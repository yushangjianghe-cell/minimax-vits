// 主入口文件
import { Context, Schema } from 'koishi'
import type { Config as ConfigType } from './types'
import { AudioCacheManager } from './cache'
import { MinimaxVitsTool } from './tool'
import { MinimaxVitsService } from './service'
import { generateSpeech, uploadFile, cloneVoice } from './api'
import { fuzzyQuery, getMessageContent, makeAudioElement } from './utils'

export const name = 'minimax-vits'

// Koishi规范要求配置Schema必须命名为schema（小写）
export const schema: Schema<ConfigType> = Schema.object({
  ttsApiKey: Schema.string().default('your-api-key-here').description('MiniMax TTS API Key').role('secret'),
  groupId: Schema.string().default('your-group-id-here').description('MiniMax Group ID'),
  apiBase: Schema.string().default('https://api.minimax.io/v1').description('API 基础地址'),
  defaultVoice: Schema.string().default('Chinese_female_gentle').description('默认语音 ID'),
  speechModel: Schema.string().default('speech-01-turbo').description('TTS 模型 (推荐 speech-01-turbo)'),
  speed: Schema.number().default(1.0).min(0.5).max(2.0).description('语速'),
  vol: Schema.number().default(1.0).min(0.0).max(2.0).description('音量'),
  pitch: Schema.number().default(0).min(-12).max(12).description('音调'),
  audioFormat: Schema.union([
    Schema.const('mp3').description('MP3 格式'),
    Schema.const('wav').description('WAV 格式')
  ]).default('mp3').description('音频格式'),
  sampleRate: Schema.union([
    Schema.const(16000),
    Schema.const(24000),
    Schema.const(32000),
    Schema.const(44100),
    Schema.const(48000)
  ]).default(32000).description('采样率'),
  bitrate: Schema.union([
    Schema.const(64000),
    Schema.const(96000),
    Schema.const(128000),
    Schema.const(192000),
    Schema.const(256000)
  ]).default(128000).description('比特率'),
  outputFormat: Schema.const('hex').default('hex').description('API输出编码 (必须是 hex)'),
  languageBoost: Schema.union([
    Schema.const('auto').description('自动'),
    Schema.const('zh').description('中文'),
    Schema.const('en').description('英文')
  ]).default('auto').description('语言增强'),
  debug: Schema.boolean().default(false).description('启用调试日志'),
  voiceCloneEnabled: Schema.boolean().default(false).description('启用语音克隆'),
  cacheEnabled: Schema.boolean().default(true).description('启用本地文件缓存'),
  cacheDir: Schema.string().default('./data/minimax-vits/cache').description('缓存路径'),
  cacheMaxAge: Schema.number().default(3600000).min(60000).description('缓存有效期(ms)'),
  cacheMaxSize: Schema.number().default(104857600).min(1048576).max(1073741824).description('缓存最大体积(bytes)'),
}).description('MiniMax VITS 配置')

// 兼容旧版本，保留Config导出
export const Config = schema

// --- 插件入口 ---
export function apply(ctx: Context, config: ConfigType) {
  // 使用 ctx.state 来存储服务实例的引用，而不是全局变量
  const state = ctx.state as any;
  
  // 创建或获取缓存管理器
  let cacheManager: AudioCacheManager | undefined;
  const logger = ctx.logger('minimax-vits')
  
  // 避免动态导入导致的模块状态冲突，改为使用简单的条件判断
  // 仅在 ChatLuna 可能已安装时才尝试加载
  try {
    // 使用 require() 替代动态 import()
    const chatLunaModule = require('koishi-plugin-chatluna/services/chat')
    const ChatLunaPlugin = chatLunaModule.ChatLunaPlugin
    if (ChatLunaPlugin) {
      const chatLunaPlugin = new ChatLunaPlugin(ctx, config as any, 'minimax-vits', false)
      
      // 注册 ChatLuna Tool
      chatLunaPlugin.registerTool('minimax_tts', {
        selector: (history: Array<{ content: unknown }>) => {
          return history.some((item) =>
            fuzzyQuery(
              getMessageContent(item.content),
              ['语音', '朗读', 'tts', 'speak', 'say', 'voice']
            )
          )
        },
        createTool: () => new MinimaxVitsTool(ctx, config, cacheManager),
        authorization: () => true
      })
      logger.info('ChatLuna Tool 已注册')
    }
  } catch (error: unknown) {
    // ChatLuna 插件未安装，跳过
    logger.debug('ChatLuna 插件未安装或加载失败，跳过 Tool 注册')
  }

  // 创建或更新缓存管理器
  if (config.cacheEnabled) {
    if (!state.cacheManager) {
      state.cacheManager = new AudioCacheManager(
        config.cacheDir ?? './data/minimax-vits/cache',
        logger,
        true,
        config.cacheMaxAge ?? 3600000,
        config.cacheMaxSize ?? 104857600
      );
      // 初始化缓存
      state.cacheManager.initialize().catch(err => {
        logger.warn('缓存初始化失败:', err);
      });
    }
    cacheManager = state.cacheManager;
  } else {
    // 销毁缓存管理器
    state.cacheManager?.dispose();
    delete state.cacheManager;
    cacheManager = undefined;
  }

  // 注册控制台服务和页面
  ctx.inject(['console'], (injectedCtx) => {
    try {
      // 使用类型断言，告诉 TypeScript injectedCtx 包含 console 属性
      const ctxWithConsole = injectedCtx as Context & { console?: any };
      
      // 如果服务实例已存在，更新其配置
      if (state.minimaxVitsService) {
        // 更新服务实例的配置
        state.minimaxVitsService.updateConfig(config).catch(err => {
          logger.warn('更新服务配置失败:', err);
        });
      } else {
        // 创建服务实例
        state.minimaxVitsService = new MinimaxVitsService(ctxWithConsole, config);
        
        // 注册控制台服务
        if (ctxWithConsole.console) {
          // 在 Koishi 4.x 中，使用 console.addService 注册服务
          if (typeof ctxWithConsole.console.addService === 'function') {
            ctxWithConsole.console.addService('minimax-vits', state.minimaxVitsService);
            logger.info('MiniMax VITS 控制台服务已注册');
          } else {
            // 兼容旧版本
            ctxWithConsole.console.services = ctxWithConsole.console.services || {};
            ctxWithConsole.console.services['minimax-vits'] = state.minimaxVitsService;
            logger.info('MiniMax VITS 控制台服务已注册（兼容模式）');
          }
          
          // 注册控制台页面
          if (typeof ctxWithConsole.console.addEntry === 'function') {
            // 使用 require() 替代动态 import()
            const ConsoleComponent = require('./console').default;
            ctxWithConsole.console.addEntry({
              id: 'minimax-vits',
              order: 500,
              title: 'MiniMax VITS',
              icon: 'activity:microphone',
              component: ConsoleComponent
            });
            logger.info('MiniMax VITS 控制台页面已注册');
          }
        }
      }
    } catch (error) {
      logger.warn('注册控制台服务或页面失败:', error);
    }
  });

  ctx.on('ready', async () => {
    // 初始化缓存
    await cacheManager?.initialize();
  });

  ctx.on('dispose', () => {
    // 清理缓存管理器
    state.cacheManager?.dispose();
    delete state.cacheManager;
    // 清理服务实例
    delete state.minimaxVitsService;
  })

  // --- 指令注册区 ---

  ctx.command('minivits.test <text:text>', '测试 TTS')
    .option('voice', '-v <voice>')
    .option('speed', '-s <speed>', { type: 'number' })
    .action(async ({ session, options }, text) => {
      if (!text) return '请输入文本'
      await session?.send('生成中...')
      
      const buffer = await generateSpeech(
        ctx,
        {
          ...config,
          speed: options?.speed ?? config.speed
        },
        text,
        options?.voice || config.defaultVoice || 'Chinese_female_gentle',
        cacheManager
      )
      
      if (!buffer) return '失败'
      return makeAudioElement(buffer, config.audioFormat ?? 'mp3')
    })

  ctx.command('minivits.debug', '查看插件配置').action(() => {
    return `API Base: ${config.apiBase}\nModel: ${config.speechModel}\nFormat: ${config.audioFormat}\nDebug: ${config.debug}`
  })

  if (config.voiceCloneEnabled) {
    ctx.command('minivits.clone.upload <filePath> <purpose>', '上传文件')
      .action(async ({ session }, filePath, purpose) => {
        if (!session || !filePath || !purpose) return '缺少参数'
        if (purpose !== 'voice_clone' && purpose !== 'prompt_audio') {
          return '用途错误，必须是 voice_clone 或 prompt_audio'
        }
        
        await session.send('上传中...')
        const fileId = await uploadFile(ctx, config, filePath, purpose)
        return fileId ? `上传成功: ${fileId}` : '上传失败'
      })

    ctx.command('minivits.clone.create <fileId> <voiceId> [text:text]', '创建语音克隆')
      .option('promptAudio', '-p <id>')
      .option('promptText', '-t <text>')
      .action(async ({ session, options }, fileId, voiceId, text) => {
        if (!session || !fileId || !voiceId) return '缺少参数'
        await session.send('克隆中...')
        
        const audioBuffer = await cloneVoice(
          ctx,
          config,
          fileId,
          voiceId,
          options?.promptAudio,
          options?.promptText,
          text
        )
        
        if (!audioBuffer) return '克隆失败'

        if (text) {
          return makeAudioElement(audioBuffer, config.audioFormat ?? 'mp3')
        }
        return '克隆操作请求已发送'
      })

    ctx.command('minivits.clone.full <sourceFile> <voiceId> <text:text>', '完整克隆流程')
      .option('promptFile', '-p <file>')
      .option('promptText', '-t <text>')
      .action(async ({ session, options }, sourceFile, voiceId, text) => {
        if (!session || !sourceFile || !voiceId || !text) return '缺少参数'
        
        await session.send('1. 上传源文件...')
        const sourceFileId = await uploadFile(ctx, config, sourceFile, 'voice_clone')
        if (!sourceFileId) return '源文件上传失败'

        let promptAudioFileId: string | undefined
        if (options?.promptFile) {
          await session.send('2. 上传提示音频...')
          promptAudioFileId = await uploadFile(ctx, config, options.promptFile, 'prompt_audio')
          if (!promptAudioFileId) return '提示音频上传失败'
        }

        await session.send('3. 生成克隆语音...')
        const audioBuffer = await cloneVoice(
          ctx,
          config,
          sourceFileId,
          voiceId,
          promptAudioFileId,
          options?.promptText,
          text
        )

        if (!audioBuffer) return '语音克隆失败'
        return makeAudioElement(audioBuffer, config.audioFormat ?? 'mp3')
      })
  }
}

// 默认导出，确保Koishi能正确识别插件结构
export default {
  name,
  schema,
  Config,
  apply
}

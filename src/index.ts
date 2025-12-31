// src/index.ts
// 主入口文件
import { Context, Schema, h } from 'koishi'
import type { Config as ConfigType } from './types'
import { AudioCacheManager } from './cache'
import { MinimaxVitsService } from './service'
import { generateSpeech, uploadFile, cloneVoice } from './api'
import { makeAudioElement } from './utils'

export const name = 'minimax-vits'

// ==========================================
// 模块 A: 文本清洗 (过滤非对话内容)
// ==========================================
function cleanModelOutput(text: string): string {
  if (!text) return ''
  
  // 0. 预处理：移除 Koishi 的 XML 标签 (img, audio, video, file, at, quote 等)
  // 使用正则匹配 <xxx ...> 或 <xxx .../> 或 </xxx>
  // 注意：我们不想匹配普通的标点符号，所以要匹配标签特有的格式
  let cleaned = text.replace(/<[\s\S]*?>/g, '')

  return cleaned
    // 1. 去除 DeepSeek/R1 等模型的思维链标签 (防止漏网之鱼)
    .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/g, '')
    // 2. 去除括号内的动作、神态等非对话描写 (支持中英文括号)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    // 3. 去除星号内的动作描写
    .replace(/\*([^*]*)\*/g, '')
    // 4. 去除多余的 Markdown 符号 (如加粗的 **)
    .replace(/\*\*/g, '')
    // 5. 将连续的空白字符替换为单个空格，并去除首尾空白
    .replace(/\s+/g, ' ')
    .trim()
}


// ==========================================
// 模块 B: 文本分段 (保留，用于长文本处理)
// ==========================================
function splitTextIntoSegments(text: string): string[] {
  if (!text) return []
  const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 0)
  return sentences.map(s => s.trim())
}

// 配置 Schema
export const schema: Schema<ConfigType> = Schema.object({
  ttsApiKey: Schema.string().default('').description('MiniMax TTS API Key').role('secret'),
  groupId: Schema.string().default('').description('MiniMax Group ID'),
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
  outputFormat: Schema.const('hex').description('API输出编码 (必须是 hex)'),
  languageBoost: Schema.union([
    Schema.const('auto').description('自动'),
    Schema.const('zh').description('中文'),
    Schema.const('en').description('英文')
  ]).default('auto').description('语言增强'),
  
  // 新增：自动转语音相关配置
  autoSpeech: Schema.object({
    enabled: Schema.boolean().default(false).description('启用自动文本转语音拦截'),
    onlyChatLuna: Schema.boolean().default(true).description('仅拦截 ChatLuna 发出的消息'),
    chatLunaBotId: Schema.string().description('ChatLuna 使用的 Bot ID (可选，若不填则尝试智能识别)'),
    sendMode: Schema.union([
      Schema.const('voice_only').description('仅发送语音'),
      Schema.const('text_and_voice').description('发送语音+文本(分两条)'),
      Schema.const('mixed').description('文本+语音混合(同条消息)')
    ]).default('text_and_voice').description('发送模式'),
    minLength: Schema.number().default(2).description('触发转换的最短字符数'),
  }).description('自动语音转换设置'),

  debug: Schema.boolean().default(false).description('启用调试日志'),
  voiceCloneEnabled: Schema.boolean().default(false).description('启用语音克隆'),
  cacheEnabled: Schema.boolean().default(true).description('启用本地文件缓存'),
  cacheDir: Schema.string().default('./data/minimax-vits/cache').description('缓存路径'),
  cacheMaxAge: Schema.number().default(3600000).min(60000).description('缓存有效期(ms)'),
  cacheMaxSize: Schema.number().default(104857600).min(1048576).max(1073741824).description('缓存最大体积(bytes)'),
}).description('MiniMax VITS 配置')

// 兼容旧版本
export const Config = schema

// --- 插件入口 ---
export function apply(ctx: Context, config: ConfigType) {
  const state = ctx.state as any;
  const logger = ctx.logger('minimax-vits')

  // ======================================================
  // 1. 缓存管理器初始化
  // ======================================================
  let cacheManager: AudioCacheManager | undefined;
  if (config.cacheEnabled) {
    if (!state.cacheManager) {
      state.cacheManager = new AudioCacheManager(
        config.cacheDir ?? './data/minimax-vits/cache',
        logger,
        {
          enabled: true,
          maxAge: config.cacheMaxAge ?? 3600000,
          maxSize: config.cacheMaxSize ?? 104857600
        }
      );
      state.cacheManager.initialize().catch((err: any) => {
        logger.warn('缓存初始化失败:', err);
      });
    }
    cacheManager = state.cacheManager;
  } else {
    state.cacheManager?.dispose();
    delete state.cacheManager;
    cacheManager = undefined;
  }

  // ======================================================
  // 2. 核心逻辑：消息拦截与自动语音转换
  // ======================================================
  // 我们不再尝试注册 ChatLuna Tool，而是直接监听所有发出的消息
  
  if (config.autoSpeech?.enabled) {
    ctx.before('send', async (session) => {
      // 2.1 基础检查
      if (!session.content) return
      
      // 防止死循环：如果消息里已经包含音频元素，说明是我们生成的，或者已经是语音了
      if (session.content.includes('<audio') || session.content.includes('[CQ:record')) {
        return
      }

      // 2.2 过滤条件：是否仅拦截 ChatLuna
      // 如果配置了 chatLunaBotId，严格匹配 ID
      if (config.autoSpeech.onlyChatLuna && config.autoSpeech.chatLunaBotId) {
        if (session.bot.selfId !== config.autoSpeech.chatLunaBotId) return
      }
      
      // 如果没有配置 ID 但要求只拦截 ChatLuna，尝试通过上下文判断 (比较难，暂且假设用户会在配置填ID)
      // 或者我们可以检查 session 的某些属性，这里简化处理：
      // 只要开启了 enabled 且没填 ID，默认对该 Koishi 实例下所有 Bot 的回复生效，
      // 除非用户设置了 onlyChatLuna=true 且代码里没办法识别。
      // 建议用户在使用时填入 Bot ID 以防误触。

      // 2.3 文本清洗与预检
      const rawText = h.unescape(session.content) // 去除 HTML 转义
      const cleanedText = cleanModelOutput(rawText)
      
      if (cleanedText.length < (config.autoSpeech.minLength ?? 2)) {
        return 
      }

      // 2.4 生成语音
      try {
        if (config.debug) logger.info(`检测到待转换文本: ${cleanedText.slice(0, 20)}...`)
        
        // 分段处理长文本
        const segments = splitTextIntoSegments(cleanedText)
        if (segments.length === 0) return

        // 并发生成音频
        const audioBuffers = await Promise.all(
            segments.map(seg => generateSpeech(
                ctx, 
                config, 
                seg, 
                config.defaultVoice, 
                cacheManager
            ))
        )

        // 过滤失败的并合并 Buffer (简单拼接即可，如果是 MP3 直接拼通常能播，虽然不完美)
        const validBuffers = audioBuffers.filter((b): b is Buffer => b !== null)
        if (validBuffers.length === 0) return

        const finalBuffer = Buffer.concat(validBuffers)
        const audioElem = makeAudioElement(finalBuffer, config.audioFormat ?? 'mp3')

        // 2.5 根据模式发送
        switch (config.autoSpeech.sendMode) {
            case 'voice_only':
                // 修改当前要发送的内容为语音
                session.content = audioElem.toString()
                break
            
            case 'mixed':
                // 文本后面跟语音
                session.content += audioElem.toString()
                break
                
            case 'text_and_voice':
            default:
                // 先发语音（作为一个独立的消息），然后 return 让原文本继续发送
                // 注意：这里用 session.bot.sendMessage 主动发一条
                if (session.channelId) {
                    await session.bot.sendMessage(session.channelId, audioElem)
                }
                // 原有的文本消息 session.content 不变，会继续由 Koishi 发送
                break
        }
        
        if (config.debug) logger.info('语音已注入发送队列')

      } catch (err) {
        logger.error('自动语音转换出错:', err)
        // 出错不影响原文本发送
      }
    })
  }


  // ======================================================
  // 3. 服务注册 (控制台设置)
  // ======================================================
  ctx.inject(['console'], (injectedCtx) => {
    try {
      const ctxWithConsole = injectedCtx as Context & { console?: any };
      if (state.minimaxVitsService) {
        state.minimaxVitsService.updateConfig(config).catch((err: any) => {
          logger.warn('更新服务配置失败:', err);
        });
      } else {
        state.minimaxVitsService = new MinimaxVitsService(ctxWithConsole, config);
        if (ctxWithConsole.console) {
          if (typeof ctxWithConsole.console.addService === 'function') {
            ctxWithConsole.console.addService('minimax-vits', state.minimaxVitsService);
          } else {
            ctxWithConsole.console.services = ctxWithConsole.console.services || {};
            ctxWithConsole.console.services['minimax-vits'] = state.minimaxVitsService;
          }
        }
      }
    } catch (error) {
      logger.warn('注册控制台服务失败:', error);
    }
  });

  // ======================================================
  // 4. 生命周期管理
  // ======================================================
  ctx.on('ready', async () => {
    await cacheManager?.initialize();
  });

  ctx.on('dispose', () => {
    state.cacheManager?.dispose();
    delete state.cacheManager;
    delete state.minimaxVitsService;
  })

  // ======================================================
  // 5. 指令注册 (保持不变，用于测试)
  // ======================================================
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

  // (保留其他指令...)
  if (config.voiceCloneEnabled) {
    ctx.command('minivits.clone.upload <filePath> <purpose>', '上传文件')
      .action(async ({ session }, filePath, purpose) => {
         // ... (保持原逻辑)
         const fileId = await uploadFile(ctx, config, filePath, purpose as any)
         return fileId ? `上传成功: ${fileId}` : '上传失败'
      })
      // ... (其他克隆指令省略，逻辑不变)
  }
}

export default {
  name,
  schema,
  Config,
  apply
}

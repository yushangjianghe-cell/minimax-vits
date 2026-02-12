// src/index.ts
// 主入口文件
import { Context, Schema, h } from 'koishi'
import type { Config as ConfigType } from './types'
import { AudioCacheManager } from './cache'
import { MinimaxVitsService } from './service'
import { generateSpeech, uploadFile, cloneVoice } from './api'
import { makeAudioElement } from './utils'
import { selectSpeechSentenceByAI } from './tool'

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

// ==========================================
// 模块 C: 使用类 OpenAI 接口让小模型决策朗读内容
// ==========================================
/**
 * 通过 OpenAI 兼容接口，让小模型从整段文本中挑选出需要朗读的内容。
 * - 返回 null / 空字符串：表示「不需要生成语音」
 * - 返回一小段文本：只对这段文本进行 TTS
 */
async function selectSpeechTextByOpenAI(
  ctx: Context,
  config: ConfigType,
  text: string,
  logger: any,
): Promise<string | null> {
  const oa = config.autoSpeech as any

  if (!oa?.openaiLikeBaseUrl || !oa?.openaiLikeApiKey || !oa?.openaiLikeModel) {
    if (config.debug) logger?.warn('未配置完整的 OpenAI 类小模型参数，跳过小模型筛选')
    return null
  }

  let baseUrl = String(oa.openaiLikeBaseUrl).replace(/\/$/, '')
  // 如果 baseUrl 已经以 /v1 结尾，则不再添加 /v1
  if (baseUrl.endsWith('/v1')) {
    baseUrl = baseUrl.slice(0, -3)
  }
  const url = `${baseUrl}/v1/chat/completions`

  try {
    const resp = await (ctx as any).http.post(url, {
      model: oa.openaiLikeModel,
      messages: [
        {
          role: 'system',
          content:
            '你是一个负责“文本转语音筛选”的助手。给你一整段聊天内容，请你只返回其中最适合朗读的一小段（可以是一句或几句），' +
            '如果整段都不适合朗读（例如是思维链、代码块、系统提示等），就返回空字符串。不要解释，不要添加任何前后缀，只返回要朗读的内容本身。',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.1,
    }, {
      headers: {
        Authorization: `Bearer ${oa.openaiLikeApiKey}`,
      },
      timeout: 15000,
    })

    const content: string | undefined =
      resp?.choices?.[0]?.message?.content?.trim()

    if (!content) {
      if (config.debug) logger?.info('小模型返回为空，视为无需朗读')
      return null
    }

    if (content.toUpperCase() === 'EMPTY' || content.toUpperCase() === 'NONE') {
      if (config.debug) logger?.info('小模型显式表示无需朗读')
      return null
    }

    return content
  } catch (error) {
    logger?.warn('调用 OpenAI 类小模型筛选语音内容失败，将退回原有策略:', error)
    return null
  }
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

    // 朗读内容选择策略
    selectorMode: Schema.union([
      Schema.const('full').description('整条文本直接转语音（默认逻辑）'),
      Schema.const('ai_sentence').description('交给 ChatLuna / 小模型从中挑选一句朗读'),
      Schema.const('openai_filter').description('通过 OpenAI 兼容接口，让小模型决定具体朗读内容'),
    ]).default('full').description('语音内容选择策略'),

    // 类 OpenAI 小模型配置（用于 openai_filter 策略）
    openaiLikeBaseUrl: Schema.string()
      .description('OpenAI 兼容接口 Base URL，例如 https://api.openai.com 或自建代理地址'),
    openaiLikeApiKey: Schema.string()
      .role('secret')
      .description('OpenAI 兼容接口 API Key'),
    openaiLikeModel: Schema.string()
      .description('用于筛选朗读内容的小模型名称，例如 gpt-4o-mini / deepseek-chat 等'),
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
      if (config.autoSpeech.onlyChatLuna && config.autoSpeech.chatLunaBotId) {
        if (session.bot.selfId !== config.autoSpeech.chatLunaBotId) return
      }

      // 2.3 文本清洗与预检
      const rawText = h.unescape(session.content) // 去除 HTML 转义
      const cleanedText = cleanModelOutput(rawText)
      
      if (cleanedText.length < (config.autoSpeech.minLength ?? 2)) {
        return 
      }

      // 2.4 使用策略选择要转换为语音的文本（整条 / AI 挑选一句）
      let targetText = cleanedText

      if (config.debug) {
        logger.info(`当前 selectorMode: ${config.autoSpeech.selectorMode}, onlyChatLuna: ${config.autoSpeech.onlyChatLuna}`)
      }

      if (config.autoSpeech.selectorMode === 'ai_sentence') {
        try {
          const aiSelected = await selectSpeechSentenceByAI(ctx, config, cleanedText, logger)
          if (aiSelected && aiSelected.length >= (config.autoSpeech.minLength ?? 2)) {
            targetText = aiSelected
            if (config.debug) logger.info(`AI 选择的语音句子: ${targetText.slice(0, 50)}...`)
          } else if (config.debug) {
            logger.info('AI 未找到合适的语音句子，使用整条文本')
          }
        } catch (error) {
          logger.warn('调用 ChatLuna 模型选择语音句子失败，将使用整条文本:', error)
        }
      } else if (config.autoSpeech.selectorMode === 'openai_filter') {
        try {
          const selected = await selectSpeechTextByOpenAI(ctx, config, cleanedText, logger)
          // 返回 null / 空字符串：视为「无需生成语音」
          if (!selected || selected.trim().length < (config.autoSpeech.minLength ?? 2)) {
            if (config.debug) logger.info('小模型判断当前消息无需生成语音，放行原文本')
            return
          }
          targetText = selected.trim()
          if (config.debug) logger.info(`小模型筛选后的朗读文本: ${targetText.slice(0, 50)}...`)
        } catch (error) {
          logger.warn('调用 OpenAI 类小模型筛选朗读内容失败，将使用整条文本:', error)
        }
      }

      // 2.5 生成语音（对 targetText 做 TTS）
      try {
        if (config.debug) logger.info(`检测到待转换文本: ${targetText.slice(0, 20)}...`)
        
        // 分段处理长文本
        const segments = splitTextIntoSegments(targetText)
        if (segments.length === 0) return

        // 并发生成音频
        const audioBuffers = await Promise.all(
          segments.map(seg =>
            generateSpeech(
              ctx,
              config,
              seg,
              config.defaultVoice,
              cacheManager
            )
          )
        )

        // 过滤失败的并合并 Buffer
        const validBuffers = audioBuffers.filter((b): b is Buffer => b !== null)
        if (validBuffers.length === 0) return

        const finalBuffer = Buffer.concat(validBuffers)
        const audioElem = makeAudioElement(finalBuffer, config.audioFormat ?? 'mp3')

        // 根据模式发送
        switch (config.autoSpeech.sendMode) {
          case 'voice_only':
            session.content = audioElem.toString()
            break
          case 'mixed':
            session.content += audioElem.toString()
            break
          case 'text_and_voice':
          default:
            if (session.channelId) {
              await session.bot.sendMessage(session.channelId, audioElem)
            }
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

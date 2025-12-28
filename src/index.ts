import { Context, Schema, h } from 'koishi'
import type { } from '@koishijs/plugin-console'
import { Tool } from '@langchain/core/tools'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { ChatLunaPlugin } from 'koishi-plugin-chatluna/services/chat'

// --- 接口定义 ---
interface ChatLunaToolRunnable {
  configurable: {
    session: any
  }
}

// --- 辅助函数 ---
function fuzzyQuery(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase()
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
}

function getMessageContent(content: any): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    return content.text || content.content || JSON.stringify(content)
  }
  return String(content)
}

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      'minimax-vits': MinimaxVitsService
    }
  }
}

function extractDialogueContent(text: string): string | null {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  let dialogueContent = ''
  let inDialogue = false

  for (const line of lines) {
    const isDialogueLine =
      line.startsWith('"') ||
      line.startsWith("'") ||
      line.includes('说：') ||
      line.match(/^[A-Za-z\u4e00-\u9fff]+[：:]/)

    const isNonDialogue =
      (line.includes('（') && line.includes('）')) ||
      (line.includes('(') && line.includes(')')) ||
      line.match(/^\s*[\[\{【（(]/)

    if (isDialogueLine && !isNonDialogue) {
      let cleanLine = line
        .replace(/^["\'"']/, '')
        .replace(/["\'"']$/, '')
        .replace(/^[A-Za-z\u4e00-\u9fff]+[：:]\s*/, '')
        .replace(/说：|说道：/g, '')
        .trim()

      if (cleanLine.length > 0) {
        dialogueContent += cleanLine + '。'
        inDialogue = true
      }
    } else if (inDialogue && line.length > 0 && !isNonDialogue) {
      dialogueContent += line + '。'
    }
  }

  if (dialogueContent.length > 0) return dialogueContent.replace(/。+/g, '。').trim()
  if (text.length <= 150 && !text.match(/[[{【（(]/)) return text
  return null
}

// --- 辅助：构建音频消息元素 (Web兼容修正) ---
function makeAudioElement(buffer: Buffer, format: string) {
  const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg'
  // 沙盒环境必须使用标准的 data: 协议
  const src = `data:${mimeType};base64,${buffer.toString('base64')}`
  return h('audio', { src })
}

// --- ChatLuna Tool 类 ---
export class MinimaxVitsTool extends Tool {
  name = 'minimax_tts'
  description = `Use this tool to generate speech/audio from text using MiniMax TTS.
  Input MUST be a JSON string: {"text": "required content", "voice": "optional_id", "speed": 1.0}`

  constructor(
    private ctx: Context,
    private config: Config,
    private cacheManager?: AudioCacheManager
  ) {
    super()
  }

  async _call(input: string, _runManager: any, toolConfig: ChatLunaToolRunnable) {
    try {
      const session = toolConfig.configurable.session
      let params: any = {}
      try {
        params = JSON.parse(input)
      } catch {
        params = { text: input }
      }
      
      let text = params.text || input
      if (typeof text === 'object') text = JSON.stringify(text)

      const voiceId = (params.voice || this.config.defaultVoice) ?? 'Chinese_female_gentle'
      const speed = params.speed ?? this.config.speed ?? 1.0
      
      const dialogueText = extractDialogueContent(text)
      if (!dialogueText) return `未检测到有效对话内容。`

      const audioBuffer = await generateSpeech(this.ctx, { 
        ...this.config, 
        speed, 
        vol: params.vol, 
        pitch: params.pitch 
      }, dialogueText, voiceId, this.cacheManager)

      if (!audioBuffer) return `TTS 生成失败。`

      await session.send(makeAudioElement(audioBuffer, this.config.audioFormat ?? 'mp3'))

      return `Audio generated and sent.`
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}

// --- Console Service ---
class MinimaxVitsService {
  constructor(private ctx: Context, private config: Config) { }
  async testTTS(text: string, voice?: string, speed?: number) {
    try {
      const audioBuffer = await generateSpeech(this.ctx, {
        ...this.config,
        speed: speed ?? 1.0
      }, text, voice || 'Chinese_female_gentle')

      if (audioBuffer) {
        return {
          success: true,
          audio: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
          size: audioBuffer.length
        }
      }
      return { success: false, error: '生成失败' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

export const name = 'minimax-vits'

export interface Config {
  ttsApiKey: string
  groupId?: string
  apiBase?: string
  defaultVoice?: string
  speechModel?: string
  speed?: number
  vol?: number
  pitch?: number
  audioFormat?: string
  sampleRate?: number
  bitrate?: number
  outputFormat?: string
  languageBoost?: string
  debug?: boolean
  voiceCloneEnabled?: boolean
  cacheEnabled?: boolean
  cacheDir?: string
  cacheMaxAge?: number
  cacheMaxSize?: number
}

export const Config: Schema<Config> = Schema.object({
  ttsApiKey: Schema.string().required().description('MiniMax TTS API Key').role('secret'),
  groupId: Schema.string().description('MiniMax Group ID'),
  apiBase: Schema.string().default('https://api.minimax.io/v1').description('API 基础地址'),
  defaultVoice: Schema.string().default('Chinese_female_gentle').description('默认语音 ID'),
  speechModel: Schema.string().default('speech-01-turbo').description('TTS 模型 (推荐 speech-01-turbo)'),
  speed: Schema.number().default(1.0).min(0.5).max(2.0).description('语速'),
  vol: Schema.number().default(1.0).description('音量'),
  pitch: Schema.number().default(0).description('音调'),
  audioFormat: Schema.string().default('mp3').description('音频格式 (mp3, wav)'),
  sampleRate: Schema.number().default(32000).description('采样率'),
  bitrate: Schema.number().default(128000).description('比特率'),
  outputFormat: Schema.string().default('hex').description('API输出编码 (必须是 hex)'),
  languageBoost: Schema.string().default('auto').description('语言增强'),
  debug: Schema.boolean().default(false).description('启用调试日志'),
  voiceCloneEnabled: Schema.boolean().default(false).description('启用语音克隆'),
  cacheEnabled: Schema.boolean().default(true).description('启用本地文件缓存'),
  cacheDir: Schema.string().default('./data/minimax-vits/cache').description('缓存路径'),
  cacheMaxAge: Schema.number().default(3600000).description('缓存有效期(ms)'),
  cacheMaxSize: Schema.number().default(104857600).description('缓存最大体积(bytes)'),
}).description('MiniMax VITS 配置')

// --- 缓存管理器 ---
class AudioCacheManager {
  constructor(
    private cacheDir: string,
    private logger: any,
    private enabled: boolean,
    private maxAge: number,
    private maxSize: number
  ) {}

  async initialize() {
    if (!this.enabled) return
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  async getAudio(text: string, voice: string, format: string): Promise<Buffer | null> {
    if (!this.enabled) return null
    try {
      const hash = crypto.createHash('md5').update(`${text}-${voice}-${format}`).digest('hex')
      const filePath = path.join(this.cacheDir, `${hash}.${format}`)
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath)
    } catch {}
    return null
  }

  async saveAudio(buffer: Buffer, text: string, voice: string, format: string) {
    if (!this.enabled || !buffer.length) return
    try {
      const hash = crypto.createHash('md5').update(`${text}-${voice}-${format}`).digest('hex')
      const filePath = path.join(this.cacheDir, `${hash}.${format}`)
      fs.writeFileSync(filePath, buffer)
    } catch (e) {
      this.logger.warn('缓存写入失败', e)
    }
  }

  dispose() {}
}

// --- 核心功能函数 ---

async function generateSpeech(
  ctx: Context,
  config: Config,
  text: string,
  voice: string,
  cacheManager?: AudioCacheManager
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  const format = config.audioFormat ?? 'mp3'

  if (cacheManager) {
    const cached = await cacheManager.getAudio(text, voice, format)
    if (cached) {
      if (config.debug) logger.debug('命中本地缓存')
      return cached
    }
  }

  try {
    const headers: any = {
      'Authorization': `Bearer ${config.ttsApiKey}`,
      'Content-Type': 'application/json',
    }
    if (config.groupId) headers['GroupId'] = config.groupId

    const payload: any = {
      model: config.speechModel ?? 'speech-01-turbo',
      text: text,
      stream: false,
      output_format: 'hex',
      voice_setting: {
        voice_id: voice,
        speed: config.speed ?? 1.0,
        vol: config.vol ?? 1.0,
        pitch: config.pitch ?? 0
      },
      audio_setting: {
        sample_rate: config.sampleRate ?? 32000,
        bitrate: config.bitrate ?? 128000,
        format: format,
        channel: 1
      }
    }

    if (config.languageBoost && config.languageBoost !== 'auto') {
      payload.language_boost = config.languageBoost
    }

    if (config.debug) logger.debug(`调用 API: ${config.apiBase}/t2a_v2`)

    const response = await ctx.http.post(`${config.apiBase}/t2a_v2`, payload, { headers, timeout: 60000 })

    if (response?.base_resp && response.base_resp.status_code !== 0) {
      logger.error(`API Error: ${response.base_resp.status_msg}`)
      return null
    }

    const audioHex = response?.data?.audio || response?.audio
    if (!audioHex) {
      logger.error('API 返回数据中未找到 audio 字段')
      return null
    }

    const audioBuffer = Buffer.from(audioHex, 'hex')
    if (audioBuffer.length === 0) return null

    if (cacheManager) {
      await cacheManager.saveAudio(audioBuffer, text, voice, format)
    }

    return audioBuffer
  } catch (error: any) {
    logger.error('TTS 调用失败:', error)
    return null
  }
}

// 找回的函数：文件上传
async function uploadFile(
  ctx: Context,
  config: Config,
  filePath: string,
  purpose: 'voice_clone' | 'prompt_audio'
): Promise<string | null> {
  const logger = ctx.logger('minimax-vits')
  try {
    const headers: any = { 'Authorization': `Bearer ${config.ttsApiKey}` }
    if (config.groupId) headers['GroupId'] = config.groupId

    const formData = new FormData()
    formData.append('file', await ctx.http.file(filePath))
    formData.append('purpose', purpose)

    const response = await ctx.http.post(`${config.apiBase}/files/upload`, formData, { headers })
    return response.file?.file_id || null
  } catch (error: any) {
    logger.error(`文件上传失败:`, error)
    return null
  }
}

// 找回的函数：语音克隆
async function cloneVoice(
  ctx: Context,
  config: Config,
  fileId: string,
  voiceId: string,
  promptAudioFileId?: string,
  promptText?: string,
  text?: string
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  try {
    // 基础克隆参数
    const payload: any = {
      file_id: fileId,
      voice_id: voiceId,
      model: config.speechModel ?? 'speech-01-turbo',
      audio_format: config.audioFormat ?? 'mp3',
    }
    // 只有提供了文本才合成语音
    if (text) payload.text = text
    
    // 复刻参数 (如果需要)
    if (promptAudioFileId && promptText) {
      payload.clone_prompt = { prompt_audio: promptAudioFileId, prompt_text: promptText }
    }

    const headers: any = {
      'Authorization': `Bearer ${config.ttsApiKey}`,
      'Content-Type': 'application/json',
    }
    if (config.groupId) headers['GroupId'] = config.groupId

    const response = await ctx.http.post(
      `${config.apiBase}/voice_clone`,
      payload,
      { headers, responseType: 'arraybuffer' }
    )
    return Buffer.from(response)
  } catch (error: any) {
    logger.error('语音克隆失败:', error)
    return null
  }
}

// --- 插件入口 ---
export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('minimax-vits')
  
  // 1. 初始化 ChatLuna
  const chatLunaPlugin = new ChatLunaPlugin(ctx, config, 'minimax-vits', false)

  // 2. 初始化缓存
  const cacheManager = config.cacheEnabled
    ? new AudioCacheManager(
        config.cacheDir ?? './data/minimax-vits/cache', 
        logger, 
        true, 
        config.cacheMaxAge ?? 3600000, 
        config.cacheMaxSize ?? 104857600
      )
    : undefined

  ctx.on('ready', async () => {
    await cacheManager?.initialize()
    if (ctx.console) {
      ctx.console.services['minimax-vits'] = new MinimaxVitsService(ctx, config)
    }

    try {
      chatLunaPlugin.registerTool('minimax_tts', {
        selector: (history: any) => history.some((item: any) => fuzzyQuery(
          getMessageContent(item.content),
          ['语音', '朗读', 'tts', 'speak', 'say', 'voice']
        )),
        createTool: () => new MinimaxVitsTool(ctx, config, cacheManager),
        authorization: () => true
      })
      logger.info('ChatLuna Tool 已注册')
    } catch (e: any) {
      logger.warn('ChatLuna Tool 注册失败', e.message)
    }
  })

  ctx.on('dispose', () => cacheManager?.dispose())

  // --- 指令注册区 ---

  // 1. 常规测试指令
  ctx.command('minivits.test <text:text>', '测试 TTS')
    .option('voice', '-v <voice>')
    .option('speed', '-s <speed>', { type: 'number' })
    .action(async ({ session, options }, text) => {
      if (!text) return '请输入文本'
      await session?.send('生成中...')
      
      const buffer = await generateSpeech(ctx, { 
        ...config, 
        speed: options?.speed ?? config.speed 
      }, text, options?.voice || config.defaultVoice || 'Chinese_female_gentle', cacheManager)
      
      if (!buffer) return '失败'
      return makeAudioElement(buffer, config.audioFormat ?? 'mp3')
    })

  // 2. 找回的 Debug 指令
  ctx.command('minivits.debug', '查看插件配置').action(() => {
    return `API Base: ${config.apiBase}\nModel: ${config.speechModel}\nFormat: ${config.audioFormat}\nDebug: ${config.debug}`
  })

  // 3. 找回的语音克隆指令集
  if (config.voiceCloneEnabled) {
    ctx.command('minivits.clone.upload <filePath> <purpose>', '上传文件')
      .action(async ({ session }, filePath, purpose) => {
        if (!session || !filePath || !purpose) return '缺少参数'
        if (purpose !== 'voice_clone' && purpose !== 'prompt_audio') return '用途错误 (valid: voice_clone, prompt_audio)'
        
        await session.send('上传中...')
        const fileId = await uploadFile(ctx, config, filePath, purpose)
        return fileId ? `上传成功: ${fileId}` : '上传失败'
      })

    ctx.command('minivits.clone.create <fileId> <voiceId> [text:text]', '创建语音克隆')
      .option('promptAudio', '-p <id>')
      .option('promptText', '-t <text>')
      .action(async ({ session, options }, fileId, voiceId, text) => {
        if (!session || !fileId || !voiceId) return '缺少参数: fileId 和 voiceId 必填'
        await session.send('克隆中...')
        
        const audioBuffer = await cloneVoice(ctx, config, fileId, voiceId, options?.promptAudio, options?.promptText, text)
        if (!audioBuffer) return '克隆失败'

        // 如果提供了文本，说明是一次合成请求，返回音频；否则可能只是注册克隆
        if (text) {
          return makeAudioElement(audioBuffer, config.audioFormat ?? 'mp3')
        }
        return '克隆操作请求已发送'
      })

    ctx.command('minivits.clone.full <sourceFile> <voiceId> <text:text>', '完整克隆流程(上传+合成)')
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
        const audioBuffer = await cloneVoice(ctx, config, sourceFileId, voiceId, promptAudioFileId, options?.promptText, text)

        if (!audioBuffer) return '语音克隆失败'
        return makeAudioElement(audioBuffer, config.audioFormat ?? 'mp3')
      })
  }
}

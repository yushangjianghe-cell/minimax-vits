import { Context, Schema, h } from 'koishi'

export const name = 'minimax-vits'

export interface Config {
  ttsApiKey: string
  apiBase?: string
  defaultVoice?: string
  speechModel?: string
  speed?: number
  vol?: number
  pitch?: number
  audioFormat?: string
  debug?: boolean
}

export const Config: Schema<Config> = Schema.object({
  ttsApiKey: Schema.string().required().description('MiniMax TTS API Key').role('secret'),
  apiBase: Schema.string().default('https://api.minimaxi.com/v1').description('API 基础地址'),
  defaultVoice: Schema.string().default('Chinese_female_gentle').description('默认语音 ID'),
  speechModel: Schema.string().default('speech-2.6-hd').description('TTS 模型名称 (speech-2.6-hd, speech-2.6-turbo, speech-02-hd, speech-02-turbo)'),
  speed: Schema.number().default(1.0).min(0.5).max(2.0).description('语速 (0.5-2.0)'),
  vol: Schema.number().default(1.0).min(0.1).max(10.0).description('音量 (0.1-10.0)'),
  pitch: Schema.number().default(0).min(-12).max(12).description('音调 (-12 到 12)'),
  audioFormat: Schema.string().default('mp3').description('音频格式 (mp3, pcm, flac, wav)'),
  debug: Schema.boolean().default(false).description('启用调试模式（输出详细日志）'),
}).description('MiniMax VITS 配置')

async function generateSpeech(
  ctx: Context,
  config: Config,
  text: string,
  voice?: string
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  const apiBase = config.apiBase || 'https://api.minimaxi.com/v1'
  const model = config.speechModel || 'speech-2.6-hd'
  const voiceId = voice || config.defaultVoice || 'Chinese_female_gentle'

  if (config.debug) {
    logger.debug(`调用 TTS API: ${apiBase}/text_to_speech`)
    logger.debug(`参数: model=${model}, voice=${voiceId}, text=${text.substring(0, 50)}...`)
  }

  try {
    const response = await ctx.http.post(
      `${apiBase}/text_to_speech`,
      {
        model,
        voice_id: voiceId,
        text,
        speed: config.speed || 1.0,
        vol: config.vol || 1.0,
        pitch: config.pitch || 0,
        audio_format: config.audioFormat || 'mp3',
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ttsApiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    ) as ArrayBuffer

    if (config.debug) {
      logger.debug('TTS API 调用成功')
    }

    return Buffer.from(response)
  } catch (error: any) {
    logger.error('TTS API 调用失败:', error)
    if (config.debug) {
      logger.error('错误详情:', error.response?.data || error.message)
    }
    return null
  }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('minimax-vits')
  
  logger.info('MiniMax VITS 插件已加载')
  
  if (config.debug) {
    logger.info('调试模式已启用')
    logger.debug(`TTS API Key: ${config.ttsApiKey ? '已配置' : '未配置'}`)
    logger.debug(`API Base: ${config.apiBase || 'https://api.minimaxi.com/v1'}`)
    logger.debug(`默认语音: ${config.defaultVoice || 'Chinese_female_gentle'}`)
    logger.debug(`TTS 模型: ${config.speechModel || 'speech-2.6-hd'}`)
  } else {
    logger.info(`TTS API Key: ${config.ttsApiKey ? '已配置' : '未配置'}`)
  }

  ctx.command('minivits.test <text:text>', '测试 MiniMax TTS 功能')
    .option('voice', '-v <voice>', { fallback: '' })
    .option('speed', '-s <speed>', { fallback: 0 })
    .option('vol', '-l <vol>', { fallback: 0 })
    .option('pitch', '-p <pitch>', { fallback: 0 })
    .action(async ({ session, options }, text) => {
      if (!session) {
        return '会话不存在'
      }

      if (!text) {
        return '请提供要测试的文本内容。\n用法: minivits.test <文本内容> [-v <语音ID>] [-s <语速>] [-l <音量>] [-p <音调>]'
      }

      const logger = ctx.logger('minimax-vits')
      const voiceId = options?.voice || config.defaultVoice || 'Chinese_female_gentle'
      const speed = options?.speed || config.speed || 1.0
      const vol = options?.vol || config.vol || 1.0
      const pitch = options?.pitch || config.pitch || 0
      
      if (config.debug) {
        logger.debug(`收到测试请求: text=${text}, voice=${voiceId}, speed=${speed}, vol=${vol}, pitch=${pitch}`)
      }

      await session.send('正在生成语音，请稍候...')

      const audioBuffer = await generateSpeech(ctx, { ...config, speed, vol, pitch }, text, voiceId)

      if (!audioBuffer) {
        return '语音生成失败，请检查配置和网络连接'
      }

      if (config.debug) {
        logger.debug(`语音生成成功，大小: ${audioBuffer.length} bytes`)
      }

      const mimeType = config.audioFormat === 'mp3' ? 'audio/mpeg' : 
                       config.audioFormat === 'wav' ? 'audio/wav' :
                       config.audioFormat === 'flac' ? 'audio/flac' : 'audio/pcm'

      return h('audio', { src: `base64://${audioBuffer.toString('base64')}`, type: mimeType })
    })

  ctx.command('minivits.debug', '查看 MiniMax VITS 插件调试信息')
    .action(() => {
      const info = [
        '=== MiniMax VITS 插件调试信息 ===',
        `TTS API Key: ${config.ttsApiKey ? '已配置' : '未配置'}`,
        `API Base: ${config.apiBase || 'https://api.minimaxi.com/v1'}`,
        `默认语音: ${config.defaultVoice || 'Chinese_female_gentle'}`,
        `TTS 模型: ${config.speechModel || 'speech-2.6-hd'}`,
        `语速: ${config.speed || 1.0}`,
        `音量: ${config.vol || 1.0}`,
        `音调: ${config.pitch || 0}`,
        `音频格式: ${config.audioFormat || 'mp3'}`,
        `调试模式: ${config.debug ? '已启用' : '已禁用'}`,
        '==============================',
      ].filter(Boolean).join('\n')
      
      return info
    })
}

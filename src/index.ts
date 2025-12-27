import { Context, Schema, h } from 'koishi'

export const name = 'minimax-vits'

export interface Config {
  apiKey: string
  groupId: string
  apiBase?: string
  model?: string
  temperature?: number
  maxTokens?: number
  ttsEnabled?: boolean
  ttsApiKey?: string
  defaultVoice?: string
  speechModel?: string
  debug?: boolean
}

export const Config: Schema<Config> = Schema.object({
  apiKey: Schema.string().required().description('MiniMax API Key').role('secret'),
  groupId: Schema.string().required().description('MiniMax Group ID'),
  apiBase: Schema.string().default('https://api.minimaxi.com/v1').description('API 基础地址'),
  model: Schema.string().default('abab6.5s-chat').description('使用的模型名称'),
  temperature: Schema.number().default(0.7).min(0).max(2).description('温度参数 (0-2)'),
  maxTokens: Schema.number().default(2048).min(1).max(4096).description('最大 token 数'),
  ttsEnabled: Schema.boolean().default(false).description('是否启用 TTS 功能'),
  ttsApiKey: Schema.string().description('TTS API Key（如果与主 API Key 不同）').role('secret'),
  defaultVoice: Schema.string().default('Chinese_female_gentle').description('默认语音 ID'),
  speechModel: Schema.string().default('speech-2.6').description('TTS 模型名称'),
  debug: Schema.boolean().default(false).description('启用调试模式（输出详细日志）'),
}).description('MiniMax VITS 配置')

/**
 * 调用 MiniMax TTS API 生成语音
 */
async function generateSpeech(
  ctx: Context,
  config: Config,
  text: string,
  voice?: string
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  const apiKey = config.ttsApiKey || config.apiKey
  const apiBase = config.apiBase || 'https://api.minimaxi.com/v1'
  const model = config.speechModel || 'speech-2.6'
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
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
    logger.debug(`API Key: ${config.apiKey ? '已配置' : '未配置'}`)
    logger.debug(`Group ID: ${config.groupId || '未配置'}`)
    logger.debug(`API Base: ${config.apiBase || 'https://api.minimaxi.com/v1'}`)
    logger.debug(`TTS Enabled: ${config.ttsEnabled || false}`)
  } else {
    logger.info(`API Key: ${config.apiKey ? '已配置' : '未配置'}`)
    logger.info(`Group ID: ${config.groupId || '未配置'}`)
  }
  
  if (config.ttsEnabled) {
    logger.info('TTS 功能已启用')
  }

  // 注册测试指令
  ctx.command('minivits.test <text:text>', '测试 MiniMax TTS 功能')
    .option('voice', '-v <voice>', { fallback: config.defaultVoice || 'Chinese_female_gentle' })
    .action(async ({ session, options }, text) => {
      if (!session) {
        return '会话不存在'
      }

      if (!text) {
        return '请提供要测试的文本内容。\n用法: minivits.test <文本内容> [-v <语音ID>]'
      }

      if (!config.ttsEnabled) {
        return 'TTS 功能未启用，请在配置中设置 ttsEnabled: true'
      }

      const logger = ctx.logger('minimax-vits')
      const voiceId = options?.voice || config.defaultVoice || 'Chinese_female_gentle'
      
      if (config.debug) {
        logger.debug(`收到测试请求: text=${text}, voice=${voiceId}`)
      }

      await session.send('正在生成语音，请稍候...')

      const audioBuffer = await generateSpeech(ctx, config, text, voiceId)

      if (!audioBuffer) {
        return '语音生成失败，请检查配置和网络连接'
      }

      if (config.debug) {
        logger.debug(`语音生成成功，大小: ${audioBuffer.length} bytes`)
      }

      // 发送语音文件（使用 base64 编码）
      return h('audio', { src: `base64://${audioBuffer.toString('base64')}`, type: 'audio/mpeg' })
    })

  // 注册调试信息查看指令
  ctx.command('minivits.debug', '查看 MiniMax VITS 插件调试信息')
    .action(() => {
      const info = [
        '=== MiniMax VITS 插件调试信息 ===',
        `API Key: ${config.apiKey ? '已配置' : '未配置'}`,
        `Group ID: ${config.groupId || '未配置'}`,
        `API Base: ${config.apiBase || 'https://api.minimaxi.com/v1'}`,
        `模型: ${config.model || 'abab6.5s-chat'}`,
        `TTS 功能: ${config.ttsEnabled ? '已启用' : '已禁用'}`,
        `调试模式: ${config.debug ? '已启用' : '已禁用'}`,
        config.ttsEnabled ? `默认语音: ${config.defaultVoice || 'Chinese_female_gentle'}` : '',
        config.ttsEnabled ? `TTS 模型: ${config.speechModel || 'speech-2.6'}` : '',
        '==============================',
      ].filter(Boolean).join('\n')
      
      return info
    })
}

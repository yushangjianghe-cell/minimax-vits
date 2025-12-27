import { Context, Schema } from 'koishi'

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
}).description('MiniMax VITS 配置')

export function apply(ctx: Context, config: Config) {
  ctx.logger('minimax-vits').info('MiniMax VITS 插件已加载')
  ctx.logger('minimax-vits').info(`API Key: ${config.apiKey ? '已配置' : '未配置'}`)
  ctx.logger('minimax-vits').info(`Group ID: ${config.groupId || '未配置'}`)
  
  if (config.ttsEnabled) {
    ctx.logger('minimax-vits').info('TTS 功能已启用')
  }
}

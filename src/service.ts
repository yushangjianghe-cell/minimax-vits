// src/service.ts
import { Context, Service } from 'koishi'
import { Config } from './types'

export class MinimaxVitsService extends Service {
  // 修复：必须声明为 public，以匹配 Koishi Service 基类的定义
  constructor(ctx: Context, public config: Config) {
    super(ctx, 'minimax-vits')
  }

  // 更新配置
  async updateConfig(config: Config) {
    this.config = config
  }

  // 获取当前配置的摘要（用于前端显示等）
  getConfigSummary() {
    return {
      apiBase: this.config.apiBase,
      model: this.config.speechModel,
      voice: this.config.defaultVoice,
      hasKey: !!this.config.ttsApiKey,
      params: {
        speed: this.config.speed,
        vol: this.config.vol,
        pitch: this.config.pitch ?? 0,
        sampleRate: this.config.sampleRate ?? 32000,
        bitrate: this.config.bitrate ?? 128000,
        format: this.config.audioFormat ?? 'mp3'
      }
    }
  }
}

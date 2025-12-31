// 控制台服务
import type { Context } from 'koishi'
import type { Config } from './types'
import { generateSpeech } from './api'

export class MinimaxVitsService {
  constructor(
    private ctx: Context,
    private config: Config
  ) {}
  
  // 获取当前配置
  getConfig(): Config {
    // 返回完整配置对象，确保所有字段都有值（包括默认值）
    // 这样即使配置为空，控制台也能正确读取所有配置项
    return {
      ttsApiKey: this.config.ttsApiKey ?? '',
      groupId: this.config.groupId ?? '',
      apiBase: this.config.apiBase ?? 'https://api.minimax.io/v1',
      defaultVoice: this.config.defaultVoice ?? 'Chinese_female_gentle',
      speechModel: this.config.speechModel ?? 'speech-01-turbo',
      speed: this.config.speed ?? 1.0,
      vol: this.config.vol ?? 1.0,
      pitch: this.config.pitch ?? 0,
      audioFormat: this.config.audioFormat ?? 'mp3',
      sampleRate: this.config.sampleRate ?? 32000,
      bitrate: this.config.bitrate ?? 128000,
      outputFormat: this.config.outputFormat ?? 'hex',
      languageBoost: this.config.languageBoost ?? 'auto',
      debug: this.config.debug ?? false,
      voiceCloneEnabled: this.config.voiceCloneEnabled ?? false,
      cacheEnabled: this.config.cacheEnabled ?? true,
      cacheDir: this.config.cacheDir ?? './data/minimax-vits/cache',
      cacheMaxAge: this.config.cacheMaxAge ?? 3600000,
      cacheMaxSize: this.config.cacheMaxSize ?? 104857600,
    };
  }
  
  // 更新配置（保存到内存）
  async updateConfig(newConfig: Partial<Config> | Config): Promise<Config> {
    // 合并新配置
    // 如果 newConfig 是完整配置对象（包含 ttsApiKey），则直接使用
    // 否则，将其与当前配置合并
    const isFullConfig = 'ttsApiKey' in newConfig;
    const updatedConfig = isFullConfig 
      ? newConfig as Config 
      : { ...this.getConfig(), ...newConfig };
    
    // 更新本地配置引用（确保立即生效）
    Object.assign(this.config, updatedConfig);
    
    return this.getConfig();
  }
  
  // 测试TTS
  async testTTS(text: string, voice?: string, speed?: number) {
    try {
      const config = this.getConfig();
      const audioBuffer = await generateSpeech(
        this.ctx,
        {
          ...config,
          speed: speed ?? config.speed ?? 1.0
        },
        text,
        voice || config.defaultVoice || 'Chinese_female_gentle'
      );

      if (audioBuffer) {
        return {
          success: true,
          audio: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
          size: audioBuffer.length
        };
      }
      return { success: false, error: '生成失败' };
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }
  
  // 获取可用语音列表
  getAvailableVoices() {
    return [
      'Chinese_female_gentle',
      'Chinese_female_vitality',
      'Chinese_male_calm',
      'Chinese_male_young',
      'English_female_casual',
      'English_male_professional'
    ];
  }
  
  // 验证API Key
  async validateApiKey(apiKey: string) {
    try {
      // 简单验证，检查API Key格式
      if (!apiKey || apiKey.length < 10) {
        return { valid: false, message: 'API Key格式无效' };
      }
      
      // 可以添加更复杂的验证，例如调用API检查
      return { valid: true, message: 'API Key格式有效' };
    } catch (error: any) {
      return { valid: false, message: error.message || String(error) };
    }
  }
}



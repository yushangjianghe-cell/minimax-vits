// src/types.ts
export interface Config {
  // 基础配置
  ttsApiKey: string
  groupId: string
  apiBase: string
  defaultVoice: string
  speechModel: string
  
  // 音频参数
  speed: number
  vol: number
  pitch: number
  audioFormat: 'mp3' | 'wav'
  sampleRate: 16000 | 24000 | 32000 | 44100 | 48000
  bitrate: 64000 | 96000 | 128000 | 192000 | 256000
  outputFormat: 'hex'
  languageBoost: 'auto' | 'zh' | 'en'

  // 新增：自动语音配置
  autoSpeech: {
    enabled: boolean
    sendMode: 'voice_only' | 'text_and_voice' | 'mixed'
    minLength: number
    selectorMode: 'full' | 'ai_sentence' | 'openai_filter'
    openaiLikeBaseUrl?: string
    openaiLikeApiKey?: string
    openaiLikeModel?: string
    customPrompt?: string
  }

  // 功能开关
  debug: boolean
  
  // 缓存配置
  cacheEnabled: boolean
  cacheDir: string
  cacheMaxAge: number
  cacheMaxSize: number
}

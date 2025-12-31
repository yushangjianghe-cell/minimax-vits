// 类型定义文件
import type { Context } from 'koishi'
import type { Session } from 'koishi'

export interface Config {
  ttsApiKey?: string // 允许空值，使插件可以在没有API Key的情况下加载
  groupId?: string
  apiBase?: string
  defaultVoice?: string
  speechModel?: string
  speed?: number
  vol?: number
  pitch?: number
  audioFormat?: 'mp3' | 'wav'
  sampleRate?: 16000 | 24000 | 32000 | 44100 | 48000
  bitrate?: 64000 | 96000 | 128000 | 192000 | 256000
  outputFormat?: 'hex'
  languageBoost?: 'auto' | 'zh' | 'en'
  debug?: boolean
  voiceCloneEnabled?: boolean
  cacheEnabled?: boolean
  cacheDir?: string
  cacheMaxAge?: number
  cacheMaxSize?: number
}

export interface ChatLunaToolRunnable {
  configurable: {
    session: Session
  }
}

export interface ToolInput {
  text: string
  voice?: string
  speed?: number
  vol?: number
  pitch?: number
}

export interface ApiResponse {
  base_resp?: {
    status_code: number
    status_msg?: string
  }
  data?: {
    audio?: string
  }
  audio?: string
}

export interface UploadResponse {
  file?: {
    file_id: string
  }
}

export interface Logger {
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}



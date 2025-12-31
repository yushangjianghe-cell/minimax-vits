// src/api.ts
import { Context } from 'koishi'
import { Config } from './types'
import { AudioCacheManager } from './cache'

export async function generateSpeech(
  ctx: Context,
  config: Config,
  text: string,
  voiceId: string,
  cacheManager?: AudioCacheManager
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')

  // 1. 尝试读取缓存
  if (cacheManager) {
    // 构造缓存参数标识
    const cacheParams = {
      speed: config.speed,
      vol: config.vol,
      pitch: config.pitch,
      format: config.audioFormat
    }
    
    const cached = await cacheManager.getAudio(text, voiceId, cacheParams)
    if (cached) {
      if (config.debug) logger.info('命中本地缓存')
      return cached
    }
  }

  // 2. 调用 API
  try {
    if (!config.ttsApiKey) {
      logger.error('未配置 ttsApiKey')
      return null
    }

    const payload = {
      model: config.speechModel,
      text: text,
      voice_setting: {
        voice_id: voiceId,
        speed: config.speed ?? 1.0,
        vol: config.vol ?? 1.0,
        pitch: config.pitch ?? 0
      },
      audio_setting: {
        sample_rate: config.sampleRate ?? 32000,
        bitrate: config.bitrate ?? 128000,
        format: config.audioFormat ?? 'mp3',
        channel: 1
      },
      language_boost: 'auto' // 默认值
    }

    // 处理 languageBoost
    if (config.languageBoost && config.languageBoost !== 'auto') {
      // @ts-ignore - 动态添加属性
      payload.language_boost = config.languageBoost
    }

    if (config.debug) {
      logger.info(`请求 API: ${config.apiBase}/text_to_speech`)
    }

    const response = await ctx.http.post(
      `${config.apiBase}/text_to_speech`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.ttsApiKey}`,
          'Content-Type': 'application/json',
          'Tts-Group-Id': config.groupId || ''
        },
        responseType: 'arraybuffer'
      }
    )

    const audioBuffer = Buffer.from(response)

    // 3. 写入缓存
    if (cacheManager && audioBuffer.length > 0) {
       const cacheParams = {
        speed: config.speed,
        vol: config.vol,
        pitch: config.pitch,
        format: config.audioFormat
      }
      // 修正：参数顺序调整为 (text, voiceId, params, buffer)
      await cacheManager.saveAudio(text, voiceId, cacheParams, audioBuffer)
    }

    return audioBuffer

  } catch (error) {
    logger.error('TTS 生成失败:', error)
    return null
  }
}

export async function uploadFile(
  ctx: Context, 
  config: Config, 
  filePath: string, 
  purpose: 'voice_clone' | 'prompt_audio'
): Promise<string | null> {
  // 简化的占位实现，确保编译通过
  return null
}

export async function cloneVoice(
  ctx: Context,
  config: Config,
  fileId: string,
  voiceId: string,
  promptAudioId?: string,
  promptText?: string,
  text?: string
): Promise<Buffer | null> {
    // 简化的占位实现，确保编译通过
    return null
}

// API 调用函数
import type { Context } from 'koishi'
import type { Config, ApiResponse, UploadResponse } from './types'
import { AudioCacheManager } from './cache'

/**
 * 生成语音
 */
export async function generateSpeech(
  ctx: Context,
  config: Config,
  text: string,
  voice: string,
  cacheManager?: AudioCacheManager
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  const format = config.audioFormat ?? 'mp3'

  // 检查缓存
  if (cacheManager) {
    const cached = await cacheManager.getAudio(text, voice, format)
    if (cached) {
      if (config.debug) {
        logger.debug('命中本地缓存')
      }
      return cached
    }
  }

  // 检查 API Key
  if (!config.ttsApiKey) {
    logger.error('未配置 API Key')
    return null
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.ttsApiKey}`,
      'Content-Type': 'application/json',
    }
    if (config.groupId) {
      headers['GroupId'] = config.groupId
    }

    const payload: Record<string, unknown> = {
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

    if (config.debug) {
      logger.debug(`调用 API: ${config.apiBase}/t2a_v2`)
    }

    const response = await ctx.http.post<ApiResponse>(
      `${config.apiBase}/t2a_v2`,
      payload,
      { headers, timeout: 60000 }
    )

    if (response?.base_resp && response.base_resp.status_code !== 0) {
      logger.error(`API Error: ${response.base_resp.status_msg || 'Unknown error'}`)
      return null
    }

    const audioHex = response?.data?.audio || response?.audio
    if (!audioHex) {
      logger.error('API 返回数据中未找到 audio 字段')
      return null
    }

    const audioBuffer = Buffer.from(audioHex, 'hex')
    if (audioBuffer.length === 0) {
      logger.warn('音频数据为空')
      return null
    }

    // 保存到缓存
    if (cacheManager) {
      await cacheManager.saveAudio(audioBuffer, text, voice, format)
    }

    return audioBuffer
  } catch (error: any) {
    logger.error('TTS 调用失败:', error.message || error)
    if (config.debug) {
      logger.debug('错误详情:', error)
    }
    return null
  }
}

/**
 * 上传文件
 */
export async function uploadFile(
  ctx: Context,
  config: Config,
  filePath: string,
  purpose: 'voice_clone' | 'prompt_audio'
): Promise<string | undefined> {
  const logger = ctx.logger('minimax-vits')
  
  // 检查 API Key
  if (!config.ttsApiKey) {
    logger.error('未配置 API Key')
    return undefined
  }
  
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.ttsApiKey}`
    }
    if (config.groupId) {
      headers['GroupId'] = config.groupId
    }

    // 使用 Koishi HTTP 客户端的文件上传功能，它会自动处理 FormData
    const response = await ctx.http.post<UploadResponse>(
      `${config.apiBase}/files/upload`,
      {
        file: await ctx.http.file(filePath),
        purpose: purpose
      },
      { 
        headers
      }
    )
    
    return response.file?.file_id
  } catch (error: any) {
    logger.error(`文件上传失败:`, error.message || error)
    if (config.debug) {
      logger.debug('错误详情:', error)
    }
    return undefined
  }
}

/**
 * 语音克隆
 */
export async function cloneVoice(
  ctx: Context,
  config: Config,
  fileId: string,
  voiceId: string,
  promptAudioFileId?: string,
  promptText?: string,
  text?: string
): Promise<Buffer | null> {
  const logger = ctx.logger('minimax-vits')
  
  // 检查 API Key
  if (!config.ttsApiKey) {
    logger.error('未配置 API Key')
    return null
  }
  
  try {
    const payload: Record<string, unknown> = {
      file_id: fileId,
      voice_id: voiceId,
      model: config.speechModel ?? 'speech-01-turbo',
      audio_format: config.audioFormat ?? 'mp3',
    }
    if (text) {
      payload.text = text
    }
    
    if (promptAudioFileId && promptText) {
      payload.clone_prompt = {
        prompt_audio: promptAudioFileId,
        prompt_text: promptText
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.ttsApiKey}`,
      'Content-Type': 'application/json',
    }
    if (config.groupId) {
      headers['GroupId'] = config.groupId
    }

    const response = await ctx.http.post<ArrayBuffer>(
      `${config.apiBase}/voice_clone`,
      payload,
      { headers, responseType: 'arraybuffer' }
    )
    
    return Buffer.from(response)
  } catch (error: any) {
    logger.error('语音克隆失败:', error.message || error)
    if (config.debug) {
      logger.debug('错误详情:', error)
    }
    return null
  }
}



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

  // 强制打印调用信息，便于排查为何无输出或无调用
  try {
    logger.info(`generateSpeech called — textLength=${text?.length ?? 0}, voiceId=${voiceId}`)
  } catch (e) {
    // ignore
  }

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

    const payload: any = {
      model: config.speechModel,
      text: text,
      stream: false, // 必填：非流式响应
      output_format: 'hex', // 必填：hex 格式输出
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
      }
    }

    // 仅在配置明确设置时添加 language_boost
    if (config.languageBoost && config.languageBoost !== 'auto') {
      payload.language_boost = config.languageBoost
    }

    if (config.debug) {
      logger.info(`请求 API: ${config.apiBase}/text_to_speech`)
    }

    // 显式打印请求负载与头（使用 info 级别以确保可见），便于调试参数缺失问题
    try {
      logger.info('TTS 请求 payload:', JSON.stringify(payload))
    } catch (e) {
      logger.info('TTS 请求 payload (unserializable)')
    }
    logger.info('TTS 请求 headers:', {
      Authorization: `Bearer ${config.ttsApiKey}`,
      'Content-Type': 'application/json',
      'Tts-Group-Id': config.groupId || ''
    })

    const response = await ctx.http.post(
      `${config.apiBase}/t2a_v2`,
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

    // 响应可能是：
    // 1. 直接的 MP3 二进制 (responseType: arraybuffer)
    // 2. 或 JSON 响应包含 hex 编码的音频 (当返回类型被解析为 JSON 时)
    
    let audioData: Buffer | null = null
    
    // 尝试将响应作为 JSON 解析（如果 API 返回了 JSON 格式）
    try {
      const responseBuffer = Buffer.isBuffer(response) ? response : Buffer.from(response)
      const responseText = responseBuffer.toString('utf8').trim()
      
      // 检查是否以 { 或 [ 开头，可能是 JSON
      if (responseText.startsWith('{') || responseText.startsWith('[')) {
        const obj = JSON.parse(responseText)
        
        // 检查是否是错误响应
        if (obj.base_resp && obj.base_resp.status_code && obj.base_resp.status_code !== 0) {
          logger.error('TTS API 错误:', obj.base_resp.status_msg || obj.base_resp.status_code)
          return null
        }
        
        // 检查是否是成功的 hex 编码音频响应
        if (obj.data && obj.data.audio && typeof obj.data.audio === 'string') {
          // 将 hex 字符串转换为 Buffer
          audioData = Buffer.from(obj.data.audio, 'hex')
          if (config.debug) {
            logger.info(`从 JSON hex 响应解析音频，大小: ${audioData.length} 字节`)
          }
        } else {
          // 其他 JSON 响应格式，记录但不处理
          logger.warn('意外的 API 响应格式:', JSON.stringify(obj).slice(0, 200))
          return null
        }
      } else {
        // 直接的二进制数据（MP3）
        audioData = responseBuffer
        if (config.debug) {
          logger.info(`获取二进制音频，大小: ${audioData.length} 字节`)
        }
      }
    } catch (parseError) {
      // 不是 JSON，当作二进制数据处理
      const responseBuffer = Buffer.isBuffer(response) ? response : Buffer.from(response)
      audioData = responseBuffer
      if (config.debug) {
        logger.info(`音频数据处理为二进制，大小: ${audioData.length} 字节`)
      }
    }
    
    if (!audioData || audioData.length === 0) {
      logger.error('无效的音频数据')
      return null
    }
    
    const audioBuffer = audioData

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

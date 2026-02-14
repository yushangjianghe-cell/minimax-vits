import { Context, Schema, h } from 'koishi'
import type { Config as ConfigType } from './types'
import { AudioCacheManager } from './cache'
import { MinimaxVitsService } from './service'
import { generateSpeech, uploadFile, cloneVoice } from './api'
import { makeAudioElement } from './utils'

const CHATLUNA_TIMEOUT = 10000
const MAX_RETRIES = 2
const RETRY_DELAY = 1000

export class MinimaxVitsTool {
  constructor(protected ctx: Context, protected config: ConfigType) {}

  async call(input: string, toolConfig?: any): Promise<string> {
    return ''
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function selectSpeechSentenceByAI(
  ctx: Context,
  config: ConfigType,
  text: string,
  logger: any
): Promise<string | null> {
  const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 0)
  
  if (sentences.length <= 1) {
    if (config.debug) logger?.info('文本只有一个句子，跳过 AI 筛选')
    return null
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const chatluna = (ctx as any).chatluna
      if (!chatluna) {
        if (config.debug) logger?.info('ChatLuna 服务未找到')
        return null
      }

      const prompt = `从以下文本中选出一句最适合语音朗读的内容。只返回选中的句子，不要添加任何解释、标点和空格：

${text}

选出的句子：`

      const chatOptions: any = {
        timeout: CHATLUNA_TIMEOUT
      }
      
      let response: any
      if (typeof chatluna.chat === 'function') {
        response = await chatluna.chat(prompt, chatOptions)
      } else if (typeof chatluna.complete === 'function') {
        response = await chatluna.complete(prompt, chatOptions)
      } else if (typeof chatluna.generate === 'function') {
        response = await chatluna.generate(prompt, chatOptions)
      } else {
        if (config.debug) logger?.warn('ChatLuna 未找到可用的调用方法')
        return null
      }

      let selected = ''
      if (typeof response === 'string') {
        selected = response.trim()
      } else if (response?.content) {
        selected = response.content.trim()
      } else if (response?.text) {
        selected = response.text.trim()
      } else if (response?.choices?.[0]?.message?.content) {
        selected = response.choices[0].message.content.trim()
      }

      if (!selected || selected.length < (config.autoSpeech?.minLength ?? 2)) {
        return null
      }

      const cleanedSelected = selected.replace(/^[。！？.!?\s]+|[。！？.!?\s]+$/g, '').trim()
      if (cleanedSelected.length >= (config.autoSpeech?.minLength ?? 2)) {
        if (config.debug) logger?.info(`ChatLuna 选择的句子: ${cleanedSelected.slice(0, 30)}...`)
        return cleanedSelected
      }

      return null
    } catch (error: any) {
      if (config.debug) logger?.warn(`ChatLuna 调用失败 (尝试 ${attempt + 1}/${MAX_RETRIES + 1}):`, error?.message || error)
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY)
        continue
      }
      
      logger?.warn('ChatLuna 模型选择语音句子失败，已达最大重试次数')
      return null
    }
  }
  
  return null
}

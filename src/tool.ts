import { Context, Schema, h } from 'koishi'
import type { Config as ConfigType } from './types'
import { AudioCacheManager } from './cache'
import { MinimaxVitsService } from './service'
import { generateSpeech, uploadFile, cloneVoice } from './api'
import { makeAudioElement } from './utils'

// 定义一个基础工具类，确保导出
export class MinimaxVitsTool {
  constructor(protected ctx: Context, protected config: ConfigType) {}

  async call(input: string, toolConfig?: any): Promise<string> {
    // 基础实现，具体逻辑会被 index.ts 中的子类覆盖
    // 这里为了通过编译，返回空字符串或简单的实现
    return ''
  }
}

// 使用 ChatLuna 模型选择最适合朗读的句子
export async function selectSpeechSentenceByAI(
  ctx: Context,
  config: ConfigType,
  text: string,
  logger: any
): Promise<string | null> {
  try {
    // 尝试使用 ChatLuna 的模型
    const chatluna = (ctx as any).chatluna
    if (!chatluna) {
      if (config.debug) logger?.info('ChatLuna 服务未找到')
      return null
    }

    // 构建提示词，让模型选择最适合朗读的句子
    const prompt = `请从以下文本中选择最适合朗读的一句话（只返回选中的句子，不要添加任何解释）：

${text}

最适合朗读的句子：`

    // 调用 ChatLuna 模型
    const response = await chatluna.chat(prompt, {
      model: config.autoSpeech.chatLunaBotId || undefined
    })

    const selected = response?.trim()
    if (!selected || selected.length < (config.autoSpeech.minLength ?? 2)) {
      return null
    }

    return selected
  } catch (error) {
    logger?.warn('调用 ChatLuna 模型选择语音句子失败:', error)
    return null
  }
}

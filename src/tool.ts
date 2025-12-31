// ChatLuna Tool 类
import type { Context } from 'koishi'
import type { Config, ChatLunaToolRunnable, ToolInput } from './types'
import { AudioCacheManager } from './cache'
import { generateSpeech } from './api'
import { extractDialogueContent } from './utils'
import { makeAudioElement } from './utils'

export class MinimaxVitsTool {
  name = 'minimax_tts'
  description = `Use this tool to generate speech/audio from text using MiniMax TTS.
Input MUST be a JSON string: {"text": "required content", "voice": "optional_id", "speed": 1.0}`

  constructor(
    private ctx: Context,
    private config: Config,
    private cacheManager?: AudioCacheManager
  ) {}

  async call(input: string, toolConfig: ChatLunaToolRunnable): Promise<string> {
    try {
      const session = toolConfig?.configurable?.session
      if (!session) {
        throw new Error('Session not found in tool config')
      }

      let params: ToolInput
      try {
        params = JSON.parse(input)
      } catch {
        params = { text: input }
      }
      
      let text = params.text || input
      if (typeof text === 'object') {
        text = JSON.stringify(text)
      }

      const voiceId = params.voice || this.config.defaultVoice || 'Chinese_female_gentle'
      const speed = params.speed ?? this.config.speed ?? 1.0
      
      const dialogueText = extractDialogueContent(text)
      if (!dialogueText) {
        return '未检测到有效对话内容。'
      }

      const audioBuffer = await generateSpeech(this.ctx, { 
        ...this.config, 
        speed, 
        vol: params.vol, 
        pitch: params.pitch 
      }, dialogueText, voiceId, this.cacheManager)

      if (!audioBuffer) {
        return 'TTS 生成失败。'
      }

      await session.send(makeAudioElement(audioBuffer, this.config.audioFormat ?? 'mp3'))

      return 'Audio generated and sent.'
    } catch (error: any) {
      this.ctx.logger('minimax-vits').error('Tool call error:', error)
      return `Error: ${error.message || String(error)}`
    }
  }

  // 兼容 ChatLuna 的工具接口
  async invoke(input: ToolInput, options?: ChatLunaToolRunnable): Promise<string> {
    if (!options) {
      throw new Error('Tool options required')
    }
    return this.call(JSON.stringify(input), options)
  }
  
  // 兼容 ChatLuna 的工具接口
  get lc_namespace(): string[] {
    return ['minimax', 'tts']
  }
}


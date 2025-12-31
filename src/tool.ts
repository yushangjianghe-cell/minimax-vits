// src/tool.ts
import { Context } from 'koishi'
import { Config } from './types'

// 定义一个基础工具类，确保导出
export class MinimaxVitsTool {
  constructor(protected ctx: Context, protected config: Config) {}

  async call(input: string, toolConfig?: any): Promise<string> {
    // 基础实现，具体逻辑会被 index.ts 中的子类覆盖
    // 这里为了通过编译，返回空字符串或简单的实现
    return ''
  }
}

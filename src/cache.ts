// 音频缓存管理器
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { Logger } from './types'

export class AudioCacheManager {
  constructor(
    private cacheDir: string,
    private logger: Logger,
    private enabled: boolean,
    private maxAge: number,
    private maxSize: number
  ) {}

  async initialize(): Promise<void> {
    if (!this.enabled) return
    try {
      try {
        await fs.access(this.cacheDir)
      } catch {
        await fs.mkdir(this.cacheDir, { recursive: true })
        this.logger.info(`缓存目录已创建: ${this.cacheDir}`)
      }
      await this.cleanup()
    } catch (error: any) {
      this.logger.warn('缓存初始化失败:', error.message)
    }
  }

  async getAudio(text: string, voice: string, format: string): Promise<Buffer | null> {
    if (!this.enabled) return null
    try {
      const hash = this.getHash(text, voice, format)
      const filePath = path.join(this.cacheDir, `${hash}.${format}`)
      
      try {
        await fs.access(filePath)
      } catch {
        return null
      }
      
      const stats = await fs.stat(filePath)
      const age = Date.now() - stats.mtimeMs
      
      if (age > this.maxAge) {
        await fs.unlink(filePath)
        return null
      }
      
      return await fs.readFile(filePath)
    } catch (error: any) {
      this.logger.debug('缓存读取失败:', error.message)
      return null
    }
  }

  async saveAudio(buffer: Buffer, text: string, voice: string, format: string): Promise<void> {
    if (!this.enabled || !buffer.length) return
    try {
      const hash = this.getHash(text, voice, format)
      const filePath = path.join(this.cacheDir, `${hash}.${format}`)
      
      // 检查缓存大小
      const currentSize = await this.getCacheSize()
      if (currentSize + buffer.length > this.maxSize) {
        await this.cleanup()
      }
      
      await fs.writeFile(filePath, buffer)
    } catch (error: any) {
      this.logger.warn('缓存写入失败:', error.message)
    }
  }

  private getHash(text: string, voice: string, format: string): string {
    return crypto.createHash('md5').update(`${text}-${voice}-${format}`).digest('hex')
  }

  private async getCacheSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir)
      let totalSize = 0
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file)
        const stats = await fs.stat(filePath)
        totalSize += stats.size
      }
      return totalSize
    } catch {
      return 0
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir)
      const now = Date.now()
      let cleaned = 0
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file)
        const stats = await fs.stat(filePath)
        const age = now - stats.mtimeMs
        
        if (age > this.maxAge) {
          await fs.unlink(filePath)
          cleaned++
        }
      }
      
      if (cleaned > 0) {
        this.logger.debug(`清理了 ${cleaned} 个过期缓存文件`)
      }
    } catch (error: any) {
      this.logger.warn('缓存清理失败:', error.message)
    }
  }

  dispose(): void {
    // 清理资源（如果需要）
  }
}



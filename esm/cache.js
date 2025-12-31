import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
export class AudioCacheManager {
    constructor(root, logger, options = {}) {
        var _a, _b, _c;
        this.root = root;
        this.logger = logger;
        this.cacheIndex = new Map();
        this.indexFile = path.join(root, 'index.json');
        this.options = {
            enabled: (_a = options.enabled) !== null && _a !== void 0 ? _a : true,
            maxAge: (_b = options.maxAge) !== null && _b !== void 0 ? _b : 3600 * 1000,
            maxSize: (_c = options.maxSize) !== null && _c !== void 0 ? _c : 100 * 1024 * 1024
        };
    }
    async initialize() {
        if (!this.options.enabled)
            return;
        try {
            if (!fs.existsSync(this.root)) {
                fs.mkdirSync(this.root, { recursive: true });
            }
            if (fs.existsSync(this.indexFile)) {
                const data = await fs.promises.readFile(this.indexFile, 'utf-8');
                const json = JSON.parse(data);
                if (Array.isArray(json)) {
                    json.forEach((entry) => this.cacheIndex.set(entry.hash, entry));
                }
            }
            this.logger.info(`缓存初始化完成，当前缓存项: ${this.cacheIndex.size}`);
        }
        catch (err) {
            this.logger.warn('缓存初始化失败，将重置缓存索引', err);
            this.cacheIndex.clear();
        }
    }
    // 计算唯一哈希
    calculateHash(text, voiceId, params) {
        const content = `${text}|${voiceId}|${JSON.stringify(params)}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }
    async getAudio(text, voiceId, params) {
        if (!this.options.enabled)
            return null;
        const hash = this.calculateHash(text, voiceId, params);
        const entry = this.cacheIndex.get(hash);
        if (entry) {
            // 检查过期
            if (Date.now() - entry.timestamp > this.options.maxAge) {
                this.logger.debug(`缓存已过期: ${hash}`);
                this.deleteEntry(hash);
                return null;
            }
            try {
                const buffer = await fs.promises.readFile(entry.filePath);
                this.logger.debug(`命中缓存: ${hash}`);
                return buffer;
            }
            catch (e) {
                this.logger.warn(`缓存文件丢失: ${entry.filePath}`);
                this.deleteEntry(hash);
            }
        }
        return null;
    }
    async saveAudio(text, voiceId, params, buffer) {
        if (!this.options.enabled)
            return;
        const hash = this.calculateHash(text, voiceId, params);
        const fileName = `${hash}.mp3`; // 简单处理，假设mp3
        const filePath = path.join(this.root, fileName);
        try {
            await fs.promises.writeFile(filePath, buffer);
            this.cacheIndex.set(hash, {
                hash,
                filePath,
                timestamp: Date.now(),
                voiceId,
                params: JSON.stringify(params)
            });
            await this.saveIndex();
            await this.prune();
        }
        catch (e) {
            this.logger.warn('写入缓存失败', e);
        }
    }
    async deleteEntry(hash) {
        const entry = this.cacheIndex.get(hash);
        if (entry) {
            try {
                if (fs.existsSync(entry.filePath)) {
                    await fs.promises.unlink(entry.filePath);
                }
            }
            catch (e) {
                // ignore
            }
            this.cacheIndex.delete(hash);
            await this.saveIndex();
        }
    }
    async saveIndex() {
        try {
            const data = JSON.stringify(Array.from(this.cacheIndex.values()));
            await fs.promises.writeFile(this.indexFile, data);
        }
        catch (e) {
            this.logger.warn('保存缓存索引失败', e);
        }
    }
    async prune() {
        // 简单实现：如果超过大小，删除最旧的
        // 这里暂时略过复杂逻辑，避免引入新 bug
    }
    dispose() {
        // 可以在这里进行清理工作
    }
}

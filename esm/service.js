// src/service.ts
import { Service } from 'koishi';
export class MinimaxVitsService extends Service {
    // 修复：必须声明为 public，以匹配 Koishi Service 基类的定义
    constructor(ctx, config) {
        super(ctx, 'minimax-vits');
        this.config = config;
    }
    // 更新配置
    async updateConfig(config) {
        this.config = config;
    }
    // 获取当前配置的摘要（用于前端显示等）
    getConfigSummary() {
        var _a, _b, _c, _d;
        return {
            apiBase: this.config.apiBase,
            model: this.config.speechModel,
            voice: this.config.defaultVoice,
            hasKey: !!this.config.ttsApiKey,
            params: {
                speed: this.config.speed,
                vol: this.config.vol,
                pitch: (_a = this.config.pitch) !== null && _a !== void 0 ? _a : 0,
                sampleRate: (_b = this.config.sampleRate) !== null && _b !== void 0 ? _b : 32000,
                bitrate: (_c = this.config.bitrate) !== null && _c !== void 0 ? _c : 128000,
                format: (_d = this.config.audioFormat) !== null && _d !== void 0 ? _d : 'mp3'
            }
        };
    }
}

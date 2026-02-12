import { Context, Service } from 'koishi';
import { Config } from './types';
export declare class MinimaxVitsService extends Service {
    config: Config;
    constructor(ctx: Context, config: Config);
    updateConfig(config: Config): Promise<void>;
    getConfigSummary(): {
        apiBase: string;
        model: string;
        voice: string;
        hasKey: boolean;
        params: {
            speed: number;
            vol: number;
            pitch: number;
            sampleRate: 16000 | 24000 | 32000 | 44100 | 48000;
            bitrate: 64000 | 96000 | 128000 | 192000 | 256000;
            format: "mp3" | "wav";
        };
    };
}

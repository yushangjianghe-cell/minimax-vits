import { Logger } from 'koishi';
export declare class AudioCacheManager {
    private root;
    private logger;
    private cacheIndex;
    private indexFile;
    private options;
    constructor(root: string, logger: Logger, options?: {
        enabled?: boolean;
        maxAge?: number;
        maxSize?: number;
    });
    initialize(): Promise<void>;
    private calculateHash;
    getAudio(text: string, voiceId: string, params: any): Promise<Buffer | null>;
    saveAudio(text: string, voiceId: string, params: any, buffer: Buffer): Promise<void>;
    private deleteEntry;
    private saveIndex;
    private prune;
    dispose(): void;
}

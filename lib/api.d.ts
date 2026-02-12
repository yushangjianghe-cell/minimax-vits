import { Context } from 'koishi';
import { Config } from './types';
import { AudioCacheManager } from './cache';
export declare function generateSpeech(ctx: Context, config: Config, text: string, voiceId: string, cacheManager?: AudioCacheManager): Promise<Buffer | null>;
export declare function uploadFile(ctx: Context, config: Config, filePath: string, purpose: 'voice_clone' | 'prompt_audio'): Promise<string | null>;
export declare function cloneVoice(ctx: Context, config: Config, fileId: string, voiceId: string, promptAudioId?: string, promptText?: string, text?: string): Promise<Buffer | null>;

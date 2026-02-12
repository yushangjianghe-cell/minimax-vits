import { Context } from 'koishi';
import type { Config as ConfigType } from './types';
export declare class MinimaxVitsTool {
    protected ctx: Context;
    protected config: ConfigType;
    constructor(ctx: Context, config: ConfigType);
    call(input: string, toolConfig?: any): Promise<string>;
}
export declare function selectSpeechSentenceByAI(ctx: Context, config: ConfigType, text: string, logger: any): Promise<string | null>;

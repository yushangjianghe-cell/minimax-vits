import { Context, Schema } from 'koishi';
import type { Config as ConfigType } from './types';
export declare const name = "minimax-vits";
export declare const schema: Schema<ConfigType>;
export declare const Config: Schema<ConfigType>;
export declare function apply(ctx: Context, config: ConfigType): void;
declare const _default: {
    name: string;
    schema: Schema<ConfigType>;
    Config: Schema<ConfigType>;
    apply: typeof apply;
};
export default _default;

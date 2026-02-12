import { h } from 'koishi';
/**
 * 模糊查询关键词
 */
export declare function fuzzyQuery(text: string, keywords: string[]): boolean;
/**
 * 从消息内容中提取文本
 */
export declare function getMessageContent(content: unknown): string;
/**
 * 提取对话内容（过滤动作描述等）
 */
export declare function extractDialogueContent(text: string): string | null;
/**
 * 构建音频消息元素
 */
export declare function makeAudioElement(buffer: Buffer, format: string): h;

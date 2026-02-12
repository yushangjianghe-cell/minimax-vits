"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzzyQuery = fuzzyQuery;
exports.getMessageContent = getMessageContent;
exports.extractDialogueContent = extractDialogueContent;
exports.makeAudioElement = makeAudioElement;
// 工具函数
const koishi_1 = require("koishi");
/**
 * 模糊查询关键词
 */
function fuzzyQuery(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}
/**
 * 从消息内容中提取文本
 */
function getMessageContent(content) {
    if (typeof content === 'string')
        return content;
    if (content && typeof content === 'object') {
        const obj = content;
        return (obj.text || obj.content || JSON.stringify(content));
    }
    return String(content);
}
/**
 * 提取对话内容（过滤动作描述等）
 */
function extractDialogueContent(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let dialogueContent = '';
    let inDialogue = false;
    for (const line of lines) {
        const isDialogueLine = line.startsWith('"') ||
            line.startsWith("'") ||
            line.includes('说：') ||
            /^[A-Za-z\u4e00-\u9fff]+[：:]/.test(line);
        const isNonDialogue = (line.includes('（') && line.includes('）')) ||
            (line.includes('(') && line.includes(')')) ||
            /^\s*[\[\{【（(]/.test(line);
        if (isDialogueLine && !isNonDialogue) {
            let cleanLine = line
                .replace(/^["\'"']/, '')
                .replace(/["\'"']$/, '')
                .replace(/^[A-Za-z\u4e00-\u9fff]+[：:]\s*/, '')
                .replace(/说：|说道：/g, '')
                .trim();
            if (cleanLine.length > 0) {
                dialogueContent += cleanLine + '。';
                inDialogue = true;
            }
        }
        else if (inDialogue && line.length > 0 && !isNonDialogue) {
            dialogueContent += line + '。';
        }
    }
    if (dialogueContent.length > 0) {
        return dialogueContent.replace(/。+/g, '。').trim();
    }
    if (text.length <= 150 && !/[[{【（(]/.test(text)) {
        return text;
    }
    return null;
}
/**
 * 构建音频消息元素
 */
function makeAudioElement(buffer, format) {
    const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const src = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return (0, koishi_1.h)('audio', { src });
}

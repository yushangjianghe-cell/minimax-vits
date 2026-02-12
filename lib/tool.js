"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinimaxVitsTool = void 0;
exports.selectSpeechSentenceByAI = selectSpeechSentenceByAI;
// 定义一个基础工具类，确保导出
class MinimaxVitsTool {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
    }
    async call(input, toolConfig) {
        // 基础实现，具体逻辑会被 index.ts 中的子类覆盖
        // 这里为了通过编译，返回空字符串或简单的实现
        return '';
    }
}
exports.MinimaxVitsTool = MinimaxVitsTool;
// 使用 ChatLuna 模型选择最适合朗读的句子
async function selectSpeechSentenceByAI(ctx, config, text, logger) {
    var _a;
    try {
        // 尝试使用 ChatLuna 的模型
        const chatluna = ctx.chatluna;
        if (!chatluna) {
            if (config.debug)
                logger === null || logger === void 0 ? void 0 : logger.info('ChatLuna 服务未找到');
            return null;
        }
        // 构建提示词，让模型选择最适合朗读的句子
        const prompt = `请从以下文本中选择最适合朗读的一句话（只返回选中的句子，不要添加任何解释）：

${text}

最适合朗读的句子：`;
        // 调用 ChatLuna 模型
        const response = await chatluna.chat(prompt, {
            model: config.autoSpeech.chatLunaBotId || undefined
        });
        const selected = response === null || response === void 0 ? void 0 : response.trim();
        if (!selected || selected.length < ((_a = config.autoSpeech.minLength) !== null && _a !== void 0 ? _a : 2)) {
            return null;
        }
        return selected;
    }
    catch (error) {
        logger === null || logger === void 0 ? void 0 : logger.warn('调用 ChatLuna 模型选择语音句子失败:', error);
        return null;
    }
}

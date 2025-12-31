// src/index.ts
// 主入口文件
import { Schema } from 'koishi';
import { AudioCacheManager } from './cache';
import { MinimaxVitsTool } from './tool';
import { MinimaxVitsService } from './service';
import { generateSpeech, uploadFile, cloneVoice } from './api';
import { fuzzyQuery, getMessageContent, makeAudioElement } from './utils';
export const name = 'minimax-vits';
// ==========================================
// 模块 A：文本清洗 (过滤非对话内容)
// ==========================================
function cleanModelOutput(text) {
    if (!text)
        return '';
    return text
        // 1. 去除 DeepSeek/R1 等模型的思维链标签 (支持跨行)
        .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/g, '')
        // 2. 去除括号内的动作、神态等非对话描写 (支持中英文括号)
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        // 3. 去除星号内的动作描写
        .replace(/\*([^*]*)\*/g, '')
        // 4. 去除首尾空白
        .trim();
}
// ==========================================
// 模块 B：文本分段
// ==========================================
function splitTextIntoSegments(text) {
    if (!text)
        return [];
    // 使用正则表达式按句末标点(。！？.!?), 和换行符(\n)进行分割。
    // 同时过滤掉分割后产生的空字符串。
    const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 0);
    return sentences.map(s => s.trim());
}
// Koishi规范要求配置Schema必须命名为schema（小写）
export const schema = Schema.object({
    ttsApiKey: Schema.string().default('').description('MiniMax TTS API Key').role('secret'),
    groupId: Schema.string().default('').description('MiniMax Group ID'),
    apiBase: Schema.string().default('https://api.minimax.io/v1').description('API 基础地址'),
    defaultVoice: Schema.string().default('Chinese_female_gentle').description('默认语音 ID'),
    speechModel: Schema.string().default('speech-01-turbo').description('TTS 模型 (推荐 speech-01-turbo)'),
    speed: Schema.number().default(1.0).min(0.5).max(2.0).description('语速'),
    vol: Schema.number().default(1.0).min(0.0).max(2.0).description('音量'),
    pitch: Schema.number().default(0).min(-12).max(12).description('音调'),
    audioFormat: Schema.union([
        Schema.const('mp3').description('MP3 格式'),
        Schema.const('wav').description('WAV 格式')
    ]).default('mp3').description('音频格式'),
    sampleRate: Schema.union([
        Schema.const(16000),
        Schema.const(24000),
        Schema.const(32000),
        Schema.const(44100),
        Schema.const(48000)
    ]).default(32000).description('采样率'),
    bitrate: Schema.union([
        Schema.const(64000),
        Schema.const(96000),
        Schema.const(128000),
        Schema.const(192000),
        Schema.const(256000)
    ]).default(128000).description('比特率'),
    outputFormat: Schema.const('hex').description('API输出编码 (必须是 hex)'),
    languageBoost: Schema.union([
        Schema.const('auto').description('自动'),
        Schema.const('zh').description('中文'),
        Schema.const('en').description('英文')
    ]).default('auto').description('语言增强'),
    debug: Schema.boolean().default(false).description('启用调试日志'),
    voiceCloneEnabled: Schema.boolean().default(false).description('启用语音克隆'),
    cacheEnabled: Schema.boolean().default(true).description('启用本地文件缓存'),
    cacheDir: Schema.string().default('./data/minimax-vits/cache').description('缓存路径'),
    cacheMaxAge: Schema.number().default(3600000).min(60000).description('缓存有效期(ms)'),
    cacheMaxSize: Schema.number().default(104857600).min(1048576).max(1073741824).description('缓存最大体积(bytes)'),
}).description('MiniMax VITS 配置');
// 兼容旧版本，保留Config导出
export const Config = schema;
// --- 插件入口 ---
export function apply(ctx, config) {
    var _a, _b, _c, _d;
    // 使用 ctx.state 来存储服务实例的引用，而不是全局变量
    const state = ctx.state;
    // 创建或获取缓存管理器
    let cacheManager;
    const logger = ctx.logger('minimax-vits');
    // 动态导入 ChatLunaPlugin，避免类型错误
    // 使用类型断言确保构建时不会报错
    let chatLunaPlugin = null;
    // 使用 Promise.then() 替代 await，因为 apply 函数不能是 async
    // @ts-ignore - 忽略类型检查，因为 koishi-plugin-chatluna 可能未安装
    import('koishi-plugin-chatluna/services/chat').then(chatLunaModule => {
        const ChatLunaPlugin = chatLunaModule.ChatLunaPlugin;
        if (ChatLunaPlugin) {
            chatLunaPlugin = new ChatLunaPlugin(ctx, config, 'minimax-vits', false);
            // ======================================================
            // 核心：创建 MinimaxVitsTool 的子类以拦截和处理输出
            // ======================================================
            class FilteredMinimaxVitsTool extends MinimaxVitsTool {
                // 修正：参数包含 toolConfig，且类型设为 any 以避免类型检查问题
                async call(text, toolConfig) {
                    logger.info(`[ChatLuna TTS] 接收到原始文本: "${text}"`);
                    // 步骤 1: 清洗文本，移除动作、神态等非对话内容
                    const cleanedText = cleanModelOutput(text);
                    logger.info(`[ChatLuna TTS] 清洗后文本: "${cleanedText}"`);
                    if (!cleanedText) {
                        logger.info('[ChatLuna TTS] 清洗后无有效内容，跳过语音生成。');
                        return '';
                    }
                    // 步骤 2: 将清洗后的文本分割成句子
                    const segments = splitTextIntoSegments(cleanedText);
                    logger.info(`[ChatLuna TTS] 文本分割成 ${segments.length} 段: ${JSON.stringify(segments)}`);
                    if (segments.length === 0) {
                        return '';
                    }
                    // 步骤 3: 并发为每个句子生成音频
                    const audioElements = await Promise.all(segments.map(async (segment) => {
                        // 修正：这里必须传入 toolConfig，否则 TS 报错
                        return super.call(segment, toolConfig);
                    }));
                    // 步骤 4: 拼接结果
                    const result = audioElements.filter(Boolean).join(' ');
                    logger.info(`[ChatLuna TTS] 最终生成内容: ${result}`);
                    return result;
                }
            }
            // 注册 ChatLuna Tool
            try {
                chatLunaPlugin.registerTool('minimax_tts', {
                    selector: (history) => {
                        return history.some((item) => fuzzyQuery(getMessageContent(item.content), ['语音', '朗读', 'tts', 'speak', 'say', 'voice']));
                    },
                    // 使用我们刚刚创建的、带过滤和分段功能的子类
                    createTool: () => new FilteredMinimaxVitsTool(ctx, config),
                    authorization: () => true
                });
                logger.info('ChatLuna Tool 已注册 (带过滤和分段功能)');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn('ChatLuna Tool 注册失败:', errorMessage);
            }
        }
    }).catch(error => {
        // ChatLuna 插件未安装，跳过
        logger.debug('ChatLuna 插件未安装，跳过 Tool 注册');
    });
    // 创建或更新缓存管理器
    if (config.cacheEnabled) {
        if (!state.cacheManager) {
            // ！！！关键修改：使用对象传递参数，匹配新版 cache.ts
            state.cacheManager = new AudioCacheManager((_a = config.cacheDir) !== null && _a !== void 0 ? _a : './data/minimax-vits/cache', logger, {
                enabled: true,
                maxAge: (_b = config.cacheMaxAge) !== null && _b !== void 0 ? _b : 3600000,
                maxSize: (_c = config.cacheMaxSize) !== null && _c !== void 0 ? _c : 104857600
            });
            // 初始化缓存
            state.cacheManager.initialize().catch((err) => {
                logger.warn('缓存初始化失败:', err);
            });
        }
        cacheManager = state.cacheManager;
    }
    else {
        // 销毁缓存管理器
        (_d = state.cacheManager) === null || _d === void 0 ? void 0 : _d.dispose();
        delete state.cacheManager;
        cacheManager = undefined;
    }
    // 注册控制台服务和页面
    ctx.inject(['console'], (injectedCtx) => {
        try {
            // 使用类型断言，告诉 TypeScript injectedCtx 包含 console 属性
            const ctxWithConsole = injectedCtx;
            // 如果服务实例已存在，更新其配置
            if (state.minimaxVitsService) {
                // 更新服务实例的配置
                state.minimaxVitsService.updateConfig(config).catch((err) => {
                    logger.warn('更新服务配置失败:', err);
                });
            }
            else {
                // 创建服务实例
                state.minimaxVitsService = new MinimaxVitsService(ctxWithConsole, config);
                // 注册控制台服务
                if (ctxWithConsole.console) {
                    // 在 Koishi 4.x 中，使用 console.addService 注册服务
                    if (typeof ctxWithConsole.console.addService === 'function') {
                        ctxWithConsole.console.addService('minimax-vits', state.minimaxVitsService);
                        logger.info('MiniMax VITS 控制台服务已注册');
                    }
                    else {
                        // 兼容旧版本
                        ctxWithConsole.console.services = ctxWithConsole.console.services || {};
                        ctxWithConsole.console.services['minimax-vits'] = state.minimaxVitsService;
                        logger.info('MiniMax VITS 控制台服务已注册（兼容模式）');
                    }
                }
            }
        }
        catch (error) {
            logger.warn('注册控制台服务或页面失败:', error);
        }
    });
    ctx.on('ready', async () => {
        // 初始化缓存
        await (cacheManager === null || cacheManager === void 0 ? void 0 : cacheManager.initialize());
    });
    ctx.on('dispose', () => {
        var _a;
        // 清理缓存管理器
        (_a = state.cacheManager) === null || _a === void 0 ? void 0 : _a.dispose();
        delete state.cacheManager;
        // 清理服务实例
        delete state.minimaxVitsService;
    });
    // --- 指令注册区 ---
    ctx.command('minivits.test <text:text>', '测试 TTS')
        .option('voice', '-v <voice>')
        .option('speed', '-s <speed>', { type: 'number' })
        .action(async ({ session, options }, text) => {
        var _a, _b;
        if (!text)
            return '请输入文本';
        await (session === null || session === void 0 ? void 0 : session.send('生成中...'));
        const buffer = await generateSpeech(ctx, {
            ...config,
            speed: (_a = options === null || options === void 0 ? void 0 : options.speed) !== null && _a !== void 0 ? _a : config.speed
        }, text, (options === null || options === void 0 ? void 0 : options.voice) || config.defaultVoice || 'Chinese_female_gentle', cacheManager);
        if (!buffer)
            return '失败';
        return makeAudioElement(buffer, (_b = config.audioFormat) !== null && _b !== void 0 ? _b : 'mp3');
    });
    ctx.command('minivits.debug', '查看插件配置').action(() => {
        return `API Base: ${config.apiBase}\nModel: ${config.speechModel}\nFormat: ${config.audioFormat}\nDebug: ${config.debug}`;
    });
    if (config.voiceCloneEnabled) {
        ctx.command('minivits.clone.upload <filePath> <purpose>', '上传文件')
            .action(async ({ session }, filePath, purpose) => {
            if (!session || !filePath || !purpose)
                return '缺少参数';
            if (purpose !== 'voice_clone' && purpose !== 'prompt_audio') {
                return '用途错误，必须是 voice_clone 或 prompt_audio';
            }
            await session.send('上传中...');
            const fileId = await uploadFile(ctx, config, filePath, purpose);
            return fileId ? `上传成功: ${fileId}` : '上传失败';
        });
        ctx.command('minivits.clone.create <fileId> <voiceId> [text:text]', '创建语音克隆')
            .option('promptAudio', '-p <id>')
            .option('promptText', '-t <text>')
            .action(async ({ session, options }, fileId, voiceId, text) => {
            var _a;
            if (!session || !fileId || !voiceId)
                return '缺少参数';
            await session.send('克隆中...');
            const audioBuffer = await cloneVoice(ctx, config, fileId, voiceId, options === null || options === void 0 ? void 0 : options.promptAudio, options === null || options === void 0 ? void 0 : options.promptText, text);
            if (!audioBuffer)
                return '克隆失败';
            if (text) {
                return makeAudioElement(audioBuffer, (_a = config.audioFormat) !== null && _a !== void 0 ? _a : 'mp3');
            }
            return '克隆操作请求已发送';
        });
        ctx.command('minivits.clone.full <sourceFile> <voiceId> <text:text>', '完整克隆流程')
            .option('promptFile', '-p <file>')
            .option('promptText', '-t <text>')
            .action(async ({ session, options }, sourceFile, voiceId, text) => {
            var _a;
            if (!session || !sourceFile || !voiceId || !text)
                return '缺少参数';
            await session.send('1. 上传源文件...');
            const sourceFileId = await uploadFile(ctx, config, sourceFile, 'voice_clone');
            if (!sourceFileId)
                return '源文件上传失败';
            let promptAudioFileId;
            if (options === null || options === void 0 ? void 0 : options.promptFile) {
                await session.send('2. 上传提示音频...');
                promptAudioFileId = await uploadFile(ctx, config, options.promptFile, 'prompt_audio');
                if (!promptAudioFileId)
                    return '提示音频上传失败';
            }
            await session.send('3. 生成克隆语音...');
            const audioBuffer = await cloneVoice(ctx, config, sourceFileId, voiceId, promptAudioFileId, options === null || options === void 0 ? void 0 : options.promptText, text);
            if (!audioBuffer)
                return '语音克隆失败';
            return makeAudioElement(audioBuffer, (_a = config.audioFormat) !== null && _a !== void 0 ? _a : 'mp3');
        });
    }
}
// 默认导出，确保Koishi能正确识别插件结构
export default {
    name,
    schema,
    Config,
    apply
};

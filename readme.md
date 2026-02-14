# koishi-plugin-minimax-vits

[![npm](https://img.shields.io/npm/v/koishi-plugin-minimax-vits?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-minimax-vits)

使用 MiniMax 国际版 TTS 生成语音，深度适配 ChatLuna（肘击AI版）。自用插件，持续打磨中。

## 特性

- **ChatLuna 深度集成**：监听 ChatLuna 对话事件，AI 回复自动转语音发送
- **智能语音筛选**：支持多种策略选择最适合朗读的内容（整条/AI挑选/OpenAI筛选）
- **音频缓存**：自动缓存已生成的音频，减少 API 调用
- **灵活发送模式**：仅语音 / 语音+文本混合 / 分开发送

## 安装

```bash
npm install koishi-plugin-minimax-vits
# 或
yarn add koishi-plugin-minimax-vits
```

## 配置

在 Koishi 控制台插件配置页面填写：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| ttsApiKey | MiniMax TTS API Key | - |
| groupId | MiniMax Group ID | - |
| apiBase | API 基础地址 | `https://api.minimax.io/v1` |
| defaultVoice | 默认语音 ID | `Chinese_female_gentle` |
| speechModel | TTS 模型 | `speech-01-turbo` |
| speed | 语速 | 1.0 |
| pitch | 音调 | 0 |
| audioFormat | 音频格式 | mp3 |
| sampleRate | 采样率 | 32000 |

### 自动语音转换

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| enabled | 启用 ChatLuna 对话自动转语音 | false |
| sendMode | 发送模式：voice_only / text_and_voice / mixed | text_and_voice |
| minLength | 触发转换的最短字符数 | 2 |
| selectorMode | 语音内容选择策略 | full |

#### 语音内容选择策略

- **full**：整条文本直接转语音
- **ai_sentence**：交给 ChatLuna 从中挑选一句朗读
- **openai_filter**：通过 OpenAI 兼容接口，让小模型决定具体朗读内容（需配置 OpenAI 兼容接口）

## 使用

1. 安装并配置 MiniMax API Key
2. 在控制台开启 **启用 ChatLuna 对话自动转语音**
3. 与 ChatLuna 对话时，AI 回复将自动转换为语音发送

### 发送模式说明

- **voice_only**：只发送语音
- **text_and_voice**：先发语音，再发原文（分两条）
- **mixed**：语音+文本混合（同一条消息）

## 指令

- `/minivits.test <text>` - 测试 TTS 语音生成

## 许可证

MIT

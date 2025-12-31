# koishi-plugin-minimax-vits

[![npm](https://img.shields.io/npm/v/koishi-plugin-minimax-vits?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-minimax-vits)

使用 minimax 国际版生成语音，适配 chatluna（肘击AI版）。自用更多，还在修。

## 安装

在 Koishi 插件目录下运行：

```bash
npm install koishi-plugin-minimax-vits
# 或
yarn add koishi-plugin-minimax-vits
```

## 配置

在 `koishi.yml` 中添加插件配置：

```yaml
plugins:
  minimax-vits:
    apiKey: your-api-key
    groupId: your-group-id
    ttsEnabled: true
```

### 配置项说明

- `apiKey` (必需): MiniMax API Key
- `groupId` (必需): MiniMax Group ID
- `apiBase` (可选): API 基础地址，默认为 `https://api.minimaxi.com/v1`
- `model` (可选): 使用的模型名称，默认为 `abab6.5s-chat`
- `temperature` (可选): 温度参数 (0-2)，默认为 `0.7`
- `maxTokens` (可选): 最大 token 数，默认为 `2048`
- `ttsEnabled` (可选): 是否启用 TTS 功能，默认为 `false`
- `ttsApiKey` (可选): TTS API Key（如果与主 API Key 不同）
- `defaultVoice` (可选): 默认语音 ID，默认为 `Chinese_female_gentle`
- `speechModel` (可选): TTS 模型名称，默认为 `speech-2.6`

## 使用

安装并配置后，插件会自动加载。你可以在 Koishi 控制台的配置页面中直接填写配置信息。

## 许可证

MIT

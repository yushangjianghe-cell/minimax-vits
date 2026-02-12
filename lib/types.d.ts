export interface Config {
    ttsApiKey: string;
    groupId: string;
    apiBase: string;
    defaultVoice: string;
    speechModel: string;
    speed: number;
    vol: number;
    pitch: number;
    audioFormat: 'mp3' | 'wav';
    sampleRate: 16000 | 24000 | 32000 | 44100 | 48000;
    bitrate: 64000 | 96000 | 128000 | 192000 | 256000;
    outputFormat: 'hex';
    languageBoost: 'auto' | 'zh' | 'en';
    autoSpeech: {
        enabled: boolean;
        onlyChatLuna: boolean;
        chatLunaBotId?: string;
        sendMode: 'voice_only' | 'text_and_voice' | 'mixed';
        minLength: number;
        selectorMode: 'full' | 'ai_sentence' | 'openai_filter';
        openaiLikeBaseUrl?: string;
        openaiLikeApiKey?: string;
        openaiLikeModel?: string;
    };
    debug: boolean;
    voiceCloneEnabled: boolean;
    cacheEnabled: boolean;
    cacheDir: string;
    cacheMaxAge: number;
    cacheMaxSize: number;
}

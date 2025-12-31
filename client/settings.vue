<template>
  <div :style="{ padding: '20px', maxWidth: '800px' }">
    <h2 :style="{ margin: '0 0 20px 0' }">MiniMax VITS 语音合成</h2>
    
    <div :style="{ marginBottom: '20px' }">
      <h3>API 配置</h3>
      <div :style="{ display: 'flex', alignItems: 'center', marginBottom: '15px' }">
        <label :style="{ width: '100px' }">API Key:</label>
        <div :style="{ flex: 1 }">
          <input
            type="password"
            :style="{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }"
            v-model="config.ttsApiKey"
            placeholder="请输入MiniMax API Key"
          />
        </div>
      </div>
      
      <div :style="{ display: 'flex', alignItems: 'center', marginBottom: '15px' }">
        <label :style="{ width: '100px' }">Group ID:</label>
        <div :style="{ flex: 1 }">
          <input
            :style="{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }"
            v-model="config.groupId"
            placeholder="可选"
          />
        </div>
      </div>
    </div>
    
    <div :style="{ marginBottom: '20px' }">
      <h3>语音设置</h3>
      <div :style="{ display: 'flex', alignItems: 'center', marginBottom: '15px' }">
        <label :style="{ width: '100px' }">默认语音:</label>
        <div :style="{ flex: 1 }">
          <select
            :style="{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }"
            v-model="config.defaultVoice"
          >
            <option v-for="voice in voices" :key="voice.value" :value="voice.value">{{ voice.label }}</option>
          </select>
        </div>
      </div>
      
      <div :style="{ display: 'flex', alignItems: 'center', marginBottom: '15px' }">
        <label :style="{ width: '100px' }">语速:</label>
        <div :style="{ flex: 1 }">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            v-model.number="config.speed"
          />
          <span>{{ config.speed }}</span>
        </div>
      </div>
    </div>
    
    <div :style="{ marginBottom: '20px' }">
      <h3>测试功能</h3>
      <div :style="{ marginBottom: '15px' }">
        <label :style="{ display: 'block', marginBottom: '5px' }">测试文本:</label>
        <textarea
          :style="{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }"
          v-model="testText"
          placeholder="输入要测试的文本"
        ></textarea>
      </div>
      
      <div :style="{ display: 'flex', gap: '10px' }">
        <button
          :style="{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#409eff', color: 'white', cursor: 'pointer' }"
          @click="testTTS"
          :disabled="isTesting"
        >
          {{ isTesting ? '测试中...' : '测试TTS' }}
        </button>
        <button
          :style="{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#67c23a', color: 'white', cursor: 'pointer' }"
          @click="saveConfig"
          :disabled="isSaving"
        >
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
        <button
          :style="{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#909399', color: 'white', cursor: 'pointer' }"
          @click="validateApiKey"
        >
          验证API Key
        </button>
      </div>
    </div>
    
    <div v-if="saveStatus" :style="{ marginBottom: '15px', padding: '10px', borderRadius: '4px', backgroundColor: '#f0f9eb', color: '#67c23a' }">
      {{ saveStatus }}
    </div>
    
    <div v-if="testResult" :style="{ marginBottom: '15px', padding: '10px', borderRadius: '4px', backgroundColor: testResult.success ? '#f0f9eb' : '#fef0f0', color: testResult.success ? '#67c23a' : '#f56c6c' }">
      {{ testResult.success ? '测试成功！' : `测试失败: ${testResult.error}` }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from '@koishijs/client'

interface Config {
  ttsApiKey: string
  groupId?: string
  apiBase?: string
  defaultVoice?: string
  speechModel?: string
  speed?: number
  vol?: number
  pitch?: number
  audioFormat?: 'mp3' | 'wav'
  sampleRate?: number
  bitrate?: number
  outputFormat?: 'hex'
  languageBoost?: 'auto' | 'zh' | 'en'
  debug?: boolean
  voiceCloneEnabled?: boolean
  cacheEnabled?: boolean
  cacheDir?: string
  cacheMaxAge?: number
  cacheMaxSize?: number
}

interface TestResult {
  success: boolean
  audio?: string
  size?: number
  error?: string
}

const store = useStore()
const service = computed(() => store['minimax-vits'])

// 配置数据
const config = reactive<Config>({
  ttsApiKey: '',
  apiBase: 'https://api.minimax.io/v1',
  defaultVoice: 'Chinese_female_gentle',
  speechModel: 'speech-01-turbo',
  speed: 1.0,
  vol: 1.0,
  pitch: 0,
  audioFormat: 'mp3',
  sampleRate: 32000,
  bitrate: 128000,
  outputFormat: 'hex',
  languageBoost: 'auto',
  debug: false,
  voiceCloneEnabled: false,
  cacheEnabled: true,
  cacheDir: './data/minimax-vits/cache',
  cacheMaxAge: 3600000,
  cacheMaxSize: 104857600
})

// 测试相关
const testText = ref('你好，这是一个测试语音。')
const testResult = ref<TestResult | null>(null)
const isTesting = ref(false)
const isSaving = ref(false)
const saveStatus = ref('')

// 可用语音列表
const voices = ref([
  { label: '温柔女声', value: 'Chinese_female_gentle' },
  { label: '活力女声', value: 'Chinese_female_vitality' },
  { label: '沉稳男声', value: 'Chinese_male_calm' },
  { label: '青年男声', value: 'Chinese_male_young' },
  { label: '随性女声(英)', value: 'English_female_casual' },
  { label: '专业男声(英)', value: 'English_male_professional' }
])

// 加载配置
const loadConfig = () => {
  if (service.value) {
    try {
      const currentConfig = service.value.getConfig()
      // 确保所有配置项都被正确赋值，包括空值
      // 使用 Object.assign 确保所有字段都被覆盖，即使值为空字符串或 undefined
      Object.assign(config, {
        ttsApiKey: currentConfig.ttsApiKey ?? '',
        groupId: currentConfig.groupId ?? '',
        apiBase: currentConfig.apiBase ?? 'https://api.minimax.io/v1',
        defaultVoice: currentConfig.defaultVoice ?? 'Chinese_female_gentle',
        speechModel: currentConfig.speechModel ?? 'speech-01-turbo',
        speed: currentConfig.speed ?? 1.0,
        vol: currentConfig.vol ?? 1.0,
        pitch: currentConfig.pitch ?? 0,
        audioFormat: currentConfig.audioFormat ?? 'mp3',
        sampleRate: currentConfig.sampleRate ?? 32000,
        bitrate: currentConfig.bitrate ?? 128000,
        outputFormat: currentConfig.outputFormat ?? 'hex',
        languageBoost: currentConfig.languageBoost ?? 'auto',
        debug: currentConfig.debug ?? false,
        voiceCloneEnabled: currentConfig.voiceCloneEnabled ?? false,
        cacheEnabled: currentConfig.cacheEnabled ?? true,
        cacheDir: currentConfig.cacheDir ?? './data/minimax-vits/cache',
        cacheMaxAge: currentConfig.cacheMaxAge ?? 3600000,
        cacheMaxSize: currentConfig.cacheMaxSize ?? 104857600,
      })
    } catch (error: any) {
      console.error('加载配置失败:', error)
    }
  }
}

// 保存配置
const saveConfig = async () => {
  if (!service.value) return
  
  isSaving.value = true
  saveStatus.value = '保存中...'
  
  try {
    await service.value.updateConfig(config)
    saveStatus.value = '保存成功！'
    setTimeout(() => saveStatus.value = '', 2000)
  } catch (error: any) {
    saveStatus.value = `保存失败: ${error.message}`
  } finally {
    isSaving.value = false
  }
}

// 测试TTS
const testTTS = async () => {
  if (!service.value || !testText.value.trim()) return
  
  isTesting.value = true
  testResult.value = null
  
  try {
    const result = await service.value.testTTS(
      testText.value,
      config.defaultVoice,
      config.speed
    )
    
    testResult.value = result
    
    if (result.success && result.audio) {
      // 创建并播放音频
      const audio = new Audio(result.audio)
      audio.play().catch(e => console.error('播放失败:', e))
    }
  } catch (error: any) {
    testResult.value = {
      success: false,
      error: error.message
    }
  } finally {
    isTesting.value = false
  }
}

// 验证API Key
const validateApiKey = async () => {
  if (!service.value || !config.ttsApiKey) return
  
  try {
    const result = await service.value.validateApiKey(config.ttsApiKey)
    if (result.valid) {
      saveStatus.value = 'API Key格式有效'
    } else {
      saveStatus.value = `API Key无效: ${result.message}`
    }
    setTimeout(() => saveStatus.value = '', 3000)
  } catch (error: any) {
    saveStatus.value = `验证失败: ${error.message}`
  }
}

// 初始化时加载配置
onMounted(() => {
  // 延迟加载，确保服务已准备好
  setTimeout(() => {
    loadConfig()
  }, 100)
  
  // 监听服务变化
  if (service.value) {
    loadConfig()
  }
})
</script>

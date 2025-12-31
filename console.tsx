import { defineComponent, ref, onMounted } from 'vue'
import { useStore } from '@koishijs/client'
import { MinimaxVitsService } from './lib/service'

export default defineComponent({
  name: 'MinimaxVitsSettings',
  
  setup() {
    const store = useStore<{
      'minimax-vits': MinimaxVitsService
    }>()
    
    const service = store['minimax-vits']
    const config = ref<any>({})
    const testText = ref('')
    const testResult = ref('')
    const isTesting = ref(false)
    const isSaving = ref(false)
    const saveStatus = ref('')
    
    // 加载配置
    const loadConfig = () => {
      if (service) {
        const currentConfig = service.getConfig()
        config.value = { ...currentConfig }
      }
    }
    
    // 获取可用语音列表
    const voices = service ? service.getAvailableVoices() : []
    
    // 保存配置
    async function saveConfig() {
      if (!service) return
      isSaving.value = true
      saveStatus.value = '保存中...'
      try {
        await service.updateConfig(config.value)
        saveStatus.value = '保存成功！'
        setTimeout(() => saveStatus.value = '', 2000)
      } catch (error: any) {
        saveStatus.value = `保存失败: ${error.message || String(error)}`
      } finally {
        isSaving.value = false
      }
    }
    
    // 组件挂载时加载配置
    onMounted(() => {
      loadConfig()
    })
    
    // 测试TTS
    async function testTTS() {
      if (!testText.value.trim()) return
      isTesting.value = true
      testResult.value = ''
      
      const result = await service.testTTS(
        testText.value,
        config.value.defaultVoice,
        config.value.speed
      )
      
      isTesting.value = false
      if (result.success) {
        testResult.value = '测试成功！已播放音频'
        // 创建音频元素并播放
        const audio = new Audio(result.audio)
        audio.play()
      } else {
        testResult.value = `测试失败: ${result.error}`
      }
    }
    
    return () => (
      <div class="minimax-vits-settings">
        <h2>MiniMax VITS 配置</h2>
        
        <div class="config-section">
          <h3>API 配置</h3>
          <div class="form-group">
            <label>API Key</label>
            <input 
              type="password" 
              value={config.value.ttsApiKey}
              onInput={(e) => config.value.ttsApiKey = e.target.value}
              placeholder="请输入MiniMax API Key"
            />
          </div>
          
          <div class="form-group">
            <label>Group ID (可选)</label>
            <input 
              value={config.value.groupId || ''}
              onInput={(e) => config.value.groupId = e.target.value}
              placeholder="Group ID"
            />
          </div>
          
          <div class="form-group">
            <label>API 基础地址</label>
            <input 
              value={config.value.apiBase}
              onInput={(e) => config.value.apiBase = e.target.value}
            />
          </div>
        </div>
        
        <div class="config-section">
          <h3>语音设置</h3>
          
          <div class="form-group">
            <label>默认语音</label>
            <select 
              value={config.value.defaultVoice}
              onChange={(e) => config.value.defaultVoice = e.target.value}
            >
              {voices.map(voice => (
                <option value={voice}>{voice}</option>
              ))}
            </select>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>语速: {config.value.speed}</label>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1"
                value={config.value.speed}
                onInput={(e) => config.value.speed = parseFloat(e.target.value)}
              />
            </div>
            
            <div class="form-group">
              <label>音量: {config.value.vol}</label>
              <input 
                type="range" 
                min="0.0" 
                max="2.0" 
                step="0.1"
                value={config.value.vol}
                onInput={(e) => config.value.vol = parseFloat(e.target.value)}
              />
            </div>
          </div>
          
          <div class="form-group">
            <label>音频格式</label>
            <div class="radio-group">
              <label>
                <input 
                  type="radio" 
                  value="mp3" 
                  checked={config.value.audioFormat === 'mp3'}
                  onChange={() => config.value.audioFormat = 'mp3'}
                /> MP3
              </label>
              <label>
                <input 
                  type="radio" 
                  value="wav" 
                  checked={config.value.audioFormat === 'wav'}
                  onChange={() => config.value.audioFormat = 'wav'}
                /> WAV
              </label>
            </div>
          </div>
        </div>
        
        <div class="config-section">
          <h3>测试功能</h3>
          <div class="form-group">
            <label>测试文本</label>
            <textarea 
              value={testText.value}
              onInput={(e) => testText.value = e.target.value}
              placeholder="输入要测试的文本"
              rows="3"
            />
          </div>
          
          <button onClick={testTTS} disabled={isTesting.value}>
            {isTesting.value ? '测试中...' : '测试TTS'}
          </button>
          
          {testResult.value && (
            <div class="test-result">
              {testResult.value}
            </div>
          )}
        </div>
        
        <div class="actions">
          <button onClick={saveConfig} class="primary" disabled={isSaving.value}>
            {isSaving.value ? '保存中...' : '保存配置'}
          </button>
          {saveStatus.value && (
            <div class="save-status">
              {saveStatus.value}
            </div>
          )}
        </div>
      </div>
    )
  }
})
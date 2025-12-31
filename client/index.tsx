// client/index.tsx - 控制台 UI 组件入口
import { Context } from '@koishijs/client'
import MinimaxVitsSettings from './settings.vue'

export default (ctx: Context) => {
  // 注册插件配置面板，使用 ctx.settings 会自动关联服务端的 schema
  ctx.settings({
    id: 'minimax-vits',
    title: 'MiniMax VITS 配置',
    component: MinimaxVitsSettings
  })
}

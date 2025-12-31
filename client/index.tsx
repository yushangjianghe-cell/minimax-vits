// client/index.tsx - 控制台 UI 组件入口
import { Context } from '@koishijs/client'
import MinimaxVitsSettings from './settings.vue'

export default (ctx: Context) => {
  // 注册控制台页面
  ctx.page({ id: 'minimax-vits', path: '/minimax-vits', name: 'MiniMax VITS', icon: 'headphones' })
  ctx.panel({ id: 'minimax-vits', pageId: 'minimax-vits', title: 'MiniMax VITS 配置', component: MinimaxVitsSettings })
}

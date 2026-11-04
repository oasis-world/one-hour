import type { MudBlueprint, MudScene } from '../../lib/mudTemplates'

export interface MudPlayer { userId: string; displayName: string; role?: string }
export interface MudState {
  instanceId: string
  blueprint: MudBlueprint
  hostUserId: string
  invited: MudPlayer[]
  step: number
  history: string[]
  scene: MudScene
  lang: string
  createdAt: number
}

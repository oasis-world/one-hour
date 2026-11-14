export interface Match3ToastData {
  id: number
  kind: 'reward' | 'refresh' | 'error'
  title?: string
  amount?: number
  message?: string
}

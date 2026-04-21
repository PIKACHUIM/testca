/// <reference types="vite/client" />

// 对 DingXiang 验证码做最小声明（外部脚本注入到 window._dx）
interface DxCaptchaInstance {
  reload?: () => void
  destroy?: () => void
}

interface DxCaptchaOptions {
  appId: string
  apiServer?: string
  success: (token: string) => void
  [key: string]: unknown
}

interface Window {
  _dx?: {
    Captcha: (element: HTMLElement, options: DxCaptchaOptions) => DxCaptchaInstance
  }
}

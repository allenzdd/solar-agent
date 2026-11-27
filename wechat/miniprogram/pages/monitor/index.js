const { serviceOrigin, deviceDebugOrigin } = require('../../config')

Page({
  data: { src: '', message: '', detail: '', retryable: false },

  onLoad() {
    this.openMonitor()
  },

  openMonitor() {
    let origin = serviceOrigin.trim().replace(/\/$/, '')
    const debug = wx.getAccountInfoSync().miniProgram.envVersion === 'develop' && !serviceOrigin.trim()
    if (debug) origin = deviceDebugOrigin
    if (!origin || !(debug ? /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i : /^https:\/\/[a-z0-9.-]+$/i).test(origin)) {
      this.setData({ src: '', message: '请先在小程序项目中配置光储服务的 HTTPS 业务域名。', detail: '', retryable: false })
      return
    }
    this.setData({ src: origin + '/wechat/index.html', message: '', detail: '', retryable: false })
  },

  onLoadError(event) {
    const detail = event && event.detail || {}
    const address = this.data.src
    const message = address.startsWith('http://')
      ? '微信未能加载 HTTP 调试页面。请确认手机已连接真机调试，再重新连接。'
      : '微信未能加载电站页面，请检查网络和业务域名。'
    this.setData({ src: '', message, detail: [address, detail.errMsg || detail.errCode].filter(Boolean).join('\n'), retryable: true })
  }
})

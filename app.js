/**
 * MES 现场知识问答 —— 微信小程序入口
 *
 * ★ 部署前必改：把 baseUrl 改成你自己的服务地址（不要带结尾斜杠）
 *   调试期：http://192.168.1.2:3091    上线后：https://mes.你的域名.com
 *   并在微信公众平台 → 开发管理 → 服务器域名 → request 合法域名 里填同一个域名。
 *
 * ★ 换 IP 不用改代码：小程序页面底部有「服务器：… 点此修改」，
 *   或者双击电脑上的 E:\DeepSeekHarness\换服务器地址.cmd。
 */
App({
  globalData: {
    // ====== 改这里 ======
    // 这台机器的局域网地址（2026-11-21 实测可通）：http://192.168.1.2:3091
    // 换 WiFi / 重开机后 IP 可能变，用 ipconfig 重新查；正式上线换 https://你的域名
    baseUrl: 'http://192.168.5.147:3091',
    // 与上面保持一样的值：用于「恢复默认」（本地缓存被清掉时回退到它）
    defaultBaseUrl: 'http://192.168.5.147:3091',
    // ====================

    industry: '全部',

    // 语音输入方式：'server' = 服务端离线识别（默认，免申请、免付费）
    //              'plugin' = 微信「同声传译」插件（更准，需先在公众平台添加插件，见 README）
    voiceMode: 'server',

    /** 顶部导航栏尺寸：自定义导航栏要自己算状态栏与胶囊按钮的位置 */
    nav: { statusBarHeight: 20, navH: 64, rightPad: 100, windowWidth: 375 }
  },

  onLaunch() {
    const saved = wx.getStorageSync('meskb_baseUrl');
    if (saved) this.globalData.baseUrl = saved;

    this.globalData.nav = this.getNavMetrics();

    // 静默登录（不弹授权框）：把 openid 带给服务端，便于访问统计与白名单控制
    wx.login({
      success: (res) => {
        if (!res.code) return;
        wx.request({
          url: this.globalData.baseUrl + '/api/wx/login',
          method: 'POST',
          data: { code: res.code },
          success: (r) => {
            if (r.data && r.data.ok && r.data.token) {
              wx.setStorageSync('meskb_token', r.data.token);
            }
          },
          fail: () => {}
        });
      }
    });
  },

  /**
   * 计算自定义导航栏尺寸。
   * 微信右上角的「胶囊按钮」会占位，页面自己的按钮必须让开，否则真机上会被挡住。
   */
  getNavMetrics() {
    let win = {};
    let cap = {};
    try { win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) {}
    try { cap = wx.getMenuButtonBoundingClientRect(); } catch (e) {}

    const statusBarHeight = win.statusBarHeight || 20;
    const windowWidth = win.windowWidth || 375;

    let navH = statusBarHeight + 44;
    let rightPad = 12;

    if (cap && cap.top && cap.left && cap.bottom) {
      navH = cap.bottom + (cap.top - statusBarHeight);
      rightPad = windowWidth - cap.left + 8;
    }

    return { statusBarHeight, navH, rightPad, windowWidth };
  }
});

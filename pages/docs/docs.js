const app = getApp();

Page({
  data: {
    nav: { statusBarHeight: 20, navH: 64, rightPad: 100, windowWidth: 375 },
    baseUrl: '',
    q: '',
    docs: [],
    total: 0,
    loading: false,
    uploading: false
  },

  onLoad() {
    this.setData({ nav: app.globalData.nav, baseUrl: app.globalData.baseUrl });
    this.loadDocs();
  },

  onShow() {
    this.setData({ baseUrl: app.globalData.baseUrl });
  },

  /* ==================== 顶部导航 ==================== */
  goQuery() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.redirectTo({ url: '/pages/query/query' });
  },

  /* ==================== 搜索 ==================== */
  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  onClear() {
    this.setData({ q: '' });
    this.loadDocs();
  },

  onSearch() {
    this.loadDocs();
  },

  /* ==================== 列表 ==================== */
  loadDocs() {
    const q = (this.data.q || '').trim();
    this.setData({ loading: true });

    wx.request({
      url: this.data.baseUrl + '/api/docs?q=' + encodeURIComponent(q),
      method: 'GET',
      success: (r) => {
        const d = r.data || {};
        if (!d.ok) {
          this.setData({ loading: false, docs: [], total: 0 });
          wx.showToast({ title: d.error || '读取失败', icon: 'none' });
          return;
        }
        this.setData({ loading: false, docs: d.docs || [], total: d.total || 0 });
      },
      fail: (e) => {
        this.setData({ loading: false });
        wx.showModal({
          title: '连不上服务器',
          content: (e.errMsg || '') + '\n\n检查：服务是否启动、手机与电脑是否同一 WiFi、或点底部「服务器」修改地址。',
          showCancel: false
        });
      }
    });
  },

  /* ==================== 上传 ==================== */
  onUpload() {
    if (this.data.uploading) return;

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        this.uploadFile(f);
      },
      fail: (e) => {
        // 用户取消不算错误
        if (String(e.errMsg || '').indexOf('cancel') >= 0) return;
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  uploadFile(f) {
    const name = f.name || '文档';
    const title = name.replace(/\.[^.]+$/, '');

    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中…', mask: true });

    wx.uploadFile({
      url: this.data.baseUrl + '/api/docs',
      filePath: f.path,
      name: 'file',
      formData: { title },
      success: (r) => {
        wx.hideLoading();
        this.setData({ uploading: false });

        let d = {};
        try { d = JSON.parse(r.data || '{}'); } catch (e) { d = {}; }

        if (d.ok) {
          wx.showToast({ title: '上传成功', icon: 'success' });
          this.loadDocs();
        } else {
          wx.showModal({
            title: '上传失败',
            content: d.error || ('服务器返回：' + (r.data || '') + '（HTTP ' + r.statusCode + '）'),
            showCancel: false
          });
        }
      },
      fail: (e) => {
        wx.hideLoading();
        this.setData({ uploading: false });
        wx.showModal({
          title: '上传失败',
          content: (e.errMsg || '') + '\n\n如果是真机，请确认服务地址用 https 或已勾选「不校验合法域名」。',
          showCancel: false
        });
      }
    });
  },

  /* ==================== 预览 ==================== */
  onOpenDoc(e) {
    const id = e.currentTarget.dataset.id;
    const doc = this.data.docs.find((d) => d.id === id);
    if (!doc) return;

    const fileType = (doc.ext || '').replace('.', '').toLowerCase();

    wx.showLoading({ title: '正在打开…', mask: true });
    wx.downloadFile({
      url: this.data.baseUrl + doc.url,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showModal({ title: '下载失败', content: 'HTTP ' + res.statusCode, showCancel: false });
          return;
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          fileType: fileType,
          showMenu: true,
          success: () => wx.hideLoading(),
          fail: (err) => {
            wx.hideLoading();
            wx.showModal({
              title: '打不开这个文件',
              content: '微信自带的阅读器不支持该格式（' + fileType + '）。\n' + (err.errMsg || ''),
              showCancel: false
            });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({
          title: '下载失败',
          content: (err.errMsg || '') + '\n\n真机上需要把服务器域名加进「downloadFile 合法域名」，调试期可勾「不校验合法域名」。',
          showCancel: false
        });
      }
    });
  },

  /* ==================== 服务器地址 ==================== */
  onEditBaseUrl() {
    wx.showModal({
      title: '服务器地址',
      editable: true,
      placeholderText: 'http://192.168.1.2:3091',
      content: this.data.baseUrl,
      success: (r) => {
        if (!r.confirm) return;
        let v = (r.content || '').trim();

        if (!v) {
          wx.removeStorageSync('meskb_baseUrl');
          const def = app.globalData.defaultBaseUrl || app.globalData.baseUrl;
          app.globalData.baseUrl = def;
          this.setData({ baseUrl: def });
          this.loadDocs();
          wx.showToast({ title: '已恢复默认', icon: 'success' });
          return;
        }

        if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
        v = v.replace(/\/+$/, '');

        wx.setStorageSync('meskb_baseUrl', v);
        app.globalData.baseUrl = v;
        this.setData({ baseUrl: v });
        this.loadDocs();
        wx.showToast({ title: '已切换服务器', icon: 'success' });
      }
    });
  }
});

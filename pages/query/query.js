const app = getApp();

/** 录音器全局只允许有一个 */
const recorder = wx.getRecorderManager();

Page({
  data: {
    nav: { statusBarHeight: 20, navH: 64, rightPad: 100, windowWidth: 375 },
    baseUrl: '',
    q: '',
    industry: '全部',
    industries: ['全部'],
    hot: [],
    loading: false,
    voiceBusy: false,
    recording: false,
    entry: null,
    results: [],
    miss: false,
    missCount: 0,
    photoUrl: '',
    ocrText: '',
    ocrOk: false,
    errMsg: ''
  },

  /* ==================== 生命周期 ==================== */
  onLoad() {
    this.setData({
      nav: app.globalData.nav,
      baseUrl: app.globalData.baseUrl
    });
    this.initRecorder();
    this.loadMeta();
  },

  onShow() {
    // 从文档页返回时，地址可能在小程序里被改过
    this.setData({ baseUrl: app.globalData.baseUrl });
  },

  /* ==================== 顶部导航 ==================== */
  goDocs() {
    wx.navigateTo({ url: '/pages/docs/docs' });
  },

  /* ==================== 元数据 ==================== */
  loadMeta() {
    wx.request({
      url: this.data.baseUrl + '/api/meta',
      method: 'GET',
      success: (r) => {
        if (r.data && r.data.ok) {
          const inds = ['全部'].concat(r.data.industries || []);
          this.setData({
            industries: inds,
            hot: (r.data.hot || []).map((x) => x.q)
          });
        }
      }
    });
  },

  /* ==================== 输入与筛选 ==================== */
  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  onPickIndustry(e) {
    const industry = e.currentTarget.dataset.ind;
    this.setData({ industry });
    if (this.data.q.trim()) this.doSearch(this.data.q);
  },

  onTapHot(e) {
    const q = e.currentTarget.dataset.q;
    this.setData({ q });
    this.doSearch(q);
  },

  onConfirm() {
    this.doSearch(this.data.q);
  },

  /* ==================== 文字查询 ==================== */
  doSearch(q) {
    q = (q || '').trim();
    if (!q) {
      wx.showToast({ title: '请先说出或输入现象', icon: 'none' });
      return;
    }
    this.setData({ loading: true, errMsg: '', photoUrl: '', ocrText: '' });

    const industry = this.data.industry === '全部' ? '' : this.data.industry;
    wx.request({
      url: this.data.baseUrl + '/api/search?q=' + encodeURIComponent(q) + '&industry=' + encodeURIComponent(industry),
      method: 'GET',
      success: (r) => {
        const d = r.data || {};
        if (!d.ok) {
          this.setData({ loading: false, errMsg: '查询失败：' + (d.error || '服务异常') });
          return;
        }
        this.applyResult(d);
      },
      fail: (e) => {
        this.setData({ loading: false, errMsg: '连不上服务器：' + (e.errMsg || '') });
      }
    });
  },

  applyResult(d) {
    const hit = d.hit && d.results && d.results.length > 0;
    const entry = hit ? d.results[0].entry : null;
    this.setData({
      loading: false,
      miss: !hit,
      missCount: d.missCount || 0,
      entry: entry ? this.decorate(entry) : null,
      results: hit ? d.results.slice(1).map((x) => x.entry) : (d.results || []).map((x) => x.entry),
      errMsg: ''
    });
    if (hit && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  decorate(e) {
    return {
      ...e,
      causesList: (e.causes || []).map((t, i) => ({ i: i + 1, t })),
      stepsList: (e.steps || []).map((t, i) => ({ i: i + 1, t })),
      paramsList: (e.params || []).map((p) => ({ k: p.k, v: p.v, note: p.note || '' })),
      updatedShort: (e.updatedAt || '').slice(0, 10)
    };
  },

  /* ==================== 语音输入 ==================== */
  initRecorder() {
    recorder.onStop((res) => this.handleRecordStop(res));
    recorder.onError((e) => {
      this.setData({ recording: false, voiceBusy: false, loading: false });
      wx.showToast({ title: '录音失败：' + (e.errMsg || '请检查麦克风权限'), icon: 'none', duration: 2500 });
    });
  },

  /** 点搜索框里的小麦克风 = 按住说话 */
  onTapMic() {
    wx.showToast({ title: '按住下方大麦克风说话', icon: 'none' });
  },

  onVoiceStart() {
    if (this.data.recording || this.data.voiceBusy) return;

    this.recordStart = Date.now();
    this.setData({ recording: true, errMsg: '' });

    recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'wav'
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  onVoiceEnd() {
    if (!this.data.recording) return;

    const ms = Date.now() - (this.recordStart || 0);
    this.setData({ recording: false });

    // 说话太短：丢掉这次录音（onStop 仍会回调，用标记跳过）
    if (ms < 700) {
      this.skipNextStop = true;
      try { recorder.stop(); } catch (e) {}
      wx.showToast({ title: '说话时间太短，按住说完再松手', icon: 'none' });
      return;
    }

    try { recorder.stop(); } catch (e) {
      this.setData({ voiceBusy: false });
    }
  },

  handleRecordStop(res) {
    if (this.skipNextStop) {
      this.skipNextStop = false;
      return;
    }

    const path = res && res.tempFilePath;
    if (!path) {
      this.setData({ voiceBusy: false });
      wx.showToast({ title: '没有录到声音', icon: 'none' });
      return;
    }

    this.setData({ voiceBusy: true, loading: true, errMsg: '', entry: null, miss: false });

    wx.getFileSystemManager().readFile({
      filePath: path,
      success: (r) => {
        wx.request({
          url: this.data.baseUrl + '/api/voice',
          method: 'POST',
          data: r.data,                                   // ArrayBuffer 原始 WAV 字节
          header: { 'content-type': 'audio/wav' },
          success: (resp) => {
            const d = resp.data || {};
            this.setData({ voiceBusy: false, loading: false });

            if (d.ok && d.text) {
              this.setData({ q: d.text });
              this.doSearch(d.text);
              return;
            }

            wx.showModal({
              title: '没听清',
              content: (d.error || '请再说一次') + '\n\n可以点搜索框手动改关键词再查。',
              showCancel: false,
              confirmText: '知道了'
            });
          },
          fail: (e) => {
            this.setData({ voiceBusy: false, loading: false, errMsg: '语音上传失败：' + (e.errMsg || '') });
          }
        });
      },
      fail: () => {
        this.setData({ voiceBusy: false, loading: false, errMsg: '读取录音文件失败' });
      }
    });
  },

  /* ==================== 拍照识别 ==================== */
  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.uploadPhoto(file.tempFilePath);
      }
    });
  },

  uploadPhoto(path) {
    this.setData({ loading: true, errMsg: '', entry: null, miss: false });
    wx.showLoading({ title: '识别中…', mask: true });

    wx.compressImage({
      src: path,
      quality: 80,
      success: (c) => this.readAndPost(c.tempFilePath),
      fail: () => this.readAndPost(path)
    });
  },

  previewPhoto() {
    if (!this.data.photoUrl) return;
    wx.previewImage({ urls: [this.data.photoUrl], current: this.data.photoUrl });
  },

  readAndPost(path) {
    wx.getFileSystemManager().readFile({
      filePath: path,
      success: (res) => {
        wx.request({
          url: this.data.baseUrl + '/api/photo?name=photo.jpg',
          method: 'POST',
          data: res.data,
          header: { 'content-type': 'image/jpeg' },
          success: (r) => {
            wx.hideLoading();
            const d = r.data || {};
            if (!d.ok) {
              this.setData({ loading: false, errMsg: '识别失败：' + (d.error || '') });
              return;
            }
            this.setData({
              photoUrl: this.data.baseUrl + d.photoUrl,
              ocrText: d.ocrText || '',
              ocrOk: !!d.ocrOk,
              q: d.query || this.data.q
            });
            this.applyResult(d);
            if (!d.ocrOk) {
              wx.showToast({ title: '没识别出文字，可改关键词再搜', icon: 'none', duration: 2500 });
            }
          },
          fail: (e) => {
            wx.hideLoading();
            this.setData({ loading: false, errMsg: '上传失败：' + (e.errMsg || '') });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ loading: false, errMsg: '读取图片失败' });
      }
    });
  },

  /* ==================== 结果操作 ==================== */
  onCopyConclusion() {
    if (!this.data.entry) return;
    wx.setClipboardData({
      data: this.data.entry.conclusion,
      success: () => wx.showToast({ title: '结论已复制', icon: 'success' })
    });
  },

  onCopyAll() {
    const e = this.data.entry;
    if (!e) return;
    const lines = [
      '【' + e.title + '】（' + e.code + ' · ' + e.industry + ' · ' + e.module + '）',
      '',
      '结论：' + e.conclusion
    ];
    if (e.symptom) lines.push('', '现象：' + e.symptom);
    if ((e.causes || []).length) lines.push('', '可能原因：' + e.causes.map((c, i) => `\n  ${i + 1}. ${c}`).join(''));
    if ((e.steps || []).length) lines.push('', '处理步骤：' + e.steps.map((s, i) => `\n  ${i + 1}. ${s}`).join(''));
    if ((e.params || []).length) lines.push('', '关键参数：' + e.params.map((p) => `\n  ${p.k} = ${p.v}${p.note ? '（' + p.note + '）' : ''}`).join(''));
    if ((e.risks || []).length) lines.push('', '风险提示：' + e.risks.map((r) => `\n  · ${r}`).join(''));

    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '全文已复制，可粘贴到群里', icon: 'none' })
    });
  },

  onOpenEntry(e) {
    const id = e.currentTarget.dataset.id;
    const entry = this.data.results.find((x) => x.id === id);
    if (!entry) return;
    this.setData({ entry: this.decorate(entry), miss: false });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
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
          this.setData({ baseUrl: def, entry: null, miss: false, errMsg: '' });
          this.loadMeta();
          wx.showToast({ title: '已恢复默认', icon: 'success' });
          return;
        }

        if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
        v = v.replace(/\/+$/, '');

        wx.setStorageSync('meskb_baseUrl', v);
        app.globalData.baseUrl = v;
        this.setData({ baseUrl: v, entry: null, miss: false, errMsg: '' });
        this.loadMeta();
        wx.showToast({ title: '已切换服务器', icon: 'success' });
      }
    });
  },

  /* ==================== 分享 ==================== */
  onShareAppMessage() {
    const e = this.data.entry;
    return {
      title: e ? (e.title + ' - MES 知识库') : 'MES 现场知识问答',
      path: '/pages/query/query'
    };
  }
});

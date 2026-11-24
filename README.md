# MES 现场知识问答 · 微信小程序

配套本知识库服务端（`MesKb` / `MesKb-Service`）的微信小程序前端。两个页面：

| 页面 | 主要能力 |
|---|---|
| **现场查询**（`pages/query`） | 文字查询、**语音说话查询**、拍照识别（拍 MES 报错界面自动找答案）、答案卡（结论/原因/步骤/参数/风险）、复制结论/全文、转发、热问推荐、工艺筛选 |
| **文档知识库**（`pages/docs`） | 文档搜索、**上传 PPT/Word/Excel/PDF**、列表浏览、**点开直接预览 PPT** |

两页右上角互相切换：`文档管理` ⇄ `现场查询`。

---

## 一、先说清楚三个硬性前提（不满足就上不了线）

| 前提 | 说明 |
|---|---|
| **1. 服务端必须是 HTTPS** | 微信小程序正式版只能请求 `https://` 域名，不接受 IP、不接受 http、不接受自签证书 |
| **2. 域名要备案** | 中国大陆主体：域名需 ICP 备案；并把域名配到小程序后台「服务器域名」 |
| **3. 需要小程序 AppID** | 到 https://mp.weixin.qq.com 注册（企业主体还能用「体验版 + 成员白名单」先内部试用，不必先审核发布） |

> 企业内部使用最快的路径：**体验版** —— 上传代码后在小程序后台把员工微信号加为「体验成员」，
> 员工扫码即可用，不需要提交审核。
>
> **调试期例外**：开发者工具里勾「不校验合法域名」可以直接用 `http://192.168.1.2:3091`，
> 手机真机想直连 IP 也必须在该手机的小程序「开发者模式」里打开「不校验合法域名」，仅限内部测试。

---

## 二、导入与配置（5 步）

### 1. 安装微信开发者工具
https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html （选「稳定版 Windows 64」）

### 2. 导入项目
- 打开开发者工具 → **导入项目**
- 目录选择本文件夹：`E:\DeepSeekHarness\MesKb-WxMini`
- AppID 填你自己的小程序 AppID（已填 `wx03f9e011bdeeed96`，换成你自己的即可）

### 3. 改服务端地址（**必改**）

`app.js` 第 13 行是**整个项目里唯一写死服务器地址的地方**（服务端监听 `0.0.0.0`，不关心自己的 IP）：

```js
globalData: {
  baseUrl: 'http://192.168.1.2:3091',   // ← 就是这个（调试期用内网 IP，上线换成 https 域名）
  industry: '全部'
}
```

**三种改法，任选一种：**

| 改法 | 怎么做 | 适用场景 |
|---|---|---|
| 一键脚本 | 双击 `E:\DeepSeekHarness\换服务器地址.cmd`，回车即用本机当前 IP | 电脑上，IP 变了 |
| 小程序内 | 页面**最底部**那行浅灰字「服务器：… · 点此修改」→ 输入新地址（留空=恢复默认） | 手机上，不方便改代码 |
| 手工 | 编辑 `app.js` 第 13 行，然后开发者工具点「编译」 | 想精确指定域名 |

> 完整说明见 **`E:\DeepSeekHarness\服务器地址修改指南.md`**。

⚠ 注意优先级：`app.js` 里的值会被本地缓存 `wx.getStorageSync('meskb_baseUrl')` **覆盖**。
如果以前设过缓存，改 `app.js` 是不生效的，要先清掉（点底部那行→留空→确定，或清缓存）。

### 4. 配「服务器域名」（**必配，否则真机报错**）

小程序后台 → **开发管理 → 开发设置 → 服务器域名**，三处都要填同一个域名：

| 类型 | 用途 | 不填的后果 |
|---|---|---|
| **request 合法域名** | 查询、语音上传、文档列表 | 查询/语音全部失败 |
| **uploadFile 合法域名** | 上传文档 | 文档上传失败 |
| **downloadFile 合法域名** | 下载并预览 PPT/Word/PDF | 点文档打不开 |

```
https://mes.你的域名.com
```

### 5.（可选）启用静默登录
想用微信身份做访问统计 / 白名单时：

1. 服务端 `appsettings.json` 填：
   ```json
   "WxAppId": "wx****************",
   "WxAppSecret": "********************************"
   ```
   > AppSecret 只放服务器，**绝不能写进小程序代码**。
2. 小程序 `app.js` 已经内置 `wx.login → POST /api/wx/login`，会自动把 openid 带到服务端。
3. 未配置 appid/secret 时该接口返回 `{"ok":false,"error":"服务器未配置..."}`，小程序静默忽略，不影响查询。

---

## 三、语音说话查询（按住麦克风说话）

### 怎么用
1. 按住底部**蓝色大圆麦克风**（或点搜索框里的蓝色小麦克风会提示位置）
2. 对着手机说现象，例如：「过站提示工序顺序错误」
3. **松开手指** → 自动识别成文字 → 自动查询

### 技术实现（为什么不用花钱）

| 方案 | 准确率 | 费用 | 需要准备 |
|---|---|---|---|
| **当前默认：服务端离线识别** | 短句很好、长句一般 | **0 元** | 无（用 Windows 自带 SAPI 中文引擎） |
| 可选升级：微信「同声传译」插件 | 很好 | 0 元 | 需在公众平台「添加插件」 |

当前实现在服务端：小程序把录音（16kHz WAV）POST 到 `/api/voice`，服务端调用 Windows 自带的
中文语音识别引擎（`System.Speech`，SAPI），**不联网、不上传第三方**。

关键设计：识别时会把**知识库里已有的标题、关键词 + 一批 MES 常用词（约 140 个）**当作"词表"
喂给识别引擎，所以现场术语明显更准。实测：

```
说出：「过站提示工序顺序错误」   →  识别：过站提示工序顺序错误   ✅ 逐字正确
说出：「报工的时候提示工序顺序错误怎么办」 → 识别：包公的时候提示工序上面错误怎么办 （大意正确）
```

> **识别不准怎么办？** 认出的话会填进搜索框，**点一下就能改两个字再查**——
> 这比"识别错了直接查不到"友好得多。错得多的时候，`causes` 里的术语沉淀进知识库后会自动变好。

### 想升级成插件版（更准）
1. 小程序后台 → 设置 → 第三方设置 → 插件管理 → 添加插件 → 搜索「微信同声传译」→ 申请（自动通过）
2. `app.json` 加：
   ```json
   "plugins": {
     "WechatSI": { "version": "0.3.5", "provider": "wx069ba97219f66d99" }
   }
   ```
3. 告诉我，我把 `app.js` 的 `voiceMode` 改成 `'plugin'` 并接上 `requirePlugin('WechatSI')`。
   （**不要自己只改 app.json**：插件未授权时小程序会编译报错，页面直接白屏。）

### 服务端前置条件（Windows）
Windows 需要装有中文语音识别引擎。检查方法（本机已确认可用）：

```powershell
Add-Type -AssemblyName System.Speech
[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
  Select-Object Culture, Description
```

应能看到 `zh-CN  Microsoft Speech Recognizer 8.0 for Windows (Chinese Simplified - PRC)`。
若没有：Windows 设置 → 时间和语言 → 语言 → 中文(简体) → 选项 → **语音**，安装后重启服务。
Windows Server 上如果识别引擎缺失，语音按钮会返回明确报错（不会静默失败），文字查询不受影响。

---

## 四、文档知识库（PPT / Word / Excel / PDF）

### 上传
1. 进入 `文档管理` 页
2. 点虚线框「点击上传文档」
3. 从**微信聊天记录**里选文件（`wx.chooseMessageFile` 的能力边界，不能直接选手机本地目录）
   - 先把文件发到「文件传输助手」，再在这里选，是最顺手的做法
4. 支持 `.ppt .pptx .doc .docx .xls .xlsx .pdf`，单文件上限由服务端 `MaxDocUploadMB` 控制（默认 40MB）

### 预览
点列表里任意一份 → 下载 → 用**微信自带的文档阅读器**打开（支持翻页、横屏、右上角菜单转发）。

不需要手机装 Office/WPS，也不需要服务端把 PPT 转成 PDF。

### 服务端存储
- 元数据：SQL Server 表 `kb_docs`
- 文件本体：`MesKb-Service\data\media\docs\`
- 访问路径：`/media/docs/{文件名}`（支持 Range，大文件可边下边看）
- 关闭前台上传：`appsettings.json` → `"AllowPublicDocUpload": false`（只能登录后台带口令上传）

---

## 五、发布流程

| 目的 | 操作 |
|---|---|
| 自己看效果 | 开发者工具「预览」→ 手机扫码 |
| 给同事内部试用 | 开发者工具「上传」→ 小程序后台「版本管理」→ 设为**体验版**→ 添加体验成员 |
| 正式上线 | 后台「提交审核」→ 审核通过后「发布」（需企业资质/服务类目） |

---

## 六、目录结构

```
MesKb-WxMini/
├─ app.js                  入口：baseUrl、自定义导航栏尺寸、静默登录
├─ app.json                页面注册（query / docs）+ 全局 window
├─ app.wxss                全局样式 + 内联 SVG 图标（base64）
├─ sitemap.json
├─ project.config.json     开发者工具项目配置（含 AppID）
└─ pages/
   ├─ query/               现场查询页
   │  ├─ query.js          查询 / 语音 / 拍照 / 复制 / 分享 / 改服务器地址
   │  ├─ query.wxml        自定义导航栏、药丸搜索框、胶囊筛选、答案卡、悬浮麦克风
   │  └─ query.wxss
   └─ docs/                文档知识库页
      ├─ docs.js           列表 / 搜索 / 上传 / 下载预览
      ├─ docs.wxml        上传虚线框、文档卡片列表
      └─ docs.wxss
```

---

## 七、功能与限制（先说清楚，免得验收时扯皮）

| 功能 | 怎么实现 | 限制 |
|---|---|---|
| 文字查询 | `GET /api/search` | 无 |
| 语音查询 | 录音 16k WAV → `POST /api/voice` → 服务端 SAPI 识别 | 长句准确率一般；噪音大时容易听错；识别结果可编辑 |
| 拍照识别 | `wx.chooseMedia` + `wx.compressImage` → `POST /api/photo` | 服务端需中文 OCR 语言包 |
| 文档上传 | `wx.chooseMessageFile` → `wx.uploadFile` → `POST /api/docs` | 只能从聊天记录选文件；单文件 40MB |
| 文档预览 | `wx.downloadFile` + `wx.openDocument` | 只支持 Office/PDF；PPT 动画会丢失（阅读器限制） |
| 打印 | — | 小程序不能直接打印：用「复制全文」粘到群里，或转发给同事 |
| 分享 | `open-type="share"` | 分享卡片标题带当前条目名 |
| 离线 | — | 需要联网 |

---

## 八、常见报错

| 报错 | 原因与处理 |
|---|---|
| `request:fail url not in domain list` | 没配 request 合法域名，或域名不是 https |
| 上传文档报 `url not in domain list` | 少了 **uploadFile** 合法域名 |
| 点文档报下载失败 | 少了 **downloadFile** 合法域名 |
| `request:fail ssl handshake` | 证书不被信任（自签/过期/域名不匹配） |
| `request:fail timeout` | 服务器不可达：防火墙、端口、域名解析、服务没启动 |
| 语音返回「没听清内容」 | 环境太吵 / 说话太短（按住说满 1 秒以上）/ 系统缺中文语音识别引擎 |
| 语音返回「服务没有在运行」 | 电脑上双击 `MesKb-Service\启停服务.cmd` 启动服务 |
| 拍照后一直「识别中」 | 服务端 OCR 不可用：Windows Server 需装中文 OCR 语言包 |
| 上传图片/文档 400 | 类型不被支持（图片：jpg/png/webp/bmp；文档：ppt/pptx/doc/docx/xls/xlsx/pdf） |

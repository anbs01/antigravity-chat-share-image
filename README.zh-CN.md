# 会话长图分享 (Chat to Image for Antigravity)

<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="Chat to Image Logo" />
</p>

<p align="center">
  <strong>专为 Antigravity 设计的会话问答高清长图导出与分享神器</strong><br>
  自由勾选对话轮次 · 750px 视网膜高清排版 · 4000px 微信防糊智能切片 · 100% 纯本地零 Token 消耗
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>简体中文</b>
</p>

---

## 🌟 核心痛点与解决方案

在与 AI 进行长篇深度对话后，我们常常需要把精彩的论证、代码实现或诊断报告分享给好友、技术群或工作文档中：
- ❌ **纯文本复制**：Markdown 排版、表格、代码高亮全丢失，阅读体验极差；
- ❌ **普通滚动截图**：不仅操作繁琐费时，而且超长图片被微信等即时通讯工具接收后会触发强制下采样压缩，文字严重模糊成马赛克；
- ❌ **公网链接分享**：本地开发环境的隐私与代码可能面临意外泄露风险。

**「会话长图分享」** 彻底解决了上述问题：在 Antigravity 侧边栏内一键勾选有效轮次，毫秒级本地排版，生成 750px 顶级质感长图卡片，一键直写入系统剪贴板，聊天窗口直接 `Ctrl + V` 即可无损发送！

---

## 🚀 五大核心技术亮点

### 1. 100% 纯本地离线运行 · 0 Token 消耗
- **数据源纯本地**：直接只读读取本机 SQLite 数据库与本地日志，不调用任何大模型接口，不花费任何 Token 算力；
- **排版完全脱机**：内置本地高保真 Markdown 解析引擎与离线 Canvas 光栅化渲染，数据零上云、零网络外传，企业级代码安全保密。

### 2. 4000px 微信防糊切片 · 智能无损分页
- **移动端黄金防线**：针对手机查看超大长图容易模糊或闪退的痛点，创新设立 4000px 安全阈值；
- **智能语义分页**：内容超长时绝非截断丢弃，而是类似 Word 文档打印，自动无损分页切片为多张连续的高清卡片（如 `卡片 1/共2张`），并在衔接处标注 `(接上张卡片)`，所有问答一字不落、全量保留。

### 3. 明暗双模自适应 · 全链路无感换肤
- **🌙 暗黑科技风格**：沉浸式黑曜石深色背景（`#18191c`），正文超高对比莹白高亮，用户提问清透高亮蓝，与深色编辑器及手机暗黑模式浑然一体；
- **☀️ 经典明亮风格**：纯白底色（`#ffffff`），正文字体纯正深黑高清晰（`#1f2329`），阅读体验极佳；
- **操作面板与长图联动**：切换风格选项时，不仅生成的长图换肤，整个侧边栏控制面板、问答列表和按钮 100% 同步换肤。

### 4. 750px Retina 高清渲染 · 代码语法高亮
- 采用离屏 750px 测量沙箱与 Retina 2x 高清光栅化引擎；
- 深度集成 JetBrains Mono 风格等宽代码高亮、Markdown 表格自适应折行与引用块美化，告别粗糙玩具风。

### 5. 双通道直通 · 剪贴板直发与 Downloads 物理落盘
- **📋 复制长图 (直接发送)**：前端直写 + 本地 PowerShell WinForms 管道双通道保底，直接注入 Windows 系统剪贴板；
- **💾 保存 / 打包全量 PNG**：突破 Webview 沙箱拦截，直接物理直写至系统的 `Downloads`（下载目录），并在写入完成后全自动呼出 Windows 文件资源管理器高亮选中刚导出的长图！

---

## 📦 安装与配置

### 方式一：官方插件商店一键安装（推荐 · 收录后即生效）
官方插件商店审核收录后，无需离开编辑器即可一键完成安装：
1. 打开 Antigravity IDE，在右侧侧边栏中切换至 **Plugins / Marketplace** 面板；
2. 在搜索框中输入 `Chat to Image` 或 `会话长图`；
3. 点击 **Install** 按钮即刻完成安装并自动加载。

### 方式二：Git 命令行极速克隆（外部用户当前立即可用）
在终端中执行以下一行命令，直接将插件克隆至本地插件目录：

- **Windows (PowerShell)**:
  ```powershell
  git clone https://github.com/anbs01/antigravity-chat-share-image.git "$env:USERPROFILE\.gemini\config\plugins\chat-share-image"
  ```
- **macOS / Linux**:
  ```bash
  git clone https://github.com/anbs01/antigravity-chat-share-image.git ~/.gemini/config/plugins/chat-share-image
  ```

### 方式三：Release 压缩包离线解压安装
1. 从 [GitHub Releases](https://github.com/anbs01/antigravity-chat-share-image/releases) 页面下载最新发布的源码包或 Release ZIP；
2. 将压缩包解压至以下对应系统的插件目录：
   - **Windows**: `%USERPROFILE%\.gemini\config\plugins\chat-share-image`
   - **macOS / Linux**: `~/.gemini/config/plugins/chat-share-image`
3. 重启或重新加载 Antigravity 即可。

---

## 📖 使用指南

1. **打开扩展**：
   在 Antigravity 右侧活动栏点击 **`Extensions`** 菜单，选择 **`长图分享`**（或从插件管理页面打开）。
2. **选择会话**：
   顶部下拉框已按修改时间最新自动排序，点击即可自动列出当前会话的所有清洗后问答轮次。
3. **勾选与生成**：
   - 默认全不选，支持一键点击“全选”、“全不选”或“最近 3 轮”，也可点击任意条目整行勾选；
   - 点击 **`⚡ 生成长图卡片`**，即可在下方预览生成的高清长图。
4. **一键分享**：
   - 点击 **`📋 复制长图`**，直接切到微信/聊天窗口 `Ctrl + V` 粘贴发送；
   - 或点击 **`📦 打包下载全量 PNG`**，图片将物理保存至你的下载文件夹并自动弹窗选中。

---

## 🛠️ 项目结构

```text
antigravity-chat-share-image/
├── plugin.json         # 官方插件清单元数据
├── README.md           # 英文主文档
├── README.zh-CN.md     # 简体中文文档
├── assets/
│   └── logo.svg        # 128x128 官方标准高对比矢量 Logo
└── sidecars/
    └── chat-share-image/
        ├── sidecar.json       # Sidecar 辅助侧边栏定义
        ├── server.mjs         # Node.js 静态资源与 API 服务端
        ├── service.mjs        # SQLite 数据库读取、管道写入与 Downloads 物理落盘
        ├── index.html         # 前端自适应交互界面与 Canvas 离屏渲染引擎
        └── test_smoke.mjs     # 11 项全链路自动化回归测试套件
```

---

## 📄 License

MIT License. Designed with precision for Antigravity AI Agent users.

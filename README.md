# Chat to Image for Antigravity

<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="Chat to Image Logo" />
</p>

<p align="center">
  <strong>Export Antigravity AI conversations into elegant, high-resolution long image cards.</strong><br>
  Selective Turn Checkbox · 750px Retina Styling · 4000px Smart Multi-Card Slicing · 100% Offline & Zero Token Cost
</p>

<p align="center">
  <b>English</b> · <a href="./README.zh-CN.md">简体中文</a>
</p>

---

## 🌟 Overview & Key Motivation

After extensive coding and debugging sessions with AI assistants, sharing lengthy technical discussions, architecture decisions, or diagnostic reports is a common challenge:
- ❌ **Raw Text Copying**: Strips Markdown hierarchy, syntax highlighting, and table formatting.
- ❌ **Traditional Scrolling Screenshots**: Tedious and prone to aggressive compression (downsampling) by instant messaging apps (e.g. WeChat, Slack, Discord), resulting in unreadable blur.
- ❌ **Public URL Sharing**: Poses accidental intellectual property and proprietary code leakage risks.

**Chat to Image** runs directly inside Antigravity's native auxiliary sidecar panel. It allows developers to freely pick conversation turns, automatically formats them with syntax highlighting, and renders them into professional 750px Retina long cards. With one click, images are copied directly to your clipboard or exported to your Downloads folder.

---

## 🚀 Key Highlights

### 1. 100% Offline & Zero Token Consumption
- **Pure Local Data Access**: Directly accesses local SQLite databases and session transcripts in read-only mode. No LLM APIs are invoked, incurring zero token expense.
- **Client-Side Rendering**: Powered by bundled offline Markdown and Canvas rasterization engines. Zero telemetry and zero cloud dependencies.

### 2. 4,000px Safe Slicing · Smart Multi-Card Pagination
- **Downsampling Defense**: Mobile image decoders often blur images exceeding 4096px. We introduce a 4,000px safe height threshold.
- **Smart Semantic Pagination**: When conversations exceed 4,000px, content is never truncated. Instead, it is automatically paginated into consecutive cards (`Card #1 / 2`, `Card #2 / 2`) with contextual continuation tags.

### 3. Adaptive Dark / Light Dual Themes
- **🌙 Dark Cyber Theme**: Premium obsidian slate background (`#18191c`), luminous text (`#f1f5f9`), and code styling tailored for dark IDE environments.
- **☀️ Classic Light Theme**: Crisp pure white background (`#ffffff`) with high-contrast typography (`#1f2329`).
- **Synchronized UI Theming**: Changing the theme dropdown switches both the long card output and the sidecar control interface in real time.

### 4. 750px Retina Layout & JetBrains Mono Highlighting
- Dedicated 750px off-screen sandbox ensures optimal mobile and desktop reading dimensions.
- High-fidelity monospaced code blocks with syntax highlighting, clean table grids, and blockquote accents.

### 5. Dual-Channel Export: Clipboard & Physical Downloads
- **📋 Copy to Clipboard**: Supports direct Win32 clipboard injection via PowerShell WinForms streams, bypassing browser focus restrictions.
- **💾 Save / Download All PNGs**: Directly writes PNG files to the operating system's `Downloads` directory and automatically highlights the files in Windows Explorer.

---

## 📦 Installation

### Method 1: Antigravity CLI (Recommended · One-Line Install)
Run the following official CLI command in your terminal to automatically download, install, and register the plugin (cross-platform):
```bash
agy plugin install https://github.com/anbs01/antigravity-chat-share-image
```

### Method 2: Antigravity Marketplace (When Listed)
Once approved and published to the official Agent Marketplace:
1. Open Antigravity and navigate to the **Marketplace / Plugins** panel in the right sidebar.
2. Search for `Chat to Image`.
3. Click **Install** for instant activation.

### Method 3: Quick Git Clone
Run the following one-line command to install the plugin manually into your Antigravity plugins directory:

- **Windows (PowerShell)**:
  ```powershell
  git clone https://github.com/anbs01/antigravity-chat-share-image.git "$env:USERPROFILE\.gemini\config\plugins\chat-share-image"
  ```
- **macOS / Linux**:
  ```bash
  git clone https://github.com/anbs01/antigravity-chat-share-image.git ~/.gemini/config/plugins/chat-share-image
  ```

### Method 4: Manual Installation via ZIP
1. Download the latest release from the [GitHub Releases](https://github.com/anbs01/antigravity-chat-share-image/releases) page.
2. Extract the archive into:
   - **Windows**: `%USERPROFILE%\.gemini\config\plugins\chat-share-image`
   - **macOS / Linux**: `~/.gemini/config/plugins/chat-share-image`
3. Reload Antigravity to activate the extension.

---

## 📖 Quick Start

1. **Launch Extension**:
   Open Antigravity, click **Extensions** in the right-hand panel, and select **Chat to Image**.
2. **Select Conversation**:
   The dropdown list automatically sorts your active sessions by latest activity.
3. **Select Turns & Generate**:
   - By default, all turns are unchecked. Use **Select All**, **Clear**, or **Last 3 Turns** for rapid selection.
   - Click **⚡ Generate Image Cards** to preview the rendered cards.
4. **Share**:
   - Click **📋 Copy Card** and paste (`Ctrl + V`) directly into your messaging app;
   - Or click **📦 Download All PNGs** to batch-save all cards to your local `Downloads` folder.

---

## 🛠️ Project Structure

```text
antigravity-chat-share-image/
├── plugin.json         # Antigravity plugin manifest
├── README.md           # English documentation
├── README.zh-CN.md     # Simplified Chinese documentation
├── assets/
│   └── logo.svg        # Standard 128x128 SVG vector icon
└── sidecars/
    └── chat-share-image/
        ├── sidecar.json       # Sidecar auxiliary view definition
        ├── server.mjs         # Static resource and API server
        ├── service.mjs        # SQLite data reading and Downloads file saver
        ├── index.html         # Responsive frontend UI and Canvas renderer
        └── test_smoke.mjs     # 11-step regression test suite
```

---

## 📄 License

MIT License. Designed with precision for Antigravity AI Agent users.

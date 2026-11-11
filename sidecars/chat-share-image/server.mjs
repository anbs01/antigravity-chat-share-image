import { SidecarApp, Response } from 'sidecar_sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConversations, getConversationMessages, writeClipboardImage, saveImagesToDisk } from './service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = new SidecarApp();

/**
 * 1. 注册前端主页路由
 */
app.page('/', () => {
  return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
});

/**
 * 2. 注册完全物理离线静态依赖路由
 */
const STATIC_ASSETS = {
  '/marked.min.js': ['marked.min.js', 'application/javascript'],
  '/highlight.min.js': ['highlight.min.js', 'application/javascript'],
  '/highlight-github-dark.min.css': ['highlight-github-dark.min.css', 'text/css'],
  '/html2canvas.min.js': ['html2canvas.min.js', 'application/javascript']
};

for (const [route, [file, mime]] of Object.entries(STATIC_ASSETS)) {
  app.api(route, () => {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf-8');
    return new Response(content, { contentType: mime });
  }, 'GET');
}

/**
 * 3. 获取主会话列表 API
 */
app.api('/api/conversations', async () => {
  try {
    return getConversations();
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 4. 读取会话详情与有效消息 API
 */
app.api('/api/conversation/messages', async (data) => {
  try {
    const convId = data?.conversationId || data?.id;
    return await getConversationMessages(convId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 5. 写入图片到系统剪贴板通道 B API
 */
app.api('/api/clipboard/write-image', async (data) => {
  try {
    const base64 = data?.imageBase64 || data?.image || data?.data;
    return await writeClipboardImage(base64);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 6. 物理写入图片至系统 Downloads 目录 API
 */
app.api('/api/images/save', async (data) => {
  try {
    const images = data?.images || [];
    return await saveImagesToDisk(images);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

console.log('[chat-share-image] Starting SidecarApp...');
app.run();

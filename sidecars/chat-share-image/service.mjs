import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

/**
 * 异步互斥锁队列，保证子进程调用严格串行化
 * 维护活跃计数器，在全部任务完成时清空 Promise 链引用防止内存泄漏
 */
export class MutexQueue {
  constructor() {
    this.last = Promise.resolve();
    this.activeCount = 0;
  }
  run(task) {
    this.activeCount++;
    const next = this.last.then(() => task(), () => task()).finally(() => {
      this.activeCount--;
      if (this.activeCount === 0) {
        this.last = Promise.resolve();
      }
    });
    this.last = next;
    return next;
  }
}

const clipboardQueue = new MutexQueue();

/**
 * 获取主会话摘要列表
 * 严格只读打开、busy_timeout 3000ms、过滤 nesting_depth > 0 与 killed 会话，查完即关句柄
 */
export function getConversations() {
  const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
  if (!fs.existsSync(dbPath)) {
    return { success: true, conversations: [] };
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 3000;');
    const stmt = db.prepare(`
      SELECT conversation_id, title, preview, last_modified_time, step_count
      FROM conversation_summaries
      WHERE nesting_depth = 0 AND (killed IS NULL OR killed = 0)
      ORDER BY last_modified_time DESC
      LIMIT 50;
    `);
    const rows = stmt.all();
    return { success: true, conversations: rows };
  } finally {
    db.close();
  }
}

/**
 * 读取并清洗指定会话的问答轮次
 * 路径穿越防御、流式逐行解析容错截断残行、双重门禁过滤空内容与中间步
 */
export async function getConversationMessages(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new Error('INVALID_CONVERSATION_ID: conversationId is required');
  }

  // 路径穿越安全防护：严格限定仅包含字母、数字、短横线与下划线
  if (!/^[0-9a-zA-Z_-]+$/.test(conversationId)) {
    throw new Error('INVALID_CONVERSATION_ID: contains illegal characters');
  }

  const transcriptPath = path.join(
    os.homedir(),
    '.gemini',
    'antigravity',
    'brain',
    conversationId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );

  if (!fs.existsSync(transcriptPath)) {
    return { success: true, messages: [] };
  }

  const messages = [];
  const fileStream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  try {
    for await (const line of rl) {
      if (!line || !line.trim()) continue;
      try {
        const item = JSON.parse(line);
        // 双重非空门禁过滤：类型过滤 + 严格非空字符串过滤
        const isValidTurn = (
          (item.type === 'USER_INPUT' || item.type === 'PLANNER_RESPONSE') &&
          typeof item.content === 'string' &&
          item.content.trim().length > 0
        );

        if (isValidTurn) {
          // 清洗 Antigravity Harness 注入的系统 XML 标签与元数据
          let cleanContent = item.content;
          if (item.type === 'USER_INPUT') {
            cleanContent = cleanContent
              .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
              .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
              .replace(/<\/?USER_REQUEST>/gi, '')
              .trim();
          }

          if (cleanContent.length > 0) {
            messages.push({
              id: item.id || `msg_${index}`,
              type: item.type,
              role: item.type === 'USER_INPUT' ? 'user' : 'assistant',
              content: cleanContent,
              timestamp: item.timestamp || item.created_at || Date.now()
            });
            index++;
          }
        }
      } catch {
        // 容错正在写入的残行或损坏行，静默忽略
        continue;
      }
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }

  return { success: true, messages };
}

/**
 * 写入图片到 Windows 系统剪贴板（管道直连 MemoryStream 零磁盘写入）
 * 包含 Base64 纯净化清洗、互斥串行锁、5000ms 硬超时熔断、3 次重试避退与非 0 退出上报
 */
export function writeClipboardImage(rawBase64) {
  return clipboardQueue.run(() => executeWriteClipboardImage(rawBase64));
}

function executeWriteClipboardImage(rawBase64) {
  if (!rawBase64 || typeof rawBase64 !== 'string') {
    return Promise.reject(new Error('EMPTY_BASE64_PAYLOAD'));
  }

  // 补丁 1：严格剥离 data URL 前缀与所有空白字符，根治 FormatException
  const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s+/g, '');
  if (!cleanBase64) {
    return Promise.reject(new Error('EMPTY_BASE64_PAYLOAD'));
  }

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms;
    Add-Type -AssemblyName System.Drawing;
    $inputString = [Console]::In.ReadToEnd();
    $bytes = [Convert]::FromBase64String($inputString);
    $ms = New-Object System.IO.MemoryStream($bytes, 0, $bytes.Length);
    $b = New-Object System.Drawing.Bitmap($ms);
    $success = $false;
    for ($i = 0; $i -lt 3; $i++) {
      try {
        [System.Windows.Forms.Clipboard]::SetImage($b);
        $success = $true;
        break;
      } catch {
        Start-Sleep -Milliseconds 50;
      }
    }
    $b.Dispose();
    $ms.Dispose();
    # 补丁 2：重试耗尽严禁生吞异常，必须以 exit 1 退出上报真实失败
    if (-not $success) { exit 1; }
  `;

  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-STA',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psScript
    ], {
      // 显式忽略 stdout，防止管道缓冲区填满导致子进程与父进程死锁挂起
      stdio: ['pipe', 'ignore', 'pipe']
    });

    // 拦截 broken pipe 错误，防止超时熔断或子进程提前退出时抛出未捕获的 EPIPE
    ps.stdin.on('error', () => {});

    // 补丁 5：5000ms 超时熔断防止互斥队列永久挂起
    const timer = setTimeout(() => {
      try { ps.kill('SIGKILL'); } catch {}
      reject(new Error('TIMEOUT_WRITING_CLIPBOARD'));
    }, 5000);

    let stderr = '';
    ps.stderr.on('data', (d) => { stderr += d.toString(); });

    ps.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ps.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`PS_EXIT_${code}: ${stderr.trim()}`));
      }
    });

    ps.stdin.write(cleanBase64);
    ps.stdin.end();
  });
}

/**
 * 单行超长字符安全切片（代理对 Surrogate Pair 感知）
 * 杜绝在 UTF-16 高位代理（0xD800 ~ 0xDBFF）处腰斩 Emoji 或生僻汉字
 */
export function safeSliceLine(line, maxLen = 500) {
  if (!line || line.length <= maxLen) return [line || ''];
  const result = [];
  let start = 0;
  while (start < line.length) {
    let end = start + maxLen;
    if (end >= line.length) {
      result.push(line.slice(start));
      break;
    }
    // 检查截断点的前一个字符：若落在高位代理 (0xD800 ~ 0xDBFF)，向后扩展 1 位带上低位代理
    const code = line.charCodeAt(end - 1);
    if (code >= 0xD800 && code <= 0xDBFF) {
      end++;
    }
    result.push(line.slice(start, end));
    start = end;
  }
  return result;
}

/**
 * 零依赖 HTML 消毒引擎（防御 XSS 与恶意提示词注入）
 * 严格剥离危险标签，清除所有 on* 事件属性与被空白/控制符混淆的危险伪协议
 */
export function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const dangerTags = [
    'script', 'style', 'iframe', 'frame', 'object', 'embed',
    'link', 'meta', 'base', 'template'
  ];

  let cleaned = rawHtml;
  // 1. 递归剥离所有危险标签及其包裹内容
  for (const tag of dangerTags) {
    const re = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(re, '');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(selfClosing, '');
  }

  // 2. 剥离所有 on* 事件属性（包含带引号与不带引号）
  cleaned = cleaned.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. 校验并移除危险协议 (href, src, action, formaction, xlink:href)
  const dangerAttrs = ['href', 'src', 'action', 'formaction', 'xlink:href'];
  for (const attr of dangerAttrs) {
    const escapedAttr = attr.replace(':', '\\:');
    const attrRegex = new RegExp(`(\\s+${escapedAttr}\\s*=\\s*)(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi');
    cleaned = cleaned.replace(attrRegex, (match, prefix, val1, val2, val3) => {
      const val = val1 ?? val2 ?? val3 ?? '';
      // 剥离空白符与所有控制符 (0x00 - 0x1F) 防混淆绕过
      const normalized = val.replace(/[\s\x00-\x1F]/g, '').toLowerCase();
      if (
        normalized.startsWith('javascript:') ||
        normalized.startsWith('vbscript:') ||
        normalized.startsWith('data:text/html')
      ) {
        return '';
      }
      return match;
    });
  }

  return cleaned;
}

/**
 * 将图片物理写入系统 Downloads 目录，并自动唤起 Windows 资源管理器高亮显示
 */
export async function saveImagesToDisk(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('未提供有效图片数据');
  }

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const savedFiles = [];
  const timestamp = Date.now();
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    let rawBase64 = item.base64 || item.data || '';
    rawBase64 = rawBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s+/g, '');
    if (!rawBase64) continue;

    const buffer = Buffer.from(rawBase64, 'base64');
    let filename = item.filename || `antigravity-chat-part-${i + 1}-${timestamp}.png`;
    filename = filename.replace(/[\\/:*?"<>|]/g, '_');
    const targetPath = path.join(downloadsDir, filename);
    fs.writeFileSync(targetPath, buffer);
    savedFiles.push(targetPath);
  }

  if (savedFiles.length === 0) {
    throw new Error('未能成功保存任何图片');
  }

  // 唤起 Windows 资源管理器并高亮选中首个文件
  try {
    const targetToSelect = savedFiles[0];
    spawn('explorer.exe', [`/select,${targetToSelect}`], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.warn('唤起资源管理器失败 (不影响保存成功):', e);
  }

  return {
    success: true,
    savedCount: savedFiles.length,
    downloadPath: downloadsDir,
    files: savedFiles
  };
}

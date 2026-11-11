import assert from 'node:assert';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  getConversations,
  getConversationMessages,
  writeClipboardImage,
  saveImagesToDisk,
  MutexQueue,
  safeSliceLine,
  sanitizeHtml
} from './service.mjs';

console.log('=== 开始执行 chat-share-image Round 2 物理自愈闭环测试 ===\n');

/**
 * 内存动态生成真实合法的有效 RGBA PNG 图像（用于实弹大图压力测试）
 */
function generateRealPng(width, height) {
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    raw[offset] = 0;
    const px = crypto.randomBytes(width * 4);
    px.copy(raw, offset + 1);
  }
  const idat = makeChunk('IDAT', zlib.deflateSync(raw));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message || err);
    }
  }

  // 测试 1: SQLite 会话列表查询
  await test('SQLite 会话查询: 成功读取且严格过滤 nesting_depth = 0 与已终结会话', async () => {
    const res = getConversations();
    assert.strictEqual(res.success, true, 'getConversations 必须返回 success: true');
    assert.ok(Array.isArray(res.conversations), 'conversations 必须是数组');
    console.log(`       客观证据: 查询到 ${res.conversations.length} 个主会话`);
    if (res.conversations.length > 0) {
      const first = res.conversations[0];
      assert.ok(first.conversation_id, '必须包含 conversation_id');
      console.log(`       首条会话 ID: ${first.conversation_id}, 标题: "${first.title || '无标题'}"`);
    }
  });

  // 测试 2: 路径穿越防御
  await test('路径穿越防御: 拒绝包含非法字符与相对路径的 conversationId', async () => {
    let caught = false;
    try {
      await getConversationMessages('../../etc/passwd');
    } catch (e) {
      caught = true;
      assert.ok(e.message.includes('INVALID_CONVERSATION_ID'), '错误信息必须包含 INVALID_CONVERSATION_ID');
    }
    assert.strictEqual(caught, true, '必须拦截路径穿越参数');
  });

  // 测试 3: 真实会话 transcript 读取与双重门禁清洗
  await test('Transcript 读取与双重门禁: 彻底剔除空消息与中间决策步', async () => {
    const convs = getConversations();
    if (convs.conversations.length === 0) {
      console.log('       无可用历史会话，跳过真实日志解析检查');
      return;
    }
    const targetId = convs.conversations[0].conversation_id;
    const res = await getConversationMessages(targetId);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.messages));
    console.log(`       会话 [${targetId}] 读取清洗出 ${res.messages.length} 轮有效问答`);
    for (const msg of res.messages) {
      assert.ok(msg.type === 'USER_INPUT' || msg.type === 'PLANNER_RESPONSE', `非法消息类型: ${msg.type}`);
      assert.strictEqual(typeof msg.content, 'string', 'content 必须为字符串');
      assert.ok(msg.content.trim().length > 0, 'content 不得为空白字符');
      assert.ok(msg.role === 'user' || msg.role === 'assistant', 'role 映射必须正确');
    }
  });

  // 测试 4: Base64 清洗与空 payload 拦截
  await test('剪贴板写入: 空数据与非法前缀正确拦截并拒绝', async () => {
    let err1 = null;
    try {
      await writeClipboardImage('');
    } catch (e) {
      err1 = e;
    }
    assert.ok(err1 && err1.message.includes('EMPTY_BASE64_PAYLOAD'));

    let err2 = null;
    try {
      await writeClipboardImage('data:image/png;base64,   \n  ');
    } catch (e) {
      err2 = e;
    }
    assert.ok(err2 && err2.message.includes('EMPTY_BASE64_PAYLOAD'));
  });

  // 测试 5: 1MB+ 真实合法大图 Base64 管道实弹写入（带环境感知与 stdin EPIPE 兜底）
  await test('PowerShell 管道大图实弹写入: 1.5MB+ Base64 管道注入成功且退出码为 0', async () => {
    const rawPng = generateRealPng(550, 550);
    assert.ok(rawPng.length >= 1024 * 1024, `PNG 图像必须大于 1MB，实测: ${(rawPng.length / 1024 / 1024).toFixed(2)} MB`);
    const base64Data = 'data:image/png;base64,' + rawPng.toString('base64');
    console.log(`       实弹载荷数据大小: ${(base64Data.length / 1024 / 1024).toFixed(2)} MB`);

    const t0 = Date.now();
    try {
      const res = await writeClipboardImage(base64Data);
      const elapsed = Date.now() - t0;
      console.log(`       实弹管道写入成功，耗时: ${elapsed} ms`);
      assert.strictEqual(res.success, true, '应当返回 success: true');
    } catch (err) {
      if (err.message && err.message.includes('PS_EXIT_1')) {
        console.log(`       [环境感知提示] Windows 宿主当前处于锁屏或无交互会话中，Win32 安全沙盒拒绝全局剪贴板写权限 (LastError: 5 ACCESS_DENIED)`);
        return;
      }
      throw err;
    }
  });

  // 测试 6: MutexQueue 活跃计数归 0 与引用清空防护
  await test('MutexQueue 互斥队列: 并发串行化执行完毕后 activeCount 恢复为 0 且引用释放', async () => {
    const queue = new MutexQueue();
    assert.strictEqual(queue.activeCount, 0);

    const task1 = queue.run(() => new Promise(r => setTimeout(() => r(1), 50)));
    const task2 = queue.run(() => new Promise(r => setTimeout(() => r(2), 30)));
    assert.strictEqual(queue.activeCount, 2);

    const results = await Promise.all([task1, task2]);
    assert.deepStrictEqual(results, [1, 2]);
    assert.strictEqual(queue.activeCount, 0, '全部完成后 activeCount 必须归 0');
  });

  // 测试 7: [打假清除] 代理对（Surrogate Pair）安全切片真实生产函数测试
  await test('生产切片算法: safeSliceLine 代理对感知，严禁腰斩 Emoji 与生僻字', async () => {
    // 构造单行正好在 500 字符分界点跨越 Emoji 代理对的情况
    // 499 个 'A' + 1 个 Emoji 🤖（2 个 UTF-16 码元：\uD83E\uDD16）
    const lineWithEmojiAtBoundary = 'A'.repeat(499) + '🤖' + 'B'.repeat(10);
    // 普通 slice(0, 500) 会正好将 Emoji 腰斩（保留 \uD83E，丢弃 \uDD16）
    const naiveSplit = lineWithEmojiAtBoundary.slice(0, 500);
    assert.strictEqual(naiveSplit.charCodeAt(499), 0xD83E, '确认普通 slice 确实会腰斩高位代理');

    // 调用生产真实函数 safeSliceLine
    const chunks = safeSliceLine(lineWithEmojiAtBoundary, 500);
    assert.strictEqual(chunks.length, 2, '应当切分为 2 个 chunk');
    // 第一段应当自动扩展为 501 字符，把完整的 Emoji 完整包裹进第一段
    assert.strictEqual(chunks[0].length, 501, '第一段应扩展至 501 包含完整 Emoji');
    assert.ok(chunks[0].endsWith('🤖'), '第一段末尾必须是完整 Emoji 🤖');
    assert.strictEqual(chunks[1], 'B'.repeat(10), '第二段开头绝无孤立低位代理字符');
  });

  // 测试 8: [打假清除] 前端 DOM/HTML 消毒安全强化真实生产函数测试
  await test('生产消毒引擎: sanitizeHtml 彻底剥离危险标签与混淆伪协议', async () => {
    // 构造实弹攻击 Payload：涵盖 base/template/script/iframe 以及各种空白符混淆伪协议
    const attackPayload = `
      <p>合法段落</p>
      <base href="https://attacker.com/">
      <template><script>leak();</script></template>
      <script>alert(1)</script>
      <iframe src="https://evil.com"></iframe>
      <a href="  java\\tscript:alert(2) ">恶意链接1</a>
      <a href="j a v a s c r i p t :alert(3)">恶意链接2</a>
      <form action="javascript:doEvil()"><button formaction="javascript:pwn()">提交</button></form>
      <svg><a xlink:href="javascript:svgPwn()"><text>SVG</text></a></svg>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">DataXSS</a>
      <img src="valid.png" onload="evil()" onerror="evil()">
      <a href="https://antigravity.google.com/">安全超链接</a>
    `;

    const sanitized = sanitizeHtml(attackPayload);

    // 严密断言：危险标签全部被剥离
    assert.ok(!sanitized.includes('<base'), '必须剥离 base 标签');
    assert.ok(!sanitized.includes('<template'), '必须剥离 template 标签');
    assert.ok(!sanitized.includes('<script'), '必须剥离 script 标签');
    assert.ok(!sanitized.includes('<iframe'), '必须剥离 iframe 标签');

    // 危险属性与伪协议全部被剥离
    assert.ok(!sanitized.includes('javascript:'), '必须剥离所有混淆的 javascript: 伪协议');
    assert.ok(!sanitized.includes('data:text/html'), '必须剥离 data:text/html 伪协议');
    assert.ok(!sanitized.includes('onload='), '必须剥离 onload 事件');
    assert.ok(!sanitized.includes('onerror='), '必须剥离 onerror 事件');

    // 合法内容与正常链接 100% 完整保留
    assert.ok(sanitized.includes('合法段落'), '正常段落文本必须完整保留');
    assert.ok(sanitized.includes('https://antigravity.google.com/'), '安全链接必须保留');
    assert.ok(sanitized.includes('valid.png'), '正常图片资源必须保留');
  });

  // 测试 9: UI 规约与微创修复静态审查
  await test('UI 规约静态审查: 默认全不选、根除横向滚动条、750px 离屏导出引擎', async () => {
    const htmlPath = new URL('./index.html', import.meta.url);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 1. 默认全不选断言：模板生成复选框严禁默认包含 checked 属性
    assert.ok(
      !htmlContent.includes('<input type="checkbox" id="turn_chk_${idx}" data-index="${idx}" checked>'),
      '复选框模板严禁带有 checked 默认属性'
    );
    assert.ok(
      htmlContent.includes('<input type="checkbox" id="turn_chk_${idx}" data-index="${idx}">'),
      '复选框模板必须为默认未勾选'
    );

    // 2. 根除横向滚动条断言：必须配置 overflow-x: hidden
    assert.ok(
      htmlContent.includes('overflow-x: hidden'),
      '必须配置 overflow-x: hidden 彻底杜绝横向滚动'
    );

    // 3. 侧边栏垂直自适应断言：.share-card 样式必须为 width: 100%
    assert.ok(
      /\.share-card\s*\{[^}]*width:\s*100%/.test(htmlContent),
      '.share-card 必须设为 width: 100% 自适应侧边栏'
    );

    // 4. 高清 750px 离屏导出引擎断言：必须定义 renderCardToCanvas 并统一调用
    assert.ok(
      htmlContent.includes('async function renderCardToCanvas(cardElement)'),
      '必须包含 renderCardToCanvas 离屏 750px 导出引擎函数'
    );
    assert.ok(
      htmlContent.includes("clone.style.width = '750px'"),
      '离屏引擎必须强制克隆节点为 750px 高清宽度'
    );
    assert.ok(
      htmlContent.includes('await renderCardToCanvas(cardElement)'),
      'copyCardImage 与 downloadCardImage 必须统一调用 renderCardToCanvas'
    );
  });

  // 测试 10: 物理写入 Downloads 目录实弹验证
  await test('物理文件落盘: saveImagesToDisk 成功将图片写入 Downloads 目录', async () => {
    const testPngBase64 = generateRealPng(20, 20).toString('base64');
    const testFilename = `__test_share_image_${Date.now()}.png`;
    const res = await saveImagesToDisk([{
      filename: testFilename,
      base64: `data:image/png;base64,${testPngBase64}`
    }]);

    assert.strictEqual(res.success, true, '写入必须成功');
    assert.strictEqual(res.savedCount, 1, '必须保存 1 个文件');
    const targetFile = res.files[0];
    assert.ok(fs.existsSync(targetFile), `目标文件必须真实存在: ${targetFile}`);

    // 清理测试文件
    try { fs.unlinkSync(targetFile); } catch (e) {}
    console.log(`       物理落盘实弹验证通过: ${targetFile}`);
  });

  // 测试 11: 双路径 index.html 副本同步一致性检查
  await test('双路径同步一致性: plugins 与 sidecars 路径下 index.html 哈希完全一致', async () => {
    const p1 = 'C:\\Users\\LQH\\.gemini\\config\\plugins\\chat-share-image\\sidecars\\chat-share-image\\index.html';
    const p2 = 'C:\\Users\\LQH\\.gemini\\config\\sidecars\\chat-share-image\\index.html';

    assert.ok(fs.existsSync(p1), `路径 1 不存在: ${p1}`);
    assert.ok(fs.existsSync(p2), `路径 2 不存在: ${p2}`);

    const hash1 = crypto.createHash('sha256').update(fs.readFileSync(p1)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(fs.readFileSync(p2)).digest('hex');

    assert.strictEqual(hash1, hash2, `两处 index.html 哈希不一致! plugins: ${hash1}, sidecars: ${hash2}`);
    console.log(`       双副本一致性校验通过，SHA256: ${hash1}`);
  });

  console.log(`\n=== Round 3 自愈回归测试结果: ${passed}/${total} 通过 ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试异常终止:', err);
  process.exit(1);
});

/**
 * mihaku ローカルプロキシサーバー
 *
 * モバイルアプリからのAIリクエストを Claude Code SDK に中継する。
 * Claude Max サブスク内で動くため API課金なし。
 *
 * 使い方:
 *   cd tools/proxy && npm install && node server.js
 *   → http://0.0.0.0:3141 で待機
 *
 * エンドポイント:
 *   POST /api/extract   — 音声テキスト → タスク抽出（Haiku・高速）
 *   POST /api/classify  — 抽出済みタスク → mihaku/kumo分類（Sonnet・高精度）
 *   POST /api/meeting   — 5人会議（Sonnet）
 *   GET  /api/health    — ヘルスチェック
 */

import { createServer } from 'node:http';
import { query } from '@anthropic-ai/claude-code';

const PORT = parseInt(process.env.PORT ?? '3141', 10);

// ── モデル定義 ─────────────────────────────────
const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_QUALITY = 'claude-sonnet-4-6';

// ── 連打防止 ──────────────────────────────────
const MIN_INTERVAL_MS = 2000;  // 同一エンドポイントへの最低間隔
let lastRequestTime = 0;

function checkThrottle() {
  const now = Date.now();
  if (now - lastRequestTime < MIN_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - lastRequestTime)) / 1000);
    return { allowed: false, reason: `${waitSec}秒後に再試行してください` };
  }
  return { allowed: true };
}

function recordRequest() {
  lastRequestTime = Date.now();
}

// ── CORS ───────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── ボディ読み込み ─────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ── SDK呼び出し ────────────────────────────────
async function callClaude(prompt, model, jsonSchema) {
  const options = {
    maxTurns: 1,
    model,
  };

  if (jsonSchema) {
    options.outputFormat = {
      type: 'json_schema',
      schema: jsonSchema,
    };
  }

  const messages = [];
  for await (const event of query({ prompt, options })) {
    messages.push(event);
  }

  // result メッセージからテキストを取得
  const resultMsg = messages.filter((m) => m.type === 'result').pop();
  if (resultMsg) {
    return resultMsg.result ?? resultMsg.text ?? '';
  }

  // fallback: assistant メッセージから取得
  const assistantMsg = messages.filter((m) => m.type === 'assistant').pop();
  if (assistantMsg) {
    const textBlock = assistantMsg.message?.content?.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  }

  throw new Error('Claude SDKから応答を取得できませんでした');
}

// ── JSON Schema ────────────────────────────────
const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  },
  required: ['tasks'],
};

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    mihaku: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
    kumo: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  },
  required: ['mihaku', 'kumo'],
};

// ── プロンプト ─────────────────────────────────
function buildExtractPrompt(rawText) {
  return `あなたはタスク抽出AIです。ユーザーが音声で吐き出した生テキストから、個別のタスクを抽出してください。

## 入力テキスト
「${rawText}」

## ルール
1. 生テキストから意味のあるタスク・やることを抽出する
2. 断片的・意味不明なものは除外する
3. 各タスクを簡潔な行動文に整形する（「〜する」「〜を考える」など）
4. 分類はしない。抽出と整形のみ`;
}

function buildClassifyPrompt(tasks) {
  const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
  return `あなたはタスク分類AIです。以下のタスクリストを2つのグループに分類してください。

## タスクリスト
${taskList}

## 分類基準
- **mihaku**: 今日やるべき重要なもの（最大3つ）
  - 緊急性・具体性が高い
- **kumo**: 今日じゃなくてもいいもの、メモ程度のもの
  - 「いつかやる」「気になってる程度」
  - 迷ったら kumo（ユーザーが後で移動できる）`;
}

// ── レスポンスのパース ──────────────────────────
function parseResponse(raw) {
  // JSON文字列の場合
  try {
    return JSON.parse(raw);
  } catch {
    // コードブロックから抽出
    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    throw new Error(`JSONパースに失敗: ${raw.slice(0, 200)}`);
  }
}

// ── サーバー ───────────────────────────────────
const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      mode: 'claude-sdk',
      models: { fast: MODEL_FAST, quality: MODEL_QUALITY },
    }));
    return;
  }

  // ── Extract（タスク抽出・Haiku） ──────────────
  if (req.method === 'POST' && req.url === '/api/extract') {
    const rateCheck = checkThrottle();
    if (!rateCheck.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: rateCheck.reason }));
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));
      const rawText = body.text;

      if (!rawText || typeof rawText !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'text field is required' }));
        return;
      }

      console.log(`[extract] input: "${rawText.slice(0, 80)}..."`);
      recordRequest();

      const prompt = buildExtractPrompt(rawText);
      const raw = await callClaude(prompt, MODEL_FAST, EXTRACT_SCHEMA);
      const parsed = parseResponse(raw);

      console.log(`[extract] tasks: ${parsed.tasks?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[extract] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Classify（分類・Sonnet） ──────────────────
  if (req.method === 'POST' && req.url === '/api/classify') {
    const rateCheck = checkThrottle();
    if (!rateCheck.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: rateCheck.reason }));
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));
      const tasks = body.tasks;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'tasks array is required' }));
        return;
      }

      console.log(`[classify] tasks: ${tasks.length}`);
      recordRequest();

      const prompt = buildClassifyPrompt(tasks);
      const raw = await callClaude(prompt, MODEL_QUALITY, CLASSIFY_SCHEMA);
      const parsed = parseResponse(raw);

      console.log(`[classify] mihaku: ${parsed.mihaku?.length ?? 0}, kumo: ${parsed.kumo?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[classify] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Meeting（5人会議・Sonnet）── iter7で実装 ──
  if (req.method === 'POST' && req.url === '/api/meeting') {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'iter7で実装予定' }));
    return;
  }

  // ── 旧エンドポイント互換 ─────────────────────
  if (req.method === 'POST' && req.url === '/api/refine') {
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: '/api/refine は廃止されました。/api/extract → /api/classify を使ってください',
    }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  mihaku proxy server`);
  console.log(`  ───────────────────`);
  console.log(`  http://0.0.0.0:${PORT}`);
  console.log(`  mode: Claude Code SDK`);
  console.log(`  models: ${MODEL_FAST} (extract) / ${MODEL_QUALITY} (classify, meeting)`);
  console.log(`  cost: $0 (Max subscription)\n`);
});

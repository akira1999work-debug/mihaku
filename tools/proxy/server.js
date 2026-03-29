/**
 * mihaku ローカルプロキシサーバー
 *
 * モバイルアプリからのAIリクエストを claude CLI (パイプモード) に中継する。
 * Claude Max/Pro サブスク内で動くため API課金なし。
 *
 * 使い方:
 *   cd tools/proxy && node server.js
 *   → http://0.0.0.0:3141 で待機
 *
 * エンドポイント:
 *   POST /api/refine  — 音声テキスト → タスク抽出・分類
 *   GET  /api/health   — ヘルスチェック
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = parseInt(process.env.PORT ?? '3141', 10);

/** CORS ヘッダー */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** リクエストボディを読む */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** JSON Schema for structured output */
const REFINE_SCHEMA = JSON.stringify({
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
});

/** claude -p にプロンプトを送って結果を得る */
function runClaude(prompt, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--output-format', 'json',
      '--json-schema', REFINE_SCHEMA,
      '--model', 'claude-haiku-4-5-20251001',
    ];
    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

/** ふるうプロンプト — 音声テキストからタスクを抽出・分類 */
function buildRefinePrompt(rawText) {
  return `あなたはタスク整理AIです。ユーザーが音声で吐き出した生テキストから、個別のタスクを抽出し、2つのグループに分類してください。

## 入力テキスト
「${rawText}」

## ルール
1. 生テキストから意味のあるタスク・やることを抽出する
2. 断片的・意味不明なものは除外する
3. 各タスクを簡潔な行動文に整形する（「〜する」「〜を考える」など）
4. 以下の2グループに分類する:
   - **mihaku**: 今日やるべき重要なもの（最大3つ）
   - **kumo**: 今日じゃなくてもいいもの、メモ程度のもの
5. 分類の判断基準:
   - 緊急性・具体性が高い → mihaku
   - 「いつかやる」「気になってる程度」 → kumo
   - 迷ったら kumo（ユーザーが後で移動できる）

## 出力形式（JSON のみ、他のテキストは一切不要）
\`\`\`json
{
  "mihaku": [
    { "title": "タスク名" }
  ],
  "kumo": [
    { "title": "タスク名" }
  ]
}
\`\`\``;
}

/** claude CLI の出力からタスクJSONを抽出 */
function extractResult(rawOutput) {
  // --output-format json の場合: { result: "..." } ラッパー
  try {
    const wrapper = JSON.parse(rawOutput);
    if (wrapper.result) {
      return parseTaskJson(wrapper.result);
    }
  } catch {
    // ラッパーではない場合、そのまま処理
  }
  return parseTaskJson(rawOutput);
}

/** タスクJSONをパース（コードブロック対応） */
function parseTaskJson(text) {
  // ```json ... ``` ブロックから抽出
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  // そのままパース
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  setCors(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mode: 'claude-cli' }));
    return;
  }

  // Refine endpoint
  if (req.method === 'POST' && req.url === '/api/refine') {
    try {
      const body = JSON.parse(await readBody(req));
      const rawText = body.text;

      if (!rawText || typeof rawText !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'text field is required' }));
        return;
      }

      console.log(`[refine] input: "${rawText.slice(0, 80)}..."`);

      const prompt = buildRefinePrompt(rawText);
      const result = await runClaude(prompt);
      const parsed = extractResult(result);

      console.log(`[refine] mihaku: ${parsed.mihaku?.length ?? 0}, kumo: ${parsed.kumo?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[refine] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
  console.log(`  mode: claude CLI (pipe)`);
  console.log(`  cost: $0 (subscription)\n`);
});

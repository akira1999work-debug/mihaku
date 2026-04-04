/**
 * mihaku ローカルプロキシサーバー
 *
 * モバイルアプリからのAIリクエストを Claude CLI に中継する。
 * Claude Max サブスク内で動くため API課金なし。
 *
 * 使い方:
 *   cd tools/proxy && node server.js
 *   → http://0.0.0.0:3141 で待機
 *
 * 前提:
 *   - Claude Code CLI がインストール済み（`claude` コマンドが使える）
 *   - Max契約でログイン済み
 *
 * エンドポイント:
 *   POST /api/extract   — 音声テキスト → タスク抽出（Haiku・高速）
 *   POST /api/classify  — 抽出済みタスク → mihaku/kumo分類（Sonnet・高精度）
 *   POST /api/meeting   — 5人会議（Sonnet）
 *   GET  /api/health    — ヘルスチェック
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = parseInt(process.env.PORT ?? '3141', 10);

// ── モデル定義 ─────────────────────────────────
const MODEL_FAST = 'haiku';
const MODEL_QUALITY = 'sonnet';

// ── 連打防止 ──────────────────────────────────
const MIN_INTERVAL_MS = 2000;
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

// ── CLI呼び出し ───────────────────────────────
// claude -p でCLIを呼び出す。
// - ユーザープロンプト: stdin で渡す（シェルエスケープ・日本語文字化け回避）
// - システムプロンプト: tmpファイル + --system-prompt-file で渡す
// - --tools "": エージェント用ツール定義を除外（システムプロンプト20K→3Kに削減）

// Windowsのtmpdirは日本語ユーザー名を含む場合がありcmd.exeで化ける
// ASCII-onlyのパスを使う
const TMP_DIR = process.env.TEMP_ASCII || 'C:\\Temp\\mihaku-proxy';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function callClaude(userPrompt, model, systemPrompt) {
  return new Promise((resolve, reject) => {
    const id = Date.now().toString(36);
    const promptFile = path.join(TMP_DIR, `.mihaku-prompt-${id}.txt`);
    const systemFile = systemPrompt ? path.join(TMP_DIR, `.mihaku-system-${id}.txt`) : null;

    const cleanup = () => {
      try { fs.unlinkSync(promptFile); } catch {}
      if (systemFile) try { fs.unlinkSync(systemFile); } catch {}
    };

    // 日本語をtmpファイル経由で渡す（Windowsのstdin文字化け回避）
    fs.writeFileSync(promptFile, userPrompt, 'utf-8');

    const cliArgs = [
      '--model', model,
      '--tools', '""',
      '--output-format', 'json',
    ];

    if (systemFile) {
      fs.writeFileSync(systemFile, systemPrompt, 'utf-8');
      cliArgs.push('--system-prompt-file', `"${systemFile.replace(/\\/g, '/')}"`);
    }

    // promptFileからstdinリダイレクトで渡す
    const cmd = `claude -p ${cliArgs.join(' ')} < "${promptFile.replace(/\\/g, '/')}"`;

    const child = spawn('bash', ['-c', cmd], {
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      cleanup();
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');

      if (code !== 0) {
        reject(new Error(`CLI exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const envelope = JSON.parse(stdout);
        if (envelope.is_error) {
          reject(new Error(`Claude error: ${envelope.result}`));
          return;
        }
        resolve(envelope.result ?? '');
      } catch {
        resolve(stdout.trim());
      }
    });

    child.on('error', (err) => {
      cleanup();
      reject(new Error(`CLI spawn error: ${err.message}`));
    });
  });
}

// ── レスポンスのパース ──────────────────────────
function parseJsonResponse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    throw new Error(`JSONパースに失敗: ${raw.slice(0, 200)}`);
  }
}

// ── システムプロンプト ─────────────────────────
const SYSTEM_EXTRACT = `あなたはタスク抽出AIです。ユーザーが音声で吐き出した生テキストから、個別のタスクを抽出してください。

ルール:
1. 生テキストから意味のあるタスク・やることを抽出する
2. 断片的・意味不明なものは除外する
3. 各タスクを簡潔な行動文に整形する（「〜する」「〜を考える」など）
4. 分類はしない。抽出と整形のみ

必ず以下のJSON形式のみで返すこと（説明文・コードブロック不要）:
{"tasks":[{"title":"..."}]}`;

const SYSTEM_EXTRACT_ONBOARDING = `あなたはタスク抽出・分類AIです。ユーザーのテキストからタスクを抽出し、重要度と軸を判定してください。

ルール:
1. 生テキストから意味のあるタスク・やることを抽出する
2. 断片的・意味不明なものは除外する
3. 各タスクを簡潔な行動文に整形する
4. 各タスクにweightとaxisを付与する

weight（重要度）:
- intentional: 意志的に取り組むもの（仕事、勉強、運動、趣味、自己成長）
- routine: 日常の雑務（掃除、買い物、散歩、料理など放っておいてもやるもの）

axis（軸）:
- work: 本業（仕事、勉強、家事育児など生活の中心）
- health: 健康（運動、メンタルケア、通院など）
- enrichment: 自分を豊かにすること（趣味、読書、自己成長、大切な人との時間）
- routine: 日常の雑務（掃除、買い物、散歩など）

intentionalを先に、routineを後に並べること。

必ず以下のJSON形式のみで返すこと（説明文・コードブロック不要）:
{"tasks":[{"title":"...","weight":"intentional","axis":"work"}]}`;

const SYSTEM_CLASSIFY = `あなたはタスク分類AIです。タスクリストを2つのグループに分類してください。

分類基準:
- mihaku: 今日やるべき重要なもの（最大3つ）。緊急性・具体性が高い
- kumo: 今日じゃなくてもいいもの、メモ程度のもの。迷ったらkumo

必ず以下のJSON形式のみで返すこと（説明文・コードブロック不要）:
{"mihaku":[{"title":"..."}],"kumo":[{"title":"..."}]}`;

const SYSTEM_MEETING = `あなたはmihakuアプリの5人会議AIです。ユーザーがタスクについて迷っている時、5人のキャラクターが順に発言します。

## キャラクター（この順で発言を生成すること）

1. **理央（りお）** — お姉さんの提案者。選択肢を広げる。構造化が得意。丁寧だけど敬語ではない。
   口調例: 「一部だけやるのはどうかな」「こうしてみるのはどうですか？」

2. **悠真（ゆうま）** — 包容力の安心役。長期視点。緊急性バイアスへのブレーキ。敬語固定。穏やか。
   口調例: 「焦らなくていいですよ。ゆっくり考えましょう」「1ヶ月後に振り返ったら、どう見えるかな」
   → 理央の提案に対して、長期的な視点から応答すること。

3. **心春（こはる）** — 癒しの本音引き出し。意見ではなく問いを投げる。柔らかい普通の話し方。
   口調例: 「それは、やりたくてやるものですか？」「それ選んだ時、どんな気持ちだった？」
   → 理央・悠真の論理的な議論に対して、感情面から切り込むこと。

4. **陽斗（はると）** — ムードメーカー。ユーザーの気持ちを代弁。フランク。一人称「俺」。
   口調例: 「自分だったら後回しにするかもしれないな」「それ面倒じゃないかな」
   → 心春の問いかけを踏まえて、より直球でユーザーの本音を代弁すること。

5. **凛（りん）** — クーデレの反論者。短く無駄がない。
   口調例: 「少し待ってください。本当にそれでいいですか」「...正しい判断だと思う。」
   → 前4人の発言から1つ以上を具体的に引用し、以下のいずれかの形で反論する:
     - 「○○が〜と言ったけど、[反証]」
     - 「全員〜だけど、[見落とし]」
     - 「[誰かの前提]を疑うと、[別の見方]」

## 掛け合いの例（このレベルの相互言及を再現すること）

- 悠真→理央「理央さんの提案は現実的ですが、急いで決めなくてもいいかもしれませんよ」
- 心春→悠真「悠真の言ってること正しいけど、本人の気持ちはどうなの？」
- 陽斗→心春「心春の言う通り気持ちは大事だけど、シンプルに面倒かどうかでしょ」
- 凛→陽斗「陽斗が『面倒』で片付けたけど、面倒の裏に本当の問題が隠れてない？」

## ルール
- 1人1-3文。短く。
- 「すべき」「おすすめ」禁止。視点の提供のみ。
- 各キャラは直前の発言者の名前を出して反応すること。独立した意見の羅列にしない。
- 凛は必ず前4人の誰かの発言を名指しで引用して反論する。
- 最後に全員の視点を1行ずつ要約して並べる。

## 出力形式（厳守。JSON形式で返すこと）
{"messages":[{"character":"rio","text":"..."},{"character":"yuma","text":"..."},{"character":"koharu","text":"..."},{"character":"haruto","text":"..."},{"character":"rin","text":"..."}],"summary":["理央の視点要約","悠真の視点要約","心春の視点要約","陽斗の視点要約","凛の視点要約"]}`;

const SYSTEM_LIGHT_REVIEW = `あなたはmihakuアプリのライトレビューAIです。ユーザーが今日のミハク（タスク）を選んだ直後に、5人のキャラクターがそれぞれ1行ずつコメントします。

## キャラクター
1. **理央（りお）** — 構造・バランスの視点。丁寧だけど敬語ではない。
2. **悠真（ゆうま）** — 長期的な意味の視点。敬語固定。穏やか。
3. **心春（こはる）** — 感情・本音の視点。柔らかい話し方。
4. **陽斗（はると）** — 直感・本音代弁の視点。フランク。一人称「俺」。
5. **凛（りん）** — リスク・盲点の視点。短く鋭い。

## ルール
- 1人1文のみ。短く。フル会議ではないので議論はしない。
- 「すべき」「おすすめ」禁止。
- ユーザーの選択を肯定しつつ、各自の視点で1つだけ気づきを添える。
- 否定しない。問いかけ or 軽い視点提供のみ。

## 出力形式（JSON）
{"reviews":[{"character":"rio","text":"..."},{"character":"yuma","text":"..."},{"character":"koharu","text":"..."},{"character":"haruto","text":"..."},{"character":"rin","text":"..."}]}`;

function buildMeetingPrompt(body) {
  const parts = [];

  if (body.userProfile) {
    parts.push(`## ユーザー情報\n${body.userProfile}`);
  }

  parts.push(`## フェーズ: ${body.phase === 'sukuu' ? 'すくう（全体俯瞰）' : 'みがく（個別タスク深堀り）'}`);
  parts.push(`## タスクの状況\n${body.taskContext}`);

  if (body.history && body.history.length > 0) {
    const historyText = body.history
      .map((m) => `【${m.character}】${m.text}`)
      .join('\n');
    parts.push(`## これまでの会議\n${historyText}`);
  }

  parts.push(`## ユーザーの相談\n${body.userMessage}`);

  return parts.join('\n\n');
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
      mode: 'cli',
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

      const raw = await callClaude(
        `以下のテキストからタスクを抽出してください:\n「${rawText}」`,
        MODEL_FAST,
        SYSTEM_EXTRACT,
      );
      const parsed = parseJsonResponse(raw);

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

      const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      const raw = await callClaude(
        `以下のタスクを分類してください:\n${taskList}`,
        MODEL_QUALITY,
        SYSTEM_CLASSIFY,
      );
      const parsed = parseJsonResponse(raw);

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

  // ── Extract Onboarding（初回体験用・weight+axis付き） ─
  if (req.method === 'POST' && req.url === '/api/extract-onboarding') {
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

      console.log(`[extract-onboarding] input: "${rawText.slice(0, 80)}..."`);
      recordRequest();

      const raw = await callClaude(
        `以下のテキストからタスクを抽出・分類してください:\n「${rawText}」`,
        MODEL_QUALITY,
        SYSTEM_EXTRACT_ONBOARDING,
      );
      const parsed = parseJsonResponse(raw);

      console.log(`[extract-onboarding] tasks: ${parsed.tasks?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[extract-onboarding] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Meeting（5人会議・Sonnet） ─────────────────
  if (req.method === 'POST' && req.url === '/api/meeting') {
    const rateCheck = checkThrottle();
    if (!rateCheck.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: rateCheck.reason }));
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));

      if (!body.userMessage || !body.taskContext) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'userMessage and taskContext are required' }));
        return;
      }

      console.log(`[meeting] phase: ${body.phase ?? 'migaku'}, task: "${(body.taskContext ?? '').slice(0, 60)}..."`);
      recordRequest();

      const prompt = buildMeetingPrompt(body);
      const raw = await callClaude(prompt, MODEL_QUALITY, SYSTEM_MEETING);
      const parsed = parseJsonResponse(raw);

      console.log(`[meeting] messages: ${parsed.messages?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[meeting] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Light Review（ライトレビュー・Sonnet） ────
  if (req.method === 'POST' && req.url === '/api/light-review') {
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

      console.log(`[light-review] tasks: ${tasks.length}`);
      recordRequest();

      const taskList = tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
      let userContext = `今日選んだミハク:\n${taskList}`;
      if (body.userProfile) {
        userContext = `ユーザー情報: ${body.userProfile}\n\n${userContext}`;
      }

      const raw = await callClaude(userContext, MODEL_QUALITY, SYSTEM_LIGHT_REVIEW);
      const parsed = parseJsonResponse(raw);

      console.log(`[light-review] reviews: ${parsed.reviews?.length ?? 0}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    } catch (err) {
      console.error('[light-review] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
  console.log(`  mode: CLI (claude -p --tools "")`);
  console.log(`  models: ${MODEL_FAST} (extract) / ${MODEL_QUALITY} (classify, meeting)`);
  console.log(`  cost: $0 (Max subscription)\n`);
});

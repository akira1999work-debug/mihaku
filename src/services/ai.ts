/**
 * AI サービス — ふるう（タスク抽出・分類）
 *
 * 2段パイプライン:
 *   Step 1: extract — 音声テキスト → タスク抽出（Haiku・高速）
 *   Step 2: classify — タスクリスト → mihaku/kumo分類（Sonnet・高精度）
 *
 * 接続モード:
 *   proxy — ローカルプロキシ経由で Claude Code SDK を使う（Max契約者向け、課金なし）
 *   api   — Claude API を直接呼ぶ（一般ユーザー向け、APIキー必要）
 */

import type {
  AiConfig,
  TaskItem,
  ExtractResult,
  ClassifyResult,
  RefineResult,
  MeetingRequest,
  MeetingResponse,
} from './ai-types';

// ── Step 1: タスク抽出（高速） ─────────────────

/** 音声テキストからタスクを抽出する（分類はしない） */
export async function extractTasks(
  rawText: string,
  config: AiConfig,
): Promise<ExtractResult> {
  if (config.mode === 'proxy') {
    return extractViaProxy(rawText, config.proxyUrl);
  }
  return extractViaApi(rawText, config.apiKey);
}

// ── Step 2: タスク分類（高精度） ───────────────

/** 抽出済みタスクを mihaku/kumo に分類する */
export async function classifyTasks(
  tasks: TaskItem[],
  config: AiConfig,
): Promise<ClassifyResult> {
  if (config.mode === 'proxy') {
    return classifyViaProxy(tasks, config.proxyUrl);
  }
  return classifyViaApi(tasks, config.apiKey);
}

// ── 5人会議 ──────────────────────────────────

/** 5人会議を実行する */
export async function runMeeting(
  request: MeetingRequest,
  config: AiConfig,
): Promise<MeetingResponse> {
  if (config.mode === 'proxy') {
    return meetingViaProxy(request, config.proxyUrl);
  }
  return meetingViaApi(request, config.apiKey);
}

// ── 一括実行（後方互換） ───────────────────────

/** extract → classify を順に実行（旧 refineText の置き換え） */
export async function refineText(
  rawText: string,
  config: AiConfig,
  onExtracted?: (tasks: TaskItem[]) => void,
): Promise<RefineResult> {
  const { tasks } = await extractTasks(rawText, config);
  onExtracted?.(tasks);
  return classifyTasks(tasks, config);
}

// ── Proxy経由 ──────────────────────────────────

async function extractViaProxy(
  rawText: string,
  proxyUrl: string,
): Promise<ExtractResult> {
  const url = `${proxyUrl.replace(/\/+$/, '')}/api/extract`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: rawText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Proxy error: ${err.error ?? res.statusText}`);
  }

  return res.json();
}

async function classifyViaProxy(
  tasks: TaskItem[],
  proxyUrl: string,
): Promise<ClassifyResult> {
  const url = `${proxyUrl.replace(/\/+$/, '')}/api/classify`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Proxy error: ${err.error ?? res.statusText}`);
  }

  return res.json();
}

async function meetingViaProxy(
  request: MeetingRequest,
  proxyUrl: string,
): Promise<MeetingResponse> {
  const url = `${proxyUrl.replace(/\/+$/, '')}/api/meeting`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Proxy error: ${err.error ?? res.statusText}`);
  }

  return res.json();
}

// ── API直接呼び出し ────────────────────────────

async function extractViaApi(
  rawText: string,
  apiKey: string,
): Promise<ExtractResult> {
  if (!apiKey) {
    throw new Error('APIキーが設定されていません');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: buildExtractPrompt(rawText),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`API error: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return extractJson(text);
}

async function classifyViaApi(
  tasks: TaskItem[],
  apiKey: string,
): Promise<ClassifyResult> {
  if (!apiKey) {
    throw new Error('APIキーが設定されていません');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: buildClassifyPrompt(tasks),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`API error: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return extractJson(text);
}

async function meetingViaApi(
  request: MeetingRequest,
  apiKey: string,
): Promise<MeetingResponse> {
  if (!apiKey) {
    throw new Error('APIキーが設定されていません');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildMeetingSystemPrompt(),
      messages: [{
        role: 'user',
        content: buildMeetingUserPrompt(request),
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`API error: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return extractJson(text);
}

// ── プロンプト ─────────────────────────────────

function buildExtractPrompt(rawText: string): string {
  return `あなたはタスク抽出AIです。ユーザーが音声で吐き出した生テキストから、個別のタスクを抽出してください。

## 入力テキスト
「${rawText}」

## ルール
1. 生テキストから意味のあるタスク・やることを抽出する
2. 断片的・意味不明なものは除外する
3. 各タスクを簡潔な行動文に整形する（「〜する」「〜を考える」など）
4. 分類はしない。抽出と整形のみ

## 出力形式（JSON のみ、他のテキストは一切不要）
\`\`\`json
{
  "tasks": [
    { "title": "タスク名" }
  ]
}
\`\`\``;
}

function buildClassifyPrompt(tasks: TaskItem[]): string {
  const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
  return `あなたはタスク分類AIです。以下のタスクリストを2つのグループに分類してください。

## タスクリスト
${taskList}

## 分類基準
- **mihaku**: 今日やるべき重要なもの（最大3つ）
  - 緊急性・具体性が高い
- **kumo**: 今日じゃなくてもいいもの、メモ程度のもの
  - 「いつかやる」「気になってる程度」
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

function buildMeetingSystemPrompt(): string {
  // proxy側のSYSTEM_MEETINGと同じ内容（APIモード用）
  return `あなたはmihakuアプリの5人会議AIです。ユーザーがタスクについて迷っている時、5人のキャラクターが順に発言します。

## キャラクター（この順で発言を生成すること）
1. **理央（りお）** — お姉さんの提案者。選択肢を広げる。構造化が得意。「こうしてみたら？」が多い。丁寧だけど敬語ではない。前の発言者がいれば、その内容に触れて展開する。
2. **悠真（ゆうま）** — 包容力の安心役。長期視点。緊急性バイアスへのブレーキ。敬語固定。穏やか。理央の提案を受けて、別の角度から補足や問いかけをする。
3. **心春（こはる）** — 癒しの本音引き出し。意見ではなく問いを投げる。「やりたい」と「やらなきゃ」の区別を気づかせる。柔らかい普通の話し方。前の発言の論理的な議論に対して、感情面から切り込む。
4. **陽斗（はると）** — ムードメーカー。ユーザーの気持ちを代弁。代替案の提示。フランク。一人称「俺」。心春の問いかけを受けて、より直球でユーザーの本音を代弁する。
5. **凛（りん）** — クーデレの反論者。前4人の発言の中から具体的な発言を引用して反論する。「○○が〜と言ったけど」の形で名指しで切り込む。見落とされたリスクを指摘。短く無駄がない口調。

## ルール
- 1人1-3文。短く。
- 「すべき」「おすすめ」禁止。視点の提供のみ。
- 各キャラは前の発言者の内容に触れること（掛け合い）。特に凛は前4人の具体的発言を引用して反論する。
- 最後に全員の視点を1行ずつ要約して並べる。

## 出力形式（厳守。JSON形式で返すこと）
{"messages":[{"character":"rio","text":"..."},{"character":"yuma","text":"..."},{"character":"koharu","text":"..."},{"character":"haruto","text":"..."},{"character":"rin","text":"..."}],"summary":["理央の視点要約","悠真の視点要約","心春の視点要約","陽斗の視点要約","凛の視点要約"]}`;
}

function buildMeetingUserPrompt(request: MeetingRequest): string {
  const parts: string[] = [];

  if (request.userProfile) {
    parts.push(`## ユーザー情報\n${request.userProfile}`);
  }

  parts.push(`## フェーズ: ${request.phase === 'sukuu' ? 'すくう（全体俯瞰）' : 'みがく（個別タスク深堀り）'}`);
  parts.push(`## タスクの状況\n${request.taskContext}`);

  if (request.history && request.history.length > 0) {
    const historyText = request.history
      .map((m) => `【${m.character}】${m.text}`)
      .join('\n');
    parts.push(`## これまでの会議\n${historyText}`);
  }

  parts.push(`## ユーザーの相談\n${request.userMessage}`);

  return parts.join('\n\n');
}

// ── ユーティリティ ─────────────────────────────

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  return JSON.parse(text);
}

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
  LightReviewRequest,
  LightReviewResponse,
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

// ── ライトレビュー ────────────────────────────

/** ミハク確定後のライトレビュー（5人1行ずつ） */
export async function runLightReview(
  request: LightReviewRequest,
  config: AiConfig,
): Promise<LightReviewResponse> {
  if (config.mode === 'proxy') {
    return lightReviewViaProxy(request, config.proxyUrl);
  }
  return lightReviewViaApi(request, config.apiKey);
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

async function lightReviewViaProxy(
  request: LightReviewRequest,
  proxyUrl: string,
): Promise<LightReviewResponse> {
  const url = `${proxyUrl.replace(/\/+$/, '')}/api/light-review`;

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

async function lightReviewViaApi(
  request: LightReviewRequest,
  apiKey: string,
): Promise<LightReviewResponse> {
  if (!apiKey) {
    throw new Error('APIキーが設定されていません');
  }

  const taskList = request.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
  let userContent = `今日選んだミハク:\n${taskList}`;
  if (request.userProfile) {
    userContent = `ユーザー情報: ${request.userProfile}\n\n${userContent}`;
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
      system: buildLightReviewSystemPrompt(),
      messages: [{ role: 'user', content: userContent }],
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

function buildLightReviewSystemPrompt(): string {
  return `あなたはmihakuアプリのライトレビューAIです。ユーザーが今日のミハク（タスク）を選んだ直後に、5人のキャラクターがそれぞれ1行ずつコメントします。

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
}

function buildMeetingSystemPrompt(): string {
  // proxy側のSYSTEM_MEETINGと同じ内容（APIモード用）
  return `あなたはmihakuアプリの5人会議AIです。ユーザーがタスクについて迷っている時、5人のキャラクターが順に発言します。

## キャラクター（この順で発言を生成すること）

1. **理央（りお）** — お姉さんの提案者。選択肢を広げる。構造化が得意。丁寧だけど敬語ではない。
   口調例: 「全部じゃなくて、一部だけやるのはどうかな」「こうしてみたら面白くない？」

2. **悠真（ゆうま）** — 包容力の安心役。長期視点。緊急性バイアスへのブレーキ。敬語固定。穏やか。
   口調例: 「焦らなくていいですよ。ゆっくり考えましょう」「1ヶ月後に振り返ったら、どう見えるかな」
   → 理央の提案に対して、長期的な視点から応答すること。

3. **心春（こはる）** — 癒しの本音引き出し。意見ではなく問いを投げる。柔らかい普通の話し方。
   口調例: 「ねぇ、それほんとにやりたいやつ？」「それ選んだ時、どんな気持ちだった？」
   → 理央・悠真の論理的な議論に対して、感情面から切り込むこと。

4. **陽斗（はると）** — ムードメーカー。ユーザーの気持ちを代弁。フランク。一人称「俺」。
   口調例: 「俺だったらこれ後回しにするわ」「ぶっちゃけめんどくない？」
   → 心春の問いかけを踏まえて、より直球でユーザーの本音を代弁すること。

5. **凛（りん）** — クーデレの反論者。短く無駄がない。
   口調例: 「待って。本当にそれでいい？」「...正しい判断。」
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

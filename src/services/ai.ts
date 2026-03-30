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

// ── ユーティリティ ─────────────────────────────

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  return JSON.parse(text);
}

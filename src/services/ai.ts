/**
 * AI サービス — ふるう（タスク抽出・分類）
 *
 * 接続モード:
 *   proxy — ローカルプロキシ経由で claude CLI を使う（Max/Pro契約者向け、課金なし）
 *   api   — Claude API を直接呼ぶ（一般ユーザー向け、APIキー必要）
 */

import type { AiConfig, RefineResult } from './ai-types';

/** 音声テキストからタスクを抽出・分類 */
export async function refineText(
  rawText: string,
  config: AiConfig,
): Promise<RefineResult> {
  if (config.mode === 'proxy') {
    return refineViaProxy(rawText, config.proxyUrl);
  }
  return refineViaApi(rawText, config.apiKey);
}

/** ローカルプロキシ経由 */
async function refineViaProxy(
  rawText: string,
  proxyUrl: string,
): Promise<RefineResult> {
  const url = `${proxyUrl.replace(/\/+$/, '')}/api/refine`;

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

/** Claude API 直接呼び出し（将来実装） */
async function refineViaApi(
  rawText: string,
  apiKey: string,
): Promise<RefineResult> {
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
        content: buildRefinePrompt(rawText),
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

function buildRefinePrompt(rawText: string): string {
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

function extractJson(text: string): RefineResult {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  return JSON.parse(text);
}

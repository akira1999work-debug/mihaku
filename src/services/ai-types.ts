/** AI整形の入出力型定義 */

export interface TaskItem {
  title: string;
}

/** タスク抽出結果（Step 1: extract） */
export interface ExtractResult {
  tasks: TaskItem[];
}

/** タスク分類結果（Step 2: classify） */
export interface ClassifyResult {
  mihaku: TaskItem[];
  kumo: TaskItem[];
}

/** ふるう結果 — 後方互換 (= ClassifyResult) */
export type RefineResult = ClassifyResult;

/** AI接続モード */
export type AiMode = 'proxy' | 'api';

/** AI接続設定 */
export interface AiConfig {
  mode: AiMode;
  /** ローカルプロキシのURL (mode=proxy) */
  proxyUrl: string;
  /** Claude APIキー (mode=api) */
  apiKey: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  mode: 'proxy',
  proxyUrl: 'http://192.168.1.44:3141',
  apiKey: '',
};

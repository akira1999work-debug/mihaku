/** AI整形の入出力型定義 */

export interface TaskItem {
  title: string;
}

/** ふるう結果 — ミハク候補とクモに分類 */
export interface RefineResult {
  mihaku: TaskItem[];
  kumo: TaskItem[];
}

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

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

/** 5人会議のフェーズ */
export type MeetingPhase = 'sukuu' | 'migaku';

/** 5人のキャラ名 */
export type CharacterName = 'rio' | 'yuma' | 'koharu' | 'haruto' | 'rin';

/** 会議の1発言 */
export interface MeetingMessage {
  character: CharacterName;
  text: string;
}

/** 会議リクエスト */
export interface MeetingRequest {
  /** 相談対象のタスク（みがく時）or 今日の候補一覧の説明（すくう時） */
  taskContext: string;
  /** ユーザーの相談メッセージ */
  userMessage: string;
  /** すくう or みがく */
  phase: MeetingPhase;
  /** 「5人に伝えておきたいこと」（設定画面のテキスト） */
  userProfile?: string;
  /** 過去の会議ログ（継続会話用） */
  history?: MeetingMessage[];
}

/** 会議レスポンス */
export interface MeetingResponse {
  messages: MeetingMessage[];
  summary: string[];
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

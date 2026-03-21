/**
 * 音声テキストをチップ（砂金の粒）に分割する
 * AI不要 — 句読点・接続詞で機械的に分割
 */

/** 分割に使うパターン（日本語の区切り表現） */
const SPLIT_PATTERN =
  /[、。！？\n]+|(?:あと|それと|それから|で(?=\s)|あとは|それに|んで|とか|けど|でも|じゃあ|で、)/g;

/**
 * テキストをチップの配列に分割する
 * - 句読点・接続詞で分割
 * - 空白のみ・短すぎるチップは除去
 * - 前後の空白をトリム
 */
export function splitChips(text: string): string[] {
  if (!text.trim()) return [];

  return text
    .split(SPLIT_PATTERN)
    .map((chip) => chip.trim())
    .filter((chip) => chip.length >= 2); // 1文字だけのゴミは除去
}

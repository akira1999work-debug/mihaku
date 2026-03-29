/**
 * AI設定の永続化
 * - Native: expo-secure-store（APIキーを安全に保存）
 * - Web: localStorage（開発用フォールバック）
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AiConfig } from './ai-types';
import { DEFAULT_AI_CONFIG } from './ai-types';

const STORAGE_KEY = 'mihaku_ai_config';

/** 設定を読み込む */
export async function loadAiConfig(): Promise<AiConfig> {
  try {
    let raw: string | null = null;

    if (Platform.OS === 'web') {
      raw = localStorage.getItem(STORAGE_KEY);
    } else {
      raw = await SecureStore.getItemAsync(STORAGE_KEY);
    }

    if (raw) {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // 読み込み失敗時はデフォルト
  }

  return { ...DEFAULT_AI_CONFIG };
}

/** 設定を保存する */
export async function saveAiConfig(config: AiConfig): Promise<void> {
  const json = JSON.stringify(config);

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, json);
    }
  } catch {
    // 保存失敗は無視（次回起動時にデフォルトに戻る）
  }
}

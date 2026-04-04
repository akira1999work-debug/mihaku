/**
 * 「5人に伝えておきたいこと」の読み書き
 *
 * 初回体験の心春の自己紹介 + 設定画面から更新可能。
 * 5人会議・ライトレビューのプロンプトに注入される。
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'mihaku_user_profile';

export async function loadUserProfile(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(KEY) ?? '';
    }
    return (await SecureStore.getItemAsync(KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function saveUserProfile(text: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(KEY, text);
      return;
    }
    await SecureStore.setItemAsync(KEY, text);
  } catch {
    // 保存失敗は握り潰さない
    console.warn('[user-profile] failed to save');
  }
}

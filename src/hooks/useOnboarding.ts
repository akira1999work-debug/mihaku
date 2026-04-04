/**
 * 初回体験の判定・管理
 *
 * - expo-secure-store に onboarding_completed フラグを保存
 * - resetOnboarding() で何度でもやり直せる（開発用）
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'mihaku_onboarding_completed';

async function getFlag(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(KEY) === 'true';
    }
    return (await SecureStore.getItemAsync(KEY)) === 'true';
  } catch {
    return false;
  }
}

async function setFlag(value: boolean): Promise<void> {
  const str = value ? 'true' : 'false';
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, str);
    return;
  }
  await SecureStore.setItemAsync(KEY, str);
}

export function useOnboarding() {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(true); // デフォルトtrue（チラつき防止）

  useEffect(() => {
    getFlag().then((v) => {
      setCompleted(v);
      setLoading(false);
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await setFlag(true);
    setCompleted(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await setFlag(false);
    setCompleted(false);
  }, []);

  return {
    /** 読み込み中 */
    loading,
    /** 初回体験を完了済みか */
    completed,
    /** 初回体験を完了としてマーク */
    completeOnboarding,
    /** 初回体験���リセット（開発用） */
    resetOnboarding,
  };
}

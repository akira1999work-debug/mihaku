/**
 * AiSettingsView — AI接続設定画面
 *
 * proxy モード: ローカルPCのclaude CLIを経由（課金なし）
 * api モード: Claude API直接（APIキー必要）
 */
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { colors } from '../theme';
import { loadAiConfig, saveAiConfig } from '../services/ai-config-store';
import type { AiConfig, AiMode } from '../services/ai-types';
import { DEFAULT_AI_CONFIG } from '../services/ai-types';

interface AiSettingsViewProps {
  onClose: () => void;
  onResetOnboarding?: () => void;
}

type ConnStatus = 'idle' | 'testing' | 'ok' | 'error';

export function AiSettingsView({ onClose, onResetOnboarding }: AiSettingsViewProps) {
  const [mode, setMode] = useState<AiMode>('proxy');
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_AI_CONFIG.proxyUrl);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<ConnStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAiConfig().then((cfg) => {
      setMode(cfg.mode);
      setProxyUrl(cfg.proxyUrl);
      setApiKey(cfg.apiKey);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    const config: AiConfig = { mode, proxyUrl, apiKey };
    await saveAiConfig(config);
    onClose();
  };

  const handleTest = async () => {
    setStatus('testing');
    setStatusMsg('');

    try {
      if (mode === 'proxy') {
        const url = `${proxyUrl.replace(/\/+$/, '')}/api/health`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatus('ok');
        setStatusMsg(`接続OK (${data.mode ?? 'proxy'})`);
      } else {
        if (!apiKey.trim()) {
          setStatus('error');
          setStatusMsg('APIキーを入力してください');
          return;
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
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message ?? `HTTP ${res.status}`);
        }
        setStatus('ok');
        setStatusMsg('API接続OK');
      }
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '接続失敗';
      setStatusMsg(msg);
    }
  };

  if (!loaded) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>AI接続設定</Text>
      <Text style={styles.desc}>
        ふるう機能で使うAIの接続先を設定します
      </Text>

      {/* モード切替 */}
      <View style={styles.modeRow}>
        <ModeButton
          label="プロキシ"
          hint="PCのClaude経由"
          active={mode === 'proxy'}
          onPress={() => { setMode('proxy'); setStatus('idle'); }}
        />
        <ModeButton
          label="API"
          hint="APIキーで直接"
          active={mode === 'api'}
          onPress={() => { setMode('api'); setStatus('idle'); }}
        />
      </View>

      {/* プロキシ設定 */}
      {mode === 'proxy' && (
        <View style={styles.section}>
          <Text style={styles.label}>プロキシURL</Text>
          <TextInput
            style={styles.input}
            value={proxyUrl}
            onChangeText={setProxyUrl}
            placeholder="http://192.168.1.44:3141"
            placeholderTextColor={colors.textSub}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            PCで tools/proxy/server.js を起動し、同じWi-Fiに接続してください
          </Text>
        </View>
      )}

      {/* API設定 */}
      {mode === 'api' && (
        <View style={styles.section}>
          <Text style={styles.label}>APIキー</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textSub}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            Anthropic Console から取得したAPIキーを入力
          </Text>
        </View>
      )}

      {/* テスト接続 */}
      <TouchableOpacity
        style={styles.testBtn}
        onPress={handleTest}
        disabled={status === 'testing'}
        activeOpacity={0.7}
      >
        {status === 'testing' ? (
          <ActivityIndicator size="small" color={colors.sumiInk} />
        ) : (
          <Text style={styles.testBtnText}>接続テスト</Text>
        )}
      </TouchableOpacity>

      {status === 'ok' && (
        <Text style={styles.statusOk}>{statusMsg}</Text>
      )}
      {status === 'error' && (
        <Text style={styles.statusError}>{statusMsg}</Text>
      )}

      {/* 保存 / 戻る */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </View>

      {/* 開発用: 初回体験リセット */}
      {onResetOnboarding && (
        <View style={styles.devSection}>
          <Text style={styles.devLabel}>開発用</Text>
          <TouchableOpacity style={styles.devBtn} onPress={onResetOnboarding}>
            <Text style={styles.devBtnText}>初回体験をやり直す</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function ModeButton({ label, hint, active, onPress }: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.modeBtnLabel, active && styles.modeBtnLabelActive]}>
        {label}
      </Text>
      <Text style={[styles.modeBtnHint, active && styles.modeBtnHintActive]}>
        {hint}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: 1,
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: 24,
  },

  // モード切替
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#f8f7f5',
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: colors.sumiInk,
    backgroundColor: colors.cardBg,
  },
  modeBtnLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textLight,
  },
  modeBtnLabelActive: {
    color: colors.sumiInk,
  },
  modeBtnHint: {
    fontSize: 11,
    color: colors.textSub,
    marginTop: 4,
  },
  modeBtnHintActive: {
    color: colors.textLight,
  },

  // セクション
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f7f5',
    borderRadius: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  hint: {
    fontSize: 11,
    color: colors.textSub,
    marginTop: 8,
    lineHeight: 16,
  },

  // テスト
  testBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 8,
  },
  testBtnText: {
    fontSize: 13,
    color: colors.text,
  },
  statusOk: {
    fontSize: 12,
    color: colors.sumiCompleted,
    marginBottom: 24,
  },
  statusError: {
    fontSize: 12,
    color: '#c0564a',
    marginBottom: 24,
  },

  // フッター
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.textLight,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.sumiInk,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  devSection: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  devLabel: {
    fontSize: 11,
    color: colors.textSub,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  devBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  devBtnText: {
    fontSize: 13,
    color: colors.textLight,
  },
});

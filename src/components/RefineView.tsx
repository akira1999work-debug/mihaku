/**
 * RefineView — ふるう画面
 *
 * AIが分類したミハク候補とクモを表示。
 * タップでグループ間を移動。「これでOK」で確定。
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { colors } from '../theme';
import { refineText } from '../services/ai';
import { loadAiConfig } from '../services/ai-config-store';
import type { AiConfig } from '../services/ai-types';

interface TaskItem {
  title: string;
}

interface RefineViewProps {
  /** 音声入力の生テキスト */
  rawText: string;
  /** ミハク候補が確定された時 */
  onConfirm: (mihaku: string[], kumo: string[]) => void;
  /** キャンセル */
  onCancel: () => void;
}

type Phase = 'loading' | 'ready' | 'error';

export function RefineView({ rawText, onConfirm, onCancel }: RefineViewProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [mihaku, setMihaku] = useState<TaskItem[]>([]);
  const [kumo, setKumo] = useState<TaskItem[]>([]);
  const [error, setError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const config = await loadAiConfig();
        const result = await refineText(rawText, config);

        if (cancelled) return;

        setMihaku(result.mihaku ?? []);
        setKumo(result.kumo ?? []);
        setPhase('ready');

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'AI接続に失敗しました';
        setError(msg);
        setPhase('error');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [rawText, fadeAnim]);

  /** タスクをクモ→ミハクに移動 */
  const moveToMihaku = (index: number) => {
    const item = kumo[index];
    if (!item) return;
    setKumo((prev) => prev.filter((_, i) => i !== index));
    setMihaku((prev) => [...prev, item]);
  };

  /** タスクをミハク→クモに移動 */
  const moveToKumo = (index: number) => {
    const item = mihaku[index];
    if (!item) return;
    setMihaku((prev) => prev.filter((_, i) => i !== index));
    setKumo((prev) => [...prev, item]);
  };

  const handleConfirm = () => {
    onConfirm(
      mihaku.map((t) => t.title),
      kumo.map((t) => t.title),
    );
  };

  // ローディング
  if (phase === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.sumiInk} />
          <Text style={styles.loadingText}>ふるいにかけています...</Text>
          <Text style={styles.loadingHint}>AIがタスクを整理中</Text>
        </View>
      </View>
    );
  }

  // エラー
  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>接続できませんでした</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.retryBtn} onPress={() => {
              setPhase('loading');
              setError('');
              // re-trigger effect by forcing re-mount — handled by parent
            }}>
              <Text style={styles.retryBtnText}>もう一度試す</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>戻る</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 結果表示
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ミハク候補セクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ミハク候補</Text>
            <Text style={styles.sectionHint}>今日やること</Text>
          </View>
          {mihaku.length === 0 ? (
            <Text style={styles.emptyHint}>
              クモからタップして移動できます
            </Text>
          ) : (
            mihaku.map((item, index) => (
              <TouchableOpacity
                key={`m-${index}-${item.title}`}
                style={styles.mihakuCard}
                onPress={() => moveToKumo(index)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardDot} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
                <Text style={styles.moveHint}>↓</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* クモセクション */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleKumo}>クモ</Text>
            <Text style={styles.sectionHint}>今日じゃなくていいもの</Text>
          </View>
          {kumo.length === 0 ? (
            <Text style={styles.emptyHint}>
              すべてミハク候補に入っています
            </Text>
          ) : (
            kumo.map((item, index) => (
              <TouchableOpacity
                key={`k-${index}-${item.title}`}
                style={styles.kumoCard}
                onPress={() => moveToMihaku(index)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardDotKumo} />
                  <Text style={styles.cardTitleKumo}>{item.title}</Text>
                </View>
                <Text style={styles.moveHint}>↑</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* フッター */}
      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          タップでミハク⇔クモを移動
        </Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={styles.backBtn} onPress={onCancel}>
            <Text style={styles.backBtnText}>やり直す</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>これでOK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // ローディング
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.text,
    marginTop: 20,
    letterSpacing: 1,
  },
  loadingHint: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 8,
  },

  // エラー
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 12,
  },
  errorMsg: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.sumiInk,
  },
  retryBtnText: {
    fontSize: 14,
    color: '#FFF',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.textLight,
  },

  // セクション
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.sumiInk,
    letterSpacing: 1,
  },
  sectionTitleKumo: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textLight,
    letterSpacing: 1,
  },
  sectionHint: {
    fontSize: 11,
    color: colors.textSub,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textSub,
    paddingVertical: 16,
    textAlign: 'center',
  },

  // カード
  mihakuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: '#d4a574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  kumoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f7f5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.releaseAccent,
  },
  cardDotKumo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSub,
  },
  cardTitle: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    letterSpacing: 0.3,
  },
  cardTitleKumo: {
    fontSize: 14,
    color: colors.textLight,
    flex: 1,
    letterSpacing: 0.3,
  },
  moveHint: {
    fontSize: 12,
    color: colors.textSub,
    marginLeft: 8,
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
  },
  footerHint: {
    fontSize: 11,
    color: colors.textSub,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  backBtnText: {
    fontSize: 14,
    color: colors.textLight,
  },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 20,
    backgroundColor: colors.sumiInk,
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
});

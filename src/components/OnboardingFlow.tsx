/**
 * 初回体験フロー — 心春ガイド型チャット
 *
 * 心春がLINE風チャットでガイドしながら、ユーザーのタスクを引き出す。
 * AI分類は裏で行い、心春の問いかけでユーザー自身が選ぶ。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { colors } from '../theme';
import { extractTasks } from '../services/ai';
import { loadAiConfig } from '../services/ai-config-store';
import type { TaskAxis } from '../types/task';

// ── 型定義 ──────────────────────────────────────

interface ExtractedTask {
  title: string;
  weight: 'intentional' | 'routine';
  axis: TaskAxis;
}

type ChatEntry =
  | { type: 'koharu'; text: string }
  | { type: 'user'; text: string }
  | { type: 'task_list'; tasks: ExtractedTask[]; selectable: boolean }
  | { type: 'input'; mode: 'initial' | 'additional' };

type Phase = 'greeting' | 'input' | 'extracted' | 'balance_check' | 'select' | 'done';

interface OnboardingFlowProps {
  onComplete: (mihaku: ExtractedTask[], kumo: ExtractedTask[]) => void;
}

// ── 軸カラー ────────────────────────────────────

const AXIS_COLORS: Record<TaskAxis, string> = {
  work: colors.axisWork,
  health: colors.axisHealth,
  enrichment: colors.axisEnrichment,
  routine: colors.axisRoutine,
};

// ── 心春バブル ──────────────────────────────────

function KoharuBubble({ text }: { text: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[bubbleStyles.koharuContainer, { opacity: fadeAnim }]}>
      <View style={bubbleStyles.koharuHeader}>
        <Text style={bubbleStyles.koharuIcon}>🌸</Text>
        <Text style={bubbleStyles.koharuName}>心春</Text>
      </View>
      <View style={bubbleStyles.koharuBody}>
        <Text style={bubbleStyles.koharuText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={bubbleStyles.userContainer}>
      <View style={bubbleStyles.userBody}>
        <Text style={bubbleStyles.userText}>{text}</Text>
      </View>
    </View>
  );
}

// ── タスクリスト表示 ────────────────────────────

function TaskListView({ tasks, selectable, selectedIds, onToggle }: {
  tasks: ExtractedTask[];
  selectable: boolean;
  selectedIds: Set<number>;
  onToggle: (index: number) => void;
}) {
  const intentional = tasks.filter((t) => t.weight === 'intentional');
  const routine = tasks.filter((t) => t.weight === 'routine');

  const renderTask = (task: ExtractedTask, globalIndex: number) => {
    const selected = selectedIds.has(globalIndex);
    return (
      <TouchableOpacity
        key={globalIndex}
        style={[
          taskStyles.card,
          { borderLeftColor: AXIS_COLORS[task.axis] },
          selectable && selected && taskStyles.cardSelected,
        ]}
        onPress={() => selectable && onToggle(globalIndex)}
        activeOpacity={selectable ? 0.7 : 1}
        disabled={!selectable}
      >
        {selectable && (
          <View style={[taskStyles.checkbox, selected && taskStyles.checkboxChecked]}>
            {selected && <Text style={taskStyles.checkmark}>✓</Text>}
          </View>
        )}
        <Text style={taskStyles.title}>{task.title}</Text>
      </TouchableOpacity>
    );
  };

  // globalIndexを計算
  let idx = 0;
  return (
    <View style={taskStyles.container}>
      {intentional.map((t) => {
        const gi = tasks.indexOf(t);
        return renderTask(t, gi);
      })}
      {routine.length > 0 && intentional.length > 0 && (
        <View style={taskStyles.divider} />
      )}
      {routine.map((t) => {
        const gi = tasks.indexOf(t);
        return renderTask(t, gi);
      })}
    </View>
  );
}

// ── メインコンポーネント ────────────────────────

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [phase, setPhase] = useState<Phase>('greeting');
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, []);

  const addKoharu = useCallback((text: string) => {
    setEntries((prev) => [...prev, { type: 'koharu', text }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const addKoharuDelayed = useCallback(async (texts: string[], delayMs = 800) => {
    for (const text of texts) {
      await new Promise((r) => setTimeout(r, delayMs));
      setEntries((prev) => [...prev, { type: 'koharu', text }]);
      scrollToBottom();
    }
  }, [scrollToBottom]);

  // 挨拶シーケンス
  useEffect(() => {
    if (phase !== 'greeting') return;
    (async () => {
      await addKoharuDelayed([
        'はじめまして、心春といいます',
        'このアプリ、やることを増やすアプリじゃないんです',
        '逆で、減らします。毎日、自分がやりたいことを3つだけ選ぶ。それだけ',
      ]);
      await new Promise((r) => setTimeout(r, 600));
      await addKoharuDelayed([
        'まず聞かせてください',
        'いま頭の中にあること、なんでも。やりたいこと、やらなきゃと思ってること',
      ]);
      setEntries((prev) => [...prev, { type: 'input', mode: 'initial' }]);
      setPhase('input');
      scrollToBottom();
    })();
  }, [phase]);

  // ユーザー入力送信
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setEntries((prev) => prev.filter((e) => e.type !== 'input'));
    setEntries((prev) => [...prev, { type: 'user', text }]);
    scrollToBottom();

    setLoading(true);
    try {
      const config = await loadAiConfig();
      const response = await fetch(
        `${config.proxyUrl.replace(/\/+$/, '')}/api/extract-onboarding`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        // フォールバック: 通常のextract
        const extracted = await extractTasks(text, config);
        const fallbackTasks: ExtractedTask[] = (extracted.tasks ?? []).map((t) => ({
          title: t.title,
          weight: 'intentional' as const,
          axis: 'work' as TaskAxis,
        }));
        setTasks((prev) => [...prev, ...fallbackTasks]);
        await showExtractedResult([...tasks, ...fallbackTasks]);
      } else {
        const data = await response.json();
        const newTasks: ExtractedTask[] = (data.tasks ?? []).map((t: { title: string; weight?: string; axis?: string }) => ({
          title: t.title,
          weight: t.weight === 'routine' ? 'routine' : 'intentional',
          axis: (['work', 'health', 'enrichment', 'routine'].includes(t.axis ?? '') ? t.axis : 'work') as TaskAxis,
        }));
        const allTasks = [...tasks, ...newTasks];
        setTasks(allTasks);
        await showExtractedResult(allTasks);
      }
    } catch {
      addKoharu('うまく聞き取れなかったかも。もう一度教えてもらえますか？');
      setEntries((prev) => [...prev, { type: 'input', mode: 'initial' }]);
    } finally {
      setLoading(false);
    }
  };

  const showExtractedResult = async (allTasks: ExtractedTask[]) => {
    await addKoharuDelayed(['整理してみました']);
    setEntries((prev) => [...prev, { type: 'task_list', tasks: allTasks, selectable: false }]);
    scrollToBottom();
    await new Promise((r) => setTimeout(r, 500));
    addKoharu('他にもあったら追加してください');
    setEntries((prev) => [...prev, { type: 'input', mode: 'additional' }]);
    setPhase('extracted');
    scrollToBottom();
  };

  // 「これで全部」
  const handleDoneInput = async () => {
    setEntries((prev) => prev.filter((e) => e.type !== 'input'));

    // バランスチェック: 軸の偏りを確認
    const axes = tasks.filter((t) => t.weight === 'intentional').map((t) => t.axis);
    const hasHealth = axes.includes('health');
    const hasEnrichment = axes.includes('enrichment');
    const workCount = axes.filter((a) => a === 'work').length;

    if (workCount >= 2 && !hasHealth && !hasEnrichment) {
      await addKoharuDelayed([
        '仕事のことが多いみたいだけど、自分のための時間、入れなくて大丈夫ですか？',
        'たとえば運動とか、読みたかった本とか、会いたい人とか...',
      ]);
      setEntries((prev) => [...prev, { type: 'input', mode: 'additional' }]);
      setPhase('balance_check');
      scrollToBottom();
      return;
    }

    await moveToSelect();
  };

  // 選択フェーズへ
  const moveToSelect = async () => {
    setEntries((prev) => prev.filter((e) => e.type !== 'input'));
    await addKoharuDelayed([
      'この中で3つだけしかできないとしたら、どれを選びますか？',
    ]);
    // タスクリストを選択可能モードで再表示
    setEntries((prev) => {
      const withoutOldList = prev.filter((e) => e.type !== 'task_list');
      return [...withoutOldList, { type: 'task_list', tasks, selectable: true }];
    });
    setPhase('select');
    scrollToBottom();
  };

  // バランスチェック後の「これで全部」
  const handleBalanceDone = async () => {
    await moveToSelect();
  };

  // タスク選択トグル
  const handleToggleTask = (index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 3) {
        next.add(index);
      }
      return next;
    });
  };

  // 確定
  const handleConfirm = async () => {
    const mihaku = tasks.filter((_, i) => selectedIds.has(i));
    const kumo = tasks.filter((_, i) => !selectedIds.has(i));
    addKoharu('いいね。今日はこの3つ');
    await new Promise((r) => setTimeout(r, 800));
    onComplete(mihaku, kumo);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
      >
        {entries.map((entry, i) => {
          if (entry.type === 'koharu') return <KoharuBubble key={i} text={entry.text} />;
          if (entry.type === 'user') return <UserBubble key={i} text={entry.text} />;
          if (entry.type === 'task_list') {
            return (
              <TaskListView
                key={`tasklist-${i}`}
                tasks={entry.tasks}
                selectable={entry.selectable}
                selectedIds={selectedIds}
                onToggle={handleToggleTask}
              />
            );
          }
          return null;
        })}

        {loading && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingDots}>...</Text>
          </View>
        )}
      </ScrollView>

      {/* 入力エリア */}
      {(phase === 'input' || phase === 'extracted' || phase === 'balance_check') && (
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="ここに入力..."
            placeholderTextColor={colors.textSub}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
            multiline
          />
          {input.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={loading}>
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          ) : (phase === 'extracted' || phase === 'balance_check') ? (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={phase === 'balance_check' ? handleBalanceDone : handleDoneInput}
            >
              <Text style={styles.doneBtnText}>これで全部</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* 選択確定ボタン */}
      {phase === 'select' && (
        <View style={styles.inputArea}>
          <TouchableOpacity
            style={[styles.confirmBtn, selectedIds.size === 0 && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            <Text style={styles.confirmBtnText}>
              {selectedIds.size === 0 ? 'タップして選んでください' : `この${selectedIds.size}つでいく`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── スタイル ────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 20, paddingVertical: 24, gap: 12 },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  input: {
    flex: 1, fontSize: 14, paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: '#f8f7f5', borderRadius: 20, color: colors.text, maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sumiInk,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnText: { fontSize: 18, color: '#FFF', fontWeight: '600' },
  doneBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18,
    backgroundColor: colors.sumiInk, marginLeft: 8,
  },
  doneBtnText: { fontSize: 13, color: '#FFF', fontWeight: '500' },
  confirmBtn: {
    flex: 1, backgroundColor: colors.sumiInk, borderRadius: 24,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: colors.ringUnfilled },
  confirmBtnText: { fontSize: 14, color: '#FFF', fontWeight: '500', letterSpacing: 0.5 },
  typingIndicator: { paddingLeft: 40, paddingVertical: 8 },
  typingDots: { fontSize: 24, color: colors.textSub, letterSpacing: 4 },
});

const bubbleStyles = StyleSheet.create({
  koharuContainer: { marginBottom: 2 },
  koharuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  koharuIcon: { fontSize: 14 },
  koharuName: { fontSize: 12, fontWeight: '600', color: '#7a5d6b', letterSpacing: 0.5 },
  koharuBody: {
    backgroundColor: colors.cardBg, borderRadius: 16, borderTopLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%',
    shadowColor: colors.cardShadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1, shadowRadius: 3, elevation: 1,
  },
  koharuText: { fontSize: 14, color: colors.text, lineHeight: 24 },
  userContainer: { alignItems: 'flex-end' },
  userBody: {
    backgroundColor: colors.sumiInk, borderRadius: 16, borderTopRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, maxWidth: '75%',
  },
  userText: { fontSize: 14, color: '#FFFFFF', lineHeight: 22 },
});

const taskStyles = StyleSheet.create({
  container: { gap: 6, marginVertical: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.cardBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 3, borderWidth: 1, borderColor: colors.divider,
  },
  cardSelected: { borderColor: colors.sumiInk, backgroundColor: '#f8f6f2' },
  checkbox: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.ringUnfilled,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { borderColor: colors.sumiInk, backgroundColor: colors.sumiInk },
  checkmark: { fontSize: 11, color: '#FFF', fontWeight: '700' },
  title: { flex: 1, fontSize: 14, color: colors.text },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.divider,
    marginVertical: 4, marginHorizontal: 8,
  },
});

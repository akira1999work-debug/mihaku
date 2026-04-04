/**
 * 5人会議画面 — LINE風チャットUI
 *
 * 各キャラの発言がバブルで表示される。
 * ユーザーは任意のタイミングで発言を追加できる。
 * 発言バブルにはリアクションボタンが付く。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { colors } from '../theme';
import type {
  MeetingMessage, MeetingRequest, MeetingResponse,
  MeetingPhase, CharacterName, AiConfig,
} from '../services/ai-types';
import { runMeeting } from '../services/ai';
import { loadAiConfig } from '../services/ai-config-store';

// ── キャラ定義 ──────────────────────────────────

interface CharacterMeta {
  name: string;
  color: string;
  icon: string;
}

const CHARACTERS: Record<CharacterName, CharacterMeta> = {
  rio:    { name: '理央', color: '#7a6b5d', icon: '💡' },
  yuma:   { name: '悠真', color: '#5d6b7a', icon: '🌿' },
  koharu: { name: '心春', color: '#7a5d6b', icon: '🌸' },
  haruto: { name: '陽斗', color: '#6b7a5d', icon: '⚡' },
  rin:    { name: '凛',   color: '#5d5d6b', icon: '❄️' },
};

const REACTIONS = ['👍', '❤️'] as const;

// ── Props ───────────────────────────────────────

interface MeetingViewProps {
  /** 相談対象のタスク情報 */
  taskContext: string;
  /** 初期フェーズ */
  phase: MeetingPhase;
  /** ユーザープロフィール（設定画面の「5人に伝えておきたいこと」） */
  userProfile?: string;
  /** 戻るボタン */
  onClose: () => void;
}

// ── 発言バブル ──────────────────────────────────

interface BubbleProps {
  message: MeetingMessage;
  onReaction: (character: CharacterName, reaction: string) => void;
}

function CharacterBubble({ message, onReaction }: BubbleProps) {
  const meta = CHARACTERS[message.character];
  const [reacted, setReacted] = useState<string | null>(null);

  const handleReaction = (reaction: string) => {
    const next = reacted === reaction ? null : reaction;
    setReacted(next);
    if (next) onReaction(message.character, next);
  };

  return (
    <View style={bubbleStyles.container}>
      <View style={bubbleStyles.header}>
        <Text style={bubbleStyles.icon}>{meta.icon}</Text>
        <Text style={[bubbleStyles.name, { color: meta.color }]}>{meta.name}</Text>
      </View>
      <View style={bubbleStyles.body}>
        <Text style={bubbleStyles.text}>{message.text}</Text>
      </View>
      <View style={bubbleStyles.reactions}>
        {REACTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[
              bubbleStyles.reactionBtn,
              reacted === r && bubbleStyles.reactionBtnActive,
            ]}
            onPress={() => handleReaction(r)}
          >
            <Text style={bubbleStyles.reactionText}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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

function SummaryView({ summary }: { summary: string[] }) {
  const names = ['理央', '悠真', '心春', '陽斗', '凛'];
  return (
    <View style={summaryStyles.container}>
      <View style={summaryStyles.divider} />
      {summary.map((line, i) => (
        <Text key={i} style={summaryStyles.line}>
          {names[i] ? `${names[i]}：` : ''}{line.replace(/^[^：]+：/, '')}
        </Text>
      ))}
      <Text style={summaryStyles.closing}>で、あなたはどうしたい？</Text>
    </View>
  );
}

// ── 筆の雫アニメーション（考え中） ────────────

function InkDropIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 300),
          Animated.timing(dot, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={indicatorStyles.container}>
      <Text style={indicatorStyles.label}>考え中</Text>
      <View style={indicatorStyles.dots}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              indicatorStyles.dot,
              { opacity: dot, transform: [{ scale: Animated.add(0.6, Animated.multiply(dot, 0.4)) }] },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── メインコンポーネント ────────────────────────

type ChatEntry =
  | { type: 'character'; message: MeetingMessage }
  | { type: 'user'; text: string }
  | { type: 'summary'; lines: string[] };

export function MeetingView({ taskContext, phase, userProfile, onClose }: MeetingViewProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const historyRef = useRef<MeetingMessage[]>([]);

  useEffect(() => {
    loadAiConfig().then(setConfig);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // 会議の初回実行
  const startMeeting = useCallback(async (userMessage: string) => {
    if (!config) return;

    setLoading(true);
    setError(null);

    // ユーザー発言を追加（初回以降）
    if (entries.length > 0) {
      setEntries((prev) => [...prev, { type: 'user', text: userMessage }]);
    }

    try {
      const request: MeetingRequest = {
        taskContext,
        userMessage,
        phase,
        userProfile,
        history: historyRef.current,
      };

      const response = await runMeeting(request, config);

      // 1人ずつ段階表示
      for (const msg of response.messages) {
        historyRef.current = [...historyRef.current, msg];
        setEntries((prev) => [...prev, { type: 'character', message: msg }]);
        scrollToBottom();
        // 段階表示の間隔（UIの「現れていく」感）
        await new Promise((r) => setTimeout(r, 400));
      }

      // 要約を追加
      if (response.summary?.length > 0) {
        setEntries((prev) => [...prev, { type: 'summary', lines: response.summary }]);
        scrollToBottom();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [config, entries.length, taskContext, phase, userProfile, scrollToBottom]);

  // 初回自動実行
  useEffect(() => {
    if (config && entries.length === 0 && !loading) {
      startMeeting(phase === 'sukuu'
        ? 'この中から今日のミハクを選びたい'
        : 'このタスクについて相談したい');
    }
  }, [config]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    startMeeting(text);
  };

  const handleReaction = (character: CharacterName, reaction: string) => {
    // TODO: DBに保存（meeting_reactions）
    console.log(`[reaction] ${character}: ${reaction}`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>☕ 5人会議</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* チャットエリア */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
      >
        {entries.map((entry, i) => {
          if (entry.type === 'character') {
            return (
              <CharacterBubble
                key={i}
                message={entry.message}
                onReaction={handleReaction}
              />
            );
          }
          if (entry.type === 'user') {
            return <UserBubble key={i} text={entry.text} />;
          }
          if (entry.type === 'summary') {
            return <SummaryView key={i} summary={entry.lines} />;
          }
          return null;
        })}

        {loading && <InkDropIndicator />}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => startMeeting('もう一度お願い')}
            >
              <Text style={styles.retryBtnText}>再試行</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 入力エリア */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="会議に参加する..."
          placeholderTextColor={colors.textSub}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!loading}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── スタイル ────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 20,
    color: colors.sumiInk,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 32,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f8f7f5',
    borderRadius: 20,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sumiInk,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.ringUnfilled,
  },
  sendBtnText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#c0392b',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  retryBtnText: {
    fontSize: 13,
    color: colors.textLight,
  },
});

const bubbleStyles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  body: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  text: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  reactions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginLeft: 4,
  },
  reactionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
  },
  reactionBtnActive: {
    borderColor: colors.sumiInk,
    backgroundColor: '#f0ede8',
  },
  reactionText: {
    fontSize: 12,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  userBody: {
    backgroundColor: colors.sumiInk,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  userText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
});

const summaryStyles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginBottom: 16,
  },
  line: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: 4,
  },
  closing: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

const indicatorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    color: colors.textSub,
    letterSpacing: 0.5,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sumiInk,
  },
});

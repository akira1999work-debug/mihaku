import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView,
  Platform, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../src/db/tasks';
import { TaskCard } from '../src/components/TaskCard';
import { FloatingActionBar } from '../src/components/FloatingActionBar';
import { ConfirmModal } from '../src/components/ConfirmModal';
import { VoiceOverlay } from '../src/components/VoiceOverlay';
import { VoiceChips } from '../src/components/VoiceChips';
import { RefineView } from '../src/components/RefineView';
import { AiSettingsView } from '../src/components/AiSettingsView';
import { useSpeechInput } from '../src/hooks/useSpeechInput';
import { splitChips } from '../src/utils/splitChips';
import { colors } from '../src/theme';
import { getDailyWord } from '../src/data/dailyWords';
import type { TaskWithSubs } from '../src/types/task';

const MAX_TODAY = 3;

type VoicePhase = 'idle' | 'recording' | 'chips' | 'refining';

export default function HomeScreen() {
  const router = useRouter();
  const {
    getTodayTasks, addTask,
    completeTask, uncompleteTask, releaseTask,
    toggleSubtask, addSubtask, updateMemo,
  } = useTasks();

  const [tasks, setTasks] = useState<TaskWithSubs[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  // 音声入力
  const speech = useSpeechInput();
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [chips, setChips] = useState<string[]>([]);
  const [rawVoiceText, setRawVoiceText] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getTodayTasks();
    setTasks(result);
    setLoading(false);
  }, [getTodayTasks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeTasks = tasks.filter((t) => t.status === 'today');
  const showAddButton = activeTasks.length < MAX_TODAY;

  const handleAdd = async () => {
    const title = input.trim();
    if (!title) return;
    if (!showAddButton) return;
    await addTask(title);
    setInput('');
    await refresh();
  };

  // --- 音声入力ハンドラ ---

  const handleVoiceStart = async () => {
    await speech.start();
    setVoicePhase('recording');
  };

  const handleVoiceStop = () => {
    speech.stop();
    const text = speech.transcript;
    if (text.trim()) {
      // AI整形フェーズへ（ふるう）
      setRawVoiceText(text);
      setVoicePhase('refining');
    } else {
      setVoicePhase('idle');
    }
  };

  const handleVoiceCancel = () => {
    speech.stop();
    speech.clear();
    setVoicePhase('idle');
    setChips([]);
  };

  const handlePickChip = async (text: string) => {
    if (!showAddButton) return;
    await addTask(text);
    await refresh();
  };

  const handleChipsDone = () => {
    setVoicePhase('idle');
    setChips([]);
    speech.clear();
  };

  /** ふるう確定 — ミハク候補をタスクとして追加 */
  const handleRefineConfirm = async (mihakuTitles: string[], _kumoTitles: string[]) => {
    for (const title of mihakuTitles) {
      if (activeTasks.length < MAX_TODAY) {
        await addTask(title);
      }
    }
    // TODO: kumo をストックに保存（iter8以降）
    await refresh();
    setVoicePhase('idle');
    setRawVoiceText('');
    speech.clear();
  };

  const handleRefineCancel = () => {
    setVoicePhase('idle');
    setRawVoiceText('');
    speech.clear();
  };

  // --- 既存ハンドラ ---

  const handleComplete = async (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await completeTask(id);
    await refresh();
  };

  const handleUncomplete = async (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await uncompleteTask(id);
    await refresh();
  };

  const handleRelease = () => {
    if (expandedId == null) return;
    setConfirmRelease(true);
  };

  const handleConfirmRelease = () => {
    setConfirmRelease(false);
    setReleasingId(expandedId);
    setExpandedId(null);
  };

  const handleCancelRelease = () => {
    setConfirmRelease(false);
  };

  const handleReleaseAnimationEnd = useCallback(async () => {
    if (releasingId == null) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await releaseTask(releasingId);
    setReleasingId(null);
    await refresh();
  }, [releasingId, releaseTask, refresh]);

  const handleConsult = () => {
    const task = tasks.find((t) => t.id === expandedId);
    if (!task) return;
    router.push({
      pathname: '/meeting',
      params: {
        taskId: String(task.id),
        taskContext: `「${task.title}」— このタスクについて相談したい`,
        phase: 'migaku',
      },
    });
  };

  const handleEdit = () => {
    // TODO: Title edit mode
  };

  const handleToggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleSubtask = async (subId: number) => {
    await toggleSubtask(subId);
    await refresh();
  };

  const handleAddSubtask = async (taskId: number, title: string) => {
    await addSubtask(taskId, title);
    await refresh();
  };

  const handleUpdateMemo = async (taskId: number, memo: string) => {
    await updateMemo(taskId, memo);
    await refresh();
  };

  // Header status text
  const statusText = (() => {
    const active = activeTasks.length;
    if (active === 0) return '今日のミハクを選んでください';
    if (active < 3) return `${active}つ選んでいます`;
    return 'ミハクが揃いました';
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // AI設定画面
  if (showSettings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>mihaku</Text>
          <Text style={styles.headerSub}>設定</Text>
        </View>
        <AiSettingsView onClose={() => setShowSettings(false)} />
      </SafeAreaView>
    );
  }

  // ふるいモード: AI整形画面
  if (voicePhase === 'refining' && rawVoiceText) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>mihaku</Text>
          <Text style={styles.headerSub}>ふるいにかけています</Text>
        </View>

        <RefineView
          rawText={rawVoiceText}
          onConfirm={handleRefineConfirm}
          onCancel={handleRefineCancel}
        />
      </SafeAreaView>
    );
  }

  // チップ選択モード（フォールバック）: 画面全体をチップ表示に切り替え
  if (voicePhase === 'chips' && chips.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>mihaku</Text>
          <Text style={styles.headerSub}>拾いたいものを選んで</Text>
        </View>

        <VoiceChips
          chips={chips}
          onPickChip={handlePickChip}
          onDone={handleChipsDone}
        />
      </SafeAreaView>
    );
  }

  // Group: released tasks for stacking
  const releasedTasks = tasks.filter((t) => t.status === 'released');
  const nonReleasedTasks = tasks.filter((t) => t.status !== 'released');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>mihaku</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
                <Text style={styles.headerBtnText}>⚙</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => {
                const taskList = activeTasks.map((t) => `・${t.title}`).join('\n');
                router.push({
                  pathname: '/meeting',
                  params: {
                    taskContext: taskList || '今日はまだタスクがありません',
                    phase: 'sukuu',
                  },
                });
              }}>
                <Text style={styles.headerBtnText}>☕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => {/* TODO: stock screen */}}>
                <Text style={styles.headerBtnLabel}>ストック</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.headerSub}>{statusText}</Text>
          <Text style={styles.dailyWord}>{getDailyWord()}</Text>
        </View>

        {/* Task list */}
        <FlatList
          data={nonReleasedTasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              expanded={expandedId === item.id}
              isReleasing={releasingId === item.id}
              onToggleExpand={handleToggleExpand}
              onComplete={handleComplete}
              onUncomplete={handleUncomplete}
              onToggleSubtask={handleToggleSubtask}
              onAddSubtask={handleAddSubtask}
              onUpdateMemo={handleUpdateMemo}
              onReleaseAnimationEnd={handleReleaseAnimationEnd}
            />
          )}
          contentContainerStyle={styles.list}
          ListFooterComponentStyle={styles.listFooter}
          ListFooterComponent={
            <>
              {/* Released tasks — stacked at bottom */}
              {releasedTasks.length > 0 && (
                <View style={styles.releasedStack}>
                  {releasedTasks.map((task, i) => (
                    <View
                      key={task.id}
                      style={[
                        styles.releasedStackItem,
                        i > 0 && { marginTop: -40, marginLeft: i * 4 },
                        i > 0 && { zIndex: -i },
                      ]}
                    >
                      <TaskCard
                        task={task}
                        expanded={false}
                        onToggleExpand={() => {}}
                        onComplete={() => {}}
                        onUncomplete={() => {}}
                        onToggleSubtask={() => {}}
                        onAddSubtask={() => {}}
                        onUpdateMemo={() => {}}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Empty state — 大きなマイクボタン */}
              {tasks.length === 0 && (
                <View style={styles.emptyContainer}>
                  <TouchableOpacity
                    style={styles.emptyMicBtn}
                    onPress={handleVoiceStart}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emptyMicIcon}>🎙️</Text>
                  </TouchableOpacity>
                  <Text style={styles.emptyText}>
                    頭の中、全部出してみて
                  </Text>
                  <Text style={styles.emptyHint}>
                    タップして話す
                  </Text>
                </View>
              )}
            </>
          }
        />

        {/* Input row with mic button */}
        {showAddButton && tasks.length > 0 && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="追加する"
              placeholderTextColor={colors.textSub}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.micBtn}
              onPress={handleVoiceStart}
              activeOpacity={0.7}
            >
              <Text style={styles.micBtnText}>🎙️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!input.trim()}
            >
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating action bar */}
        {expandedId != null && tasks.find((t) => t.id === expandedId)?.status === 'today' && (
          <FloatingActionBar
            onRelease={handleRelease}
            onConsult={handleConsult}
            onEdit={handleEdit}
          />
        )}

        {/* Release confirmation modal */}
        <ConfirmModal
          visible={confirmRelease}
          title="手放しますか？"
          message={`「${tasks.find((t) => t.id === expandedId)?.title ?? ''}」を手放します`}
          confirmLabel="手放す"
          cancelLabel="やめる"
          onConfirm={handleConfirmRelease}
          onCancel={handleCancelRelease}
        />

        {/* Voice recording overlay */}
        <VoiceOverlay
          visible={voicePhase === 'recording'}
          transcript={speech.transcript}
          isListening={speech.isListening}
          onStop={handleVoiceStop}
          onCancel={handleVoiceCancel}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: colors.textSub,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '300',
    color: '#4a4540',
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerBtnText: {
    fontSize: 18,
  },
  headerBtnLabel: {
    fontSize: 13,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 6,
    letterSpacing: 1,
  },
  dailyWord: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 12,
    lineHeight: 20,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    flexGrow: 1,
  },
  listFooter: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  releasedStack: {
    marginTop: 8,
  },
  releasedStackItem: {
    // stacking offset handled inline
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyMicBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.divider,
    shadowColor: '#d4a574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 20,
  },
  emptyMicIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSub,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 8,
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.cardBg,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f7f5',
    borderRadius: 12,
    color: colors.text,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micBtnText: {
    fontSize: 20,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sumiInk,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addBtnDisabled: {
    backgroundColor: colors.ringUnfilled,
  },
  addBtnText: {
    fontSize: 22,
    color: '#FFF',
    fontWeight: '300',
    marginTop: -1,
  },
});

/**
 * デイリーセットアップ — その日の初回起動でミハクを選ぶフロー
 *
 * Step 1: プールの候補一覧を表示、タップで選択（最大3つ）
 * Step 2: 「これでいく」で確定 → ライトレビュー表示
 * Step 3: ライトレビュー（5人1行ずつ）→ 入れ替えor確定
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors } from '../theme';
import { useTasks } from '../db/tasks';
import type { Task } from '../types/task';
import type { AiConfig } from '../services/ai-types';
import { loadAiConfig } from '../services/ai-config-store';

const MAX_SELECT = 3;

type SetupPhase = 'select' | 'reviewing' | 'done';

interface DailySetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function DailySetup({ onComplete, onSkip }: DailySetupProps) {
  const { getPoolTasks, selectForToday } = useTasks();
  const [poolTasks, setPoolTasks] = useState<Task[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<SetupPhase>('select');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    getPoolTasks().then((tasks) => {
      setPoolTasks(tasks);
      setLoading(false);
    });
  }, [getPoolTasks]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setConfirming(true);

    // 選択したタスクを today に移動
    for (const id of selectedIds) {
      await selectForToday(id);
    }

    // TODO: ライトレビュー（Phase 2で実装）
    // 今はそのまま完了
    onComplete();
  }, [selectedIds, selectForToday, onComplete]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.sumiInk} />
      </View>
    );
  }

  const selectedCount = selectedIds.size;
  const statusText = selectedCount === 0
    ? '今日のミハクを選んでください'
    : selectedCount < 3
      ? `${selectedCount}つ選んでいます`
      : 'ミハクが揃いました';

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>今日のミハクを選ぶ</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </View>

      {/* 候補リスト */}
      <FlatList
        data={poolTasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.candidateCard, selected && styles.candidateSelected]}
              onPress={() => toggleSelect(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.candidateTitle, selected && styles.candidateTitleSelected]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>プールにタスクがありません</Text>
          </View>
        }
      />

      {/* アクションバー */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipBtnText}>あとで選ぶ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, selectedCount === 0 && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={selectedCount === 0 || confirming}
        >
          <Text style={styles.confirmBtnText}>
            {confirming ? '...' : `これでいく（${selectedCount}）`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  candidateSelected: {
    borderColor: colors.sumiInk,
    backgroundColor: '#f8f6f2',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ringUnfilled,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: colors.sumiInk,
    backgroundColor: colors.sumiInk,
  },
  checkmark: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  candidateTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  candidateTitleSelected: {
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSub,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.cardBg,
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.sumiInk,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.ringUnfilled,
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

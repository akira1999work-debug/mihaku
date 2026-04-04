/**
 * 気分チェック — 完了・手放し直後にワンタップ5段階
 *
 * スキップ可。常駐しない。
 * mood_checks テーブルに保存。
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { colors } from '../theme';

const MOODS = [
  { value: 1, label: '😣' },
  { value: 2, label: '😕' },
  { value: 3, label: '😐' },
  { value: 4, label: '🙂' },
  { value: 5, label: '😊' },
] as const;

interface MoodCheckProps {
  visible: boolean;
  action: 'complete' | 'release';
  taskTitle: string;
  onSelect: (mood: number) => void;
  onSkip: () => void;
}

export function MoodCheck({ visible, action, taskTitle, onSelect, onSkip }: MoodCheckProps) {
  const message = action === 'complete'
    ? `「${taskTitle}」完了`
    : `「${taskTitle}」を手放しました`;

  const question = '今、どんな気持ち？';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.question}>{question}</Text>

          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={styles.moodBtn}
                onPress={() => onSelect(m.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.moodEmoji}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>スキップ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  question: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  moodBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f7f5',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  moodEmoji: {
    fontSize: 22,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    color: colors.textSub,
  },
});

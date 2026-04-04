import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, runOnJS, Easing,
} from 'react-native-reanimated';
import { BrushRing } from './BrushRing';
import { colors } from '../theme';
import type { TaskWithSubs, SubTask } from '../types/task';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  task: TaskWithSubs;
  expanded: boolean;
  isReleasing?: boolean;
  onToggleExpand: (id: number) => void;
  onComplete: (id: number) => void;
  onUncomplete: (id: number) => void;
  onToggleSubtask: (id: number) => void;
  onAddSubtask: (taskId: number, title: string) => void;
  onUpdateMemo: (taskId: number, memo: string) => void;
  onSetTimeSlot?: (taskId: number, slot: string) => void;
  editing?: boolean;
  onEditTitle?: (taskId: number, newTitle: string) => void;
  onReleaseAnimationEnd?: () => void;
}

export function TaskCard({
  task, expanded, isReleasing,
  onToggleExpand,
  onComplete, onUncomplete,
  onToggleSubtask, onAddSubtask, onUpdateMemo,
  onSetTimeSlot, editing, onEditTitle, onReleaseAnimationEnd,
}: Props) {
  const [subInput, setSubInput] = useState('');
  const [memoInput, setMemoInput] = useState(task.memo || '');
  const [titleInput, setTitleInput] = useState(task.title);

  const isCompleted = task.status === 'completed';
  const isReleased = task.status === 'released';
  const completedCount = task.subtasks.filter((s) => s.completed).length;
  const totalCount = task.subtasks.length;

  const handleRingTap = () => {
    if (isCompleted) {
      onUncomplete(task.id);
    } else {
      onComplete(task.id);
    }
  };

  const handleCardTap = () => {
    if (isReleased) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggleExpand(task.id);
  };

  const handleAddSub = () => {
    const title = subInput.trim();
    if (!title) return;
    onAddSubtask(task.id, title);
    setSubInput('');
  };

  const handleMemoBlur = () => {
    onUpdateMemo(task.id, memoInput);
  };

  const cardOpacity = isReleased ? colors.releasedOpacity : isCompleted ? colors.completedOpacity : 1;

  // Release animation (ふわっと空に消える)
  const translateY = useSharedValue(0);
  const animScale = useSharedValue(1);
  const animOpacity = useSharedValue(1);

  useEffect(() => {
    if (isReleasing) {
      const easing = Easing.bezierFn(0.25, 0.1, 0.25, 1);
      translateY.value = withTiming(-250, { duration: 2000, easing });
      animScale.value = withTiming(0.85, { duration: 2000, easing });
      animOpacity.value = withDelay(600,
        withTiming(0, { duration: 1400, easing }, (finished) => {
          if (finished && onReleaseAnimationEnd) {
            runOnJS(onReleaseAnimationEnd)();
          }
        }),
      );
    }
  }, [isReleasing]);

  const releaseAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: animScale.value },
    ],
    opacity: animOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        isCompleted && styles.completedCard,
        isReleased && styles.releasedCard,
        { opacity: isReleasing ? undefined : cardOpacity },
        isReleasing && releaseAnimStyle,
      ]}
      pointerEvents={isReleasing ? 'none' : 'auto'}
    >
      {/* Main row: Ring + Title */}
      <View style={styles.mainRow}>
        <TouchableOpacity onPress={handleRingTap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {totalCount > 0 ? (
            <BrushRing
              total={totalCount}
              completed={completedCount}
              size={22}
              isTaskCompleted={isCompleted}
            />
          ) : (
            <View style={[styles.simpleRing, isCompleted && styles.simpleRingCompleted]}>
              {isCompleted && <Text style={styles.simpleCheck}>✓</Text>}
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.content} onPress={handleCardTap} activeOpacity={0.7}>
          {editing && onEditTitle ? (
            <TextInput
              style={[styles.title, styles.titleEditing]}
              value={titleInput}
              onChangeText={setTitleInput}
              onBlur={() => {
                const trimmed = titleInput.trim();
                if (trimmed && trimmed !== task.title) {
                  onEditTitle(task.id, trimmed);
                }
              }}
              onSubmitEditing={() => {
                const trimmed = titleInput.trim();
                if (trimmed && trimmed !== task.title) {
                  onEditTitle(task.id, trimmed);
                }
              }}
              autoFocus
              returnKeyType="done"
            />
          ) : (
            <Text style={[
              styles.title,
              isCompleted && styles.completedTitle,
            ]}>
              {task.title}
            </Text>
          )}
          <View style={styles.subtitleRow}>
            {totalCount > 0 && (
              <Text style={styles.sub}>
                <Text style={completedCount > 0 ? styles.subDone : undefined}>
                  {isCompleted ? `${totalCount}/${totalCount}` : `${completedCount}`}
                </Text>
                {isCompleted ? ' 完了' : `/${totalCount} サブタスク`}
              </Text>
            )}
            {task.time_slot && task.time_slot !== 'unset' && (
              <Text style={styles.timeSlotLabel}>
                {{ morning: '午前', afternoon: '午後', evening: '夜' }[task.time_slot]}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Expanded content */}
      {expanded && !isReleased && (
        <View style={styles.expandedArea}>
          {/* Subtasks */}
          {task.subtasks.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={styles.subRow}
              onPress={() => onToggleSubtask(sub.id)}
            >
              <Text style={styles.subCheck}>{sub.completed ? '☑' : '□'}</Text>
              <Text style={[styles.subText, sub.completed && styles.subTextDone]}>
                {sub.title}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Add subtask */}
          {!isCompleted && (
            <View style={styles.subInputRow}>
              <Text style={styles.subCheck}>＋</Text>
              <TextInput
                style={styles.subInput}
                placeholder="手順を追加"
                placeholderTextColor={colors.textSub}
                value={subInput}
                onChangeText={setSubInput}
                onSubmitEditing={handleAddSub}
                returnKeyType="done"
              />
            </View>
          )}

          {/* Time slot */}
          {!isCompleted && onSetTimeSlot && (
            <View style={styles.timeSlotRow}>
              <Text style={styles.timeSlotQuestion}>いつやる？</Text>
              {(['morning', 'afternoon', 'evening', 'unset'] as const).map((slot) => {
                const label = { morning: '午前', afternoon: '午後', evening: '夜', unset: '未定' }[slot];
                const active = task.time_slot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeSlotBtn, active && styles.timeSlotBtnActive]}
                    onPress={() => onSetTimeSlot(task.id, slot)}
                  >
                    <Text style={[styles.timeSlotBtnText, active && styles.timeSlotBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Memo */}
          {!isCompleted ? (
            <TextInput
              style={styles.memo}
              placeholder="メモ"
              placeholderTextColor={colors.textSub}
              value={memoInput}
              onChangeText={setMemoInput}
              onBlur={handleMemoBlur}
            />
          ) : task.memo ? (
            <Text style={styles.memoText}>{task.memo}</Text>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  completedCard: {
    backgroundColor: colors.completedCardBg,
  },
  releasedCard: {
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  simpleRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ringUnfilled,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleRingCompleted: {
    borderColor: colors.sumiCompleted,
    backgroundColor: colors.sumiCompleted,
  },
  simpleCheck: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
    marginTop: -1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  titleEditing: {
    borderBottomWidth: 1,
    borderBottomColor: colors.sumiInk,
    paddingVertical: 2,
  },
  completedTitle: {
    color: colors.completedTitle,
    textDecorationLine: 'line-through',
    textDecorationColor: '#b8c4ab',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sub: {
    fontSize: 11,
    color: colors.textSub,
  },
  subDone: {
    color: colors.completedSub,
  },
  timeSlotLabel: {
    fontSize: 10,
    color: colors.textSub,
    opacity: 0.7,
    letterSpacing: 0.3,
  },
  expandedArea: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  subCheck: {
    fontSize: 14,
    color: colors.textLight,
    width: 20,
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  subTextDone: {
    color: colors.textSub,
    textDecorationLine: 'line-through',
  },
  subInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  subInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 4,
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  timeSlotQuestion: {
    fontSize: 12,
    color: colors.textSub,
    letterSpacing: 0.3,
  },
  timeSlotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  timeSlotBtnActive: {
    borderColor: colors.sumiInk,
    backgroundColor: '#f0ede8',
  },
  timeSlotBtnText: {
    fontSize: 11,
    color: colors.textSub,
  },
  timeSlotBtnTextActive: {
    color: colors.sumiInk,
    fontWeight: '500',
  },
  memo: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textLight,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f8f7f5',
    borderRadius: 8,
  },
  memoText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textLight,
  },
});

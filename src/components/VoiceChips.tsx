/**
 * VoiceChips — 音声テキストから分割されたチップを表示
 * 砂金の粒のメタファー。タップで拾う（= タスクとして保存）
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';
import { colors } from '../theme';

interface VoiceChipsProps {
  /** 分割されたチップテキストの配列 */
  chips: string[];
  /** チップがタップされた時（タスクとして保存） */
  onPickChip: (text: string, index: number) => void;
  /** すべてのチップの処理が完了した時 */
  onDone: () => void;
}

interface ChipState {
  text: string;
  picked: boolean;
  dismissed: boolean;
}

export function VoiceChips({ chips, onPickChip, onDone }: VoiceChipsProps) {
  const [chipStates, setChipStates] = useState<ChipState[]>([]);
  const fadeAnims = useRef<Animated.Value[]>([]);

  useEffect(() => {
    const states = chips.map((text) => ({
      text,
      picked: false,
      dismissed: false,
    }));
    setChipStates(states);
    fadeAnims.current = chips.map(() => new Animated.Value(0));

    // ふわっと順番に表示
    chips.forEach((_, i) => {
      Animated.timing(fadeAnims.current[i], {
        toValue: 1,
        duration: 300,
        delay: i * 120,
        useNativeDriver: true,
      }).start();
    });
  }, [chips]);

  const handlePick = (index: number) => {
    const chip = chipStates[index];
    if (!chip || chip.picked || chip.dismissed) return;

    onPickChip(chip.text, index);

    // 拾ったアニメーション: 光って上に浮く
    setChipStates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, picked: true } : c))
    );

    Animated.timing(fadeAnims.current[index], {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      checkAllDone(index);
    });
  };

  const handleDismiss = (index: number) => {
    const chip = chipStates[index];
    if (!chip || chip.picked || chip.dismissed) return;

    // 拾わない: 薄くなって消える
    setChipStates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, dismissed: true } : c))
    );

    Animated.timing(fadeAnims.current[index], {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      checkAllDone(index);
    });
  };

  const checkAllDone = (lastIndex: number) => {
    setChipStates((prev) => {
      const allProcessed = prev.every(
        (c, i) => c.picked || c.dismissed || i === lastIndex
      );
      if (allProcessed) {
        // 少し待ってから完了通知
        setTimeout(onDone, 200);
      }
      return prev;
    });
  };

  if (chipStates.length === 0) return null;

  const remaining = chipStates.filter((c) => !c.picked && !c.dismissed).length;

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        拾いたいものをタップ。左スワイプで流す
      </Text>

      <View style={styles.chipGrid}>
        {chipStates.map((chip, index) => {
          if (chip.picked || chip.dismissed) return null;
          const fadeAnim = fadeAnims.current[index];
          if (!fadeAnim) return null;

          return (
            <Animated.View
              key={`${chip.text}-${index}`}
              style={[
                styles.chipWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handlePick(index)}
                onLongPress={() => handleDismiss(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{chip.text}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {remaining > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onDone}
          >
            <Text style={styles.doneBtnText}>これでいい</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  hint: {
    fontSize: 12,
    color: colors.textSub,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chipWrapper: {
    // アニメーション用ラッパー
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    // うっすら光る効果
    shadowColor: '#d4a574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  doneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  doneBtnText: {
    fontSize: 13,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
});

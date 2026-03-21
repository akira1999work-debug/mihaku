/**
 * VoiceOverlay — 音声入力中のオーバーレイUI
 * マイク録音中のリアルタイムテキスト表示
 */
import {
  View, Text, TouchableOpacity,
  StyleSheet, Modal,
} from 'react-native';
import { colors } from '../theme';

interface VoiceOverlayProps {
  visible: boolean;
  transcript: string;
  isListening: boolean;
  onStop: () => void;
  onCancel: () => void;
}

export function VoiceOverlay({
  visible,
  transcript,
  isListening,
  onStop,
  onCancel,
}: VoiceOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.content}>
          {/* 録音インジケーター */}
          <View style={styles.micContainer}>
            <View style={[styles.micCircle, isListening && styles.micCircleActive]}>
              <Text style={styles.micIcon}>🎙️</Text>
            </View>
            <Text style={styles.statusText}>
              {isListening ? '聴いてます...' : '処理中...'}
            </Text>
          </View>

          {/* リアルタイムテキスト */}
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              {transcript || '話してみて'}
            </Text>
          </View>

          {/* ボタン */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>やめる</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stopBtn, !transcript && styles.stopBtnDisabled]}
              onPress={onStop}
              disabled={!transcript}
            >
              <Text style={styles.stopBtnText}>できた</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(250, 250, 250, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  micContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.divider,
  },
  micCircleActive: {
    borderColor: colors.releaseAccent,
    shadowColor: colors.releaseAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  micIcon: {
    fontSize: 32,
  },
  statusText: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 12,
    letterSpacing: 1,
  },
  transcriptBox: {
    width: '100%',
    minHeight: 120,
    maxHeight: 240,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 32,
  },
  transcriptText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.textLight,
  },
  stopBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: colors.sumiInk,
  },
  stopBtnDisabled: {
    backgroundColor: colors.ringUnfilled,
  },
  stopBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
});

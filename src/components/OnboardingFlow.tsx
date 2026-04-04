/**
 * 初回体験フロー
 *
 * はきだす → ふるう → すくう（5人会議）→ きめる → ホーム
 * 既存コンポーネントを順に表示するコンテナ。
 */

import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors } from '../theme';
import { VoiceOverlay } from './VoiceOverlay';
import { RefineView } from './RefineView';
import { useSpeechInput } from '../hooks/useSpeechInput';
import type { TaskItem } from '../services/ai-types';
import { saveAiConfig, loadAiConfig } from '../services/ai-config-store';

type Step = 'intro' | 'hakidasu' | 'furuu' | 'sukuu' | 'kimeru' | 'done';

interface OnboardingFlowProps {
  onComplete: (mihakuTitles: string[], kumoTitles: string[]) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('intro');
  const [rawText, setRawText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mihaku, setMihaku] = useState<string[]>([]);
  const [kumo, setKumo] = useState<string[]>([]);
  const speech = useSpeechInput();

  // --- イントロ ---
  if (step === 'intro') {
    return (
      <View style={styles.container}>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>mihaku</Text>
          <Text style={styles.introSubtitle}>3つの余白</Text>

          <View style={styles.introTextBlock}>
            <Text style={styles.introText}>
              頭の中にあること、{'\n'}
              全部出してみてください。
            </Text>
            <Text style={styles.introTextSub}>
              やること、気になってること、{'\n'}
              なんでも大丈夫です。
            </Text>
            <Text style={styles.introTextSub}>
              その中から、今日のあなたにとって{'\n'}
              大切なものを一緒に見つけましょう。
            </Text>
          </View>

          <TouchableOpacity
            style={styles.introBtn}
            onPress={() => setStep('hakidasu')}
            activeOpacity={0.7}
          >
            <Text style={styles.introBtnText}>はじめる</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- はきだす ---
  if (step === 'hakidasu') {
    const handleVoiceStop = () => {
      speech.stop();
      const text = speech.transcript;
      if (text.trim()) {
        setRawText(text);
        setStep('furuu');
      }
    };

    const handleTextSubmit = () => {
      const text = textInput.trim();
      if (text) {
        setRawText(text);
        setStep('furuu');
      }
    };

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hakidasuContent}>
          <Text style={styles.stepTitle}>はきだす</Text>
          <Text style={styles.stepDesc}>
            頭の中にあること、全部出してみて。{'\n'}
            タップして話すか、テキストで入力できます。
          </Text>

          <TouchableOpacity
            style={styles.micBtnLarge}
            onPress={async () => {
              await speech.start();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.micBtnIcon}>🎙️</Text>
            <Text style={styles.micBtnLabel}>タップして話す</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>または</Text>

          <TextInput
            style={styles.textArea}
            placeholder="ここに書き出す..."
            placeholderTextColor={colors.textSub}
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={4}
          />

          {textInput.trim().length > 0 && (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleTextSubmit}
            >
              <Text style={styles.nextBtnText}>これで全部</Text>
            </TouchableOpacity>
          )}
        </View>

        <VoiceOverlay
          visible={speech.isListening}
          transcript={speech.transcript}
          isListening={speech.isListening}
          onStop={handleVoiceStop}
          onCancel={() => {
            speech.stop();
            speech.clear();
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  // --- ふるう ---
  if (step === 'furuu') {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>ふるう</Text>
          <Text style={styles.stepDesc}>AIがタスクを整理しています</Text>
        </View>
        <RefineView
          rawText={rawText}
          onConfirm={(mihakuTitles, kumoTitles) => {
            setMihaku(mihakuTitles);
            setKumo(kumoTitles);
            // すくう（5人会議）をスキップしてきめるへ
            // 初回体験では5人会議は重すぎるかもしれないのでオプション化
            // TODO: iter9の設計では会議を含むが、まずフロー繋ぎを優先
            setStep('kimeru');
          }}
          onCancel={() => setStep('hakidasu')}
        />
      </View>
    );
  }

  // --- きめる ---
  if (step === 'kimeru') {
    return (
      <View style={styles.container}>
        <View style={styles.kimeruContent}>
          <Text style={styles.stepTitle}>きめる</Text>
          <Text style={styles.stepDesc}>
            今日のミハクが決まりました
          </Text>

          <View style={styles.kimeruList}>
            {mihaku.map((title, i) => (
              <View key={i} style={styles.kimeruCard}>
                <Text style={styles.kimeruCardText}>{title}</Text>
              </View>
            ))}
          </View>

          {kumo.length > 0 && (
            <View style={styles.kumoSection}>
              <Text style={styles.kumoLabel}>
                クモ（ストックに保存されます）
              </Text>
              {kumo.map((title, i) => (
                <Text key={i} style={styles.kumoItem}>・{title}</Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => onComplete(mihaku, kumo)}
            activeOpacity={0.7}
          >
            <Text style={styles.completeBtnText}>はじめよう</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // --- イントロ ---
  introContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  introTitle: {
    fontSize: 32,
    fontWeight: '200',
    color: colors.sumiInk,
    letterSpacing: 6,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    letterSpacing: 2,
    marginBottom: 48,
  },
  introTextBlock: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 48,
  },
  introText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  introTextSub: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  introBtn: {
    backgroundColor: colors.sumiInk,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  introBtnText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
    letterSpacing: 1,
  },

  // --- はきだす ---
  hakidasuContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  stepHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  micBtnLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.divider,
    shadowColor: '#d4a574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 4,
    marginTop: 40,
    marginBottom: 16,
  },
  micBtnIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  micBtnLabel: {
    fontSize: 11,
    color: colors.textSub,
    letterSpacing: 0.3,
  },
  orText: {
    fontSize: 13,
    color: colors.textSub,
    marginVertical: 16,
  },
  textArea: {
    width: '100%',
    minHeight: 100,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  nextBtn: {
    backgroundColor: colors.sumiInk,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  nextBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // --- きめる ---
  kimeruContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  kimeruList: {
    width: '100%',
    gap: 10,
    marginTop: 32,
    marginBottom: 24,
  },
  kimeruCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.sumiInk,
  },
  kimeruCardText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  kumoSection: {
    width: '100%',
    marginBottom: 32,
  },
  kumoLabel: {
    fontSize: 12,
    color: colors.textSub,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  kumoItem: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 22,
  },
  completeBtn: {
    backgroundColor: colors.sumiInk,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 'auto',
    marginBottom: 40,
  },
  completeBtnText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
    letterSpacing: 1,
  },
});

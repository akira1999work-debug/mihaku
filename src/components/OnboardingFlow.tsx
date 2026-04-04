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
import { MeetingView } from './MeetingView';
import { useSpeechInput } from '../hooks/useSpeechInput';
import type { TaskItem } from '../services/ai-types';
import { saveUserProfile } from '../services/user-profile-store';

type Step = 'intro' | 'hakidasu' | 'furuu_intro' | 'furuu' | 'sukuu' | 'kimeru' | 'done';

interface OnboardingFlowProps {
  onComplete: (mihakuTitles: string[], kumoTitles: string[]) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('intro');
  const [rawText, setRawText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mihaku, setMihaku] = useState<string[]>([]);
  const [kumo, setKumo] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState('');
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
        setStep('furuu_intro');
      }
    };

    const handleTextSubmit = () => {
      const text = textInput.trim();
      if (text) {
        setRawText(text);
        setStep('furuu_intro');
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

  // --- ふるう前の説明 ---
  if (step === 'furuu_intro') {
    return (
      <View style={styles.container}>
        <View style={styles.furuuIntroContent}>
          <Text style={styles.stepTitle}>ふるう</Text>
          <Text style={styles.furuuIntroText}>
            出してくれたものを整理するね。
          </Text>

          <View style={styles.furuuExplainBox}>
            <View style={styles.furuuExplainRow}>
              <Text style={styles.furuuExplainLabel}>ミハク</Text>
              <Text style={styles.furuuExplainDesc}>今日やりたいもの</Text>
            </View>
            <View style={styles.furuuExplainDivider} />
            <View style={styles.furuuExplainRow}>
              <Text style={styles.furuuExplainLabel}>クモ</Text>
              <Text style={styles.furuuExplainDesc}>今じゃなくていいもの</Text>
            </View>
          </View>

          <Text style={styles.furuuIntroHint}>
            後から自由に動かせます
          </Text>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setStep('furuu')}
            activeOpacity={0.7}
          >
            <Text style={styles.nextBtnText}>整理する</Text>
          </TouchableOpacity>
        </View>
      </View>
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
            setStep('sukuu');
          }}
          onCancel={() => setStep('hakidasu')}
        />
      </View>
    );
  }

  // --- すくう（5人会議 — 初回は心春が自己紹介を聞く） ---
  if (step === 'sukuu') {
    const taskList = mihaku.map((t) => `・${t}`).join('\n');
    const kumoList = kumo.map((t) => `・${t}`).join('\n');
    let taskContext = '';
    if (mihaku.length > 0) taskContext += `ミハク候補:\n${taskList}\n\n`;
    if (kumo.length > 0) taskContext += `クモ（今じゃなくていいもの）:\n${kumoList}\n\n`;
    taskContext += '【初回】ユーザーはmihakuを初めて使っています。心春は議論の途中で自然に「ちょっと聞いていい？普段どんな生活してるの？」と自己紹介を聞いてください。';

    return (
      <View style={styles.container}>
        <MeetingView
          taskContext={taskContext}
          phase="sukuu"
          userProfile={userProfile || undefined}
          onClose={() => setStep('kimeru')}
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

  // --- ふるう前説明 ---
  furuuIntroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  furuuIntroText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
  },
  furuuExplainBox: {
    width: '100%',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 16,
  },
  furuuExplainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  furuuExplainLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.sumiInk,
    width: 60,
    letterSpacing: 1,
  },
  furuuExplainDesc: {
    fontSize: 14,
    color: colors.textLight,
  },
  furuuExplainDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  furuuIntroHint: {
    fontSize: 13,
    color: colors.textSub,
    marginBottom: 32,
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

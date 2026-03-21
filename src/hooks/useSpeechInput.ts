/**
 * 音声入力フック — expo-speech-recognition のラッパー
 * 「はきだす」体験の音声→テキスト変換を担当
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseSpeechInputReturn {
  /** 現在認識中のテキスト（interim含む） */
  transcript: string;
  /** 認識中かどうか */
  isListening: boolean;
  /** 音声認識が利用可能か */
  isAvailable: boolean;
  /** 認識開始 */
  start: () => Promise<void>;
  /** 認識停止 */
  stop: () => void;
  /** テキストをクリア */
  clear: () => void;
  /** エラーメッセージ */
  error: string | null;
}

export function useSpeechInput(): UseSpeechInputReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    ExpoSpeechRecognitionModule.getStateAsync().then((state) => {
      setIsAvailable(state !== 'inactive');
    }).catch(() => {
      setIsAvailable(false);
    });
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    // results は ExpoSpeechRecognitionResult[] — 最新の結果を取得
    const results = event.results;
    if (!results || results.length === 0) return;

    const latest = results[results.length - 1];
    const text = latest?.transcript ?? '';

    if (event.isFinal) {
      // 確定テキストを蓄積
      const separator = finalTranscriptRef.current ? '、' : '';
      finalTranscriptRef.current += separator + text;
      setTranscript(finalTranscriptRef.current);
    } else {
      // interim: 確定分 + 認識中テキスト
      const separator = finalTranscriptRef.current ? '、' : '';
      setTranscript(finalTranscriptRef.current + separator + text);
    }
  });

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.error);
    setIsListening(false);
  });

  const start = useCallback(async () => {
    setError(null);
    finalTranscriptRef.current = '';
    setTranscript('');

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError('マイクの使用許可が必要です');
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'ja-JP',
      interimResults: true,
      continuous: true,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const clear = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    isAvailable,
    start,
    stop,
    clear,
    error,
  };
}

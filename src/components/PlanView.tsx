/**
 * 課金プラン表示画面（v1ではUI枠のみ・実課金なし）
 */

import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { colors } from '../theme';

interface PlanViewProps {
  onClose: () => void;
}

interface PlanCardProps {
  name: string;
  price: string;
  features: string[];
  recommended?: boolean;
  current?: boolean;
}

function PlanCard({ name, price, features, recommended, current }: PlanCardProps) {
  return (
    <View style={[planStyles.card, recommended && planStyles.cardRecommended]}>
      {recommended && (
        <Text style={planStyles.badge}>おすすめ</Text>
      )}
      <Text style={planStyles.name}>{name}</Text>
      <Text style={planStyles.price}>{price}</Text>

      <View style={planStyles.features}>
        {features.map((f, i) => (
          <Text key={i} style={planStyles.feature}>・{f}</Text>
        ))}
      </View>

      <TouchableOpacity
        style={[planStyles.btn, current && planStyles.btnCurrent]}
        disabled={current}
      >
        <Text style={[planStyles.btnText, current && planStyles.btnTextCurrent]}>
          {current ? '現在のプラン' : '選択する'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function PlanView({ onClose }: PlanViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>プラン</Text>
        <View style={styles.spacer} />
      </View>

      <Text style={styles.note}>
        v1開発中 — 課金機能は未実装です
      </Text>

      <PlanCard
        name="Pro"
        price="¥680 / 月"
        features={[
          '今日の3つ・手放し',
          '5人会議 1日3回',
          '会議中の発言 5回/会議',
          'AIモデル: 標準',
        ]}
        current
      />

      <PlanCard
        name="Pro Max"
        price="¥1,480 / 月"
        features={[
          '5人会議 無制限',
          '会議中の発言 無制限',
          '1対1チャット',
          'エンドコンテンツ（関係性Level）',
          'AIそうだん（音声/テキスト操作）',
          'AIモデル: 高品質',
        ]}
        recommended
      />

      <View style={styles.apiSection}>
        <Text style={styles.apiTitle}>自前API</Text>
        <Text style={styles.apiDesc}>
          設定画面からAPIキーを入力すると、好きなAIモデルを自己負担で利用できます
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  backBtn: {
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 20,
    color: colors.sumiInk,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  spacer: {
    width: 32,
  },
  note: {
    fontSize: 12,
    color: colors.textSub,
    textAlign: 'center',
    marginBottom: 24,
    paddingVertical: 8,
    backgroundColor: '#f8f7f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  apiSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  apiTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  apiDesc: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 20,
  },
});

const planStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardRecommended: {
    borderColor: colors.sumiInk,
  },
  badge: {
    fontSize: 11,
    color: colors.cardBg,
    backgroundColor: colors.sumiInk,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 16,
  },
  features: {
    gap: 6,
    marginBottom: 16,
  },
  feature: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.sumiInk,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnCurrent: {
    backgroundColor: '#f0ede8',
  },
  btnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  btnTextCurrent: {
    color: colors.textLight,
  },
});

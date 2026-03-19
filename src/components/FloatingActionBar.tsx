import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface Props {
  onRelease: () => void;
  onConsult: () => void;
  onEdit: () => void;
}

export function FloatingActionBar({ onRelease, onConsult, onEdit }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onRelease}>
        <View style={[styles.circle, styles.releaseCircle]}>
          <Text style={styles.releaseIcon}>↗</Text>
        </View>
        <Text style={styles.label}>手放す</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onConsult}>
        <View style={[styles.circle, styles.consultCircle]}>
          <Text style={styles.consultIcon}>☕</Text>
        </View>
        <Text style={styles.label}>相談する</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onEdit}>
        <View style={[styles.circle, styles.editCircle]}>
          <Text style={styles.editIcon}>✎</Text>
        </View>
        <Text style={styles.label}>編集</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: colors.cardBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  button: {
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  releaseCircle: {
    backgroundColor: '#faf5ef',
  },
  consultCircle: {
    backgroundColor: '#f5f3ef',
  },
  editCircle: {
    backgroundColor: '#f3f3f3',
  },
  releaseIcon: {
    fontSize: 20,
    color: colors.releaseAccent,
  },
  consultIcon: {
    fontSize: 20,
  },
  editIcon: {
    fontSize: 18,
    color: colors.textLight,
  },
  label: {
    fontSize: 11,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';
import { MeetingView } from '../src/components/MeetingView';
import { colors } from '../src/theme';
import type { MeetingPhase } from '../src/services/ai-types';

export default function MeetingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string;
    taskContext?: string;
    phase?: string;
    userProfile?: string;
  }>();

  const taskId = params.taskId ? Number(params.taskId) : undefined;
  const taskContext = params.taskContext ?? '今日のタスクについて相談';
  const phase = (params.phase ?? 'migaku') as MeetingPhase;
  const userProfile = params.userProfile;

  return (
    <SafeAreaView style={styles.container}>
      <MeetingView
        taskId={taskId}
        taskContext={taskContext}
        phase={phase}
        userProfile={userProfile}
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

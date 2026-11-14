import {
  describeError,
  type Uas7EligibilityData,
  type Uas7ScoreData,
  type Uas7WeekData,
} from '@drmayday/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';
import { HistoryList } from '@/components/uas7/history-list';
import { TodayCard } from '@/components/uas7/today-card';
import { WeekCard } from '@/components/uas7/week-card';
import { todayLocalIso } from '@/lib/local-date';
import { fetchEligibility, fetchScoreHistory, fetchWeek } from '@/lib/uas7-api';

interface Uas7State {
  eligibility: Uas7EligibilityData;
  /** Chỉ có dữ liệu khi đủ điều kiện chấm điểm. */
  scores: Uas7ScoreData[];
  week: Uas7WeekData | null;
}

async function loadState(patientId: number): Promise<Uas7State> {
  const eligibility = await fetchEligibility();
  if (eligibility.eligible !== 'true') return { eligibility, scores: [], week: null };
  const [scores, week] = await Promise.all([fetchScoreHistory(patientId), fetchWeek(patientId)]);
  return { eligibility, scores, week };
}

function Uas7Content() {
  const { user } = useAuth();
  const userId = user?.user_id;
  const [state, setState] = useState<Uas7State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState(todayLocalIso);

  // Chỉ nhận kết quả của lần tải mới nhất, tránh phản hồi cũ về muộn ghi đè.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const patientId = Number(userId);
    if (!Number.isInteger(patientId)) {
      setError('Không xác định được tài khoản. Vui lòng đăng nhập lại.');
      return;
    }
    const requestId = ++latestRequest.current;
    setError(null);
    try {
      const next = await loadState(patientId);
      if (requestId === latestRequest.current) setState(next);
    } catch (e) {
      if (requestId === latestRequest.current) setError(describeError(e));
    }
  }, [userId]);

  // Cập nhật "hôm nay" rồi tải lại; gọi khi mở tab và khi app quay lại, để qua nửa đêm không giữ ngày cũ.
  const reload = useCallback(() => {
    setToday(todayLocalIso());
    return load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void reload();
    });
    return () => subscription.remove();
  }, [reload]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  const medicalRecordId =
    state?.eligibility.eligible === 'true' ? state.eligibility.medical_record_id : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <Text style={styles.title}>Chấm điểm UAS7</Text>
        {error && <Banner tone="error" message={error} />}
        {error && <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void load()} />}
        {!state ? (
          !error && <ActivityIndicator size="large" />
        ) : !medicalRecordId ? (
          <Text style={styles.message}>Bạn cần có bệnh án đang điều trị để chấm điểm UAS7</Text>
        ) : (
          <>
            <TodayCard
              key={today}
              scoreDate={today}
              medicalRecordId={medicalRecordId}
              submitted={state.scores.find((score) => score.score_date === today)}
              onChanged={load}
            />
            {state.week && <WeekCard week={state.week} />}
            <HistoryList scores={state.scores} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. */
export default function Uas7Screen() {
  return (
    <AuthGate require="signed-in">
      <Uas7Content />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5ff' },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  message: { fontSize: 18, color: '#595959', textAlign: 'center', paddingVertical: 24 },
});

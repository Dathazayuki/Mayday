import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { PrimaryButton } from '@/components/primary-button';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Xin chào{user ? `, ${user.full_name}` : ''}</Text>
      <Text style={styles.subtitle}>
        Tự ghi nhận tình trạng tổn thương da, chấm điểm UAS7 hằng ngày và theo dõi bệnh án của bạn.
      </Text>
      <PrimaryButton
        title="Hồ sơ cá nhân"
        variant="secondary"
        onPress={() => router.push('/profile')}
      />
      <PrimaryButton
        title="Đổi mật khẩu"
        variant="secondary"
        onPress={() => router.push('/change-password')}
      />
      <PrimaryButton
        title="Đăng xuất"
        variant="danger"
        loading={loggingOut}
        onPress={() => void handleLogout()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 17, color: '#595959', lineHeight: 24 },
});

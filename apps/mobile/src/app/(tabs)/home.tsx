import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Xin chào{user ? `, ${user.full_name}` : ''}</Text>
      <Text style={styles.subtitle}>
        Tự ghi nhận tình trạng tổn thương da, chấm điểm UAS7 hằng ngày và theo dõi bệnh án của bạn.
      </Text>
      <Pressable style={styles.button} onPress={() => void logout()} accessibilityRole="button">
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 17, color: '#595959', lineHeight: 24 },
  button: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 18, fontWeight: '600', color: '#cf1322' },
});

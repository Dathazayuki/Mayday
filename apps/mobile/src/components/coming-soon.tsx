import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.badge}>Đang phát triển</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700' },
  description: { fontSize: 17, color: '#595959', lineHeight: 24 },
  badge: { fontSize: 15, color: '#2f54eb', fontWeight: '600' },
});

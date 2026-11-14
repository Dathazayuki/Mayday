import { StyleSheet, Text } from 'react-native';

type BannerTone = 'error' | 'success';

export function Banner({ tone, message }: { tone: BannerTone; message: string }) {
  return (
    <Text style={[styles.banner, tone === 'error' ? styles.error : styles.success]}>{message}</Text>
  );
}

const styles = StyleSheet.create({
  banner: { fontSize: 16, padding: 12, borderRadius: 8 },
  error: { color: '#a8071a', backgroundColor: '#fff1f0' },
  success: { color: '#135200', backgroundColor: '#f6ffed' },
});

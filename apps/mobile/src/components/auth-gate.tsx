import { Redirect, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';

/** Chỉ hiện màn con khi trạng thái đăng nhập đúng yêu cầu, ngược lại chuyển hướng. */
export function AuthGate({
  require,
  redirectHref,
  children,
}: {
  require: 'signed-in' | 'signed-out';
  /** Đích chuyển hướng thay cho mặc định (/login hoặc /home). */
  redirectHref?: Href;
  children: ReactNode;
}) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (status !== require) {
    return <Redirect href={redirectHref ?? (require === 'signed-in' ? '/login' : '/home')} />;
  }
  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

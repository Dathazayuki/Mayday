import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';

/** Chỉ hiện màn con khi trạng thái đăng nhập đúng yêu cầu, ngược lại chuyển hướng. */
export function AuthGate({
  require,
  children,
}: {
  require: 'signed-in' | 'signed-out';
  children: ReactNode;
}) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (status !== require) {
    return <Redirect href={require === 'signed-in' ? '/login' : '/home'} />;
  }
  return children;
}

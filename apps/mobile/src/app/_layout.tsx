import { Stack } from 'expo-router';
import { AuthProvider } from '@/auth/auth-context';

const formScreenOptions = { headerShown: true, headerBackButtonDisplayMode: 'minimal' } as const;

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="signup" options={{ ...formScreenOptions, title: 'Đăng ký' }} />
        <Stack.Screen
          name="forgot-password"
          options={{ ...formScreenOptions, title: 'Quên mật khẩu' }}
        />
        <Stack.Screen name="profile" options={{ ...formScreenOptions, title: 'Hồ sơ cá nhân' }} />
        <Stack.Screen
          name="change-password"
          options={{ ...formScreenOptions, title: 'Đổi mật khẩu' }}
        />
      </Stack>
    </AuthProvider>
  );
}

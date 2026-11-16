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
        <Stack.Screen
          name="records/new"
          options={{ ...formScreenOptions, title: 'Tạo bệnh án mới' }}
        />
        <Stack.Screen
          name="records/[id]"
          options={{ ...formScreenOptions, title: 'Chi tiết bệnh án' }}
        />
        <Stack.Screen
          name="records/[id]/edit"
          options={{ ...formScreenOptions, title: 'Sửa thông tin đã khai' }}
        />
        <Stack.Screen name="media" options={{ ...formScreenOptions, title: 'Kho ảnh của tôi' }} />
        <Stack.Screen
          name="lesions/new"
          options={{ ...formScreenOptions, title: 'Đợt tổn thương' }}
        />
        <Stack.Screen
          name="lesions/[id]"
          options={{ ...formScreenOptions, title: 'Chi tiết đợt tổn thương' }}
        />
        <Stack.Screen
          name="lesions/location"
          options={{ ...formScreenOptions, title: 'Vị trí tổn thương' }}
        />
        <Stack.Screen
          name="lesions/photo"
          options={{ ...formScreenOptions, title: 'Ảnh tổn thương' }}
        />
      </Stack>
    </AuthProvider>
  );
}

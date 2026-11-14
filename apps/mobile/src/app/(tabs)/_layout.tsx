import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (status === 'signed-out') return <Redirect href="/login" />;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Trang chủ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="uas7">
        <NativeTabs.Trigger.Label>UAS7</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="monitoring" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lesions">
        <NativeTabs.Trigger.Label>Tổn thương da</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bandage.fill" md="healing" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Label>Bệnh án</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Thông báo</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell.fill" md="notifications" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

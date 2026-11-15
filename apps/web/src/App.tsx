import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';
import { appTheme } from './theme/antd-theme';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ConfigProvider locale={viVN} theme={appTheme}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

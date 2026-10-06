import { lazy, Suspense, type ComponentType } from 'react';
import { createHashRouter } from 'react-router';
import { AppShell } from './ui/AppShell';
import { Loading } from './ui/kit';

const page = (load: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<div className="page"><Loading /></div>}>
      <C />
    </Suspense>
  );
};

// HashRouter: 정적 호스팅·Artifact에서도 새로고침 시 경로가 깨지지 않는다.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: page(() => import('./pages/HomePage')) },
      { path: 'ips', element: page(() => import('./pages/ExplorePage')) },
      { path: 'ips/:ipId', element: page(() => import('./pages/IpDetailPage')) },
      { path: 'checkout/:productId', element: page(() => import('./pages/CheckoutPage')) },
      { path: 'quests', element: page(() => import('./pages/QuestsPage')) },
      { path: 'quests/:questId', element: page(() => import('./pages/QuestDetailPage')) },
      { path: 'merchant', element: page(() => import('./pages/MerchantPage')) },
      { path: 'studio', element: page(() => import('./pages/StudioPage')) },
      { path: 'studio/new', element: page(() => import('./pages/StudioNewPage')) },
      { path: 'studio/:ipId', element: page(() => import('./pages/StudioIpPage')) },
      { path: 'transparency', element: page(() => import('./pages/TransparencyPage')) },
      { path: 'report', element: page(() => import('./pages/ReportPage')) },
      { path: 'login', element: page(() => import('./pages/LoginPage')) },
      { path: 'signup', element: page(() => import('./pages/SignupPage')) },
      { path: 'verify', element: page(() => import('./pages/VerifyPage')) },
      { path: 'me', element: page(() => import('./pages/MePage')) },
      { path: 'me/licenses', element: page(() => import('./pages/LicensesPage')) },
      { path: 'me/licenses/:grantId', element: page(() => import('./pages/LicenseDetailPage')) },
      { path: 'me/wallet', element: page(() => import('./pages/WalletPage')) },
      { path: 'legal/:doc', element: page(() => import('./pages/LegalPage')) },
      { path: 'admin', element: page(() => import('./pages/admin/AdminPage')) },
      { path: '*', element: page(() => import('./pages/NotFoundPage')) },
    ],
  },
]);

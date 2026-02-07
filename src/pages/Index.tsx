import { lazy, Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

const Dashboard = lazy(() => import('./Dashboard'));

const Index = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Dashboard />
    </Suspense>
  );
};

export default Index;

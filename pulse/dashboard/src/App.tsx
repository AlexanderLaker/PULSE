import { Suspense, lazy } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { FullPageSkeleton } from './components/LoadingSkeleton';

const WarRoom = lazy(() => import('./components/WarRoom'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageSkeleton />}>
        <WarRoom />
      </Suspense>
    </ErrorBoundary>
  );
}

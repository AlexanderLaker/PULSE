'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        if (data.authenticated) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.replace('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-500">Loading PRISM Profit Pool Shift Model...</p>
        </div>
      </div>
    );
  }

  return null;
}

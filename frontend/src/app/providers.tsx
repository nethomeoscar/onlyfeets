'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { socketService } from '@/lib/socket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AppInitializer>{children}</AppInitializer>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
            },
            success: { iconTheme: { primary: '#ff6b9d', secondary: '#fff' } },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { user, accessToken, restoreSession } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (accessToken) {
      socketService.connect(accessToken);
    } else {
      socketService.disconnect();
    }
    return () => { socketService.disconnect(); };
  }, [accessToken]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <span className="text-2xl">🦶</span>
          </div>
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

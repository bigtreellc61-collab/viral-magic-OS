import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { Shell } from '@/components/layout/shell';
import { SetupPage } from '@/pages/setup';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { SettingsPage } from '@/pages/settings';
import NotFound from '@/pages/not-found';
import { useGetSetupStatus, useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthWall() {
  const [location, setLocation] = useLocation();
  const { data: setupStatus, isLoading: isLoadingSetup } = useGetSetupStatus();
  
  // Only query user if setup is not needed
  const { data: user, isLoading: isLoadingUser, error: userError } = useGetCurrentUser({
    query: {
      enabled: setupStatus?.needsSetup === false,
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    }
  });

  const isLoading = isLoadingSetup || (setupStatus?.needsSetup === false && isLoadingUser);
  const needsSetup = Boolean(setupStatus?.needsSetup);
  const isUnauthenticated = !needsSetup && (Boolean(userError) || !user);

  useEffect(() => {
    if (isLoading) return;

    if (needsSetup) {
      if (location !== '/setup') setLocation('/setup');
      return;
    }

    if (isUnauthenticated) {
      if (location !== '/login') setLocation('/login');
      return;
    }

    if (location === '/login' || location === '/setup') {
      setLocation('/');
    }
  }, [isLoading, needsSetup, isUnauthenticated, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1. Force setup if needed
  if (needsSetup) {
    return <SetupPage />;
  }

  // 2. Force login if not authenticated
  if (isUnauthenticated) {
    return <LoginPage />;
  }

  // 3. Authenticated users on auth routes: render nothing while the effect
  // above navigates them away.
  if (location === '/login' || location === '/setup') {
    return null;
  }

  // 4. Authenticated Area
  if (!user) {
    return null;
  }

  return (
    <Shell user={user}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/settings">
          {() => <SettingsPage user={user} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthWall />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

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
import { ClientsPage } from '@/pages/clients';
import { ClientDetailPage } from '@/pages/client-detail';
import { ClientFormPage } from '@/pages/client-form';
import { ProjectsPage } from '@/pages/projects';
import { ProjectDetailPage } from '@/pages/project-detail';
import { ProjectFormPage } from '@/pages/project-form';
import { TasksPage } from '@/pages/tasks';
import DiagnosticsPage from '@/pages/diagnostics';
import DiagnosticCreatePage from '@/pages/diagnostic-create';
import DiagnosticDetailPage from '@/pages/diagnostic-detail';
import DiagnosticComparePage from '@/pages/diagnostic-compare';
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

  const { data: user, isLoading: isLoadingUser, error: userError } = useGetCurrentUser({
    query: {
      enabled: setupStatus?.needsSetup === false,
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    },
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

  if (needsSetup) return <SetupPage />;
  if (isUnauthenticated) return <LoginPage />;
  if (location === '/login' || location === '/setup') return null;
  if (!user) return null;

  return (
    <Shell user={user}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/clients">
          {() => <ClientsPage />}
        </Route>
        <Route path="/clients/new">
          {() => <ClientFormPage />}
        </Route>
        <Route path="/clients/:id/edit">
          {(params) => <ClientFormPage clientId={params.id} />}
        </Route>
        <Route path="/clients/:id">
          {(params) => <ClientDetailPage clientId={params.id} />}
        </Route>
        <Route path="/projects">
          {() => <ProjectsPage />}
        </Route>
        <Route path="/projects/new">
          {() => <ProjectFormPage />}
        </Route>
        <Route path="/projects/:id/edit">
          {(params) => <ProjectFormPage projectId={params.id} />}
        </Route>
        <Route path="/projects/:id">
          {(params) => <ProjectDetailPage projectId={params.id} />}
        </Route>
        <Route path="/tasks">
          {() => <TasksPage />}
        </Route>
        <Route path="/diagnostics/new">
          {() => <DiagnosticCreatePage />}
        </Route>
        <Route path="/diagnostics/:id/compare">
          {() => <DiagnosticComparePage />}
        </Route>
        <Route path="/diagnostics/:id">
          {() => <DiagnosticDetailPage />}
        </Route>
        <Route path="/diagnostics">
          {() => <DiagnosticsPage />}
        </Route>
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

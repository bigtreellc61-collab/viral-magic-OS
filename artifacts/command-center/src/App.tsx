import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { Shell } from '@/components/layout/shell';
import { useGetSetupStatus, useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';

// Auth/setup pages are small and always needed early — keep them eager
import { SetupPage } from '@/pages/setup';
import { LoginPage } from '@/pages/login';

// All other pages are lazily loaded so they only download when navigated to
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
);
const ClientsPage = lazy(() =>
  import('@/pages/clients').then((m) => ({ default: m.ClientsPage })),
);
const ClientDetailPage = lazy(() =>
  import('@/pages/client-detail').then((m) => ({ default: m.ClientDetailPage })),
);
const ClientFormPage = lazy(() =>
  import('@/pages/client-form').then((m) => ({ default: m.ClientFormPage })),
);
const ProjectsPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('@/pages/project-detail').then((m) => ({ default: m.ProjectDetailPage })),
);
const ProjectFormPage = lazy(() =>
  import('@/pages/project-form').then((m) => ({ default: m.ProjectFormPage })),
);
const TasksPage = lazy(() =>
  import('@/pages/tasks').then((m) => ({ default: m.TasksPage })),
);
const DiagnosticsPage = lazy(() => import('@/pages/diagnostics'));
const DiagnosticCreatePage = lazy(() => import('@/pages/diagnostic-create'));
const DiagnosticDetailPage = lazy(() => import('@/pages/diagnostic-detail'));
const DiagnosticComparePage = lazy(() => import('@/pages/diagnostic-compare'));
const GrowthAssessmentPage = lazy(() =>
  import('@/pages/growth-assessment').then((m) => ({ default: m.GrowthAssessmentPage })),
);
const SolutionRecommendationDetailPage = lazy(
  () => import('@/pages/solution-recommendation-detail'),
);
const GrowthBlueprintDetailPage = lazy(() =>
  import('@/pages/growth-blueprint-detail').then((m) => ({ default: m.GrowthBlueprintDetailPage })),
);
const NotFound = lazy(() => import('@/pages/not-found'));

// Heavy routes prefetched during browser idle time so the first navigation to
// them feels instant.  requestIdleCallback fires after the initial paint has
// settled; we fall back to a short setTimeout for Safari which lacks rIC.
const HEAVY_ROUTES: Array<() => Promise<unknown>> = [
  () => import('@/pages/diagnostic-detail'),
  () => import('@/pages/growth-assessment'),
  () => import('@/pages/solution-recommendation-detail'),
];

function prefetchHeavyRoutes() {
  const schedule =
    typeof requestIdleCallback !== 'undefined'
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 3000 })
      : (cb: () => void) => setTimeout(cb, 200);

  HEAVY_ROUTES.forEach((loader) => schedule(loader));
}

// Shared fallback shown while any page chunk is loading
function PageLoader() {
  return (
    <div className="min-h-[50vh] w-full flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

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

  // Once authenticated, kick off idle prefetch for heavy route chunks.
  useEffect(() => {
    if (!user) return;
    prefetchHeavyRoutes();
  }, [user]);

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
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/growth-assessments/:id">
            {(params) => <GrowthAssessmentPage assessmentId={params.id} />}
          </Route>
          <Route path="/solution-recommendations/:id">
            {() => <SolutionRecommendationDetailPage />}
          </Route>
          <Route path="/growth-blueprints/:id">
            {(params) => <GrowthBlueprintDetailPage />}
          </Route>
          <Route path="/settings">
            {() => <SettingsPage user={user} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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

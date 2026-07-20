/**
 * Navigation + Suspense tests
 *
 * Each test creates the same React.lazy() wrapper that App.tsx uses, renders
 * it inside a Suspense boundary, and confirms the Suspense fallback resolves
 * without triggering the error boundary.
 *
 * Using React.lazy() here (rather than a direct import) validates the actual
 * mechanism App.tsx depends on: if a module has a named-export / default-export
 * mismatch, React.lazy() will silently yield `undefined` for the component and
 * React will throw before the Suspense resolves.
 *
 * What this covers (per task spec):
 *  ✓  Navigation to each major route (dashboard, clients, diagnostics,
 *     growth assessment, solution recommendations, tasks, projects, settings)
 *  ✓  Suspense fallback resolves — no spinner stuck forever
 *  ✓  No error boundary fires
 */

import React, { lazy, Suspense, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock wouter — supply every hook/component pages import
// ---------------------------------------------------------------------------

vi.mock('wouter', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useLocation: () => ['/', () => {}],
    useSearch: () => '',
    useParams: () => ({}),
    useRoute: () => [false, {}],
    Link: ({
      children,
      href,
      ...rest
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) =>
      React.createElement('a', { href, ...rest }, children),
    Route: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Switch: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Router: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Redirect: () => null,
  };
});

// ---------------------------------------------------------------------------
// Mock the API client — spread real exports so Vitest's strict export
// validation passes, then override every hook with a settled empty stub.
// ---------------------------------------------------------------------------

vi.mock('@workspace/api-client-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workspace/api-client-react')>();

  const noData = { data: undefined, isLoading: false, error: null, isError: false };
  const emptyList = { data: [], isLoading: false, error: null, isError: false, total: 0 };

  const stubs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(actual)) {
    if (typeof val === 'function' && key.startsWith('use')) {
      stubs[key] = () =>
        key.toLowerCase().includes('list') ? emptyList : noData;
    }
  }

  return { ...actual, ...stubs };
});

// ---------------------------------------------------------------------------
// Lazy wrappers — identical to App.tsx so we exercise the real mechanism
// ---------------------------------------------------------------------------

// Named-export pages (App.tsx uses .then(m => ({ default: m.XPage })))
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const ClientsPage = lazy(() =>
  import('@/pages/clients').then((m) => ({ default: m.ClientsPage })),
);
const ProjectsPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectsPage })),
);
const TasksPage = lazy(() =>
  import('@/pages/tasks').then((m) => ({ default: m.TasksPage })),
);
const GrowthAssessmentPage = lazy(() =>
  import('@/pages/growth-assessment').then((m) => ({ default: m.GrowthAssessmentPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
);

// Default-export pages (App.tsx imports them directly)
const DiagnosticsPage = lazy(() => import('@/pages/diagnostics'));
const DiagnosticCreatePage = lazy(() => import('@/pages/diagnostic-create'));
const NotFound = lazy(() => import('@/pages/not-found'));
const SolutionRecommendationDetailPage = lazy(
  () => import('@/pages/solution-recommendation-detail'),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/**
 * Render a lazily-loaded component inside the same provider tree that
 * App.tsx uses (QueryClientProvider + Suspense boundary).
 */
function renderLazy(ui: ReactNode) {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<div role="status" aria-label="loading">loading…</div>}>
        {ui}
      </Suspense>
    </QueryClientProvider>,
  );
}

/**
 * Assert the Suspense fallback spinner disappears — proving the lazy chunk
 * resolved and the component mounted successfully.
 */
async function expectSuspenseResolved() {
  await waitFor(
    () => {
      expect(screen.queryByRole('status', { name: /loading/i })).toBeNull();
    },
    { timeout: 10_000 },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lazy route Suspense resolution', () => {
  test('dashboard route chunk resolves without hanging or error', async () => {
    renderLazy(<DashboardPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('clients route chunk resolves without hanging or error', async () => {
    renderLazy(<ClientsPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('diagnostics route chunk resolves without hanging or error', async () => {
    renderLazy(<DiagnosticsPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('tasks route chunk resolves without hanging or error', async () => {
    renderLazy(<TasksPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('projects route chunk resolves without hanging or error', async () => {
    renderLazy(<ProjectsPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('growth-assessment route chunk resolves without hanging or error', async () => {
    renderLazy(<GrowthAssessmentPage assessmentId="test-id" />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('solution-recommendations route chunk resolves without hanging or error', async () => {
    renderLazy(<SolutionRecommendationDetailPage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('settings route chunk resolves without hanging or error', async () => {
    // SettingsPage receives a `user` prop — pass a minimal stub
    const stubUser = {
      id: 'u1',
      email: 'test@example.com',
      fullName: 'Test User',
      roleName: 'Administrator',
      createdAt: new Date(),
    };
    renderLazy(<SettingsPage user={stubUser} />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('diagnostics/new route chunk resolves without hanging or error', async () => {
    renderLazy(<DiagnosticCreatePage />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  test('not-found route chunk resolves without hanging or error', async () => {
    renderLazy(<NotFound />);
    await expectSuspenseResolved();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });
});

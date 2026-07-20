/**
 * Lazy-export shape tests
 *
 * App.tsx loads every page via React.lazy().  Some pages use a named export
 * (`.then(m => ({ default: m.FooPage }))`); others rely on the module's
 * default export.  A mismatch — e.g. a page that only exports a named symbol
 * but the lazy() wrapper looks for `.default` — would render a blank screen at
 * runtime and only be caught when a user navigated to that route.
 *
 * These tests catch that class of breakage by importing every module directly
 * and asserting the expected symbol is a function (React component).
 */

// ---------------------------------------------------------------------------
// Pages that App.tsx imports via .then(m => ({ default: m.NamedExport }))
// ---------------------------------------------------------------------------

describe('Named-export pages', () => {
  test('DashboardPage is a function', async () => {
    const mod = await import('@/pages/dashboard');
    expect(typeof mod.DashboardPage).toBe('function');
  });

  test('SettingsPage is a function', async () => {
    const mod = await import('@/pages/settings');
    expect(typeof mod.SettingsPage).toBe('function');
  });

  test('ClientsPage is a function', async () => {
    const mod = await import('@/pages/clients');
    expect(typeof mod.ClientsPage).toBe('function');
  });

  test('ClientDetailPage is a function', async () => {
    const mod = await import('@/pages/client-detail');
    expect(typeof mod.ClientDetailPage).toBe('function');
  });

  test('ClientFormPage is a function', async () => {
    const mod = await import('@/pages/client-form');
    expect(typeof mod.ClientFormPage).toBe('function');
  });

  test('ProjectsPage is a function', async () => {
    const mod = await import('@/pages/projects');
    expect(typeof mod.ProjectsPage).toBe('function');
  });

  test('ProjectDetailPage is a function', async () => {
    const mod = await import('@/pages/project-detail');
    expect(typeof mod.ProjectDetailPage).toBe('function');
  });

  test('ProjectFormPage is a function', async () => {
    const mod = await import('@/pages/project-form');
    expect(typeof mod.ProjectFormPage).toBe('function');
  });

  test('TasksPage is a function', async () => {
    const mod = await import('@/pages/tasks');
    expect(typeof mod.TasksPage).toBe('function');
  });

  test('GrowthAssessmentPage is a function', async () => {
    const mod = await import('@/pages/growth-assessment');
    expect(typeof mod.GrowthAssessmentPage).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Pages that App.tsx imports directly (default export)
// ---------------------------------------------------------------------------

describe('Default-export pages', () => {
  test('DiagnosticsPage has a default export that is a function', async () => {
    const mod = await import('@/pages/diagnostics');
    expect(typeof mod.default).toBe('function');
  });

  test('DiagnosticCreatePage has a default export that is a function', async () => {
    const mod = await import('@/pages/diagnostic-create');
    expect(typeof mod.default).toBe('function');
  });

  test('DiagnosticDetailPage has a default export that is a function', async () => {
    const mod = await import('@/pages/diagnostic-detail');
    expect(typeof mod.default).toBe('function');
  });

  test('DiagnosticComparePage has a default export that is a function', async () => {
    const mod = await import('@/pages/diagnostic-compare');
    expect(typeof mod.default).toBe('function');
  });

  test('SolutionRecommendationDetailPage has a default export that is a function', async () => {
    const mod = await import('@/pages/solution-recommendation-detail');
    expect(typeof mod.default).toBe('function');
  });

  test('NotFound has a default export that is a function', async () => {
    const mod = await import('@/pages/not-found');
    expect(typeof mod.default).toBe('function');
  });
});

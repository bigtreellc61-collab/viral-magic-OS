import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Auth stubs — satisfy the AuthWall so tests reach real page components
// ---------------------------------------------------------------------------

const STUB_USER = {
  id: 'test-user-1',
  email: 'admin@example.com',
  fullName: 'Test Admin',
  roleName: 'Administrator',
  createdAt: new Date().toISOString(),
};

/**
 * Intercept every /api/* request so pages don't spin on network errors.
 *
 * Rules (applied in order):
 *  1. /api/auth/setup-status  → { needsSetup: false }
 *  2. /api/auth/me            → stub user
 *  3. Any other GET /api/**   → { data: [], total: 0 }  (empty list / no-op)
 *  4. Non-GET /api/**         → 204 No Content
 */
async function mockApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/api/auth/setup-status')) {
      await route.fulfill({ json: { needsSetup: false } });
      return;
    }

    if (url.includes('/api/auth/me')) {
      await route.fulfill({ json: STUB_USER });
      return;
    }

    // Foundation-status endpoint used by the dashboard
    if (url.includes('/api/settings/foundation-status')) {
      await route.fulfill({
        json: {
          apiIntegrations: { configured: 0, total: 3 },
          coreData: { clients: 0, activeProjects: 0 },
          systemHealth: { status: 'healthy' },
        },
      });
      return;
    }

    // Generic: GET → empty collection, anything else → no content
    if (method === 'GET') {
      await route.fulfill({ json: { data: [], items: [], total: 0, count: 0 } });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: navigate, wait for the Suspense spinner to disappear, then assert
// no error-boundary message rendered.
// ---------------------------------------------------------------------------

async function navigateTo(page: Page, path: string) {
  await page.goto(path);

  // The PageLoader renders a Loader2 spinner; wait until it is gone.
  // We use a generous timeout because the first chunk load incurs a cold
  // module-graph build under Vite.
  await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 15_000 });

  // Confirm the ErrorBoundary "Something went wrong" copy is NOT visible.
  await expect(page.getByText('Something went wrong')).toBeHidden();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('dashboard route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/');
  // The dashboard renders at least one Card element when the page is ready.
  await expect(page.locator('main, [role="main"], .dashboard, h1, h2').first()).toBeVisible({
    timeout: 10_000,
  });
});

test('clients route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/clients');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('projects route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/projects');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('tasks route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/tasks');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('diagnostics route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/diagnostics');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('settings route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/settings');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('404 / not-found route loads without hanging', async ({ page }) => {
  await navigateTo(page, '/this-route-does-not-exist');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

// ---------------------------------------------------------------------------
// Lazy-import export-shape guards
//
// These tests verify that each lazy() call in App.tsx resolves to a module
// with a usable default export.  A named-export mismatch (e.g. the module
// exports { ClientsPage } but the lazy() wrapper asks for `.default`) would
// produce a blank page or an immediate error boundary.
// ---------------------------------------------------------------------------

test('clients/new (ClientFormPage) loads without hanging', async ({ page }) => {
  await navigateTo(page, '/clients/new');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('projects/new (ProjectFormPage) loads without hanging', async ({ page }) => {
  await navigateTo(page, '/projects/new');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

test('diagnostics/new (DiagnosticCreatePage) loads without hanging', async ({ page }) => {
  await navigateTo(page, '/diagnostics/new');
  await expect(page.locator('body')).not.toContainText('Something went wrong');
});

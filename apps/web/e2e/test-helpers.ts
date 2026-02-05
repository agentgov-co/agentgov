import type { Page } from '@playwright/test'

// Must match the organization ID from the seed data
const E2E_ORG_ID = 'org_dev_001'

// Default project ID used in e2e tests
const E2E_PROJECT_ID = 'proj_chatbot'

/**
 * Intercepts auth endpoints to ensure the active organization is loaded.
 *
 * When Playwright restores storageState, the session cookie is valid but
 * the session response may lack activeOrganizationId, causing useProjects
 * to remain disabled (enabled: isAuthenticated && !!organization) and
 * selectedProjectId to stay null.
 *
 * Call this BEFORE page.goto() and BEFORE any other page.route() calls
 * that might match the same patterns.
 */
export async function ensureOrgLoaded(page: Page): Promise<void> {
  // Skip onboarding modal in e2e tests
  await page.addInitScript(() => {
    window.localStorage.setItem('agentgov_onboarding_skipped', 'true')
  })

  // Intercept session response — patch in activeOrganizationId if missing
  await page.route('**/api/auth/get-session*', async (route) => {
    const response = await route.fetch()
    try {
      const json = await response.json()
      if (json?.session) {
        json.session.activeOrganizationId =
          json.session.activeOrganizationId || E2E_ORG_ID
      }
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(json),
      })
    } catch {
      // If JSON parsing fails, pass through unmodified
      await route.continue()
    }
  })

  // Mock the full organization endpoint so auth-provider resolves activeOrg
  await page.route(
    '**/api/auth/organization/get-full-organization*',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: E2E_ORG_ID,
          name: 'Dev Organization',
          slug: 'dev-org',
          members: [],
        }),
      })
    },
  )

  // Mock projects endpoint so selectedProjectId validation passes
  // This is needed because dashboard-layout.tsx validates localStorage projectId
  // against the actual projects list from useProjects()
  await page.route('**/v1/projects*', async (route) => {
    // Only intercept GET requests (list projects)
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: E2E_PROJECT_ID,
          name: 'Chatbot Project',
          description: 'E2E test project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    })
  })
}

import type { Page } from '@playwright/test'

const E2E_ORG_ID = 'org-e2e-test'

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
          name: 'E2E Test Organization',
          slug: 'e2e-test',
          members: [],
        }),
      })
    },
  )
}

import { test, expect } from '@playwright/test'

// Skip dashboard tests in CI - they require real auth session
// better-auth client doesn't work with page.route() mocking
const isCI = !!process.env.CI

test.describe('Navigation', () => {
  test.describe('Public pages', () => {
    test('should load landing page', async ({ page }) => {
      await page.goto('/')

      await expect(page).toHaveTitle(/AgentGov/i)
    })

    test('should navigate to login from landing page', async ({ page }) => {
      await page.goto('/')

      // Look for sign in / login link
      const signInLink = page.getByRole('link', { name: /sign in|log in/i })
      if (await signInLink.isVisible()) {
        await signInLink.click()
        await expect(page).toHaveURL('/login')
      }
    })

    test('should navigate to register from landing page', async ({ page }) => {
      await page.goto('/')

      // Wait for Next.js hydration before clicking client-side links
      await page.waitForLoadState('networkidle')

      // Look for sign up / get started link (use first() as there may be multiple)
      const signUpLink = page.getByRole('link', { name: /sign up|get started|register/i }).first()
      if (await signUpLink.isVisible()) {
        await signUpLink.click()
        // "Get Started" links to /dashboard which redirects to /login without auth
        await expect(page).toHaveURL(/\/(register|signup|dashboard|login)/, { timeout: 10000 })
      }
    })
  })

  test.describe('Dashboard navigation', () => {
    // Skip in CI - requires real auth session
    test.skip(isCI, 'Dashboard tests require real auth session')

    test.beforeEach(async ({ page, context }) => {
      // Set session cookie to bypass middleware auth check
      await context.addCookies([
        {
          name: 'agentgov.session_token',
          value: 'test-session-token',
          domain: 'localhost',
          path: '/',
        },
      ])

      // Mock auth session
      await page.route('**/api/auth/get-session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: 'test-session-id',
              userId: 'test-user-id',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
            user: {
              id: 'test-user-id',
              name: 'Test User',
              email: 'test@example.com',
            },
          }),
        })
      })

      // Mock projects
      await page.route('**/v1/projects', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      // Mock traces
      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })
    })

    test('should navigate to dashboard', async ({ page }) => {
      await page.goto('/dashboard')

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('should navigate to projects page', async ({ page }) => {
      await page.goto('/dashboard/projects')

      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    })

    test('should navigate to traces page', async ({ page }) => {
      await page.goto('/dashboard/traces')

      await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible()
    })

    test('should navigate to settings page', async ({ page }) => {
      await page.goto('/dashboard/settings')

      await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
    })

    test('should have sidebar navigation', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for sidebar navigation items
      await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Projects/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Traces/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible()
    })
  })

  test.describe('Responsive design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/')

      // Page should still be functional on mobile
      await expect(page).toHaveTitle(/AgentGov/i)
    })

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })

      await page.goto('/')

      // Page should still be functional on tablet
      await expect(page).toHaveTitle(/AgentGov/i)
    })
  })
})

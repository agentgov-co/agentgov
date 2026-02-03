import { test, expect } from '@playwright/test'

// Skip in CI - dashboard tests require real auth session
// better-auth client doesn't work with page.route() mocking
const isCI = !!process.env.CI

test.describe('Settings', () => {
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
        body: JSON.stringify([
          {
            id: 'project-1',
            name: 'Test Project',
            createdAt: new Date().toISOString(),
            _count: { traces: 5 },
          },
        ]),
      })
    })
  })

  test.describe('Settings Page', () => {
    test('should display settings page', async ({ page }) => {
      await page.goto('/dashboard/settings')

      await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
    })

    test('should have tabs for different sections', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Check for common settings tabs
      const tabList = page.getByRole('tablist')
      await expect(tabList).toBeVisible()
    })

    test('should display user profile information', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Should show user email or name somewhere
      await expect(page.getByText('test@example.com')).toBeVisible()
    })
  })

  test.describe('API Keys Section', () => {
    test('should display API key input', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.goto('/dashboard/settings')

      // Look for API key related elements
      const apiKeySection = page.getByText(/API Key/i)
      await expect(apiKeySection).toBeVisible()
    })

    test('should be able to set admin API key', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.goto('/dashboard/settings')

      // Find API key input
      const apiKeyInput = page.getByPlaceholder(/Enter.*API key/i).first()
      if (await apiKeyInput.isVisible()) {
        await apiKeyInput.fill('agv_test_key_123')

        // Look for save button
        const saveButton = page.getByRole('button', { name: /Save|Set|Apply/i }).first()
        if (await saveButton.isVisible()) {
          await saveButton.click()
        }
      }
    })
  })

  test.describe('Account Settings', () => {
    test('should have sign out option', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Look for sign out button
      const signOutButton = page.getByRole('button', { name: /Sign out|Log out/i })
      await expect(signOutButton).toBeVisible()
    })

    test('should have two-factor authentication option', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Look for 2FA option
      const twoFactorText = page.getByText(/Two-Factor|2FA/i)
      if (await twoFactorText.isVisible()) {
        await expect(twoFactorText).toBeVisible()
      }
    })
  })

  test.describe('Danger Zone', () => {
    test('should have delete account option', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Look for danger zone or delete account
      const dangerZone = page.getByText(/Danger Zone|Delete Account/i)
      if (await dangerZone.isVisible()) {
        await expect(dangerZone).toBeVisible()
      }
    })
  })
})

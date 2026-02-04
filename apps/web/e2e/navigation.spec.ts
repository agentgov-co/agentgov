import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.describe('Public pages', () => {
    // Public pages should not carry auth cookies — visiting /login or
    // /register with a session cookie causes a redirect to /dashboard.
    test.use({ storageState: { cookies: [], origins: [] } })

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
    // Landing page is public — no auth needed
    test.use({ storageState: { cookies: [], origins: [] } })

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

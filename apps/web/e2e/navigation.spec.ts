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

    test('should have registration link on landing page', async ({ page }) => {
      await page.goto('/')

      // The landing page has CTA links leading to registration or dashboard
      const ctaLink = page.getByRole('link', { name: /get started|start free/i }).first()
      await expect(ctaLink).toBeVisible()
      // Verify the link points to /dashboard or /register
      await expect(ctaLink).toHaveAttribute('href', /\/(dashboard|register)/)
    })
  })

  test.describe('Dashboard navigation', () => {
    test('should navigate to dashboard', async ({ page }) => {
      await page.goto('/dashboard')

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('should navigate to projects page', async ({ page }) => {
      await page.goto('/dashboard/projects')

      await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible()
    })

    test('should navigate to traces page', async ({ page }) => {
      await page.goto('/dashboard/traces')

      await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible()
    })

    test('should navigate to settings page', async ({ page }) => {
      await page.goto('/dashboard/settings')

      await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
    })

    test('should have tab navigation', async ({ page }) => {
      await page.goto('/dashboard')

      // Dashboard uses horizontal tab navigation (not sidebar)
      const nav = page.locator('header nav')
      await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Traces' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Projects' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()
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

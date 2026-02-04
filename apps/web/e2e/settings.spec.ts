import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
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

      // Email is in a disabled input field on the General tab
      await expect(page.locator('input#email')).toHaveValue('dev@dev.com')
    })
  })

  test.describe('API Keys Section', () => {
    test('should navigate to API Keys tab', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Click the API Keys tab
      const apiKeysTab = page.getByRole('tab', { name: /API Keys/i })
      await expect(apiKeysTab).toBeVisible()
      await apiKeysTab.click()

      // Verify tab content is displayed
      await expect(page.getByRole('tabpanel')).toBeVisible()
    })
  })

  test.describe('Security Section', () => {
    test('should navigate to Security tab', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Click the Security tab
      const securityTab = page.getByRole('tab', { name: /Security/i })
      await expect(securityTab).toBeVisible()
      await securityTab.click()

      // Verify tab content is displayed
      await expect(page.getByRole('tabpanel')).toBeVisible()
    })
  })

  test.describe('Account Settings', () => {
    test('should have sign out option in user menu', async ({ page }) => {
      await page.goto('/dashboard/settings')

      // Sign out is in the header user dropdown, not on the settings page
      const userMenuButton = page.locator('header').getByRole('button').last()
      await userMenuButton.click()

      await expect(page.getByText('Sign out')).toBeVisible()
    })
  })
})

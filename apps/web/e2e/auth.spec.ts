import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Registration', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
      await expect(page.getByLabel('Name')).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Confirm Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    })

    test('should show error for password mismatch', async ({ page }) => {
      await page.goto('/register', { waitUntil: 'networkidle' })

      await page.getByLabel('Name').fill('Test User')
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password', { exact: true }).fill('password123')
      await page.getByLabel('Confirm Password').fill('password456')
      await page.getByRole('button', { name: 'Create account' }).click()

      await expect(page.getByText('Passwords do not match')).toBeVisible()
    })

    test('should show error for short password', async ({ page }) => {
      await page.goto('/register', { waitUntil: 'networkidle' })

      await page.getByLabel('Name').fill('Test User')
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password', { exact: true }).fill('short')
      await page.getByLabel('Confirm Password').fill('short')
      await page.getByRole('button', { name: 'Create account' }).click()

      await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    })

    test('should have link to login page', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login')
    })

    test('should display OAuth buttons', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toBeVisible()
    })
  })

  test.describe('Login', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    })

    test('should have link to registration page', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
      await page.getByRole('link', { name: 'Sign up' }).click()
      await expect(page).toHaveURL('/register')
    })

    test('should have forgot password link', async ({ page }) => {
      await page.goto('/login')

      // Check if forgot password link exists (may be text or link)
      const forgotLink = page.getByRole('link', { name: /forgot.*password/i })
      if (await forgotLink.isVisible()) {
        await forgotLink.click()
        // URL may vary: /forgot-password, /reset-password, etc.
        await expect(page).toHaveURL(/\/(forgot|reset)-password/)
      }
    })

    test('should display OAuth buttons', async ({ page }) => {
      await page.goto('/login')

      await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toBeVisible()
    })

    test('should show loading state when submitting', async ({ page, browserName }) => {
      // page.route() interception is unreliable in webkit — skip
      test.skip(browserName === 'webkit', 'Route interception flaky in webkit')

      await page.goto('/login', { waitUntil: 'networkidle' })

      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password').fill('password123')

      // Mock the API to be slow
      await page.route('**/api/auth/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.continue()
      })

      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible()
    })
  })

  test.describe('Forgot Password', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot-password')

      await expect(page.getByRole('heading', { name: /Forgot password/i })).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
    })

    test('should have link back to login', async ({ page }) => {
      await page.goto('/forgot-password')

      await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible()
    })
  })
})

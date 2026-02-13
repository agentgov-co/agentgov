import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL ?? 'dev@dev.com'
  const password = process.env.E2E_TEST_PASSWORD ?? 'dev123'

  // Skip onboarding in e2e tests - set flag before login
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('agentgov_onboarding_skipped', 'true')
  })

  // Navigate to login — if this redirects unexpectedly, the seed may not have run
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' }), {
    message: 'Login page did not load. Check that the web server is running.',
  }).toBeVisible({ timeout: 10000 })

  // Fill credentials and submit
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Verify redirect to dashboard — proves the session is valid.
  // If this fails, the seed likely hasn't run (user doesn't exist).
  await expect(page, {
    message: `Login failed for ${email}. Ensure the database is seeded: pnpm --filter @agentgov/api db:seed`,
  }).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Close onboarding modal if it appears (shows for users without active org)
  const onboardingSkipButton = page.getByRole('button', { name: /skip for now/i })
  const onboardingCloseButton = page.locator('[data-radix-dialog-close]')
  if (await onboardingSkipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await onboardingSkipButton.click()
    await page.waitForTimeout(500) // Wait for modal to close
  } else if (await onboardingCloseButton.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await onboardingCloseButton.first().click()
    await page.waitForTimeout(500)
  }

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 })

  // Select organization — required for projects/traces to load.
  // The org switcher shows "Select Organization" when no org is active.
  const orgButton = page.getByRole('button', { name: /Select Organization/i })
  if (await orgButton.isVisible({ timeout: 3000 })) {
    await orgButton.click()
    await page.getByRole('menuitem', { name: 'Dev Organization' }).click()

    // Org switcher calls window.location.reload() after setting active org.
    // Wait for reload to complete and dashboard to re-render.
    await page.waitForLoadState('load')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
  }

  // Persist authenticated state for all dependent projects
  await page.context().storageState({ path: AUTH_FILE })
})

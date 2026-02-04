import { test as setup, expect } from '@playwright/test'
import path from 'node:path'

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL ?? 'dev@dev.com'
  const password = process.env.E2E_TEST_PASSWORD ?? 'dev123'

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

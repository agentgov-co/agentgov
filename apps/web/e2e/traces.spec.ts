import { test, expect } from '@playwright/test'
import { ensureOrgLoaded } from './test-helpers'

/**
 * Helper to create a paginated traces response matching TracesResponse interface.
 */
function tracesResponse(traces: unknown[]): string {
  return JSON.stringify({
    data: traces,
    pagination: { total: traces.length, limit: 50, offset: 0, hasMore: false },
  })
}

test.describe('Traces', () => {
  test.describe('Traces Page', () => {
    test('should display traces header', async ({ page }) => {
      await page.goto('/dashboard/traces')

      await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible()
      await expect(
        page.getByText('Monitor and analyze your agent executions')
      ).toBeVisible()
    })

    test('should show no project selected state', async ({ page }) => {
      // Clear any selected project from localStorage
      await page.addInitScript(() => {
        window.localStorage.removeItem('selectedProjectId')
      })

      // Mock projects to return empty so no project is auto-selected
      await page.route('**/v1/projects*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByText('No project selected')).toBeVisible()
      await expect(
        page.getByText('Select a project from the header to view traces.')
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Go to Projects' })).toBeVisible()
    })

    test('should display traces list when project is selected', async ({ page }) => {
      const mockTraces = [
        {
          id: 'trace-1',
          name: 'Test Trace 1',
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
        {
          id: 'trace-2',
          name: 'Test Trace 2',
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
          _count: { spans: 1 },
        },
      ]

      await ensureOrgLoaded(page)

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse(mockTraces),
        })
      })

      // Ensure a specific project is selected via localStorage.
      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      await page.goto('/dashboard/traces')

      // Wait for filters to appear (indicates org + projects loaded, selectedProjectId set)
      await expect(page.getByPlaceholder('Search traces...')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Test Trace 1')).toBeVisible()
      await expect(page.getByText('Test Trace 2')).toBeVisible()
    })

    test('should have search input', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse([]),
        })
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByPlaceholder('Search traces...')).toBeVisible({ timeout: 15000 })
    })

    test('should have status filter', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse([]),
        })
      })

      await page.goto('/dashboard/traces')

      // Wait for filters to render
      await expect(page.getByPlaceholder('Search traces...')).toBeVisible({ timeout: 15000 })

      // Click the status filter dropdown
      await page.getByRole('combobox').click()

      await expect(page.getByRole('option', { name: 'All statuses' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Running' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Completed' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Failed' })).toBeVisible()
    })

    test('should have view toggle buttons', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse([]),
        })
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByRole('button', { name: 'Card view' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Table view' })).toBeVisible()
    })

    test('should switch between card and table view', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      const mockTraces = [
        {
          id: 'trace-1',
          name: 'Test Trace 1',
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse(mockTraces),
        })
      })

      await page.goto('/dashboard/traces')

      // Wait for traces to render
      await expect(page.getByText('Test Trace 1')).toBeVisible({ timeout: 15000 })

      // Switch to table view
      await page.getByRole('button', { name: 'Table view' }).click()

      // Verify table is visible
      await expect(page.locator('table')).toBeVisible()
    })

    test('should navigate to trace detail', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      const mockTraces = [
        {
          id: 'trace-nav-1',
          name: 'Navigable Trace',
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse(mockTraces),
        })
      })

      await page.goto('/dashboard/traces')

      // Wait for traces to render
      await expect(page.getByText('Navigable Trace')).toBeVisible({ timeout: 15000 })

      // Click on the trace
      await page.getByText('Navigable Trace').click()

      await expect(page).toHaveURL(/\/dashboard\/traces\/trace-nav-1/)
    })
  })

  test.describe('Trace Detail', () => {
    test('should navigate to trace detail from list', async ({ page }) => {
      await ensureOrgLoaded(page)

      await page.addInitScript(() => {
        window.localStorage.setItem('selectedProjectId', 'proj_chatbot')
      })

      const mockTraces = [
        {
          id: 'trace-detail-1',
          name: 'Detail Test Trace',
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 2 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: tracesResponse(mockTraces),
        })
      })

      // Navigate via list to avoid direct-navigation hydration issues in dev mode
      await page.goto('/dashboard/traces')

      await expect(page.getByText('Detail Test Trace')).toBeVisible({ timeout: 15000 })
      await page.getByText('Detail Test Trace').click()
      await expect(page).toHaveURL(/\/dashboard\/traces\/trace-detail-1/)
    })
  })
})

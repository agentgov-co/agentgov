import { test, expect } from '@playwright/test'

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
          status: 'completed',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
        {
          id: 'trace-2',
          name: 'Test Trace 2',
          status: 'running',
          startedAt: new Date().toISOString(),
          _count: { spans: 1 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTraces),
        })
      })

      // Set selected project in localStorage
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByText('Test Trace 1')).toBeVisible()
      await expect(page.getByText('Test Trace 2')).toBeVisible()
    })

    test('should have search input', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByPlaceholder('Search traces...')).toBeVisible()
    })

    test('should have status filter', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/traces')

      // Click the status filter dropdown
      await page.getByRole('combobox').click()

      await expect(page.getByRole('option', { name: 'All statuses' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Running' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Completed' })).toBeVisible()
      await expect(page.getByRole('option', { name: 'Failed' })).toBeVisible()
    })

    test('should have view toggle buttons', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/traces')

      await expect(page.getByRole('button', { name: 'Card view' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Table view' })).toBeVisible()
    })

    test('should switch between card and table view', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      const mockTraces = [
        {
          id: 'trace-1',
          name: 'Test Trace 1',
          status: 'completed',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTraces),
        })
      })

      await page.goto('/dashboard/traces')

      // Default is card view
      await expect(page.getByRole('button', { name: 'Card view' })).toHaveAttribute(
        'data-state',
        'active'
      )

      // Switch to table view
      await page.getByRole('button', { name: 'Table view' }).click()

      // Verify table is visible
      await expect(page.locator('table')).toBeVisible()
    })

    test('should navigate to trace detail', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      const mockTraces = [
        {
          id: 'trace-1',
          name: 'Test Trace 1',
          status: 'completed',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          _count: { spans: 3 },
        },
      ]

      await page.route('**/v1/traces*', async (route) => {
        if (route.request().url().includes('/trace-1')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ...mockTraces[0],
              spans: [],
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockTraces),
          })
        }
      })

      await page.goto('/dashboard/traces')

      // Click on the trace
      await page.getByText('Test Trace 1').click()

      await expect(page).toHaveURL(/\/dashboard\/traces\/trace-1/)
    })
  })

  test.describe('Trace Detail', () => {
    test('should display trace detail page', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('agentgov:selectedProject', 'project-1')
      })

      const mockTrace = {
        id: 'trace-1',
        name: 'Test Trace Detail',
        status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        spans: [
          {
            id: 'span-1',
            name: 'llm_call',
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            input: { prompt: 'Hello' },
            output: { response: 'Hi there!' },
          },
        ],
      }

      await page.route('**/v1/traces/trace-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTrace),
        })
      })

      await page.goto('/dashboard/traces/trace-1')

      await expect(page.getByText('Test Trace Detail')).toBeVisible()
    })
  })
})

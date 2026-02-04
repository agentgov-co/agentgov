import { test, expect } from '@playwright/test'

test.describe('Projects', () => {
  test.describe('Projects Page', () => {
    test('should display projects header', async ({ page }) => {
      await page.route('**/v1/projects*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/projects')

      await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible()
    })

    test('should show empty state when no projects', async ({ page }) => {
      await page.route('**/v1/projects*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/projects')

      await expect(page.getByText('No projects yet')).toBeVisible()
      await expect(
        page.getByText('Create your first project to start tracing your AI agents.')
      ).toBeVisible()
    })

    test('should display project list', async ({ page }) => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          description: 'Description 1',
          createdAt: new Date().toISOString(),
          _count: { traces: 5 },
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          description: 'Description 2',
          createdAt: new Date().toISOString(),
          _count: { traces: 10 },
        },
      ]

      await page.route('**/v1/projects*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProjects),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/dashboard/projects')

      // Scope to main content to avoid matching the header project selector
      const main = page.locator('main')
      await expect(main.getByText('Test Project 1')).toBeVisible()
      await expect(main.getByText('Test Project 2')).toBeVisible()
      await expect(main.getByText('5 traces')).toBeVisible()
      await expect(main.getByText('10 traces')).toBeVisible()
    })

    test('should open create project dialog', async ({ page }) => {
      await page.route('**/v1/projects*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.goto('/dashboard/projects')

      await page.getByRole('button', { name: /New Project/i }).click()

      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible()
      await expect(page.getByLabel('Name')).toBeVisible()
    })

    test('should create new project', async ({ page }) => {
      const newProject = {
        id: 'new-project-id',
        name: 'New Test Project',
        description: 'Test description',
        apiKey: 'agv_test_api_key_123',
        createdAt: new Date().toISOString(),
        _count: { traces: 0 },
      }

      await page.route('**/v1/projects*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(newProject),
          })
        }
      })

      await page.goto('/dashboard/projects')
      await page.getByRole('button', { name: /New Project/i }).click()

      await page.getByLabel('Name').fill('New Test Project')
      await page.getByRole('button', { name: 'Create Project' }).click()

      // Should show API key alert
      await expect(page.getByText('agv_test_api_key_123')).toBeVisible()
    })

    test('should copy API key to clipboard', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      const newProject = {
        id: 'new-project-id',
        name: 'New Test Project',
        apiKey: 'agv_test_api_key_123',
        createdAt: new Date().toISOString(),
        _count: { traces: 0 },
      }

      await page.route('**/v1/projects*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(newProject),
          })
        }
      })

      await page.goto('/dashboard/projects')
      await page.getByRole('button', { name: /New Project/i }).click()
      await page.getByLabel('Name').fill('New Test Project')
      await page.getByRole('button', { name: 'Create Project' }).click()

      // Wait for API key alert
      await expect(page.getByText('agv_test_api_key_123')).toBeVisible()

      // Click copy button
      await page.getByRole('button', { name: 'Copy API key' }).click()

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toBe('agv_test_api_key_123')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Create mocks before imports
const mockRefreshSession = vi.fn()
const mockOrganization = {
  list: vi.fn(),
  create: vi.fn(),
  setActive: vi.fn(),
}
const mockUseAuth = vi.fn()

vi.mock('@/lib/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/auth-client', () => ({
  organization: {
    list: () => mockOrganization.list(),
    create: (data: { name: string; slug: string }) => mockOrganization.create(data),
    setActive: (data: { organizationId: string }) => mockOrganization.setActive(data),
  },
}))

// Import after mocks are set up
import { OrganizationSwitcher } from './organization-switcher'

describe('OrganizationSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      organization: { id: 'org-1', name: 'Test Org' },
      refreshSession: mockRefreshSession,
    })
    mockOrganization.list.mockResolvedValue({
      data: [
        { id: 'org-1', name: 'Test Org', slug: 'test-org' },
        { id: 'org-2', name: 'Another Org', slug: 'another-org' },
      ],
    })
  })

  it('renders loading state initially', () => {
    render(<OrganizationSwitcher />)

    // Should show loading spinner - button is disabled during loading
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders organization name after loading', async () => {
    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument()
    })
  })

  it('renders clickable button after loading', async () => {
    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument()
    })

    // Button should be enabled after loading
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('fetches organizations on mount', async () => {
    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(mockOrganization.list).toHaveBeenCalled()
    })
  })

  it('shows select organization when no active organization', async () => {
    mockUseAuth.mockReturnValue({
      organization: null,
      refreshSession: mockRefreshSession,
    })

    render(<OrganizationSwitcher />)

    await waitFor(() => {
      expect(screen.getByText('Select Organization')).toBeInTheDocument()
    })
  })

  it('renders with correct organization data', async () => {
    render(<OrganizationSwitcher />)

    await waitFor(() => {
      // Current organization name should be displayed
      expect(screen.getByText('Test Org')).toBeInTheDocument()
    })

    // Button should be interactive
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })
})

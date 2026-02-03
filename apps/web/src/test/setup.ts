import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock better-auth/react
vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
    signOut: vi.fn(),
    signUp: {
      email: vi.fn(),
    },
    useSession: vi.fn(() => ({ data: null, isPending: false })),
    getSession: vi.fn(),
    organization: {
      getFullOrganization: vi.fn(),
      inviteMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      cancelInvitation: vi.fn(),
      acceptInvitation: vi.fn(),
      getInvitation: vi.fn(),
    },
    twoFactor: {
      enable: vi.fn(),
      disable: vi.fn(),
      getTotpUri: vi.fn(),
      verifyTotp: vi.fn(),
      verifyBackupCode: vi.fn(),
      generateBackupCodes: vi.fn(),
    },
    $Infer: {
      Session: {},
    },
  }),
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    reload: vi.fn(),
  },
  writable: true,
})

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

// Mock window.matchMedia for responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

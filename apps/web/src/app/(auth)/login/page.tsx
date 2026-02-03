import type { Metadata } from 'next'
import { LoginForm } from './login-form'
import { BreadcrumbJsonLd } from '@/components/structured-data'

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to AgentGov to monitor your AI agents, track compliance, and manage governance dashboards.',
  alternates: {
    canonical: 'https://agentgov.co/login',
  },
}

export default function LoginPage(): React.JSX.Element {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://agentgov.co' },
          { name: 'Sign In', url: 'https://agentgov.co/login' },
        ]}
      />
      <LoginForm />
    </>
  )
}

import type { Metadata } from 'next'
import { RegisterForm } from './register-form'
import { BreadcrumbJsonLd } from '@/components/structured-data'

export const metadata: Metadata = {
  title: 'Create Account',
  description:
    'Sign up for AgentGov — free AI agent monitoring with EU AI Act compliance. Start tracing in under 5 minutes.',
  alternates: {
    canonical: 'https://agentgov.co/register',
  },
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://agentgov.co' },
          { name: 'Create Account', url: 'https://agentgov.co/register' },
        ]}
      />
      <RegisterForm />
    </>
  )
}

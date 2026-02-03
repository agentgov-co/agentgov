'use client'

import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function SentryExamplePage(): React.JSX.Element {
  const [status, setStatus] = useState<string>('')

  const triggerError = (): void => {
    setStatus('Throwing error...')
    throw new Error('Sentry test error from AgentGov Web (native)')
  }

  const captureError = (): void => {
    setStatus('Capturing...')
    Sentry.captureException(new Error('Sentry captured error from AgentGov Web'))
    setStatus('Error captured! Check Sentry.')
  }

  const triggerApiError = async (): Promise<void> => {
    setStatus('Triggering API error...')
    try {
      await fetch('http://localhost:3001/test-error')
      setStatus('API error triggered!')
    } catch {
      setStatus('Request failed (expected)')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Sentry Test Page</h1>
      <p className="text-muted-foreground">
        Click a button to trigger a test error and verify Sentry integration.
      </p>

      <div className="flex gap-4">
        <Button variant="destructive" onClick={triggerError}>
          Throw Error
        </Button>

        <Button variant="default" onClick={captureError}>
          Capture Exception
        </Button>

        <Button variant="outline" onClick={triggerApiError}>
          API Error
        </Button>
      </div>

      {status && (
        <p className="mt-4 text-sm font-medium text-green-600">{status}</p>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        After clicking, check your Sentry dashboard for the error.
      </p>
    </div>
  )
}

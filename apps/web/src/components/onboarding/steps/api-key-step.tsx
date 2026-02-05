'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Key, Copy, Check, Rocket, ArrowLeft } from 'lucide-react'

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

interface ApiKeyStepProps {
  apiKey: string
  onComplete: () => void
  onBack?: () => void
}

const INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm install @agentgov/sdk',
  yarn: 'yarn add @agentgov/sdk',
  pnpm: 'pnpm add @agentgov/sdk',
  bun: 'bun add @agentgov/sdk',
}

export function ApiKeyStep({ apiKey, onComplete, onBack }: ApiKeyStepProps): React.JSX.Element {
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [selectedPM, setSelectedPM] = useState<PackageManager>('npm')

  const copyApiKey = async (): Promise<void> => {
    await navigator.clipboard.writeText(apiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const copyInstallCommand = async (): Promise<void> => {
    await navigator.clipboard.writeText(INSTALL_COMMANDS[selectedPM])
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  const initCode = `import { AgentGov } from '@agentgov/sdk'

const ag = new AgentGov({ apiKey: '${apiKey.slice(0, 20)}...' })

const trace = ag.trace('my-agent')
// ... your agent code
trace.end()`

  const fullInitCode = `import { AgentGov } from '@agentgov/sdk'

const agentgov = new AgentGov({
  apiKey: '${apiKey}'
})

// Start tracing your agent
const trace = agentgov.trace('my-agent-run')
// ... your agent code
trace.end()`

  const copyInitCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(fullInitCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Icon - smaller */}
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Key className="w-6 h-6 text-emerald-600" />
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold">Your API Key</h3>
        <p className="text-sm text-muted-foreground">
          Save this key securely. You won&apos;t see it again.
        </p>
      </div>

      {/* API Key */}
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-muted p-2.5 rounded-lg text-xs font-mono truncate border">
          {apiKey}
        </code>
        <Button
          variant="outline"
          size="icon"
          onClick={copyApiKey}
          className="shrink-0 h-9 w-9"
          aria-label="Copy API key"
        >
          {copiedKey ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Quick Start */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Quick Start</h4>

        {/* Package Manager Tabs */}
        <Tabs value={selectedPM} onValueChange={(v) => setSelectedPM(v as PackageManager)}>
          <TabsList className="w-full">
            <TabsTrigger value="npm" className="flex-1 text-xs px-2">npm</TabsTrigger>
            <TabsTrigger value="yarn" className="flex-1 text-xs px-2">yarn</TabsTrigger>
            <TabsTrigger value="pnpm" className="flex-1 text-xs px-2">pnpm</TabsTrigger>
            <TabsTrigger value="bun" className="flex-1 text-xs px-2">bun</TabsTrigger>
          </TabsList>

          {(['npm', 'yarn', 'pnpm', 'bun'] as const).map((pm) => (
            <TabsContent key={pm} value={pm} className="mt-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded-lg text-xs font-mono border">
                  {INSTALL_COMMANDS[pm]}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyInstallCommand}
                  className="shrink-0 h-8 w-8"
                  aria-label="Copy install command"
                >
                  {copiedInstall ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Init Code - more compact */}
        <div className="relative">
          <pre className="bg-muted p-2.5 rounded-lg text-[11px] font-mono border overflow-x-auto leading-relaxed">
            <code>{initCode}</code>
          </pre>
          <Button
            variant="outline"
            size="icon"
            onClick={copyInitCode}
            className="absolute top-1.5 right-1.5 h-6 w-6"
            aria-label="Copy initialization code"
          >
            {copiedCode ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <Button onClick={onComplete} className="flex-1" size="sm">
          <Rocket className="w-4 h-4 mr-1" />
          Start Using AgentGov
        </Button>
      </div>
    </div>
  )
}

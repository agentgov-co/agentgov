'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Key, Users, Shield, Activity } from 'lucide-react'
import { LogoLoader } from '@/components/logo'
import { GeneralSettings } from './general-settings'
import { ApiKeysSettings } from './api-keys-settings'
import { TeamSettings } from './team-settings'
import { TwoFactorSettings } from './two-factor-settings'
import { UsageSettings } from './usage-settings'
import { DashboardErrorBoundary } from '@/components/error-boundary'

function SettingsContent(): React.JSX.Element {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'general'
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
        <TabsList variant="underline" className="min-w-max">
          <TabsTrigger value="general" variant="underline" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="usage" variant="underline" className="gap-2">
            <Activity className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="security" variant="underline" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api-keys" variant="underline" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="team" variant="underline" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="general">
        <DashboardErrorBoundary>
          <GeneralSettings />
        </DashboardErrorBoundary>
      </TabsContent>

      <TabsContent value="usage">
        <DashboardErrorBoundary>
          <UsageSettings />
        </DashboardErrorBoundary>
      </TabsContent>

      <TabsContent value="security">
        <DashboardErrorBoundary>
          <div className="max-w-2xl space-y-6">
            <TwoFactorSettings />
          </div>
        </DashboardErrorBoundary>
      </TabsContent>

      <TabsContent value="api-keys">
        <DashboardErrorBoundary>
          <ApiKeysSettings />
        </DashboardErrorBoundary>
      </TabsContent>

      <TabsContent value="team">
        <DashboardErrorBoundary>
          <TeamSettings />
        </DashboardErrorBoundary>
      </TabsContent>
    </Tabs>
  )
}

export default function SettingsPage(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <h1 className="font-semibold text-lg">Settings</h1>
        <p className="text-sm text-black/50">
          Manage your account, security, API keys, and team
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <Suspense fallback={<div className="flex items-center justify-center py-12"><LogoLoader size={32} /></div>}>
          <SettingsContent />
        </Suspense>
      </div>
    </main>
  )
}

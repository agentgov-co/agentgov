'use client'

import { useAuth } from '@/lib/auth-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Building2 } from 'lucide-react'

export function GeneralSettings(): React.JSX.Element {
  const { user, organization } = useAuth()

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-lg border border-black/10 p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2 bg-black/5 rounded-lg">
            <User className="h-5 w-5 text-black/60" />
          </div>
          <div>
            <h2 className="font-medium">Profile</h2>
            <p className="text-sm text-black/50">Your personal information</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={user?.name || ''}
              disabled
              className="bg-black/5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-black/5"
            />
          </div>
          <p className="text-xs text-black/40">
            Contact support to update your profile information.
          </p>
        </div>
      </div>

      {/* Organization Section */}
      {organization && (
        <div className="bg-white rounded-lg border border-black/10 p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-2 bg-black/5 rounded-lg">
              <Building2 className="h-5 w-5 text-black/60" />
            </div>
            <div>
              <h2 className="font-medium">Organization</h2>
              <p className="text-sm text-black/50">Your current organization</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={organization.name}
                disabled
                className="bg-black/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Your Role</Label>
              <Input
                value={organization.role.charAt(0).toUpperCase() + organization.role.slice(1)}
                disabled
                className="bg-black/5"
              />
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="bg-white rounded-lg border border-black/10 p-6">
        <h2 className="font-medium mb-3">About</h2>
        <div className="space-y-2 text-sm text-black/60">
          <p>AgentGov v0.1.0</p>
          <p>
            <a
              href="https://github.com/agentgov-co/agentgov"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { organization } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Loader2, ArrowRight } from 'lucide-react'

interface CreateOrgStepProps {
  onComplete: () => void
  onSkip?: () => void
}

export function CreateOrgStep({ onComplete, onSkip }: CreateOrgStepProps): React.JSX.Element {
  const [orgName, setOrgName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (): Promise<void> => {
    if (!orgName.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      // Generate slug from name
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 48) // Limit length

      const { data, error: createError } = await organization.create({
        name: orgName.trim(),
        slug: slug || `org-${Date.now()}`,
      })

      if (createError) {
        setError(createError.message || 'Failed to create organization')
        return
      }

      if (data) {
        // Set as active organization (no page reload)
        await organization.setActive({ organizationId: data.id })
        // Proceed to next step immediately
        onComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && orgName.trim() && !isCreating) {
      handleCreate()
    }
  }

  return (
    <div className="space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Create Your Organization</h3>
        <p className="text-sm text-muted-foreground">
          Organizations help you manage projects and collaborate with your team.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            placeholder="Acme Inc"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCreating}
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex gap-3">
          {onSkip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={isCreating}
              className="flex-1"
            >
              Skip for now
            </Button>
          )}
          <Button
            onClick={handleCreate}
            disabled={!orgName.trim() || isCreating}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

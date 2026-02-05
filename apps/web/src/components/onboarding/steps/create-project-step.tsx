'use client'

import { useState } from 'react'
import { useCreateProject } from '@/hooks/use-projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FolderPlus, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'

interface CreateProjectStepProps {
  onComplete: (apiKey: string) => void
  onBack?: () => void
  onSkip?: () => void
}

export function CreateProjectStep({ onComplete, onBack, onSkip }: CreateProjectStepProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createProject = useCreateProject()
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) return

    setError(null)

    try {
      const result = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })

      if (result.apiKey) {
        onComplete(result.apiKey)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && name.trim() && !createProject.isPending) {
      handleCreate()
    }
  }

  return (
    <div className="space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <FolderPlus className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Create Your First Project</h3>
        <p className="text-sm text-muted-foreground">
          Projects let you organize and monitor your AI agents separately.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            placeholder="My AI Agent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={createProject.isPending}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="project-description"
            placeholder="What does this agent do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={createProject.isPending}
            rows={2}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={createProject.isPending}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSkip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={createProject.isPending}
              className="flex-1"
            >
              Skip
            </Button>
          )}
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createProject.isPending}
            className="flex-1"
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create & Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

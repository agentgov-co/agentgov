'use client'

import { useState } from 'react'
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/use-projects'
import { useProjectApiKeyState } from '@/hooks/use-admin-key'
import { useSelectedProject } from '@/hooks/use-selected-project'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Trash2, Copy, Check, Key, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Project } from '@/lib/api'

export default function ProjectsPage(): React.JSX.Element {
  const { data: projects, isLoading } = useProjects()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)

  if (isLoading) {
    return <ProjectsPageSkeleton />
  }

  return (
    <main className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Projects</h1>
          <p className="text-sm text-black/50">
            {projects?.length || 0} project{projects?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <CreateProjectDialog
            onSuccess={(apiKey) => {
              setNewApiKey(apiKey)
              setDialogOpen(false)
            }}
          />
        </Dialog>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Show new API key */}
        {newApiKey && (
          <div className="mb-6">
            <ApiKeyAlert apiKey={newApiKey} onDismiss={() => setNewApiKey(null)} />
          </div>
        )}

        {/* Projects grid */}
        {projects && projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-black/10 p-16 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-black/20" />
            <h3 className="font-medium text-lg mb-2">No projects yet</h3>
            <p className="text-black/50 mb-4">
              Create your first project to start tracing your AI agents.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}

function CreateProjectDialog({
  onSuccess
}: {
  onSuccess: (apiKey: string) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createProject = useCreateProject()

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    const result = await createProject.mutateAsync({ name, description })

    if (result.apiKey) {
      onSuccess(result.apiKey)
    }

    setName('')
    setDescription('')
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Create a new project to start tracing your AI agents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Project"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function ApiKeyAlert({
  apiKey,
  onDismiss
}: {
  apiKey: string
  onDismiss: () => void
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [, setProjectApiKey] = useProjectApiKeyState()

  const copyToClipboard = (): void => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const useAsActive = (): void => {
    setProjectApiKey(apiKey)
    onDismiss()
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
      <h3 className="font-medium text-emerald-800 mb-1">
        Project Created! Save your API key
      </h3>
      <p className="text-sm text-emerald-700 mb-4">
        This is the only time you will see this key.
      </p>
      <div className="flex items-center gap-2 mb-4">
        <code className="flex-1 bg-white p-2.5 rounded text-sm font-mono border border-emerald-200 truncate">
          {apiKey}
        </code>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyToClipboard} aria-label="Copy API key">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={useAsActive}>
          <Key className="mr-2 h-4 w-4" />
          Use as active
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }): React.JSX.Element {
  const deleteProject = useDeleteProject()
  const { selectedProjectId, setSelectedProjectId } = useSelectedProject()
  const isSelected = selectedProjectId === project.id

  return (
    <div
      role="button"
      tabIndex={0}
      className={`bg-white rounded-lg border p-5 hover:shadow-sm transition-all cursor-pointer ${
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-black/10'
      }`}
      onClick={() => setSelectedProjectId(project.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedProjectId(project.id);
        }
      }}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{project.name}</h3>
            {isSelected && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-black/50 truncate">
            {project.description || 'No description'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Project options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                deleteProject.mutate(project.id)
                toast.success('Project deleted')
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex justify-between text-sm text-black/40">
        <span>{project._count?.traces || 0} traces</span>
        <span>
          {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}

function ProjectsPageSkeleton(): React.JSX.Element {
  return (
    <main className="flex-1 overflow-auto">
      <div className="bg-white border-b border-black/10 px-6 py-4">
        <Skeleton className="h-7 w-32 mb-1" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  )
}

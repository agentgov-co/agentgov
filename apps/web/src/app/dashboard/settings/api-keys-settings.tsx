'use client'

import { useState } from 'react'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/use-api-keys'
import { useProjects } from '@/hooks/use-projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Key, Plus, Copy, Check, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { LogoLoader } from '@/components/logo'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export function ApiKeysSettings(): React.JSX.Element {
  const { data: apiKeys, isLoading, error } = useApiKeys()
  const { data: projects } = useProjects()
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyProject, setNewKeyProject] = useState<string>('')
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleCreate = async (): Promise<void> => {
    try {
      const result = await createApiKey.mutateAsync({
        name: newKeyName,
        projectId: newKeyProject || undefined,
        expiresInDays: newKeyExpiry ? parseInt(newKeyExpiry) : undefined,
      })
      setCreatedKey(result.key)
      setNewKeyName('')
      setNewKeyProject('')
      setNewKeyExpiry('')
      toast.success('API key created')
    } catch (err) {
      console.error('Failed to create API key:', err)
      toast.error('Failed to create API key')
    }
  }

  const handleCopyKey = async (): Promise<void> => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const handleCloseCreate = (): void => {
    setIsCreateOpen(false)
    setCreatedKey(null)
    setCopiedKey(false)
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteApiKey.mutateAsync(id)
      setDeleteId(null)
      toast.success('API key deleted')
    } catch (err) {
      console.error('Failed to delete API key:', err)
      toast.error('Failed to delete API key')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LogoLoader size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-800">Failed to load API keys</p>
          <p className="text-sm text-red-600 mt-1">
            Make sure you have an active organization selected.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">API Keys</h2>
          <p className="text-sm text-black/50">
            Manage API keys for SDK authentication
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {createdKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy this key now. You won&apos;t be able to see it again.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-800 text-sm font-medium mb-2">
                      <AlertCircle className="h-4 w-4" />
                      Save this key securely
                    </div>
                    <p className="text-amber-700 text-xs">
                      This is the only time you&apos;ll see this key. Store it in a secure location.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={createdKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyKey}
                      aria-label="Copy API key"
                    >
                      {copiedKey ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={handleCloseCreate}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for SDK authentication
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      placeholder="My API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <p className="text-xs text-black/40">
                      A descriptive name to identify this key
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="key-project">Project (optional)</Label>
                    <Select value={newKeyProject} onValueChange={setNewKeyProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="All projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All projects</SelectItem>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-black/40">
                      Restrict this key to a specific project
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="key-expiry">Expiration (optional)</Label>
                    <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Never expires" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Never expires</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName || createApiKey.isPending}
                  >
                    {createApiKey.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create Key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys Table */}
      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        {apiKeys && apiKeys.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-black/5 px-2 py-1 rounded">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    {key.project ? (
                      <Badge variant="secondary">{key.project.name}</Badge>
                    ) : (
                      <span className="text-black/40">All projects</span>
                    )}
                  </TableCell>
                  <TableCell className="text-black/60">
                    {key.lastUsedAt
                      ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-black/60">
                    {key.expiresAt
                      ? formatDistanceToNow(new Date(key.expiresAt), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Dialog
                      open={deleteId === key.id}
                      onOpenChange={(open) => setDeleteId(open ? key.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-black/40 hover:text-red-600"
                          aria-label="Delete API key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete API Key</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete &quot;{key.name}&quot;? This action cannot be undone.
                            Any applications using this key will stop working immediately.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(key.id)}
                            disabled={deleteApiKey.isPending}
                          >
                            {deleteApiKey.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="p-3 bg-black/5 rounded-full mb-4">
              <Key className="h-6 w-6 text-black/40" />
            </div>
            <h3 className="font-medium mb-1">No API keys yet</h3>
            <p className="text-sm text-black/50 mb-4">
              Create an API key to start using the SDK
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-black/5 rounded-lg p-4">
        <h3 className="font-medium mb-2">Quick Start</h3>
        <pre className="text-sm text-black/70 overflow-x-auto">
{`import { AgentGov } from '@agentgov/sdk'

const ag = new AgentGov({
  apiKey: 'your-api-key-here'
})`}
        </pre>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-provider'
import { organization } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, ChevronDown, Check, Plus, Loader2 } from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
}

export function OrganizationSwitcher(): React.JSX.Element {
  const { organization: activeOrg, refreshSession } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Fetch user's organizations
  useEffect(() => {
    const fetchOrgs = async (): Promise<void> => {
      try {
        const { data } = await organization.list()
        if (data) {
          setOrganizations(data.map(o => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
          })))
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrgs()
  }, [])

  const handleSwitch = async (orgId: string): Promise<void> => {
    if (orgId === activeOrg?.id) return

    setIsSwitching(true)
    try {
      await organization.setActive({ organizationId: orgId })
      refreshSession()
      // Small delay to let the session update
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (err) {
      console.error('Failed to switch organization:', err)
      setIsSwitching(false)
    }
  }

  const handleCreate = async (): Promise<void> => {
    if (!newOrgName.trim()) return

    setIsCreating(true)
    try {
      // Generate slug from name
      const slug = newOrgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const { data } = await organization.create({
        name: newOrgName,
        slug,
      })

      if (data) {
        // Add to list and switch to it
        setOrganizations(prev => [...prev, {
          id: data.id,
          name: data.name,
          slug: data.slug,
        }])
        setIsCreateOpen(false)
        setNewOrgName('')
        await handleSwitch(data.id)
      }
    } catch (err) {
      console.error('Failed to create organization:', err)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" className="gap-2 h-9" disabled>
        <Building2 className="h-4 w-4" />
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            disabled={isSwitching}
          >
            <Building2 className="h-4 w-4" />
            <span className="max-w-[150px] truncate">
              {isSwitching ? 'Switching...' : (activeOrg?.name || 'Select Organization')}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{org.name}</span>
              {org.id === activeOrg?.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          {organizations.length === 0 && (
            <DropdownMenuItem disabled>
              No organizations
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCreateOpen(true)}
            className="text-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage projects and team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Inc"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newOrgName.trim()) {
                    handleCreate()
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newOrgName.trim() || isCreating}
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

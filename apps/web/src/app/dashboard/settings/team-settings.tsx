'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-provider'
import { organization } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, UserPlus, Mail, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react'
import { LogoLoader } from '@/components/logo'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

// Type definitions aligned with Better Auth organization plugin
interface OrganizationMember {
  id: string
  userId: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

interface OrganizationInvitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date
  organizationId: string
}

// Helper to safely parse dates from API response
function toDate(value: Date | string | undefined): Date {
  if (!value) return new Date()
  return value instanceof Date ? value : new Date(value)
}

// Transform API member to our type
function transformMember(member: Record<string, unknown>): OrganizationMember {
  const user = member.user as Record<string, unknown> | undefined
  return {
    id: String(member.id ?? ''),
    userId: String(member.userId ?? ''),
    role: String(member.role ?? 'member'),
    createdAt: toDate(member.createdAt as Date | string | undefined),
    user: {
      id: String(user?.id ?? ''),
      name: String(user?.name ?? ''),
      email: String(user?.email ?? ''),
      image: user?.image ? String(user.image) : null,
    },
  }
}

// Transform API invitation to our type
function transformInvitation(invitation: Record<string, unknown>): OrganizationInvitation {
  return {
    id: String(invitation.id ?? ''),
    email: String(invitation.email ?? ''),
    role: String(invitation.role ?? 'member'),
    status: String(invitation.status ?? 'pending'),
    expiresAt: toDate(invitation.expiresAt as Date | string | undefined),
    organizationId: String(invitation.organizationId ?? ''),
  }
}

export function TeamSettings(): React.JSX.Element {
  const { user, organization: activeOrg } = useAuth()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite dialog state
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [isInviting, setIsInviting] = useState(false)

  // Role change dialog state
  const [roleChangeTarget, setRoleChangeTarget] = useState<OrganizationMember | null>(null)
  const [newRole, setNewRole] = useState('')
  const [isChangingRole, setIsChangingRole] = useState(false)

  // Remove member dialog state
  const [removeMemberTarget, setRemoveMemberTarget] = useState<OrganizationMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // Fetch and refresh organization data
  const refreshData = useCallback(async () => {
    if (!activeOrg?.id) return

    try {
      const { data } = await organization.getFullOrganization({
        query: { organizationId: activeOrg.id }
      })

      if (data) {
        const rawMembers = (data.members || []) as Record<string, unknown>[]
        const rawInvitations = (data.invitations || []) as Record<string, unknown>[]
        setMembers(rawMembers.map(transformMember))
        setInvitations(rawInvitations.map(transformInvitation))
      }
    } catch (err) {
      console.error('Failed to fetch team data:', err)
      setError('Failed to load team data')
    }
  }, [activeOrg?.id])

  // Initial fetch
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setIsLoading(true)
      await refreshData()
      setIsLoading(false)
    }

    if (activeOrg?.id) {
      fetchData()
    } else {
      setIsLoading(false)
    }
  }, [activeOrg?.id, refreshData])

  const handleInvite = async (): Promise<void> => {
    if (!inviteEmail.trim() || !activeOrg?.id) return

    setIsInviting(true)
    setError(null)

    try {
      const { error: inviteError } = await organization.inviteMember({
        email: inviteEmail,
        role: inviteRole as 'admin' | 'member',
        organizationId: activeOrg.id,
      })

      if (inviteError) {
        setError(inviteError.message || 'Failed to send invitation')
        return
      }

      await refreshData()
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      toast.success('Invitation sent')
    } catch {
      setError('Failed to send invitation')
      toast.error('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRoleChange = async (): Promise<void> => {
    if (!roleChangeTarget || !newRole || !activeOrg?.id) return

    setIsChangingRole(true)
    setError(null)

    try {
      const { error: updateError } = await organization.updateMemberRole({
        memberId: roleChangeTarget.id,
        role: newRole as 'admin' | 'member',
        organizationId: activeOrg.id,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to change role')
        return
      }

      await refreshData()
      setRoleChangeTarget(null)
      setNewRole('')
      toast.success('Role updated')
    } catch {
      setError('Failed to change role')
      toast.error('Failed to change role')
    } finally {
      setIsChangingRole(false)
    }
  }

  const handleRemoveMember = async (): Promise<void> => {
    if (!removeMemberTarget || !activeOrg?.id) return

    setIsRemoving(true)
    setError(null)

    try {
      const { error: removeError } = await organization.removeMember({
        memberIdOrEmail: removeMemberTarget.id,
      })

      if (removeError) {
        setError(removeError.message || 'Failed to remove member')
        return
      }

      await refreshData()
      setRemoveMemberTarget(null)
      toast.success('Member removed')
    } catch {
      setError('Failed to remove member')
      toast.error('Failed to remove member')
    } finally {
      setIsRemoving(false)
    }
  }

  const cancelInvitation = async (invitationId: string): Promise<void> => {
    if (!activeOrg?.id) return

    try {
      await organization.cancelInvitation({
        invitationId,
      })
      await refreshData()
      toast.success('Invitation cancelled')
    } catch (err) {
      console.error('Failed to cancel invitation:', err)
      setError('Failed to cancel invitation')
      toast.error('Failed to cancel invitation')
    }
  }

  const isOwner = activeOrg?.role === 'owner'
  const isAdmin = activeOrg?.role === 'admin' || isOwner
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LogoLoader size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Team Members</h2>
          <p className="text-sm text-black/50">
            Manage who has access to your organization
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        {members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {member.user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.user.name}
                          {member.userId === user?.id && (
                            <span className="text-black/40 font-normal ml-2">(you)</span>
                          )}
                        </p>
                        <p className="text-sm text-black/50">{member.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-black/60">
                    {formatDistanceToNow(member.createdAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && isAdmin && member.userId !== user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRoleChangeTarget(member)
                              setNewRole(member.role === 'admin' ? 'member' : 'admin')
                            }}
                          >
                            Change to {member.role === 'admin' ? 'Member' : 'Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setRemoveMemberTarget(member)}
                            className="text-red-600"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="p-3 bg-black/5 rounded-full mb-4">
              <Users className="h-6 w-6 text-black/40" />
            </div>
            <h3 className="font-medium mb-1">No team members</h3>
            <p className="text-sm text-black/50">
              Invite team members to collaborate
            </p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="bg-white rounded-lg border border-black/10 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 bg-black/5 rounded-lg">
            <Mail className="h-5 w-5 text-black/60" />
          </div>
          <div>
            <h2 className="font-medium">Pending Invitations</h2>
            <p className="text-sm text-black/50">Invitations waiting to be accepted</p>
          </div>
        </div>

        {pendingInvitations.length > 0 ? (
          <div className="space-y-3">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 bg-black/5 rounded-lg"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-black/50">
                    {invitation.role} · Expires {formatDistanceToNow(invitation.expiresAt, { addSuffix: true })}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvitation(invitation.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/40 text-center py-4">
            No pending invitations
          </p>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-black/40">
                Admins can manage team members and projects
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isInviting}>
              {isInviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the role for {roleChangeTarget?.user.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-black/60">
              Change role from <strong>{roleChangeTarget?.role}</strong> to <strong>{newRole}</strong>?
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={isChangingRole}>
              {isChangingRole && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Change Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={!!removeMemberTarget} onOpenChange={(open) => !open && setRemoveMemberTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removeMemberTarget?.user.name} from this organization?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-black/60">
              They will lose access to all projects and data in this organization.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={isRemoving}>
              {isRemoving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState } from 'react'
import { getApiMode, api } from '@/api'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { LabelRoleBadge } from '@/components/role-badge'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/lib/use-async'
import { useRightsPersona } from '@/lib/rights-persona'
import { userName } from '@/lib/user-name'
import { formatRelativeTime } from '@/lib/utils'
import { Plus, Trash2, Users } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { LabelRole } from '@/types'

export function RightsMembersPage() {
  const persona = useRightsPersona()
  const { data: members, loading, error, reload } = useAsync(
    () => persona.labelId ? api.labels.listMembers(persona.labelId) : Promise.resolve([]),
    [persona.id, persona.labelId, getApiMode()],
  )

  if (persona.kind === 'independent') return <Navigate to="/rights" replace />

  async function removeMember(userId: string) {
    if (!persona.labelId) return
    try {
      await api.labels.removeMember(persona.labelId, userId)
      toast.success('Member removed')
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member')
    }
  }

  async function changeRole(userId: string, role: LabelRole) {
    if (!persona.labelId) return
    try {
      await api.labels.removeMember(persona.labelId, userId)
      await api.labels.addMember(persona.labelId, { user_id: userId, role })
      toast.success('Member role updated')
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Label members"
        description={`People managing and represented by ${persona.labelName}.`}
        actions={persona.canManageMembers && persona.labelId ? <AddMemberDialog labelId={persona.labelId} onAdded={reload} /> : undefined}
      />

      {!persona.canManageMembers && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">Only label owners can invite members, change roles, or remove people.</div>
      )}

      {error ? <EmptyState title="Members unavailable" description={error.message} /> : loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : members?.length === 0 ? (
        <EmptyState icon={<Users />} title="No members" description="Invite the first member to this label." />
      ) : (
        <div className="space-y-3">
          {members?.map(member => {
            const isCurrentUser = member.user_id === persona.user.id
            return (
              <Card key={member.user_id}>
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
                  <UserAvatar name={userName(member.user_id, member.user_name)} role={member.role === 'ARTIST' ? 'Artist' : 'Label Manager'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{userName(member.user_id, member.user_name)}</p><LabelRoleBadge role={member.role} />{isCurrentUser && <span className="text-[10px] text-muted-foreground">You</span>}</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Joined {formatRelativeTime(member.joined_at)} · {member.user_id.slice(0, 12)}…</p>
                  </div>
                  {persona.canManageMembers && !isCurrentUser && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={event => changeRole(member.user_id, event.target.value as LabelRole)}
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="OWNER">Owner</option><option value="REP">Rep</option><option value="ARTIST">Artist</option>
                      </select>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${userName(member.user_id, member.user_name)}`} onClick={() => removeMember(member.user_id)}><Trash2 /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddMemberDialog({ labelId, onAdded }: { labelId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<LabelRole>('REP')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try {
      await api.labels.addMember(labelId, { user_id: userId, role })
      toast.success('Member added')
      setOpen(false); setUserId(''); setRole('REP'); onAdded()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add member')
    } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button><Plus /> Add member</Button>} /><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Add label member</DialogTitle><DialogDescription>Use an existing platform user ID and choose their label role.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="space-y-1.5"><Label htmlFor="member-user">User ID</Label><Input id="member-user" value={userId} onChange={event => setUserId(event.target.value)} required /></div><div className="space-y-1.5"><Label htmlFor="member-role">Role</Label><select id="member-role" value={role} onChange={event => setRole(event.target.value as LabelRole)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="OWNER">Owner</option><option value="REP">Rep</option><option value="ARTIST">Artist</option></select></div></div><DialogFooter><Button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add member'}</Button></DialogFooter></form></DialogContent></Dialog>
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmptyState } from '@/components/empty-state'
import { api } from '@/api'
import { userName } from '@/lib/user-name'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { LicenseEvent } from '@/types'

const EVENT_COPY: Record<LicenseEvent['kind'], string> = {
  submitted: 'submitted a license for review',
  counter_offer: 'sent a counter-offer',
  accepted: 'accepted a license offer',
  rejected: 'rejected a license offer',
  cancelled: 'cancelled a license request',
}

interface Notification extends LicenseEvent {
  id: string
  read: boolean
}

const MAX_NOTIFICATIONS = 20

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    return api.licenses.subscribeEvents(event => {
      setNotifications(prev => [
        { ...event, id: `${event.license_id}-${event.timestamp}-${event.kind}`, read: false },
        ...prev,
      ].slice(0, MAX_NOTIFICATIONS))
    })
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <span className="text-[11px] text-muted-foreground">{unreadCount} new</span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-5" />}
              title="No notifications yet"
              description="Negotiation activity across your licenses will show up here."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map(notification => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate(`/studio/licenses/${notification.license_id}`)
                    }}
                    className={cn(
                      'block w-full px-4 py-3 text-left text-[13px] transition-colors hover:bg-accent/60',
                      !notification.read && 'bg-primary/5',
                    )}
                  >
                    <p>
                      <span className="font-medium">
                        {userName(notification.actor, notification.actor_name)}
                      </span>{' '}
                      {EVENT_COPY[notification.kind]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

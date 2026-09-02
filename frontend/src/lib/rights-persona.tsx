import { createContext, useContext, useEffect, useState } from 'react'
import { api, getApiMode } from '@/api'
import { useAuth } from '@/lib/auth'
import type { Label, LabelMember, LabelRole, PlatformRole } from '@/types'

export type RightsPersonaId = 'label-owner' | 'label-rep' | 'label-artist' | 'independent-artist'

export interface RightsPersona {
  id: RightsPersonaId
  kind: 'label' | 'independent'
  user: { id: string; name: string; email: string }
  platformRole: PlatformRole
  labelId: string | null
  labelName: string | null
  labelRole: LabelRole | null
  canNegotiate: boolean
  canManageMembers: boolean
  catalogScope: 'label' | 'artist'
  title: string
}

// ─── Mock personas (used in mock API mode) ───

import { labels, USERS } from '@/api/mock/data'

export const RIGHTS_PERSONAS: Record<RightsPersonaId, RightsPersona> = {
  'label-owner': {
    id: 'label-owner',
    kind: 'label',
    user: USERS.labelManager,
    platformRole: 'Label Manager',
    labelId: labels[0].id,
    labelName: labels[0].name,
    labelRole: 'OWNER',
    canNegotiate: true,
    canManageMembers: true,
    catalogScope: 'label',
    title: `${labels[0].name} · Owner`,
  },
  'label-rep': {
    id: 'label-rep',
    kind: 'label',
    user: USERS.labelRep,
    platformRole: 'Label Manager',
    labelId: labels[0].id,
    labelName: labels[0].name,
    labelRole: 'REP',
    canNegotiate: true,
    canManageMembers: false,
    catalogScope: 'label',
    title: `${labels[0].name} · Rep`,
  },
  'label-artist': {
    id: 'label-artist',
    kind: 'label',
    user: USERS.artist,
    platformRole: 'Artist',
    labelId: labels[0].id,
    labelName: labels[0].name,
    labelRole: 'ARTIST',
    canNegotiate: false,
    canManageMembers: false,
    catalogScope: 'artist',
    title: `${labels[0].name} · Artist`,
  },
  'independent-artist': {
    id: 'independent-artist',
    kind: 'independent',
    user: USERS.artist,
    platformRole: 'Artist',
    labelId: null,
    labelName: null,
    labelRole: null,
    canNegotiate: true,
    canManageMembers: false,
    catalogScope: 'artist',
    title: 'Independent catalog',
  },
}

// ─── Mock-mode external store (unchanged from original) ───

const STORAGE_KEY = 'rights-persona'
let currentId: RightsPersonaId = readInitialPersona()
const mockListeners = new Set<() => void>()

function readInitialPersona(): RightsPersonaId {
  if (typeof window === 'undefined') return 'label-owner'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored && stored in RIGHTS_PERSONAS ? stored as RightsPersonaId : 'label-owner'
}

export function getRightsPersona(): RightsPersona {
  return RIGHTS_PERSONAS[currentId]
}

export function setRightsPersona(id: RightsPersonaId) {
  if (currentId === id) return
  currentId = id
  window.localStorage.setItem(STORAGE_KEY, id)
  mockListeners.forEach(listener => listener())
}

// ─── React context for real-mode persona ───

const RealPersonaCtx = createContext<RightsPersona | null>(null)

function roleFromScopes(scopes: string[]): PlatformRole {
  if (scopes.includes('*')) return 'Admin'
  if (scopes.includes('movies:*')) return 'Producer'
  if (scopes.includes('songs:*') && scopes.includes('licenses:negotiate')) {
    // Could be Artist or Label Manager — differentiated by label membership
    return 'Artist'
  }
  return 'Viewer'
}

function derivePersona(
  user: { id: string; name: string; email: string; scopes: string[] },
  userLabels: Label[],
  membershipMap: Map<string, LabelMember>,
): RightsPersona {
  const role = roleFromScopes(user.scopes)

  // If user belongs to a label, build a label persona
  if (userLabels.length > 0) {
    const label = userLabels[0]
    const membership = membershipMap.get(label.id)
    const labelRole: LabelRole = membership?.role ?? 'ARTIST'
    const isOwner = labelRole === 'OWNER'
    const isRep = labelRole === 'REP'
    const canNeg = isOwner || isRep
    const personaId: RightsPersonaId = isOwner ? 'label-owner' : isRep ? 'label-rep' : 'label-artist'

    return {
      id: personaId,
      kind: 'label',
      user: { id: user.id, name: user.name, email: user.email },
      platformRole: (role === 'Artist' && (isOwner || isRep)) ? 'Label Manager' : role,
      labelId: label.id,
      labelName: label.name,
      labelRole,
      canNegotiate: canNeg,
      canManageMembers: isOwner,
      catalogScope: labelRole === 'ARTIST' ? 'artist' : 'label',
      title: `${label.name} · ${isOwner ? 'Owner' : isRep ? 'Rep' : 'Artist'}`,
    }
  }

  // Independent artist fallback
  return {
    id: 'independent-artist',
    kind: 'independent',
    user: { id: user.id, name: user.name, email: user.email },
    platformRole: role,
    labelId: null,
    labelName: null,
    labelRole: null,
    canNegotiate: true,
    canManageMembers: false,
    catalogScope: 'artist',
    title: 'Independent catalog',
  }
}

export function RealPersonaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [persona, setPersona] = useState<RightsPersona | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    ;(async () => {
      try {
        const userLabels = await api.labels.getUserLabels(user.user_id)
        const membershipMap = new Map<string, LabelMember>()
        for (const label of userLabels) {
          const members = await api.labels.listMembers(label.id)
          const me = members.find(m => m.user_id === user.user_id)
          if (me) membershipMap.set(label.id, me)
        }
        if (!cancelled) {
          setPersona(derivePersona(
            { id: user.user_id, name: user.name, email: user.email, scopes: user.scopes },
            userLabels,
            membershipMap,
          ))
        }
      } catch {
        // Fallback: independent artist
        if (!cancelled) {
          setPersona(derivePersona(
            { id: user.user_id, name: user.name, email: user.email, scopes: user.scopes },
            [],
            new Map(),
          ))
        }
      }
    })()
    return () => { cancelled = true }
  }, [user])

  return <RealPersonaCtx.Provider value={persona}>{children}</RealPersonaCtx.Provider>
}

// ─── Hook: returns correct persona for current API mode ───

import { useSyncExternalStore } from 'react'

export function useRightsPersona(): RightsPersona {
  const mode = getApiMode()

  // Mock mode: use the external store (supports persona switcher)
  const mockId = useSyncExternalStore<RightsPersonaId>(
    listener => { mockListeners.add(listener); return () => mockListeners.delete(listener) },
    () => currentId,
    () => 'label-owner',
  )

  const realPersona = useContext(RealPersonaCtx)

  if (mode === 'real' && realPersona) return realPersona

  return RIGHTS_PERSONAS[mockId]
}

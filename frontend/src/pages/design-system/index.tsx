import { useState } from 'react'
import {
  AppShell,
  AppHeader,
  AppSidebar,
  PageHeader,
  StatusBadge,
  MovieRoleBadge,
  LabelRoleBadge,
  UsageBadge,
  SideBadge,
  UserAvatar,
  UserAvatarWithInfo,
  MovieCard,
  SongCard,
  LicenseCard,
  NegotiationTimeline,
  EmptyState,
} from '@/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { Movie, Song, LicenseRequest, LicenseOffer, LicenseStatus, MovieRole, LabelRole, UsageType, NegotiationSide, PlatformRole } from '@/types'

/* ─── Mock data ─── */
const MOCK_MOVIE: Movie = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  title: 'Cyber City',
  description: 'A neo-noir thriller set in 2085',
  release_year: 2026,
  director: 'Jane Doe',
  created_by: '00000000-0000-0000-0000-000000000001',
  created_by_name: 'Jordan Blake',
  created_at: '2026-08-30T12:00:00Z',
  updated_at: '2026-08-30T12:00:00Z',
}

const MOCK_SONG: Song = {
  id: 'b1b2c3d4-0000-0000-0000-000000000001',
  title: 'Neon Lights',
  artist_id: '00000000-0000-0000-0000-000000000003',
  artist_name: 'Nova Chen',
  label_id: 'c1b2c3d4-0000-0000-0000-000000000001',
  label_name: 'Wave Records',
  album: 'Electric Dreams',
  duration_seconds: 240,
  genre: 'Electronic',
  isrc: 'US-RC1-76-07839',
  created_at: '2026-07-15T10:00:00Z',
  updated_at: '2026-07-15T10:00:00Z',
}

const MOCK_LICENSE: LicenseRequest = {
  id: 'd1b2c3d4-0000-0000-0000-000000001042',
  track_id: 'e1b2c3d4-0000-0000-0000-000000000001',
  status: 'APPROVED',
  requested_by: '00000000-0000-0000-0000-000000000002',
  requested_by_name: 'Casey Reyes',
  requested_at: '2026-08-25T14:00:00Z',
  resolved_by: '00000000-0000-0000-0000-000000000004',
  resolved_by_name: 'Priya Anand',
  resolved_at: '2026-08-28T16:30:00Z',
  rejection_reason: null,
  created_at: '2026-08-25T14:00:00Z',
  updated_at: '2026-08-28T16:30:00Z',
}

const MOCK_OFFERS: (LicenseOffer & { proposer_name: string })[] = [
  { id: '1', license_request_id: MOCK_LICENSE.id, offer_number: 1, side: 'MOVIE_TEAM', proposed_by: '2', proposed_by_name: 'Producer', proposer_name: 'Producer', license_fee: 5000, currency: 'USD', territory: 'Worldwide', media_rights: null, license_start: null, license_end: null, exclusive: false, notes: 'Initial offer for opening scene placement', created_at: '2026-08-25T14:00:00Z' },
  { id: '2', license_request_id: MOCK_LICENSE.id, offer_number: 2, side: 'MOVIE_TEAM', proposed_by: '2', proposed_by_name: 'Producer', proposer_name: 'Producer', license_fee: 4500, currency: 'USD', territory: 'North America', media_rights: null, license_start: null, license_end: null, exclusive: false, notes: 'Revised — narrowed territory', created_at: '2026-08-26T09:00:00Z' },
  { id: '3', license_request_id: MOCK_LICENSE.id, offer_number: 3, side: 'RIGHTS_HOLDER', proposed_by: '4', proposed_by_name: 'Label Manager', proposer_name: 'Label Manager', license_fee: 8000, currency: 'USD', territory: 'Worldwide', media_rights: null, license_start: null, license_end: null, exclusive: true, notes: 'Counter: higher fee for exclusive', created_at: '2026-08-26T15:00:00Z' },
  { id: '4', license_request_id: MOCK_LICENSE.id, offer_number: 4, side: 'MOVIE_TEAM', proposed_by: '2', proposed_by_name: 'Producer', proposer_name: 'Producer', license_fee: 6000, currency: 'USD', territory: 'North America', media_rights: null, license_start: null, license_end: null, exclusive: false, notes: 'Final compromise', created_at: '2026-08-27T11:00:00Z' },
]

/* ─── Section helper ─── */
function Section({ id, title, description, children }: {
  id: string; title: string; description?: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ColorSwatch({ name, value, token }: { name: string; value: string; token: string }) {
  return (
    <div className="space-y-1.5">
      <div className="h-12 rounded-md border border-border" style={{ backgroundColor: value }} />
      <p className="text-[13px] font-medium">{name}</p>
      <p className="text-xs text-muted-foreground font-mono">{token}</p>
    </div>
  )
}

/* ─── Nav config ─── */
const NAV = [
  { label: 'Foundations', href: '#foundations' },
  { label: 'Colors', href: '#colors' },
  { label: 'Typography', href: '#typography' },
  { label: 'Spacing', href: '#spacing' },
  { label: 'Buttons', href: '#buttons' },
  { label: 'Badges', href: '#badges' },
  { label: 'Forms', href: '#forms' },
  { label: 'Cards', href: '#cards' },
  { label: 'Tables', href: '#tables' },
  { label: 'Status System', href: '#status' },
  { label: 'Timeline', href: '#timeline' },
  { label: 'Avatars', href: '#avatars' },
  { label: 'Empty States', href: '#empty' },
  { label: 'Loading', href: '#loading' },
  { label: 'Layout', href: '#layout' },
]

/* ─── App ─── */
function DesignSystem() {
  const [activeNav, setActiveNav] = useState('#foundations')
  const isDark = document.documentElement.classList.contains('dark')

  return (
    <>
      <AppHeader userName="Admin" userRole="Admin" />
      <AppShell
        sidebar={
          <AppSidebar
            items={NAV}
            activeHref={activeNav}
            onNavigate={(href) => {
              setActiveNav(href)
              document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        }
      >
        <div className="max-w-5xl space-y-16">

          {/* Hero */}
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Design System</h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Component library for the Music Licensing Platform.
              Built with React, Tailwind CSS v4, and shadcn/ui.
              Inspired by Linear's density, Spotify's dark-first content focus,
              and Musicbed's music licensing UX patterns.
            </p>
            <div className="flex gap-2 pt-2">
              <Badge variant="outline" className="text-xs">Inter Variable</Badge>
              <Badge variant="outline" className="text-xs">4px Grid</Badge>
              <Badge variant="outline" className="text-xs">Dark-First</Badge>
              <Badge variant="outline" className="text-xs">Border Depth</Badge>
            </div>
          </div>

          <Separator />

          {/* ── Foundations ── */}
          <Section id="foundations" title="Design Principles" description="Core philosophy driving every component decision.">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Dark-First', desc: 'Deep surfaces (#0f1011) let content — album art, data tables, status badges — be the visual hero.' },
                { title: 'Border Depth', desc: '1px borders (#2a2e33) for separation, not drop shadows. Cards brighten on hover, not lift.' },
                { title: 'Calm Density', desc: 'Tight type scale, 4px grid, strategic whitespace. Show only what the current workflow needs.' },
                { title: 'Functional Color', desc: 'Accent (#5e6ad2) for interactive elements only. Status colors for license states. Never decorative.' },
                { title: 'Progressive Disclosure', desc: 'Simple defaults, complexity on demand. Empty states guide. Filters expand.' },
                { title: 'Role-Adaptive', desc: 'Producers see pipelines. Artists see catalogs. Label managers see negotiation queues.' },
              ].map(p => (
                <Card key={p.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{p.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          <Separator />

          {/* ── Colors ── */}
          <Section id="colors" title="Color Palette" description="Semantic tokens. All colors as CSS custom properties for theme switching.">
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-medium mb-3">Surfaces</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <ColorSwatch name="Background" value={isDark ? '#0f1011' : '#ffffff'} token="--background" />
                  <ColorSwatch name="Card" value={isDark ? '#161718' : '#f9fafb'} token="--card" />
                  <ColorSwatch name="Popover" value={isDark ? '#1a1b1d' : '#ffffff'} token="--popover" />
                  <ColorSwatch name="Muted" value={isDark ? '#1e2022' : '#f3f4f6'} token="--muted" />
                  <ColorSwatch name="Secondary" value={isDark ? '#1e2022' : '#f1f3f5'} token="--secondary" />
                  <ColorSwatch name="Border" value={isDark ? '#2a2e33' : '#e5e7eb'} token="--border" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Text</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <ColorSwatch name="Foreground" value={isDark ? '#f7f8f8' : '#0f1011'} token="--foreground" />
                  <ColorSwatch name="Muted Text" value={isDark ? '#8a8f98' : '#6b7280'} token="--muted-foreground" />
                  <ColorSwatch name="Primary" value="#5e6ad2" token="--primary" />
                  <ColorSwatch name="Accent Text" value={isDark ? '#a5b4fc' : '#4338ca'} token="--accent-foreground" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Status (License Negotiation)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <ColorSwatch name="Success / Approved" value="#10b981" token="--success" />
                  <ColorSwatch name="Warning / Pending" value="#f59e0b" token="--warning" />
                  <ColorSwatch name="Info / Requested" value="#3b82f6" token="--info" />
                  <ColorSwatch name="Destructive" value="#ef4444" token="--destructive" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Brand Accent</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <ColorSwatch name="Indigo 400" value="#818cf8" token="interactive-hover" />
                  <ColorSwatch name="Indigo 500" value="#6366f1" token="interactive-active" />
                  <ColorSwatch name="Indigo 600" value="#5e6ad2" token="--primary" />
                  <ColorSwatch name="Purple 500" value="#8b5cf6" token="chart-accent" />
                </div>
              </div>
            </div>
          </Section>

          <Separator />

          {/* ── Typography ── */}
          <Section id="typography" title="Typography" description="Inter Variable with tight tracking. Hierarchy through weight and size.">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Role</TableHead>
                    <TableHead className="w-20">Size</TableHead>
                    <TableHead className="w-20">Weight</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { role: 'Display', size: '48px', weight: '700', el: <span className="text-5xl font-bold tracking-tight leading-none">Licensing</span> },
                    { role: 'H1', size: '30px', weight: '600', el: <span className="text-3xl font-semibold tracking-tight">Movie Dashboard</span> },
                    { role: 'H2', size: '24px', weight: '600', el: <span className="text-2xl font-semibold tracking-tight">License Requests</span> },
                    { role: 'H3', size: '16px', weight: '600', el: <span className="text-base font-semibold">Track: Neon Lights</span> },
                    { role: 'Body', size: '14px', weight: '400', el: <span className="text-sm">License negotiation between Producer and Label Manager.</span> },
                    { role: 'Small', size: '13px', weight: '400', el: <span className="text-[13px] text-muted-foreground">Created Aug 30, 2026 by Jane Doe</span> },
                    { role: 'Caption', size: '11px', weight: '500', el: <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ISRC: US-RC1-76-07839</span> },
                  ].map(t => (
                    <TableRow key={t.role}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.role}</TableCell>
                      <TableCell className="font-mono text-xs">{t.size}</TableCell>
                      <TableCell className="font-mono text-xs">{t.weight}</TableCell>
                      <TableCell>{t.el}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Section>

          <Separator />

          {/* ── Spacing ── */}
          <Section id="spacing" title="Spacing & Radius" description="4px base unit. Strict radius scale: 4/6/12/9999px.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Spacing Scale</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: '1 (4px)', width: 'w-1', use: 'Icon-text gap' },
                      { name: '2 (8px)', width: 'w-2', use: 'Tight element gap' },
                      { name: '3 (12px)', width: 'w-3', use: 'Button padding' },
                      { name: '4 (16px)', width: 'w-4', use: 'Standard gap' },
                      { name: '6 (24px)', width: 'w-6', use: 'Card padding' },
                      { name: '8 (32px)', width: 'w-8', use: 'Section gap' },
                      { name: '16 (64px)', width: 'w-16', use: 'Page section' },
                    ].map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{s.name}</span>
                        <div className={`${s.width} h-3 bg-primary rounded-sm`} />
                        <span className="text-xs text-muted-foreground">{s.use}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Border Radius</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { name: '4px', cls: 'rounded-sm', use: 'Tags' },
                      { name: '6px', cls: 'rounded-md', use: 'Buttons' },
                      { name: '12px', cls: 'rounded-lg', use: 'Cards' },
                      { name: '9999px', cls: 'rounded-full', use: 'Pills' },
                    ].map(r => (
                      <div key={r.name} className="flex flex-col items-center gap-2">
                        <div className={`w-16 h-16 border border-border bg-secondary ${r.cls}`} />
                        <span className="text-xs font-mono">{r.name}</span>
                        <span className="text-[11px] text-muted-foreground">{r.use}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── Buttons ── */}
          <Section id="buttons" title="Buttons" description="Primary for key actions. Ghost/outline for secondary. Contextual license actions.">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Variants</h3>
                <div className="flex flex-wrap gap-3">
                  <Button>Primary Action</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Delete</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" className="h-9 w-9"><span className="text-sm">+</span></Button>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">States</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Enabled</Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">License Actions (contextual)</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Submit Offer</Button>
                  <Button size="sm" variant="outline">Counter</Button>
                  <Button size="sm" variant="ghost">Save Draft</Button>
                  <Button size="sm" variant="destructive">Reject</Button>
                </div>
              </div>
            </div>
          </Section>

          <Separator />

          {/* ── Badges (using components) ── */}
          <Section id="badges" title="Badges & Status" description="Domain-specific badge components. Each maps to a backend enum.">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">License Status — <code className="text-xs font-mono text-muted-foreground">{'<StatusBadge status={...} />'}</code></h3>
                <div className="flex flex-wrap gap-2">
                  {(['DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as LicenseStatus[]).map(s => (
                    <StatusBadge key={s} status={s} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Movie Roles — <code className="text-xs font-mono text-muted-foreground">{'<MovieRoleBadge role={...} />'}</code></h3>
                <div className="flex flex-wrap gap-2">
                  {(['OWNER', 'SUPERVISOR', 'EDITOR', 'VIEWER'] as MovieRole[]).map(r => (
                    <MovieRoleBadge key={r} role={r} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Label Roles — <code className="text-xs font-mono text-muted-foreground">{'<LabelRoleBadge role={...} />'}</code></h3>
                <div className="flex flex-wrap gap-2">
                  {(['OWNER', 'REP', 'ARTIST'] as LabelRole[]).map(r => (
                    <LabelRoleBadge key={r} role={r} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Track Usage — <code className="text-xs font-mono text-muted-foreground">{'<UsageBadge usage={...} />'}</code></h3>
                <div className="flex flex-wrap gap-2">
                  {(['FEATURED', 'BACKGROUND', 'CREDITS', 'TRAILER'] as UsageType[]).map(u => (
                    <UsageBadge key={u} usage={u} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Negotiation Side — <code className="text-xs font-mono text-muted-foreground">{'<SideBadge side={...} />'}</code></h3>
                <div className="flex flex-wrap gap-2">
                  {(['MOVIE_TEAM', 'RIGHTS_HOLDER'] as NegotiationSide[]).map(s => (
                    <SideBadge key={s} side={s} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Separator />

          {/* ── Forms ── */}
          <Section id="forms" title="Form Elements" description="1px borders, primary focus ring. Labels at 13px/medium.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="movie-title" className="text-[13px]">Movie Title</Label>
                <Input id="movie-title" placeholder="Enter movie title..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search" className="text-[13px]">Search Songs</Label>
                <Input id="search" type="search" placeholder="Search by title, artist, genre..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-select" className="text-[13px]">Member Role</Label>
                <Select>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee" className="text-[13px]">License Fee (USD)</Label>
                <Input id="fee" type="number" placeholder="5000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes" className="text-[13px]">Negotiation Notes</Label>
                <Textarea id="notes" placeholder="Add context for the counter-offer..." rows={3} />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="exclusive" />
                <Label htmlFor="exclusive" className="text-[13px]">Exclusive license</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="worldwide" defaultChecked />
                <Label htmlFor="worldwide" className="text-[13px]">Worldwide territory</Label>
              </div>
            </div>
          </Section>

          <Separator />

          {/* ── Cards (using components) ── */}
          <Section id="cards" title="Cards" description="Domain cards built from real API types. Hover for border highlight.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MovieCard
                movie={MOCK_MOVIE}
                sceneCount={3}
                trackCount={5}
                licensedCount={2}
                onClick={() => {}}
              />
              <SongCard
                song={MOCK_SONG}
                artistName="Artist User"
                labelName="Acme Records"
                onClick={() => {}}
              />
              <LicenseCard
                license={MOCK_LICENSE}
                latestOffer={MOCK_OFFERS[3]}
                offerCount={4}
                songTitle="Neon Lights"
                sceneTitle="Opening Scene"
                resolvedByName="Label Manager"
                onClick={() => {}}
              />
            </div>
          </Section>

          <Separator />

          {/* ── Tables ── */}
          <Section id="tables" title="Data Tables" description="Dense rows for scanning. Monospace for IDs. StatusBadge inline.">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Song</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Scene</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: 1, song: 'Neon Lights', artist: 'Artist User', scene: 'Opening', usage: 'FEATURED' as UsageType, status: 'APPROVED' as LicenseStatus, fee: '$6,000' },
                    { id: 2, song: 'Free Bird', artist: 'Solo Artist', scene: 'Chase', usage: 'BACKGROUND' as UsageType, status: 'REQUESTED' as LicenseStatus, fee: '$1,500' },
                    { id: 3, song: 'Midnight Run', artist: 'Duo Band', scene: 'Finale', usage: 'FEATURED' as UsageType, status: 'APPROVED' as LicenseStatus, fee: '$4,200' },
                    { id: 4, song: 'Dawn Chorus', artist: 'Indie Maker', scene: 'Montage', usage: 'CREDITS' as UsageType, status: 'DRAFT' as LicenseStatus, fee: '--' },
                    { id: 5, song: 'City Pulse', artist: 'Label Act', scene: 'Credits', usage: 'BACKGROUND' as UsageType, status: 'REJECTED' as LicenseStatus, fee: '$800' },
                  ].map(row => (
                    <TableRow key={row.id} className="hover:bg-accent/50 cursor-pointer transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                      <TableCell className="font-medium text-[13px]">{row.song}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{row.artist}</TableCell>
                      <TableCell className="text-[13px]">{row.scene}</TableCell>
                      <TableCell><UsageBadge usage={row.usage} /></TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell className="text-right font-mono text-[13px]">{row.fee}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Section>

          <Separator />

          {/* ── Status system ── */}
          <Section id="status" title="License Status System" description="Each state in the negotiation machine maps to a visual treatment.">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {([
                    { status: 'DRAFT' as LicenseStatus, desc: 'Not yet submitted. Editable.' },
                    { status: 'REQUESTED' as LicenseStatus, desc: 'Submitted for review.' },
                    { status: 'APPROVED' as LicenseStatus, desc: 'Both parties agreed.' },
                    { status: 'REJECTED' as LicenseStatus, desc: 'Declined with reason.' },
                    { status: 'CANCELLED' as LicenseStatus, desc: 'Withdrawn by requester.' },
                  ]).map(s => (
                    <div key={s.status} className="rounded-lg p-4 bg-card border border-border">
                      <StatusBadge status={s.status} />
                      <p className="text-xs text-muted-foreground mt-2">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── Negotiation Timeline (component) ── */}
          <Section id="timeline" title="Negotiation Timeline" description="NegotiationTimeline component. Color-coded by party side.">
            <div className="max-w-2xl">
              <NegotiationTimeline
                status="APPROVED"
                offers={MOCK_OFFERS}
                songTitle="Neon Lights"
                sceneTitle="Opening Scene"
                movieTitle="Cyber City"
                resolvedByName="Label Manager"
              />
            </div>
          </Section>

          <Separator />

          {/* ── Avatars (component) ── */}
          <Section id="avatars" title="Avatars & Roles" description="UserAvatar and UserAvatarWithInfo components. Color-coded by platform role.">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">UserAvatarWithInfo</h3>
                <div className="flex flex-wrap gap-6">
                  {([
                    { name: 'Admin', role: 'Admin' as PlatformRole },
                    { name: 'Producer', role: 'Producer' as PlatformRole },
                    { name: 'Artist', role: 'Artist' as PlatformRole },
                    { name: 'Label Manager', role: 'Label Manager' as PlatformRole },
                    { name: 'Viewer', role: 'Viewer' as PlatformRole },
                  ]).map(u => (
                    <UserAvatarWithInfo key={u.name} name={u.name} role={u.role} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">UserAvatar sizes</h3>
                <div className="flex items-end gap-4">
                  {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(size => (
                    <div key={size} className="flex flex-col items-center gap-1.5">
                      <UserAvatar name="Music Licensing" size={size} />
                      <span className="text-[11px] text-muted-foreground font-mono">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Separator />

          {/* ── Empty states (component) ── */}
          <Section id="empty" title="Empty States" description="EmptyState component. Guides users toward the next action.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <EmptyState
                  icon={<span className="text-xl text-muted-foreground">&#9835;</span>}
                  title="No tracks in this scene"
                  description="Add a track to start the licensing process. Browse the song catalog or search for a specific track."
                  action={{ label: 'Add Track', onClick: () => {} }}
                />
              </Card>
              <Card>
                <EmptyState
                  icon={<span className="text-xl text-muted-foreground">&#9724;</span>}
                  title="No movies yet"
                  description="Create your first movie to start organizing scenes and licensing tracks."
                  action={{ label: 'Create Movie', onClick: () => {} }}
                />
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── Loading ── */}
          <Section id="loading" title="Loading States" description="Skeleton placeholders match the layout of the component they replace.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </CardHeader>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── Layout patterns ── */}
          <Section id="layout" title="Layout & Patterns" description="AppShell, PageHeader, navigation, elevation, and responsive breakpoints.">
            <Tabs defaultValue="page-header">
              <TabsList>
                <TabsTrigger value="page-header">PageHeader</TabsTrigger>
                <TabsTrigger value="nav">Navigation</TabsTrigger>
                <TabsTrigger value="elevation">Elevation</TabsTrigger>
                <TabsTrigger value="responsive">Responsive</TabsTrigger>
              </TabsList>

              <TabsContent value="page-header" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <PageHeader
                      title="Movies"
                      description="Manage your movies, scenes, and track placements."
                      actions={<Button size="sm">Create Movie</Button>}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="nav" className="mt-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <h4 className="text-[13px] font-medium mb-2">Sidebar (role-adaptive)</h4>
                      <div className="border border-border rounded-lg p-3 max-w-xs space-y-1">
                        {['Dashboard', 'Movies', 'Songs', 'Licenses', 'Labels'].map((item, i) => (
                          <div
                            key={item}
                            className={`px-3 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors ${
                              i === 0
                                ? 'bg-accent text-accent-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[13px] font-medium mb-2">Tab Navigation</h4>
                      <Tabs defaultValue="details">
                        <TabsList>
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="scenes">Scenes (3)</TabsTrigger>
                          <TabsTrigger value="team">Team (4)</TabsTrigger>
                          <TabsTrigger value="licenses">Licenses (2)</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="elevation" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-[13px] text-muted-foreground mb-4">
                      Depth through borders, not shadows. Hover = brighten. Focus = primary ring.
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'z-0: Base', cls: 'bg-background border border-border' },
                        { label: 'z-1: Card', cls: 'bg-card border border-border' },
                        { label: 'z-2: Focus', cls: 'bg-popover border border-border ring-2 ring-primary/30' },
                        { label: 'z-3: Popover', cls: 'bg-popover border border-border shadow-lg' },
                      ].map(e => (
                        <div key={e.label} className={`w-32 h-20 rounded-lg flex items-center justify-center text-[11px] text-muted-foreground ${e.cls}`}>
                          {e.label}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="responsive" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Breakpoint</TableHead>
                          <TableHead>Width</TableHead>
                          <TableHead>Layout</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { name: 'Mobile', width: '< 640px', layout: 'Single column, hamburger nav' },
                          { name: 'Tablet', width: '641-1024px', layout: '2 columns, sidebar collapses' },
                          { name: 'Desktop', width: '1025-1440px', layout: 'Sidebar + 3-col grid' },
                          { name: 'Wide', width: '> 1440px', layout: 'Max-width 1440px container' },
                        ].map(b => (
                          <TableRow key={b.name}>
                            <TableCell className="font-medium text-[13px]">{b.name}</TableCell>
                            <TableCell className="font-mono text-[12px] text-muted-foreground">{b.width}</TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">{b.layout}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Section>

        </div>
      </AppShell>
    </>
  )
}

export default function DesignSystemPage() {
  return <DesignSystem />
}

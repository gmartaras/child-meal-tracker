import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ageInMonths, formatAge, todayISO } from '../domain/age'
import { useStore } from '../store/store'
import { ClientForm } from './ClientForm'
import { Banner, Icon, IconButton, cx } from './ui'

function ClientList({ onNavigate }: { onNavigate: () => void }) {
  const clients = useStore((s) => s.clients)
  const id = useLocation().pathname.match(/^\/c\/([^/]+)/)?.[1]
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const today = todayISO()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return clients
      .filter((c) => (showArchived ? true : !c.archived))
      .filter((c) => !t || c.firstName.toLowerCase().includes(t) || c.code.toLowerCase().includes(t))
      .sort((a, b) => (t ? a.firstName.localeCompare(b.firstName) : b.updatedAt - a.updatedAt))
  }, [clients, q, showArchived])
  const archivedCount = clients.filter((c) => c.archived).length

  return (
    <>
      <div className="px-3">
        <div className="relative">
          <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && list[0]) {
                nav(`/c/${list[0].id}`)
                setQ('')
                onNavigate()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="Find a client"
            aria-label="Find a client (Ctrl or ⌘ + K)"
            className="h-9 w-full rounded-lg border border-line bg-surface pr-10 pl-8 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-line px-1 text-[10px] text-muted lg:block">⌘K</kbd>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-4">
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Clients · {list.length}</span>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium text-accent-ink hover:bg-accent-wash">
          <Icon name="plus" size={13} /> New
        </button>
      </div>
      <nav className="scroll-thin mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Clients">
        {list.map((c) => (
          <NavLink
            key={c.id}
            to={`/c/${c.id}`}
            onClick={onNavigate}
            className={cx('flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5', id === c.id ? 'bg-surface font-medium shadow-sm ring-1 ring-line' : 'hover:bg-surface/70', c.archived && 'opacity-60')}
          >
            <span className="truncate text-[13.5px]">{c.firstName}</span>
            <span className="shrink-0 text-[11.5px] text-muted">{formatAge(ageInMonths(c.dob, today))} · {c.code}</span>
          </NavLink>
        ))}
        {!list.length && <p className="px-2 py-3 text-[13px] text-muted">{clients.length ? 'No clients match.' : 'No clients yet.'}</p>}
        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived(!showArchived)} className="mt-1 px-2 py-1 text-[12px] text-muted hover:text-ink">
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
      </nav>
      {adding && <ClientForm onClose={() => setAdding(false)} onSaved={(c) => (nav(`/c/${c.id}`), onNavigate())} />}
    </>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  const mode = useStore((s) => s.mode)
  const user = useStore((s) => s.user)
  const synced = useStore((s) => s.synced)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  const signOut = useStore((s) => s.signOut)
  const practice = useStore((s) => s.settings.practiceName)
  const loc = useLocation()
  const isReport = /\/(report|print)\//.test(loc.pathname)
  const autoLockMin = useStore((s) => s.settings.autoLockMin) ?? 30
  const logAudit = useStore((s) => s.logAudit)

  // Sign out after a period without any activity, so an unattended device does not stay open on client records.
  useEffect(() => {
    if (mode !== 'cloud' || !(autoLockMin > 0)) return
    let last = Date.now()
    const touch = () => {
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    const timer = setInterval(() => {
      if (Date.now() - last > autoLockMin * 60_000) {
        logAudit('auto-sign-out', `after ${autoLockMin} minutes without activity`)
        void signOut()
      }
    }, 20_000)
    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
    }
  }, [mode, autoLockMin, signOut, logAudit])
  useEffect(() => setDrawer(false), [loc.pathname])

  if (isReport) return <>{children}</>

  const navItem = ({ isActive }: { isActive: boolean }) => cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px]', isActive ? 'bg-surface font-medium shadow-sm ring-1 ring-line' : 'text-ink-2 hover:bg-surface/70 hover:text-ink')

  const sidebar = (
    <div className="flex h-full flex-col bg-surface-2/60">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <img src="./icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-tight font-semibold tracking-tight">Mealtrace</span>
            {practice && <span className="block truncate text-[11.5px] leading-tight text-muted">{practice}</span>}
          </span>
        </NavLink>
        <IconButton icon="x" label="Close menu" className="ml-auto lg:hidden" onClick={() => setDrawer(false)} />
      </div>
      <div className="px-2 pb-2">
        <NavLink to="/" end className={navItem}><Icon name="users" /> All clients</NavLink>
        <NavLink to="/foods" className={navItem}><Icon name="apple" /> Food library</NavLink>
      </div>
      <ClientList onNavigate={() => setDrawer(false)} />
      <div className="border-t border-line p-2">
        <NavLink to="/settings" className={navItem}><Icon name="settings" /> Settings</NavLink>
        <div className="mt-1 flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted">
          <Icon name={mode === 'cloud' ? 'cloud' : 'cloudOff'} size={14} className={mode === 'cloud' && synced ? 'text-good-ink' : ''} />
          <span className="min-w-0 flex-1 truncate" title={user?.email}>
            {mode === 'cloud' ? (synced ? `Saved to cloud · ${user?.email}` : 'Working offline · will sync') : 'This browser only'}
          </span>
          {mode === 'cloud' && <button type="button" onClick={() => signOut()} title="Sign out" aria-label="Sign out" className="hover:text-ink"><Icon name="logout" size={14} /></button>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-[272px] shrink-0 border-r border-line lg:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-bg shadow-card">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
          <IconButton icon="menu" label="Open menu" onClick={() => setDrawer(true)} />
          <span className="text-[15px] font-semibold tracking-tight">Mealtrace</span>
          <button type="button" onClick={() => setDrawer(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] text-ink-2">
            <Icon name="users" size={15} /> Clients
          </button>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {(error || mode === 'local') && (
            <div className="space-y-2 px-4 pt-3 sm:px-6">
              {error && (
                <Banner tone="critical" action={<IconButton icon="x" label="Dismiss" onClick={clearError} className="-my-1.5" />}>
                  {error}
                </Banner>
              )}
              {mode === 'local' && (
                <Banner tone="warning">
                  <strong className="font-semibold">Trial mode:</strong> data stays in this browser only, with no sign-in, backup or sync. Connect cloud storage before entering real client data.
                </Banner>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

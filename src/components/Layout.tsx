import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
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
            className={cx('flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5', id === c.id ? 'bg-accent-wash font-semibold text-accent-ink' : 'hover:bg-surface-2', c.archived && 'opacity-60')}
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px]"><span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-ink-2">{c.firstName.slice(0,1).toUpperCase()}</span><span className="truncate">{c.firstName}</span></span>
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
  const synced = useStore((s) => s.synced && !s.pendingWrites && !s.error)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  const signOut = useStore((s) => s.signOut)
  const practice = useStore((s) => s.settings.practiceName)
  const loc = useLocation()
  const isReport = /\/report\//.test(loc.pathname)
  const clientId = loc.pathname.match(/^\/c\/([^/]+)/)?.[1]
  const clientName = useStore(s => s.clients.find(c => c.id === clientId)?.firstName)
  const section = loc.pathname === '/settings' ? 'Settings' : loc.pathname === '/recipes' ? 'Recipes' : loc.pathname === '/foods' ? 'Food library' : 'Clients'
  const content = useRef<HTMLElement>(null)
  useEffect(() => {
    setDrawer(false)
    content.current?.scrollTo({top: 0, behavior: 'instant'})
  }, [loc.pathname])

  if (isReport) return <>{children}</>

  const navItem = ({ isActive }: { isActive: boolean }) => cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px]', isActive ? 'bg-accent-wash font-semibold text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')

  const sidebar = (
    <div className="app-rail flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <img src="./icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-[16px] leading-tight font-semibold tracking-tight">Mealtrace</span>
            {practice && <span className="block truncate text-[11.5px] leading-tight text-muted">{practice}</span>}
          </span>
        </NavLink>
        <IconButton icon="x" label="Close menu" className="ml-auto lg:hidden" onClick={() => setDrawer(false)} />
      </div>
      <nav className="space-y-1 px-3 py-4" aria-label="Workspace">
        <NavLink to="/" end className={navItem}><Icon name="layout" /> Clients</NavLink>
        <NavLink to="/foods" className={navItem}><Icon name="apple" /> Food library</NavLink>
        <NavLink to="/recipes" className={navItem}><Icon name="layers" /> Recipes</NavLink>
        <NavLink to="/settings" className={navItem}><Icon name="settings" /> Settings</NavLink>
      </nav>
      <div className="mx-3 mb-4 border-t border-line" />
      <ClientList onNavigate={() => setDrawer(false)} />
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 px-1 py-1 text-[12px] text-muted">
          <Icon name={mode === 'cloud' ? 'cloud' : 'cloudOff'} size={14} className={mode === 'cloud' && synced ? 'text-good-ink' : ''} />
          <span className="min-w-0 flex-1 truncate" title={user?.email}>
            {mode === 'cloud' ? (synced ? `Synced · ${user?.email}` : 'Not confirmed in cloud · keep this tab open') : 'This browser only'}
          </span>
          {mode === 'cloud' && <button type="button" onClick={() => signOut()} title="Sign out" aria-label="Sign out" className="hover:text-ink"><Icon name="logout" size={14} /></button>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-[242px] shrink-0 border-r border-line lg:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] border-r border-line bg-surface shadow-card">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-6 lg:h-16 lg:px-8">
          <IconButton icon="menu" label="Open menu" className="lg:hidden" onClick={() => setDrawer(true)} />
          <nav aria-label="Current location" className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {clientName ? <><Link to="/" className="text-ink-2 hover:text-accent-ink">Clients</Link><Icon name="chevronRight" size={13} className="text-muted" /><Link to={`/c/${clientId}`} className="truncate hover:text-accent-ink">{clientName}</Link>{loc.pathname.includes('/a/') && <span className="hidden items-center gap-2 text-ink-2 sm:inline-flex"><Icon name="chevronRight" size={13} /> Food history</span>}</> : <span>{section}</span>}
          </nav>
          <span className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
            <span aria-hidden="true" className={cx('size-1.5 rounded-full', synced && mode === 'cloud' ? 'bg-good' : 'bg-warning')} />
            {mode === 'local' ? 'Trial mode' : synced ? 'Synced' : 'Sync pending'}
          </span>
        </header>
        <main ref={content} className="app-main scroll-thin min-h-0 flex-1 overflow-y-auto">
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

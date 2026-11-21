import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ageInMonths, formatAge, todayISO } from '../domain/age'
import { inactivityMinutes, useStore } from '../store/store'
import { ClientForm } from './ClientForm'
import { CommandPalette } from './CommandPalette'
import { Banner, Icon, IconButton, cx } from './ui'

const SIDEBAR_KEY = 'mealtrace-ui:sidebar'

function ClientList({ onNavigate }: { onNavigate: () => void }) {
  const clients = useStore((s) => s.clients)
  const id = useLocation().pathname.match(/^\/c\/([^/]+)/)?.[1]
  const nav = useNavigate()
  const q = ''
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const today = todayISO()

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
        <button type="button" onClick={() => window.dispatchEvent(new Event('mealtrace:palette'))} className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-muted hover:border-line-strong">
          <Icon name="search" size={15} />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-line px-1 text-[10px]">⌘K</kbd>
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between px-4">
        <span className="text-[12px] font-medium text-muted">Clients · {list.length}</span>
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
            className={cx('flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5', id === c.id ? 'bg-surface-2 font-medium' : 'hover:bg-surface-2/60', c.archived && 'opacity-60')}
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
      <CommandPalette onNewClient={() => setAdding(true)} />
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
  const isReport = /\/(report|print|family)\//.test(loc.pathname)
  const autoLockMin = useStore((s) => inactivityMinutes(s.settings.autoLockMin))
  const logAudit = useStore((s) => s.logAudit)

  // Sign out after a period without any activity, so an unattended device does not stay open on client records.
  useEffect(() => {
    if (mode !== 'cloud') return
    let last = Date.now()
    let signedOut = false
    const check = () => {
      if (signedOut || Date.now() - last < autoLockMin * 60_000) return signedOut
      signedOut = true
      // Do not let logging or a failed save keep an unattended session open.
      const audit = logAudit('auto-sign-out')
      void Promise.race([audit, new Promise(resolve => window.setTimeout(resolve, 750))]).then(() => signOut(true))
      return true
    }
    const touch = () => {
      if (!check()) last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 1000)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
    }
  }, [mode, autoLockMin, signOut, logAudit])
  useEffect(() => setDrawer(false), [loc.pathname])
  // desktop sidebar can collapse to an icon rail, e.g. to give the Nutrient Explorer the full width.
  // Remembered in this browser only; nothing to do with records.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed' } catch { return false }
  })
  const toggleSidebar = () => setCollapsed((c) => {
    try { localStorage.setItem(SIDEBAR_KEY, c ? 'open' : 'collapsed') } catch { /* private mode: not remembered */ }
    return !c
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    const onToggle = () => toggleSidebar()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mealtrace:sidebar', onToggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mealtrace:sidebar', onToggle)
    }
  }, [])

  if (isReport) return <>{children}</>

  const navItem = ({ isActive }: { isActive: boolean }) => cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px]', isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink')

  const sidebar = (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <img src="./icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-tight font-semibold tracking-tight">Mealtrace</span>
            {practice && <span className="block truncate text-[11.5px] leading-tight text-muted">{practice}</span>}
          </span>
        </NavLink>
        <IconButton icon="x" label="Close menu" className="ml-auto lg:hidden" onClick={() => setDrawer(false)} />
        <IconButton icon="sidebar" label="Collapse sidebar" title="Collapse sidebar (Ctrl or ⌘ + \)" className="ml-auto hidden lg:inline-flex" onClick={toggleSidebar} />
      </div>
      <div className="px-2 pb-2">
        <NavLink to="/" end className={navItem}><Icon name="users" /> All clients</NavLink>
        <NavLink to="/foods" className={navItem}><Icon name="apple" /> Food library</NavLink>
        <NavLink to="/explorer" className={navItem}><Icon name="chart" /> Nutrient Explorer</NavLink>
      </div>
      <ClientList onNavigate={() => setDrawer(false)} />
      <div className="border-t border-line p-2">
        <NavLink to="/settings" className={navItem}><Icon name="settings" /> Settings</NavLink>
        <NavLink to="/privacy" className={navItem}><Icon name="lock" /> Privacy &amp; security</NavLink>
        <div className="mt-1 flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted">
          <Icon name={mode === 'cloud' ? 'cloud' : 'cloudOff'} size={14} className={mode === 'cloud' && synced ? 'text-good-ink' : ''} />
          <span className="min-w-0 flex-1 truncate" title={user?.email}>
            {mode === 'cloud' ? (synced ? `Saved to cloud · ${user?.email}` : 'Not confirmed in cloud · keep this tab open') : 'This browser only'}
          </span>
          {mode === 'cloud' && <button type="button" onClick={() => signOut()} title="Sign out" aria-label="Sign out" className="hover:text-ink"><Icon name="logout" size={14} /></button>}
        </div>
      </div>
    </div>
  )

  const railItem = ({ isActive }: { isActive: boolean }) => cx('flex h-9 w-9 items-center justify-center rounded-lg', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink')
  const rail = (
    <nav className="flex h-full flex-col items-center gap-1 bg-bg py-3" aria-label="Main">
      <button type="button" onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar (Ctrl or ⌘ + \)" className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"><Icon name="sidebar" /></button>
      <NavLink to="/" end className={railItem} aria-label="All clients" title="All clients"><Icon name="users" /></NavLink>
      <NavLink to="/foods" className={railItem} aria-label="Food library" title="Food library"><Icon name="apple" /></NavLink>
      <NavLink to="/explorer" className={railItem} aria-label="Nutrient Explorer" title="Nutrient Explorer"><Icon name="chart" /></NavLink>
      <button type="button" onClick={() => window.dispatchEvent(new Event('mealtrace:palette'))} aria-label="Search" title="Search (⌘K)" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2/60 hover:text-ink"><Icon name="search" /></button>
      <div className="mt-auto flex flex-col items-center gap-1">
        <NavLink to="/settings" className={railItem} aria-label="Settings" title="Settings"><Icon name="settings" /></NavLink>
        <NavLink to="/privacy" className={railItem} aria-label="Privacy & security" title="Privacy & security"><Icon name="lock" /></NavLink>
        <span className="flex h-9 w-9 items-center justify-center" title={mode === 'cloud' ? (synced ? `Saved to cloud · ${user?.email}` : 'Not confirmed in cloud · keep this tab open') : 'This browser only'}><Icon name={mode === 'cloud' ? 'cloud' : 'cloudOff'} size={15} className={mode === 'cloud' && synced ? 'text-good-ink' : 'text-muted'} /></span>
        {mode === 'cloud' && <button type="button" onClick={() => signOut()} aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2/60 hover:text-ink"><Icon name="logout" size={15} /></button>}
      </div>
    </nav>
  )

  return (
    <div className="flex h-full">
      <aside className={cx('hidden shrink-0 border-r border-line lg:block', collapsed ? 'w-14' : 'w-[272px]')}>{collapsed ? rail : sidebar}</aside>
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

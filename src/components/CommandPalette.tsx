import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ageInMonths, formatAge, todayISO } from '../domain/age'
import { useStore } from '../store/store'
import { Icon, cx } from './ui'

interface Command {
  id: string
  label: string
  hint?: string
  icon: string
  run: () => void
}

/** ⌘K / Ctrl+K: jump to any client or page, or start a common task, without touching the mouse. */
export function CommandPalette({ onNewClient }: { onNewClient: () => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const clients = useStore((s) => s.clients)
  const nav = useNavigate()
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQ('')
        setActive(0)
      } else if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => (setOpen(true), setQ(''), setActive(0))
    window.addEventListener('keydown', onKey)
    window.addEventListener('mealtrace:palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mealtrace:palette', onOpen)
    }
  }, [])

  const commands = useMemo(() => {
    const today = todayISO()
    const go = (to: string) => () => nav(to)
    const base: Command[] = [
      { id: 'new', label: 'New client', icon: 'plus', run: onNewClient },
      { id: 'clients', label: 'All clients', icon: 'users', run: go('/') },
      { id: 'foods', label: 'Food library', icon: 'apple', run: go('/foods') },
      { id: 'explorer', label: 'Nutrient Explorer', icon: 'chart', run: go('/explorer') },
      { id: 'settings', label: 'Settings', icon: 'settings', run: go('/settings') },
      { id: 'backup', label: 'Back up records', icon: 'download', run: go('/settings#backup') },
    ]
    const people: Command[] = [...clients]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({ id: c.id, label: c.firstName, hint: `${c.code} · ${formatAge(ageInMonths(c.dob, today))}${c.archived ? ' · archived' : ''}`, icon: 'chevronRight', run: go(`/c/${c.id}`) }))
    const t = q.trim().toLowerCase()
    const all = t ? [...people, ...base] : [...base.slice(0, 3), ...people.slice(0, 6), ...base.slice(3)]
    return t ? all.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(t)) : all
  }, [clients, q, nav, onNewClient])

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null
  const run = (c?: Command) => {
    if (!c) return
    setOpen(false)
    c.run()
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 px-4 pt-[14vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command menu" className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Icon name="search" className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, commands.length - 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
              else if (e.key === 'Enter') (e.preventDefault(), run(commands[active]))
            }}
            placeholder="Go to a client or page…"
            aria-label="Search clients and pages"
            style={{ outline: 'none' }}
            className="h-12 flex-1 bg-transparent text-[15px] placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-muted">esc</kbd>
        </div>
        <ul ref={list} role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5">
          {commands.map((c, i) => (
            <li key={c.id} data-i={i} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onMouseDown={(e) => (e.preventDefault(), run(c))} className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px]', i === active ? 'bg-surface-2' : '')}>
              <Icon name={c.icon} size={15} className="text-muted" />
              <span className="font-medium">{c.label}</span>
              {c.hint && <span className="tnum ml-auto text-[12px] text-muted">{c.hint}</span>}
            </li>
          ))}
          {!commands.length && <li className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  )
}

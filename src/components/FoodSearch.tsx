import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { getFood, groupName, searchFoods } from '../domain/foods'
import { fmt } from '../domain/nutrients'
import type { Food } from '../domain/types'
import { useStore } from '../store/store'
import { Icon, cx } from './ui'

export interface FoodSearchHandle {
  focus(): void
}

function basis(f: Food): string {
  const kcal = typeof f.values.energy === 'number' ? `${fmt(f.values.energy, 0)} kcal` : ''
  if (f.kind === 'supplement') return `per ${f.unit}`
  return kcal ? `${kcal} / ${f.per} ${f.unit}` : `per ${f.per} ${f.unit}`
}

/** Type-ahead food picker. ↑/↓ to move, Enter to choose, Esc to close. Empty box shows favourites and recents. */
export const FoodSearch = forwardRef<FoodSearchHandle, { onPick: (food: Food) => void; onCreate?: (name: string) => void; placeholder?: string; autoFocus?: boolean }>(function FoodSearch(
  { onPick, onCreate, placeholder = 'Add a food or drink…', autoFocus },
  ref,
) {
  const recents = useStore((s) => s.settings.recents)
  const favourites = useStore((s) => s.settings.favourites)
  const foodsVersion = useStore((s) => s.foods)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const pointer = useRef({ x: -1, y: -1 })
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only a real pointer movement may change the highlighted row. Browsers also fire hover events when
  // the list scrolls or re-renders under a stationary pointer, which would silently change what Enter picks.
  const hover = (i: number) => (e: React.MouseEvent) => {
    if (e.clientX === pointer.current.x && e.clientY === pointer.current.y) return
    pointer.current = { x: e.clientX, y: e.clientY }
    setActive(i)
  }
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }))

  const results = useMemo(
    () => searchFoods(q, { recents, favourites, limit: 30 }),
    // foodsVersion: re-run when custom foods change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, recents, favourites, foodsVersion],
  )
  const favSet = useMemo(() => new Set(favourites), [favourites])
  const showCreate = Boolean(onCreate && q.trim().length > 1)
  const total = results.length + (showCreate ? 1 : 0)

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (i: number) => {
    if (i < results.length) {
      const f = getFood(results[i].id)
      if (f) onPick(f)
    } else if (showCreate) onCreate!(q.trim())
    setQ('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" size={15} />
        <input
          ref={input}
          value={q}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            // cancel a pending close from an earlier blur: focus can return here within milliseconds
            if (closeTimer.current) clearTimeout(closeTimer.current)
            // the list opens on click or typing, not on focus alone, so that returning here from the
            // quantity box does not cover the next meal with the recents list
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            closeTimer.current = setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, total - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (total > 0 && (open || q.trim())) choose(Math.min(active, total - 1))
            } else if (e.key === 'Escape') {
              setOpen(false)
              setQ('')
            }
          }}
          className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-sm placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
        />
      </div>
      {open && total > 0 && (
        <ul ref={list} role="listbox" className="scroll-thin absolute right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card">
          {!q.trim() && <li className="px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Favourites &amp; recent</li>}
          {results.map((f, i) => (
            <li
              key={f.id}
              data-i={i}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(i)
              }}
              onMouseMove={hover(i)}
              className={cx('flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5', i === active && 'bg-accent-wash')}
            >
              <span className="min-w-0">
                <span className="text-[13.5px]">
                  {favSet.has(f.id) && <span className="mr-1 text-warning-ink" aria-label="favourite">★</span>}
                  {f.name}
                </span>
                {f.brand && <span className="ml-1.5 text-[12px] text-muted">{f.brand}</span>}
              </span>
              <span className="shrink-0 text-right text-[11.5px] text-muted">
                {groupName(f)} · <span className="tnum">{basis(f)}</span>
              </span>
            </li>
          ))}
          {showCreate && (
            <li
              data-i={results.length}
              role="option"
              aria-selected={active === results.length}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(results.length)
              }}
              onMouseMove={hover(results.length)}
              className={cx('flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-[13px] text-accent-ink', active === results.length && 'bg-accent-wash')}
            >
              <Icon name="plus" size={14} /> Add “{q.trim()}” as a new food from its label
            </li>
          )}
        </ul>
      )}
      {open && total === 0 && q.trim() && <div className="absolute right-0 left-0 z-30 mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-2 shadow-card">No foods match “{q}”.</div>}
    </div>
  )
})

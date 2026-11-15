import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ---------- icons (24px grid, stroke) ----------
const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  x: 'M18 6 6 18M6 6l12 12',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  printer: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.700 3h17a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0z',
  alertCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  star: 'm12 2 3.100 6.300 6.900 1-5 4.900 1.200 6.900L12 17.800l-6.200 3.300L7 14.200 2 9.300l6.900-1z',
  edit: 'M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z',
  cloud: 'M17.500 19a4.500 4.500 0 0 0 .5-9 6 6 0 0 0-11.700 1.500A4 4 0 0 0 7 19z',
  cloudOff: 'M2 2l20 20M5.800 5.800A6 6 0 0 0 6.300 11.500 4 4 0 0 0 7 19h10.500M9.500 4.200A6 6 0 0 1 18 10a4.500 4.500 0 0 1 3.300 7.300',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800',
  apple: 'M12 7c-1.500-2-5-2-6.500 1S5 16 7.500 19c1 1.200 2.500 1.500 4.500.5 2 1 3.500.7 4.500-.5 2.500-3 3.500-8 2-11S13.500 5 12 7zM12 7c0-2 1-3.500 3-4',
  file: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  note: 'M4 4h16v12l-4 4H4zM16 20v-4h4M8 9h8M8 13h5',
  ruler: 'M3 17 17 3l4 4L7 21zM7.500 12.500l2 2M10.500 9.500l2 2M13.500 6.500l2 2',
  minus: 'M5 12h14',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  command: 'M9 9h6v6H9zM9 9V6a3 3 0 1 0-3 3h3M15 9V6a3 3 0 1 1 3 3h-3M9 15v3a3 3 0 1 1-3-3h3M15 15v3a3 3 0 1 0 3-3h-3',
}

export function Icon({ name, size = 16, className, filled }: { name: keyof typeof PATHS | string; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={cx('shrink-0', className)} aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}

// ---------- buttons ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: string }

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-ink text-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:opacity-90',
        variant === 'secondary' && 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'text-critical-ink border border-line-strong bg-surface hover:bg-critical-wash',
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors', className)}>
      <Icon name={icon} />
    </button>
  )
}

// ---------- form controls ----------
/** `w-full` unless the caller sets its own width class (two width utilities on one element would conflict) */
const width = (className?: string) => (className && /(^|\s)(w-|max-w-\[)/.test(className) && /(^|\s)w-/.test(className) ? '' : 'w-full')
const control = 'rounded-lg border border-line bg-surface hover:border-line-strong px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(width(className), control, 'h-9', className)} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(width(className), control, 'h-9 pr-7', className)}>
      {children}
    </select>
  )
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(width(className), control, 'py-2 leading-relaxed', className)} />
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  )
}

/** Textarea that grows with its content. */
export function AutoTextarea({ value, onChange, className, minRows = 2, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { value: string; onChange: (v: string) => void; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 2 + 'px'
  }, [value])
  return <textarea ref={ref} rows={minRows} value={value} onChange={(e) => onChange(e.target.value)} {...rest} className={cx(width(className), control, 'resize-none py-2 leading-relaxed', className)} />
}

// ---------- surfaces ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-xl border border-line bg-surface', className)}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[14px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon name={icon} size={18} />
      </div>
      <div className="font-medium">{title}</div>
      {children && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-card sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', value === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-[12px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={cx('rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors', value === o.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'critical'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx('flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px]', tone === 'info' && 'bg-accent-wash text-ink', tone === 'warning' && 'bg-warning-wash text-ink', tone === 'critical' && 'bg-critical-wash text-ink')}>
      <Icon name={tone === 'info' ? 'info' : 'alert'} className={cx('mt-0.5', tone === 'info' && 'text-accent-ink', tone === 'warning' && 'text-warning-ink', tone === 'critical' && 'text-critical-ink')} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

export function confirmDialog(message: string): boolean {
  return window.confirm(message)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

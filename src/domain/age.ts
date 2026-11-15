/** Parse yyyy-mm-dd as a local date (avoids UTC off-by-one). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Completed months between two dates, with a fractional part for the remaining days. */
export function ageInMonths(dob: string, at: string): number {
  const a = parseDate(dob)
  const b = parseDate(at)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  const anchor = new Date(a.getFullYear(), a.getMonth() + months, a.getDate())
  const days = Math.max(0, (b.getTime() - anchor.getTime()) / 86400000)
  return Math.max(0, months + Math.min(days, 30) / 30.44)
}

export function formatAge(months: number): string {
  const whole = Math.floor(months + 1e-9)
  if (whole < 1) {
    const weeks = Math.floor((months * 30.44) / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'}`
  }
  if (whole < 24) return `${whole} month${whole === 1 ? '' : 's'}`
  const y = Math.floor(whole / 12)
  const m = whole % 12
  return m ? `${y} y ${m} m` : `${y} years`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  if (!iso) return ''
  return parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

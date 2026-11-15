import type { SensoryAnswer, SensoryRow } from './types'

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/\\/g, '').trim()

/**
 * Split a parent's food diary into days using its "Day 1 / Day 2 / Day 3" headings.
 * Text before the first heading (or everything, when there are no headings) goes to the first day.
 */
export function splitDiaryByDay(text: string): { label: string; text: string }[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const days: { label: string; lines: string[] }[] = []
  let current: { label: string; lines: string[] } | null = null
  const preface: string[] = []
  for (const raw of lines) {
    const line = clean(raw)
    const m = /^day\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i.exec(line)
    if (m) {
      const rest = m[2].replace(/[:\s]+$/, '').replace(/^\((.*)\)$/, '$1')
      current = { label: rest ? `Day ${m[1]} · ${rest}`.slice(0, 40) : `Day ${m[1]}`, lines: [] }
      days.push(current)
    } else if (current) current.lines.push(raw.replace(/\*\*/g, '').replace(/\\/g, ''))
    else preface.push(raw)
  }
  const tidy = (ls: string[]) => ls.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!days.length) return [{ label: '', text: tidy(lines) }]
  const out = days.map((d) => ({ label: d.label, text: tidy(d.lines) }))
  const pre = tidy(preface)
  if (pre) out[0].text = `${pre}\n\n${out[0].text}`.trim()
  return out
}

function answerOf(s: string): SensoryAnswer {
  const t = s.trim().toLowerCase()
  if (/^(yes|y\b|yep|yeah)/.test(t)) return 'yes'
  if (/^(no\b|n0\b|n\b|never|not\b|none)/.test(t)) return 'no'
  if (/^(sometimes|occasionally|a bit|rarely|every now)/.test(t)) return 'sometimes'
  return ''
}

/**
 * Turn a completed sensory checklist, pasted as text, into rows.
 * A line in capitals is a section heading; each other line is "statement – answer and comments".
 * Nothing about the checklist itself is built in: the wording comes from the pasted document.
 */
export function parseSensory(text: string): SensoryRow[] {
  const rows: SensoryRow[] = []
  let section = 'General'
  let pending: SensoryRow | null = null
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = clean(raw)
    if (!line) continue
    if (/^(child.?s name|child.?s d\.?o\.?b|date completed|\(comment yes|sensory checklist|\*?questionnaire adapted)/i.test(line)) continue
    const letters = line.replace(/[^A-Za-z]/g, '')
    if (letters.length >= 4 && letters === letters.toUpperCase() && line.length < 40 && !/[–—]|--/.test(line)) {
      section = line.charAt(0) + line.slice(1).toLowerCase()
      pending = null
      continue
    }
    // answer follows the last dash separator (–, —, -- or " - ")
    const m = /^(.*?)(?:\s*(?:–|—|--)\s*|\s+-\s+)([^–—]*)$/.exec(line)
    if (m && m[1].trim().length > 8) {
      const ans = m[2].trim()
      pending = { section, text: m[1].trim().replace(/[.…:]+$/, ''), answer: answerOf(ans), comment: ans }
      rows.push(pending)
    } else if (pending && pending.comment === '' ) {
      // an answer given on the line below its statement
      pending.comment = line.replace(/^[–—-]+\s*/, '')
      pending.answer = answerOf(pending.comment)
    } else {
      // a statement with no answer on the same line
      const tail = /\b(yes|no)\s*$/i.exec(line)
      pending = tail && line.length > 12 ? { section, text: line.slice(0, tail.index).trim(), answer: answerOf(tail[1]), comment: tail[1] } : { section, text: line.replace(/[.…:]+$/, ''), answer: '', comment: '' }
      rows.push(pending)
    }
  }
  // tidy the comment: drop the bare yes/no word when that is all there is
  return rows.map((r) => ({ ...r, comment: /^(yes|no|n0|sometimes)[.!]?$/i.test(r.comment.trim()) ? '' : r.comment.replace(/^(yes|no|sometimes)\s*[,;:.\-–]\s*/i, '').trim() }))
}

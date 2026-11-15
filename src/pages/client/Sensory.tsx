import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, Segmented, Textarea, confirmDialog, cx } from '../../components/ui'
import { formatDate, todayISO } from '../../domain/age'
import { parseSensory } from '../../domain/parse'
import type { Client, SensoryAnswer, SensoryRow } from '../../domain/types'
import { useStore } from '../../store/store'

const ANSWERS: { id: SensoryAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'no', label: 'No' },
  { id: '', label: '–' },
]
const TONE: Record<SensoryAnswer, string> = { yes: 'bg-ink text-surface', sometimes: 'bg-surface-2 text-ink', no: 'text-muted', '': 'text-muted' }

/** The family's completed sensory checklist: pasted in, split into rows, and filtered to what stands out. */
export function Sensory({ client }: { client: Client }) {
  const saveClient = useStore((s) => s.saveClient)
  const rec = client.sensory
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayISO())
  const [view, setView] = useState<'flagged' | 'all'>('flagged')
  const preview = useMemo(() => (text.trim() ? parseSensory(text) : []), [text])

  const setRow = (idx: number, patch: Partial<SensoryRow>) => rec && saveClient({ ...client, sensory: { ...rec, rows: rec.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } })
  const sections = rec ? [...new Set(rec.rows.map((r) => r.section))] : []

  return (
    <div>
      {!rec ? (
        <Card className="px-6 py-8 text-center">
          <div className="font-medium">No sensory checklist yet</div>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-2">Copy the family’s completed sensory questionnaire and paste it in. Each statement becomes a row with its answer, so you can see at a glance what was answered “yes” in each area.</p>
          <Button variant="primary" className="mt-4" onClick={() => setPasting(true)}>Paste completed questionnaire</Button>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">Completed {formatDate(rec.completedOn)} · {rec.rows.filter((r) => r.answer === 'yes').length} yes, {rec.rows.filter((r) => r.answer === 'sometimes').length} sometimes, of {rec.rows.length} statements.</p>
            <Segmented value={view} onChange={setView} options={[{ id: 'flagged', label: 'Yes and sometimes' }, { id: 'all', label: 'All answers' }]} />
            <Button size="sm" onClick={() => setPasting(true)}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => confirmDialog('Remove the sensory checklist from this record?') && saveClient({ ...client, sensory: undefined })}>Remove</Button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {sections.map((sec) => {
              const rows = rec.rows.map((r, i) => ({ r, i })).filter((x) => x.r.section === sec)
              const shown = rows.filter((x) => view === 'all' || x.r.answer === 'yes' || x.r.answer === 'sometimes' || (x.r.answer === '' && x.r.comment))
              const yes = rows.filter((x) => x.r.answer === 'yes').length
              return (
                <Card key={sec} className="p-3.5">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <h3 className="text-[13.5px] font-semibold">{sec}</h3>
                    <span className="tnum text-[12px] text-muted">{yes} yes of {rows.length}</span>
                  </div>
                  {shown.length === 0 ? <p className="text-[12.5px] text-muted">Nothing answered yes or sometimes.</p> : (
                    <ul className="divide-y divide-line">
                      {shown.map(({ r, i }) => (
                        <li key={i} className="flex items-start gap-2.5 py-1.5">
                          <select aria-label={`Answer: ${r.text}`} value={r.answer} onChange={(e) => setRow(i, { answer: e.target.value as SensoryAnswer })} className={cx('mt-0.5 h-6 shrink-0 rounded-full border border-line px-1.5 text-[11.5px] font-medium', TONE[r.answer])}>
                            {ANSWERS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                          </select>
                          <div className="min-w-0 text-[13px]">
                            <div className={r.answer === 'no' ? 'text-ink-2' : ''}>{r.text}</div>
                            {r.comment && <div className="mt-0.5 text-[12.5px] text-ink-2 italic">{r.comment}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted">Answers are read from the pasted text and can be corrected with the selector beside each statement.</p>
        </>
      )}
      {pasting && (
        <Modal wide title="Paste the completed sensory questionnaire" onClose={() => setPasting(false)} footer={<><Button onClick={() => setPasting(false)}>Cancel</Button><Button variant="primary" disabled={!preview.length} onClick={() => (saveClient({ ...client, sensory: { completedOn: date, rows: preview } }), setPasting(false), setText(''))}>Save {preview.length} statements</Button></>}>
          <p className="mb-2 text-[13px] text-ink-2">Select everything in the family’s completed document, copy, and paste here. Headings in capitals become sections; each line is read as “statement – answer”.</p>
          <Field label="Date completed" className="mb-2 w-44"><Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Textarea autoFocus rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'TOUCH\nDislikes messy play – No\n…'} />
          {preview.length > 0 && <p className="mt-2 text-[12.5px] text-ink-2">Read {preview.length} statements in {new Set(preview.map((r) => r.section)).size} sections: {preview.filter((r) => r.answer === 'yes').length} yes, {preview.filter((r) => r.answer === 'sometimes').length} sometimes, {preview.filter((r) => r.answer === 'no').length} no, {preview.filter((r) => r.answer === '').length} to check.</p>}
        </Modal>
      )}
    </div>
  )
}

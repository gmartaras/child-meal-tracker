import { beforeAll, describe, expect, it } from 'vitest'
import { addTotals, boostersFor, gapsOf, snapshotOf, totalsOf, typicalPortion, quickItem } from '../src/domain/explore'
import { getFood, loadCofid } from '../src/domain/foods'
import { redactRecords } from '../src/domain/redact'
import { targetsFor } from '../src/domain/drv'
import { DEFAULT_SETTINGS } from '../src/store/store'
import type { Assessment, Client, Day, Item, Session } from '../src/domain/types'

// Synthetic records only.
beforeAll(loadCofid)

const client: Client = { id: 'c1', code: 'ZZ0101', firstName: 'Test', dob: '2022-01-01', sex: 'F', feeding: 'na', context: 'synthetic context', createdAt: 1, updatedAt: 1 }
const milk = () => quickItem(getFood('c:12-596')!, 300) // whole milk, 300 ml
const day = (items: Item[], complete?: boolean): Day => ({ id: Math.random().toString(36), label: 'Day', complete, meals: [{ id: 'm', name: 'Breakfast', items }] })
const history = (days: Day[], extra: Partial<Assessment> = {}): Assessment => ({ id: 'a1', clientId: 'c1', date: '2026-11-01', type: 'diary', title: 'Food history', days, createdAt: 1, updatedAt: 1, ...extra })

describe('nutrient explorer', () => {
  it('analyses unconfirmed days provisionally until a day is confirmed', () => {
    const draft = history([day([milk()]), day([])])
    const snap = snapshotOf(draft, client, DEFAULT_SETTINGS)!
    expect(snap.provisional).toBe(true)
    expect(snap.days).toBe(1)
    expect(snap.analysis.result.avg.calcium.v).toBeGreaterThan(300)
    const confirmed = history([day([milk()], true), day([milk(), milk()])])
    const s2 = snapshotOf(confirmed, client, DEFAULT_SETTINGS)!
    expect(s2.provisional).toBe(false)
    expect(s2.days).toBe(1)
  })

  it('returns nothing to analyse when no food has an amount', () => {
    expect(snapshotOf(history([day([])]), client, DEFAULT_SETTINGS)).toBeNull()
  })

  it('ranks gaps lowest first and leaves maximums out', () => {
    const targets = targetsFor(58, 'F', 'na')
    const gaps = gapsOf(totalsOf([milk()]), targets, DEFAULT_SETTINGS.panel)
    expect(gaps.length).toBeGreaterThan(5)
    for (let i = 1; i < gaps.length; i++) expect(gaps[i].pct).toBeGreaterThanOrEqual(gaps[i - 1].pct)
    expect(gaps.some((g) => g.id === 'salt')).toBe(false)
    expect(gaps.find((g) => g.id === 'calcium')!.pct).toBeGreaterThan(gaps.find((g) => g.id === 'iron')!.pct)
  })

  it('adds planned foods on top of the baseline', () => {
    const both = addTotals(totalsOf([milk()]), totalsOf([milk()]))
    expect(both.calcium.v).toBeCloseTo(totalsOf([milk()]).calcium.v * 2, 5)
  })

  it('suggests foods rich in the chosen nutrient, accepted foods first, and nothing unsuitable', () => {
    const targets = targetsFor(58, 'F', 'na')
    const r = boostersFor('iron', { ageMonths: 58, target: targets.iron, acceptedIds: ['c:12-596'], limit: 10 })
    expect(r.ideas.length).toBe(10)
    for (let i = 1; i < r.ideas.length; i++) expect(r.ideas[i].value).toBeLessThanOrEqual(r.ideas[i - 1].value)
    expect(r.ideas.every((b) => !/liver|kidney|supplement|formula|powder/i.test(b.food.name))).toBe(true)
    expect(r.ideas.every((b) => b.food.kind === 'food')).toBe(true)
    expect(r.accepted.every((b) => b.accepted)).toBe(true)
  })

  it('gives a child-sized portion', () => {
    const p = typicalPortion(getFood('c:12-596')!, 36)
    expect(p.amount).toBeGreaterThan(0)
    expect(p.amount).toBeLessThanOrEqual(400)
  })
})

describe('privacy reset', () => {
  const session: Session = { id: 's1', clientId: 'c1', date: '2026-10-01', note: 'free text', sections: { concerns: 'synthetic concern', actions: 'try x' }, weightKg: 15, createdAt: 1, updatedAt: 1 }
  const finalised = () => history([day([milk()], true)], { id: 'f1', state: 'finalised', note: 'synthetic', snapshot: { client, analysis: {} as never, settings: DEFAULT_SETTINGS, finalisedAt: '', calculatorVersion: '' } })
  const draft = () => history([{ ...day([milk()]), source: 'pasted diary' }], { id: 'd1', note: 'note', parentNote: 'for parents' })
  const full: Client = { ...client, folderUrl: 'https://drive.google.com/drive/folders/x', resources: [{ id: 'r', category: 'Food diary', title: 't', url: 'u', text: 'doc text' }], sensory: { completedOn: '2026-01-01', rows: [{ section: 'Touch', text: 's', answer: 'yes', comment: 'synthetic comment' }] }, acceptedFoods: [{ id: 'f', name: 'Milk', group: 2, addedOn: '2026-01-01', foodId: 'c:12-596', note: 'n' }], plan: { intro: '', cells: [], chains: [], updatedAt: 1 } }

  it('keeps the code and analysis data, removes names, notes and links', () => {
    const r = redactRecords([full], [session], [draft(), finalised()])
    const c = r.clients[0]
    expect(c.firstName).toBe('ZZ0101')
    expect(c.context).toBe('')
    expect(c.folderUrl).toBeUndefined()
    expect(c.resources).toBeUndefined()
    expect(c.sensory!.rows[0]).toMatchObject({ answer: 'yes', comment: '' })
    expect(c.acceptedFoods![0]).toMatchObject({ name: 'Milk', foodId: 'c:12-596' })
    expect(c.acceptedFoods![0].note).toBeUndefined()
    expect(c.dob).toBe(client.dob)
    expect(c.plan).toBeDefined()
    expect(r.sessions[0]).toMatchObject({ note: '', sections: {}, weightKg: 15, date: '2026-10-01' })
    expect(r.assessments[0].note).toBe('')
    expect(r.assessments[0].parentNote).toBe('')
    expect(r.assessments[0].days[0].source).toBeUndefined()
    expect(r.assessments[0].days[0].meals[0].items).toHaveLength(1)
    expect(r.locked.map((a) => a.id)).toEqual(['f1'])
  })

  it('changes nothing that is already clean', () => {
    const clean: Client = { ...client, firstName: client.code, context: '' }
    const r = redactRecords([clean], [{ ...session, note: '', sections: {} }], [history([day([milk()])])])
    expect(r.clients).toHaveLength(0)
    expect(r.sessions).toHaveLength(0)
    expect(r.assessments).toHaveLength(0)
  })
})

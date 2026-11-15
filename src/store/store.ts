import { create } from 'zustand'
import { uid } from '../domain/age'
import { setCustomFoods } from '../domain/foods'
import { CORE_IDS } from '../domain/nutrients'
import type { Assessment, Client, CustomFood, Session, Settings } from '../domain/types'
import { COLLS, createBackend, type AuthUser, type Backend, type Coll, type Doc } from './backend'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  practiceName: '',
  practitioner: '',
  panel: [...CORE_IDS],
  // Default breast-milk volume assumptions; review in Settings before relying on them.
  bm: { perFeedYounger: 135, perFeedOlder: 100, olderFromMonths: 8, exclusiveDay: 780, mainMilkDay: 600, density: 1.03 },
  measures: {},
  recents: [],
  favourites: [],
  nextClientNo: 1,
  updatedAt: 0,
}

/** Editable starting points, created once. Composition as published for the product; check before use. */
const SEED_FOODS: CustomFood[] = [
  {
    id: 'seed-healthy-start',
    name: 'Healthy Start children’s vitamin drops',
    kind: 'supplement',
    per: 1,
    unit: 'daily dose (5 drops)',
    values: { vita: 233, vitc: 20, vitd: 10 },
    notes: 'Daily dose of 5 drops: vitamin A 233 µg, vitamin C 20 mg, vitamin D3 10 µg. Check against the current product label.',
    updatedAt: 0,
  },
  { id: 'seed-vitd-10', name: 'Vitamin D supplement 10 µg', kind: 'supplement', per: 1, unit: 'dose', values: { vitd: 10 }, updatedAt: 0 },
  { id: 'seed-vitd-8-5', name: 'Vitamin D supplement 8.5 µg', kind: 'supplement', per: 1, unit: 'dose', values: { vitd: 8.5 }, updatedAt: 0 },
]

export interface Backup {
  app: 'mealtrace'
  version: 1
  exportedAt: string
  clients: Client[]
  sessions: Session[]
  assessments: Assessment[]
  foods: CustomFood[]
  settings: Settings
}

interface State {
  phase: 'loading' | 'signin' | 'ready'
  mode: 'local' | 'cloud'
  user: AuthUser | null
  error: string | null
  synced: boolean
  clients: Client[]
  sessions: Session[]
  assessments: Assessment[]
  foods: CustomFood[]
  settings: Settings
  init(): Promise<void>
  signIn(): Promise<void>
  signOut(): Promise<void>
  saveClient(c: Partial<Client> & { firstName: string; dob: string }): Client
  deleteClient(id: string): void
  saveSession(s: Partial<Session> & { clientId: string; date: string }): Session
  deleteSession(id: string): void
  saveAssessment(a: Assessment): void
  deleteAssessment(id: string): void
  saveFood(f: Partial<CustomFood> & { name: string }): CustomFood
  deleteFood(id: string): void
  updateSettings(patch: Partial<Settings>): void
  touchRecent(foodId: string): void
  exportBackup(): Backup
  importBackup(b: Backup): number
  clearError(): void
}

let backend: Backend | null = null
let unsubs: (() => void)[] = []

export const useStore = create<State>((set, get) => {
  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(e)
    set({ error: /permission|insufficient/i.test(msg) ? 'Cloud storage refused the request. Check that you are signed in with the authorised Google account.' : msg })
  }
  const put = <T extends Doc>(coll: Coll, doc: T) => {
    backend?.put(coll, doc).catch(fail)
  }
  const del = (coll: Coll, id: string) => {
    backend?.remove(coll, id).catch(fail)
  }

  const startWatching = () => {
    unsubs.forEach((u) => u())
    unsubs = []
    const loaded = new Set<Coll>()
    const confirmed = new Set<Coll>()
    const maybeReady = () => {
      if (loaded.size === COLLS.length && get().phase !== 'ready') set({ phase: 'ready' })
      set({ synced: confirmed.size === COLLS.length })
      // create the starter supplements once the server has confirmed there are no settings yet
      if (confirmed.has('meta') && confirmed.has('foods') && !get().settings.seeded) {
        const existing = new Set(get().foods.map((f) => f.id))
        for (const f of SEED_FOODS) if (!existing.has(f.id)) put('foods', { ...f, updatedAt: Date.now() })
        get().updateSettings({ seeded: true })
      }
    }
    for (const coll of COLLS) {
      unsubs.push(
        backend!.watch(
          coll,
          (docs, fromCache) => {
            if (coll === 'meta') {
              const s = docs.find((d) => d.id === 'settings') as unknown as Settings | undefined
              set({ settings: { ...DEFAULT_SETTINGS, ...(s ?? {}), bm: { ...DEFAULT_SETTINGS.bm, ...(s?.bm ?? {}) } } })
            } else if (coll === 'foods') {
              const foods = docs as unknown as CustomFood[]
              setCustomFoods(foods)
              set({ foods: [...foods].sort((a, b) => a.name.localeCompare(b.name)) })
            } else {
              set({ [coll]: docs } as unknown as Partial<State>)
            }
            loaded.add(coll)
            if (!fromCache) confirmed.add(coll)
            maybeReady()
          },
          fail,
        ),
      )
    }
  }

  return {
    phase: 'loading',
    mode: 'local',
    user: null,
    error: null,
    synced: false,
    clients: [],
    sessions: [],
    assessments: [],
    foods: [],
    settings: DEFAULT_SETTINGS,

    async init() {
      if (backend) return
      try {
        backend = await createBackend()
      } catch (e) {
        fail(e)
        return
      }
      set({ mode: backend.mode })
      backend.onAuth((user) => {
        if (user) {
          set({ user, phase: 'loading' })
          startWatching()
        } else {
          unsubs.forEach((u) => u())
          unsubs = []
          set({ user: null, phase: 'signin', clients: [], sessions: [], assessments: [], foods: [], settings: DEFAULT_SETTINGS })
        }
      })
    },
    async signIn() {
      try {
        await backend?.signIn()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!/popup-closed|cancelled-popup/.test(msg)) fail(e)
      }
    },
    async signOut() {
      await backend?.signOut()
    },

    saveClient(c) {
      const now = Date.now()
      const s = get().settings
      const existing = c.id ? get().clients.find((x) => x.id === c.id) : undefined
      let code = c.code ?? existing?.code
      if (!code) {
        code = 'C-' + String(s.nextClientNo).padStart(3, '0')
        get().updateSettings({ nextClientNo: s.nextClientNo + 1 })
      }
      const doc: Client = {
        sex: 'F',
        feeding: 'na',
        context: '',
        createdAt: now,
        ...existing,
        ...c,
        id: c.id ?? uid(),
        code,
        updatedAt: now,
      }
      put('clients', doc)
      return doc
    },
    deleteClient(id) {
      for (const a of get().assessments.filter((x) => x.clientId === id)) del('assessments', a.id)
      for (const s of get().sessions.filter((x) => x.clientId === id)) del('sessions', s.id)
      del('clients', id)
    },
    saveSession(sess) {
      const now = Date.now()
      const existing = sess.id ? get().sessions.find((x) => x.id === sess.id) : undefined
      const doc: Session = { note: '', createdAt: now, ...existing, ...sess, id: sess.id ?? uid(), updatedAt: now }
      put('sessions', doc)
      return doc
    },
    deleteSession(id) {
      del('sessions', id)
    },
    saveAssessment(a) {
      put('assessments', { ...a, updatedAt: Date.now() })
    },
    deleteAssessment(id) {
      del('assessments', id)
    },
    saveFood(f) {
      const existing = f.id ? get().foods.find((x) => x.id === f.id) : undefined
      const doc: CustomFood = { kind: 'food', per: 100, unit: 'g', values: {}, ...existing, ...f, id: f.id ?? uid(), updatedAt: Date.now() }
      put('foods', doc)
      return doc
    },
    deleteFood(id) {
      del('foods', id)
    },
    updateSettings(patch) {
      const next = { ...get().settings, ...patch, id: 'settings' as const, updatedAt: Date.now() }
      set({ settings: next })
      put('meta', next)
    },
    touchRecent(foodId) {
      const r = [foodId, ...get().settings.recents.filter((x) => x !== foodId)].slice(0, 30)
      get().updateSettings({ recents: r })
    },
    exportBackup() {
      const { clients, sessions, assessments, foods, settings } = get()
      return { app: 'mealtrace', version: 1, exportedAt: new Date().toISOString(), clients, sessions, assessments, foods, settings }
    },
    importBackup(b) {
      if (b?.app !== 'mealtrace' || !Array.isArray(b.clients)) throw new Error('This file is not a Mealtrace backup.')
      let n = 0
      for (const c of b.clients) (put('clients', c), n++)
      for (const s of b.sessions ?? []) (put('sessions', s), n++)
      for (const a of b.assessments ?? []) (put('assessments', a), n++)
      for (const f of b.foods ?? []) (put('foods', f), n++)
      if (b.settings) put('meta', { ...b.settings, id: 'settings', lastBackupAt: get().settings.lastBackupAt })
      return n
    },
    clearError() {
      set({ error: null })
    },
  }
})

import { validateBackup } from '../domain/backupValidation'
import { create } from 'zustand'
import { uid } from '../domain/age'
import { setCustomFoods } from '../domain/foods'
import { CORE_IDS } from '../domain/nutrients'
import { DEFAULT_CHECKLIST, MEAL_NAMES, type Assessment, type Client, type CustomFood, type Session, type Settings } from '../domain/types'
import { COLLS, createBackend, type AuthUser, type Backend, type Coll, type Doc } from './backend'

export const MAX_INACTIVITY_MINUTES = 30

export function inactivityMinutes(value: number | undefined): number {
  return value && Number.isFinite(value) && value >= 1
    ? Math.min(MAX_INACTIVITY_MINUTES, Math.floor(value))
    : MAX_INACTIVITY_MINUTES
}

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
  mealNames: [...MEAL_NAMES],
  checklist: [...DEFAULT_CHECKLIST],
  autoLockMin: MAX_INACTIVITY_MINUTES,
  retentionAge: 25,
  updatedAt: 0,
}

export interface AuditEntry {
  id: string
  at: number
  action: 'sign-in' | 'export' | 'erase' | 'backup' | 'restore' | 'auto-sign-out'
}

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
  pendingWrites: number
  clients: Client[]
  sessions: Session[]
  assessments: Assessment[]
  foods: CustomFood[]
  audit: AuditEntry[]
  settings: Settings
  /** append to the access log: who exported, erased or restored what, and when (no clinical content) */
  logAudit(action: AuditEntry['action']): Promise<void>
  init(): Promise<void>
  signIn(): Promise<void>
  signOut(automatic?: boolean): Promise<void>
  saveClient(c: Partial<Client> & { firstName: string; dob: string }): Client
  /** Change some fields of a client. Patches are applied one after another on top of the latest saved record, so quick successive edits never overwrite each other. */
  /** Pass a function when the change depends on current values (e.g. toggling one checklist item):
   *  it runs on the latest saved copy, after any earlier queued saves, so rapid edits are not lost. */
  patchClient(id: string, patch: Partial<Client> | ((latest: Client) => Partial<Client>)): Promise<boolean>
  saveContext(id: string, value: string, previous: string): Promise<void>
  saveResources(client: Client, resources: NonNullable<Client["resources"]>): Promise<boolean>
  deleteClient(id: string): Promise<boolean>
  saveSession(s: Partial<Session> & { clientId: string; date: string }): Promise<boolean>
  deleteSession(id: string): void
  saveAssessment(a: Assessment): Promise<boolean>
  deleteAssessment(id: string): void
  saveFood(f: Partial<CustomFood> & { name: string }): Promise<CustomFood | null>
  deleteFood(id: string): void
  updateSettings(patch: Partial<Settings>): void
  touchRecent(foodId: string): void
  exportBackup(): Backup
  importBackup(b: Backup): Promise<number>
  clearError(): void
}

const REQUIRED = COLLS.filter((c) => c !== 'audit')
const clientQueue = new Map<string, Promise<boolean>>()
const lastClient = new Map<string, Client>()
let backend: Backend | null = null
let unsubs: (() => void)[] = []

export const useStore = create<State>((set, get) => {
  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Storage operation failed')
    set({ error: /permission|insufficient/i.test(msg) ? 'Cloud storage refused the request. Check that you are signed in with the authorised Google account.' : msg })
  }
  const put = async <T extends Doc>(coll: Coll, doc: T, expected?: number): Promise<boolean> => {
    set({ pendingWrites: get().pendingWrites + 1 })
    try {
      if (!backend) throw new Error('Storage not ready')
      await backend.put(coll, doc, expected)
      return true
    } catch (e) { fail(e); return false }
    finally { set({ pendingWrites: get().pendingWrites - 1 }) }
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
      // the access log is optional: where the database rules do not allow it, the app still loads and saves
      if (loaded.size === REQUIRED.length && get().phase !== 'ready') set({ phase: 'ready' })
      set({ synced: confirmed.size === REQUIRED.length })
      // create the starter supplements once the server has confirmed there are no settings yet
      if (confirmed.has('meta') && confirmed.has('foods') && !get().settings.seeded) {
        // No automatic unverified product seeding. Add products from checked labels.
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
            } else if (coll === 'audit') {
              set({ audit: (docs as unknown as AuditEntry[]).sort((a, b) => b.at - a.at) })
            } else if (coll === 'foods') {
              const foods = docs as unknown as CustomFood[]
              setCustomFoods(foods)
              set({ foods: [...foods].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) })
            } else {
              set({ [coll]: docs } as unknown as Partial<State>)
            }
            if (coll !== 'audit') {
              loaded.add(coll)
              if (!fromCache) confirmed.add(coll)
              else confirmed.delete(coll)
            }
            maybeReady()
          },
          coll === 'audit' ? (e) => console.info('Access log unavailable:', e.message) : fail,
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
    pendingWrites: 0,
    clients: [],
    sessions: [],
    assessments: [],
    foods: [],
    audit: [],
    settings: DEFAULT_SETTINGS,

    async logAudit(action) {
      if (backend?.mode !== 'cloud') return
      const entry: AuditEntry = { id: uid(), at: Date.now(), action }
      await backend.put('audit', entry).catch(() => {})
    },

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
          void get().logAudit('sign-in')
        } else {
          unsubs.forEach((u) => u())
          unsubs = []
          set({ user: null, phase: 'signin', clients: [], sessions: [], assessments: [], foods: [], audit: [], settings: DEFAULT_SETTINGS })
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
    async signOut(automatic = false) {
      if (!automatic && (get().pendingWrites || get().error)) {fail(new Error("Resolve pending or failed saves before signing out.")); return}
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
        sex: '',
        feeding: 'na',
        context: '',
        createdAt: now,
        ...existing,
        ...c,
        id: c.id ?? uid(),
        code,
        updatedAt: now,
      }
      void put('clients', doc, existing?.updatedAt)
      return doc
    },
    patchClient(id, patch) {
      const run = async (): Promise<boolean> => {
        const base = lastClient.get(id) ?? get().clients.find((c) => c.id === id)
        if (!base) return false
        // the store copy wins if it is newer than our last write (e.g. a context save or another device)
        const stored = get().clients.find((c) => c.id === id)
        const latest = stored && stored.updatedAt > base.updatedAt ? stored : base
        const changes = typeof patch === 'function' ? patch(latest) : patch
        const doc: Client = { ...latest, ...changes, id, updatedAt: Math.max(Date.now(), latest.updatedAt + 1) }
        const ok = await put('clients', doc, latest.updatedAt)
        if (ok) lastClient.set(id, doc)
        else lastClient.delete(id)
        return ok
      }
      const next = (clientQueue.get(id) ?? Promise.resolve(true)).then(run, run)
      clientQueue.set(id, next)
      return next
    },
    async saveResources(client, resources) {
      const doc = {...client, resources, updatedAt: Math.max(Date.now(), client.updatedAt + 1)}
      return put("clients", doc, client.updatedAt)
    },
    async saveContext(id, value, previous) {
      set({ pendingWrites: get().pendingWrites + 1 })
      try {
        if (!backend) throw new Error('Storage is not ready. Try again shortly.')
        await backend.saveContext(id, value, previous)
      } finally {
        set({ pendingWrites: get().pendingWrites - 1 })
      }
    },
    async deleteClient(id) {
      set({ pendingWrites: get().pendingWrites + 1 })
      try {
        if (!backend) throw new Error('Storage not ready')
        await clientQueue.get(id)
        await backend.removeClient(id)
        return true
      } catch (e) {
        fail(e)
        return false
      } finally {
        set({ pendingWrites: get().pendingWrites - 1 })
      }
    },
    async saveSession(sess) {
      const now = Date.now()
      const existing = sess.id ? get().sessions.find((x) => x.id === sess.id) : undefined
      const doc: Session = { note: '', createdAt: now, ...existing, ...sess, id: sess.id ?? uid(), updatedAt: now }
      return put('sessions', doc, existing?.updatedAt)
    },
    deleteSession(id) {
      del('sessions', id)
    },
    async saveAssessment(a) {
      if (get().assessments.find(x => x.id === a.id)?.state === 'finalised') {
        fail(new Error('Finalised assessments are immutable. Create an amendment.'))
        return false
      }
      const stamp = Math.max(Date.now(), a.updatedAt + 1)
      const ok = await put('assessments', { ...a, updatedAt: stamp }, get().assessments.some(x => x.id === a.id) ? a.updatedAt : undefined)
      if (ok) a.updatedAt = stamp
      return ok
    },
    deleteAssessment(id) {
      del('assessments', id)
    },
    async saveFood(f) {
      const existing = f.id ? get().foods.find((x) => x.id === f.id) : undefined
      const doc: CustomFood = { kind: 'food', per: 100, unit: 'g', values: {}, ...existing, ...f, id: f.id ?? uid(), updatedAt: Date.now() }
      return await put('foods', doc, existing?.updatedAt) ? doc : null
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
    async importBackup(b) {
      validateBackup(b)
      if (b?.app !== 'mealtrace' || !Array.isArray(b.clients)) throw new Error('This file is not a Mealtrace backup.')
      if (b.version !== 1) throw new Error('Unsupported backup version')
      const groups = [['clients', b.clients], ['sessions', b.sessions], ['assessments', b.assessments], ['foods', b.foods]] as const
      for (const [coll, records] of groups) {
        if (!Array.isArray(records)) throw new Error(`Invalid ${coll} collection`)
        const ids = new Set<string>()
        for (const row of records) {
          if (!row || typeof row.id !== 'string' || !row.id || row.id.includes('/') || ids.has(row.id)) throw new Error(`Invalid or duplicate ID in ${coll}`)
          ids.add(row.id)
          if (coll === 'assessments' && !Array.isArray((row as Assessment).days)) throw new Error('Invalid assessment')
        }
      }
      let n = 0
      for (const [coll, records] of groups) for (const row of records) {
        if (!await put(coll, row)) throw new Error(`Restore stopped after ${n} records. Review errors before retrying.`)
        n++
      }
      if (b.settings && !await put('meta', { ...b.settings, id: 'settings' })) throw new Error('Records restored but settings failed')
      return n
    },
    clearError() {
      set({ error: null })
    },
  }
})

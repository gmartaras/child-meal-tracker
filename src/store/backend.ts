/**
 * Storage backends.
 *  - cloud: Firebase Auth (Google sign-in) + Firestore, used when firebase.config.json is filled in.
 *  - local: this browser's localStorage only. A try-it-out mode; data is NOT backed up or synced.
 */
import firebaseConfig from '../../firebase.config.json'

export type Coll = 'clients' | 'sessions' | 'assessments' | 'foods' | 'meta' | 'audit'
export const COLLS: Coll[] = ['clients', 'sessions', 'assessments', 'foods', 'meta', 'audit']

export interface Doc {
  id: string
  updatedAt?: number
  state?: string
}

export interface AuthUser {
  uid: string
  email: string
  name: string
}

export interface Backend {
  mode: 'local' | 'cloud'
  /** Calls back with the signed-in user, or null when signed out. */
  onAuth(cb: (user: AuthUser | null) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>
  /** Live view of a collection. `fromCache` is true until the server has confirmed the data. */
  watch(coll: Coll, cb: (docs: Doc[], fromCache: boolean) => void, onError: (e: Error) => void): () => void
  put(coll: Coll, doc: Doc, expected?: number): Promise<void>
  saveContext(id: string, value: string, previous: string): Promise<void>
  remove(coll: Coll, id: string): Promise<void>
}

const cfg = firebaseConfig as Record<string, string>
export const cloudConfigured = Boolean(cfg.apiKey && cfg.projectId)

// ---------------- local ----------------

const KEY = (c: Coll) => `mealtrace:${c}`

function readLocal(c: Coll): Doc[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(c)) ?? '[]') as Doc[]
  } catch {
    return []
  }
}

function localBackend(): Backend {
  const listeners: Record<string, Set<(docs: Doc[], fromCache: boolean) => void>> = {}
  const emit = (c: Coll) => listeners[c]?.forEach((cb) => cb(readLocal(c), false))
  window.addEventListener('storage', (e) => {
    const c = COLLS.find((x) => KEY(x) === e.key)
    if (c) emit(c)
  })
  return {
    mode: 'local',
    onAuth(cb) {
      cb({ uid: 'local', email: '', name: 'This browser' })
      return () => {}
    },
    async signIn() {},
    async signOut() {},
    watch(coll, cb) {
      ;(listeners[coll] ??= new Set()).add(cb)
      cb(readLocal(coll), false)
      return () => listeners[coll].delete(cb)
    },
    async put(coll, doc, expected) {
      const docs = readLocal(coll)
      const i = docs.findIndex((d) => d.id === doc.id)
      if (i >= 0 && docs[i].state === "finalised") throw new Error("Finalised record is immutable")
      if (i >= 0 && expected !== undefined && docs[i].updatedAt !== expected) throw new Error("Record changed elsewhere. Reload before retrying.")
      if (i >= 0) docs[i] = doc
      else docs.push(doc)
      localStorage.setItem(KEY(coll), JSON.stringify(docs))
      emit(coll)
    },
    async saveContext(id, value, previous) {
      const docs = readLocal('clients')
      const current = docs.find((doc) => doc.id === id) as (Doc & { context?: string }) | undefined
      if (!current) throw new Error('This client record no longer exists.')
      if ((current.context ?? '') !== previous && current.context !== value) {
        throw new Error('Key context changed in another tab or device. Copy your text before reloading.')
      }
      const next = { ...current, context: value, updatedAt: Math.max(Date.now(), (current.updatedAt ?? 0) + 1) }
      localStorage.setItem(KEY('clients'), JSON.stringify(docs.map((doc) => doc.id === id ? next : doc)))
      emit('clients')
    },
    async remove(coll, id) {
      if (readLocal(coll).find(d => d.id === id)?.state === "finalised") throw new Error("Finalised record is immutable")
      localStorage.setItem(KEY(coll), JSON.stringify(readLocal(coll).filter((d) => d.id !== id)))
      emit(coll)
    },
  }
}

// ---------------- cloud (Firebase) ----------------

async function cloudBackend(): Promise<Backend> {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const app = initializeApp(cfg)
  const a = auth.getAuth(app)
  // Records are held in memory only: nothing is written to this device's disk, and closing the tab clears them.
  const db = fs.initializeFirestore(app, {
    localCache: fs.memoryLocalCache(),
    ignoreUndefinedProperties: true,
  })
  const path = (coll: Coll) => {
    const uid = a.currentUser?.uid
    if (!uid) throw new Error('Not signed in')
    // every document lives under the signed-in user's own namespace (see firestore.rules)
    return fs.collection(db, 'users', uid, coll)
  }
  return {
    mode: 'cloud',
    onAuth(cb) {
      return auth.onAuthStateChanged(a, (u) =>
        cb(u ? { uid: u.uid, email: u.email ?? '', name: u.displayName ?? u.email ?? '' } : null),
      )
    },
    async signIn() {
      const provider = new auth.GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await auth.signInWithPopup(a, provider)
    },
    async signOut() {
      await auth.signOut(a)
      // drop the in-memory records and start clean
      try {
        await fs.terminate(db)
      } catch (e) {
        console.warn('Could not end the database session cleanly', e)
      }
      window.location.reload()
    },
    watch(coll, cb, onError) {
      return fs.onSnapshot(
        path(coll),
        { includeMetadataChanges: true },
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Doc), id: d.id })), snap.metadata.fromCache || snap.metadata.hasPendingWrites),
        (e) => onError(e),
      )
    },
    async put(coll, doc, expected) {
      // resolves once the server confirms; offline it stays pending while Firestore queues the write
      const ref = fs.doc(path(coll), doc.id)
      await fs.runTransaction(db, async tx => {
        const current = await tx.get(ref)
        if (current.exists() && current.data().state === 'finalised') throw new Error('Finalised record is immutable')
        if (current.exists() && expected !== undefined && current.data().updatedAt !== expected) throw new Error('Record changed elsewhere. Reload before retrying.')
        tx.set(ref, doc)
      })
    },
    async saveContext(id, value, previous) {
      const ref = fs.doc(path('clients'), id)
      await fs.runTransaction(db, async (transaction) => {
        const current = (await transaction.get(ref)).data()
        if (!current) throw new Error('This client record no longer exists.')
        if ((current.context ?? '') !== previous && current.context !== value) {
          throw new Error('Key context changed in another tab or device. Copy your text before reloading.')
        }
        transaction.update(ref, { context: value, updatedAt: Math.max(Date.now(), (current.updatedAt ?? 0) + 1) })
      })
    },
    async remove(coll, id) {
      await fs.deleteDoc(fs.doc(path(coll), id))
    },
  }
}

export async function createBackend(): Promise<Backend> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1') return localBackend()
  if (!cloudConfigured) throw new Error('Firebase configuration missing.')
  return cloudBackend()
}

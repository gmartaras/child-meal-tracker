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
  put(coll: Coll, doc: Doc): Promise<void>
  remove(coll: Coll, id: string): Promise<void>
}

const cfg = firebaseConfig as Record<string, string>
export const cloudConfigured = Boolean(cfg.apiKey && cfg.projectId)

/** On a shared or borrowed device, keep nothing on disk: records are held in memory only while the app is open. */
const NO_CACHE_KEY = 'mealtrace:no-offline-copy'
export const offlineCopyDisabled = () => {
  try {
    return localStorage.getItem(NO_CACHE_KEY) === '1'
  } catch {
    return false
  }
}
export const setOfflineCopyDisabled = (off: boolean) => {
  try {
    if (off) localStorage.setItem(NO_CACHE_KEY, '1')
    else localStorage.removeItem(NO_CACHE_KEY)
  } catch {
    /* storage unavailable */
  }
}

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
    async put(coll, doc) {
      const docs = readLocal(coll)
      const i = docs.findIndex((d) => d.id === doc.id)
      if (i >= 0) docs[i] = doc
      else docs.push(doc)
      localStorage.setItem(KEY(coll), JSON.stringify(docs))
      emit(coll)
    },
    async remove(coll, id) {
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
  // Offline copy: the app keeps working without signal and syncs when back online.
  // It is switched off on shared devices and wiped on sign-out (see signOut below).
  const persistent = !offlineCopyDisabled()
  const db = fs.initializeFirestore(app, {
    localCache: persistent ? fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) : fs.memoryLocalCache(),
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
      // remove the offline copy of client records from this device, then start clean
      try {
        await fs.terminate(db)
        if (persistent) await fs.clearIndexedDbPersistence(db)
      } catch (e) {
        console.warn('Could not clear the offline copy', e)
      }
      window.location.reload()
    },
    watch(coll, cb, onError) {
      return fs.onSnapshot(
        path(coll),
        { includeMetadataChanges: true },
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Doc), id: d.id })), snap.metadata.fromCache),
        (e) => onError(e),
      )
    },
    async put(coll, doc) {
      // resolves once the server confirms; offline it stays pending while Firestore queues the write
      await fs.setDoc(fs.doc(path(coll), doc.id), doc)
    },
    async remove(coll, id) {
      await fs.deleteDoc(fs.doc(path(coll), id))
    },
  }
}

export async function createBackend(): Promise<Backend> {
  return cloudConfigured ? cloudBackend() : localBackend()
}

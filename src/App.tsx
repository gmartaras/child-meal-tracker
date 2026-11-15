import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Button } from './components/ui'
import { loadCofid } from './domain/foods'
import AssessmentPage from './pages/AssessmentPage'
import ClientPage from './pages/ClientPage'
import FamilyPage from './pages/FamilyPage'
import LibraryPage from './pages/LibraryPage'
import HomePage from './pages/HomePage'
import PrintDocPage from './pages/PrintDocPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import { useStore } from './store/store'

/** Remount the editor when moving between food histories (e.g. to an amendment) so no draft state carries over. */
function AssessmentRoute() {
  const { aid } = useParams()
  return <AssessmentPage key={aid} />
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="./icon.svg" alt="" className="h-14 w-14 rounded-2xl" />
      {children}
    </div>
  )
}

export default function App() {
  const phase = useStore((s) => s.phase)
  const error = useStore((s) => s.error)
  const init = useStore((s) => s.init)
  const signIn = useStore((s) => s.signIn)
  const [foodsReady, setFoodsReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadCofid().then(() => setFoodsReady(true))
    void init()
  }, [init])

  if (phase === 'signin') {
    return (
      <Splash>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mealtrace</h1>
          <p className="mt-1 max-w-xs text-[13.5px] text-ink-2">Sign in with your Google account to open your client records.</p>
        </div>
        <Button variant="primary" disabled={busy} onClick={async () => (setBusy(true), await signIn(), setBusy(false))}>{busy ? 'Opening Google…' : 'Sign in with Google'}</Button>
        {error && <p className="max-w-sm text-[13px] text-critical-ink" role="alert">{error}</p>}
      </Splash>
    )
  }
  if (phase !== 'ready' || !foodsReady) {
    return (
      <Splash>
        <p className="text-[13.5px] text-ink-2" role="status">{error ?? 'Loading your records…'}</p>
      </Splash>
    )
  }
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:id" element={<ClientPage />} />
          <Route path="/c/:id/a/:aid" element={<AssessmentRoute />} />
          <Route path="/c/:id/family/:aid" element={<FamilyPage />} />
          <Route path="/recipes" element={<Navigate to="/foods" replace />} />
          <Route path="/c/:id/report/:aid/:kind" element={<ReportPage />} />
          <Route path="/c/:id/print/:doc" element={<PrintDocPage />} />
          <Route path="/foods" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

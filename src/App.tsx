import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Button } from './components/ui'
import { loadCofid } from './domain/foods'
import AssessmentPage from './pages/AssessmentPage'
import ClientPage from './pages/ClientPage'
import FoodsPage from './pages/FoodsPage'
import HomePage from './pages/HomePage'
import ReportPage from './pages/ReportPage'
import RecipePage from './pages/RecipePage'
import FamilyPage from './pages/FamilyPage'
import SettingsPage from './pages/SettingsPage'
import { useStore } from './store/store'

function AssessmentRoute() { const { aid } = useParams(); return <AssessmentPage key={aid} /> }

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="workspace-hero flex w-full max-w-md flex-col items-start gap-5 rounded-2xl border border-line p-7 sm:p-10">
        <img src="./icon.svg" alt="" className="size-12 rounded-xl" />
        {children}
      </div>
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
          <h1 className="page-title text-3xl font-semibold">Mealtrace</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-2">Sign in with your Google account to open your client records.</p>
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
      <Routes><Route path="/c/:id/family/:aid" element={<FamilyPage />} /><Route path="*" element={<Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:id" element={<ClientPage />} />
          <Route path="/c/:id/a/:aid" element={<AssessmentRoute />} />
          <Route path="/c/:id/report/:aid/:kind" element={<ReportPage />} />
          <Route path="/recipes" element={<RecipePage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>} /></Routes>
    </HashRouter>
  )
}

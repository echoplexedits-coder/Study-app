import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Component, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Shell } from './components/Shell'
import { Button, Spinner, ToastProvider } from './components/ui'
import { ApiError, useMe } from './lib/api'
import { Deck } from './pages/Deck'
import { Flashcards } from './pages/Flashcards'
import { Learn } from './pages/Learn'
import { Library } from './pages/Library'
import { Match } from './pages/Match'
import { Settings } from './pages/Settings'
import { SetupNeeded, SignIn } from './pages/SignIn'
import { StatsPage } from './pages/Stats'

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } })

function Gate() {
  const me = useMe()
  if (me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    )
  }
  if (me.error instanceof ApiError && me.error.status === 401) return <SignIn />
  if (me.error) return <SetupNeeded message={me.error.message} />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Library />} />
        <Route path="decks/:id" element={<Deck />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="decks/:id/flashcards" element={<Flashcards />} />
      <Route path="decks/:id/learn" element={<Learn />} />
      <Route path="decks/:id/match" element={<Match />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** A render error should never leave a blank page in production. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-[20px] font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Reload the page to get back to your library. Your decks and progress are safe.</p>
          <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    )
  }
}

export function App() {
  return (
    <ErrorBoundary>
      {/* Honour prefers-reduced-motion for JS-driven animation, not just CSS. */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={client}>
          <ToastProvider>
            <BrowserRouter>
              <Gate />
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}

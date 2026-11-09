import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Component, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'

import { Shell } from './components/Shell'
import { Button, Spinner, ToastProvider } from './components/ui'
import { ApiError, useConsent, useMe } from './lib/api'
import { AdminUsers } from './pages/AdminUsers'
import { ForgotPasswordPage, ResetPasswordPage, SignInPage, SignUpPage } from './pages/Auth'
import { AccountSuspended, ChooseUsername } from './pages/ChooseUsername'
import { ConsentScreen } from './pages/Consent'
import { Deck } from './pages/Deck'
import { Flashcards } from './pages/Flashcards'
import { AcceptableUsePage, ContactPage, CopyrightPage, PrivacyPage, TermsPage } from './pages/Legal'
import { Learn } from './pages/Learn'
import { Library } from './pages/Library'
import { Match } from './pages/Match'
import { Notes } from './pages/Notes'
import { Quizzes } from './pages/Quizzes'
import { Resources } from './pages/Resources'
import { Settings } from './pages/Settings'
import { SetupNeeded } from './pages/SignIn'
import { SignedOut } from './pages/SignedOut'
import { StatsPage } from './pages/Stats'
import { Welcome } from './pages/Welcome'

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } })

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  )
}

/**
 * Sign-in gate followed by the consent gate. The policy pages above are public,
 * so someone can read what they are agreeing to before signing in at all.
 */
function RequireAuth() {
  const me = useMe()
  const consent = useConsent()
  const { pathname } = useLocation()
  if (me.isLoading) return <Loading />
  // The landing page is the front door; a deep link to an app route gets a
  // short explanation and a way in, instead of the whole marketing page at a
  // URL that claims to be the library.
  if (me.error instanceof ApiError && me.error.status === 401) return pathname === '/' ? <Welcome /> : <SignedOut />
  // Suspended accounts keep their data but reach nothing else.
  if (me.error instanceof ApiError && me.error.code === 'account_suspended') return <AccountSuspended />
  if (me.error) return <SetupNeeded message={me.error.message} />
  // The username gate comes before consent: no account reaches the library
  // without owning exactly one name.
  if (me.data?.user.needsUsername) return <ChooseUsername />
  if (consent.isLoading) return <Loading />
  if (consent.error) return <SetupNeeded message={(consent.error as Error).message} />
  if (consent.data && !consent.data.accepted) return <ConsentScreen />
  return <Outlet />
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
              <Routes>
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="acceptable-use" element={<AcceptableUsePage />} />
                <Route path="copyright" element={<CopyrightPage />} />
                <Route path="contact" element={<ContactPage />} />
                {/* Public identity pages. Signing in from any of them lands back
                    on the app, where the consent gate takes over. */}
                <Route path="signin" element={<SignInPage />} />
                <Route path="signup" element={<SignUpPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset" element={<ResetPasswordPage />} />
                {/* This alias goes through the auth gate: signed-in members land in
                    the library, signed-out visitors get the welcome page at /. */}
                <Route path="welcome" element={<Navigate to="/" replace />} />
                <Route element={<RequireAuth />}>
                  <Route element={<Shell />}>
                    <Route index element={<Library />} />
                    <Route path="notes" element={<Notes />} />
                    <Route path="resources" element={<Resources />} />
                    <Route path="quizzes" element={<Quizzes />} />
                    <Route path="decks/:id" element={<Deck />} />
                    <Route path="stats" element={<StatsPage />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="admin/users" element={<AdminUsers />} />
                  </Route>
                  <Route path="decks/:id/flashcards" element={<Flashcards />} />
                  <Route path="decks/:id/learn" element={<Learn />} />
                  <Route path="decks/:id/match" element={<Match />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}

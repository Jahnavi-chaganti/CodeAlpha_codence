import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Columns3,
  Layers,
  Lock,
  Mail,
  Radio,
  User as UserIcon,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { syncUserProfile } from '../lib/firestoreService';

type AuthMode = 'signin' | 'register' | 'reset';

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : 'Unable to complete authentication.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Console. Use Google Sign-In or enable Email/Password under Authentication > Sign-in method.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setError(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('Password reset instructions were sent to your email address.');
        setMode('signin');
        return;
      }

      if (mode === 'register') {
        const cleanName = displayName.trim();
        if (!cleanName) {
          setError('Please enter your full name.');
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanName });
        await syncUserProfile(cred.user);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Handled in verification banner if needed
        }
        return;
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col cadence-canvas text-[#3D1023] dark:text-[#FFF5F6] transition-colors duration-150">
      <header className="w-full max-w-[1220px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#8F3157] via-[#7A2346] to-[#5B1733] flex items-center justify-center text-[#FFF5F6] shadow-md">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-[#3D1023] dark:text-white block leading-none">
              Cadence
            </span>
            <span className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
              Collaborative Project Workspace
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1220px] mx-auto px-5 sm:px-8 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <section className="lg:col-span-7 space-y-7">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wide text-[#7A2346] dark:text-[#F1BBC8] uppercase">
              Plan Smarter. Collaborate Better. Deliver Faster.
            </p>
            <h1
              className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight leading-[1.14] text-[#3D1023] dark:text-[#FFF5F6]"
              style={{ textWrap: 'balance' }}
            >
              Unify sprint planning, live boards, timelines, and team analytics in one workspace.
            </h1>
            <p className="text-sm sm:text-base text-[#513443] dark:text-[#D9B7C4] max-w-xl leading-relaxed">
              Coordinate multi-user projects with Kanban boards, Gantt timelines, sprint burndowns,
              time tracking, task dependencies, and instant WebSocket room presence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="glass-card glass-card-interactive p-4.5 space-y-1.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
                  <Columns3 className="w-4 h-4" />
                </span>
                <span>Multi-View Execution</span>
              </div>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] leading-relaxed">
                Switch effortlessly between Kanban Board, Sortable List, Calendar, and Gantt
                Timeline views.
              </p>
            </div>

            <div className="glass-card glass-card-interactive p-4.5 space-y-1.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4" />
                </span>
                <span>Authenticated Real-Time Sync</span>
              </div>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] leading-relaxed">
                Room-isolated WebSocket presence, live drag indicators, @mentions, and persistent
                activity logs.
              </p>
            </div>

            <div className="glass-card glass-card-interactive p-4.5 space-y-1.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </span>
                <span>Sprints, Subtasks &amp; Timers</span>
              </div>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] leading-relaxed">
                Plan sprints and milestones, enforce dependency blockers, track task hours, and
                automate recurring work.
              </p>
            </div>

            <div className="glass-card glass-card-interactive p-4.5 space-y-1.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </span>
                <span>Real-Data Analytics &amp; Exports</span>
              </div>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] leading-relaxed">
                Monitor completion velocity, workload balance, sprint burndowns, and export CSV or
                printable reports.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="p-6 sm:p-8 glass-strong rounded-[20px] space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                  {mode === 'signin'
                    ? 'Sign in to Cadence'
                    : mode === 'register'
                      ? 'Create your account'
                      : 'Reset password'}
                </h2>
                <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-1">
                  {mode === 'reset'
                    ? 'We will email you a secure password recovery link.'
                    : 'Access your synchronized boards and team projects.'}
                </p>
              </div>
            </div>

            {mode !== 'reset' && (
              <div
                className="grid grid-cols-2 p-1 rounded-[12px] bg-[#F8DDE3]/75 dark:bg-[#3D1023]/80 border border-[#EAD7DE] dark:border-[#E9A8B8]/20"
                role="tablist"
                aria-label="Authentication mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setNotice(null);
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-[#7A2346] text-[#7A2346] dark:text-white shadow-xs'
                      : 'text-[#795D6B] dark:text-[#D9B7C4] hover:text-[#3D1023] dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setNotice(null);
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-[#7A2346] text-[#7A2346] dark:text-white shadow-xs'
                      : 'text-[#795D6B] dark:text-[#D9B7C4] hover:text-[#3D1023] dark:hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-3 rounded-[12px] border border-[#D94C65]/35 bg-[#D94C65]/10 text-xs text-[#A3263E] dark:text-[#F8A5B4] leading-relaxed"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="p-3 rounded-[12px] border border-[#21865B]/35 bg-[#21865B]/10 text-xs text-[#196846] dark:text-[#7CE0B5] flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-burgundy w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{loading ? 'Please wait...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-[#EAD7DE] dark:border-[#E9A8B8]/20" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-[#A58C98] dark:text-[#D9B7C4]">
                or with email
              </span>
              <div className="flex-1 border-t border-[#EAD7DE] dark:border-[#E9A8B8]/20" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#513443] dark:text-[#F1BBC8] mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-[#8F3157] dark:text-[#E9A8B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Rivera"
                      required
                      maxLength={80}
                      className="input-blush w-full pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#513443] dark:text-[#F1BBC8] mb-1">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#8F3157] dark:text-[#E9A8B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="input-blush w-full pl-9 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#513443] dark:text-[#F1BBC8]">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          setError(null);
                          setNotice(null);
                        }}
                        className="text-[11px] font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:text-[#C86B88] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[#8F3157] dark:text-[#E9A8B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      className="input-blush w-full pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-blush w-full py-2.5 px-4 text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {loading
                  ? 'Authenticating...'
                  : mode === 'signin'
                    ? 'Sign in with Email'
                    : mode === 'register'
                      ? 'Create Account'
                      : 'Send Password Reset Email'}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="w-full py-1.5 text-xs font-medium text-[#795D6B] dark:text-[#D9B7C4] hover:text-[#7A2346] dark:hover:text-white cursor-pointer"
                >
                  Back to sign in
                </button>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

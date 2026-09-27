import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export default function Login() {
  const { isAuthedAdmin, signIn, error: adminError } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthedAdmin) return <Navigate to="/" replace />;

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
      if (signInError) {
        const message = signInError.message || '';
        setError(/invalid login credentials/i.test(message)
          ? 'Incorrect email or password. Please try again.'
          : message);
      }
    } catch (signInError) {
      setError(signInError.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-7 sm:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(51,45,120,0.16)] md:min-h-[570px] md:grid-cols-[0.92fr_1.08fr]">
        <div className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#312785] via-primary to-[#8174F4] p-6 text-white sm:p-9 md:min-h-full md:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/15 bg-white/10" />
            <span className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/15 bg-white/10" />
            <span className="absolute right-16 top-[48%] h-16 w-16 rounded-full bg-white/5" />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-sm backdrop-blur-sm"><ShieldCheck size={23} /></div>
            <div><p className="text-sm font-extrabold tracking-wide">UniVents</p><p className="text-xs text-white/70">Administration portal</p></div>
          </div>

          <div className="relative z-10 my-7 md:my-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Secure workspace
            </span>
            <h2 className="mt-5 max-w-sm text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">University events, thoughtfully managed.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">Create announcements, coordinate campus events, and review requests from one central workspace.</p>
          </div>

          <div className="relative z-10 hidden items-center gap-2 text-xs font-semibold text-white/70 md:flex">
            <ShieldCheck size={15} /> Authorized administrators only
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col justify-center p-6 sm:p-10 md:px-12 md:py-12">
          <div className="mb-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Admin sign in</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-mute">Use your administrator account to continue.</p>
          </div>

          <div className="mb-5">
            <label htmlFor="admin-email" className="mb-2 block text-sm font-bold text-ink">Email address</label>
            <div className="relative">
              <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-line bg-[#FAFAFE] pl-11 pr-4 text-sm font-medium text-ink outline-none transition placeholder:text-mute/60 hover:border-primary/30 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="admin-password" className="mb-2 block text-sm font-bold text-ink">Password</label>
            <div className="relative">
              <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-line bg-[#FAFAFE] py-2.5 pl-11 pr-12 text-sm font-medium text-ink outline-none transition placeholder:text-mute/60 hover:border-primary/30 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                placeholder="Enter your password"
              />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-mute transition hover:bg-soft hover:text-primary">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {(error || adminError) && <p role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-danger">{error || adminError}</p>}

          <button
            type="submit"
            disabled={busy}
            className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-white shadow-[0_9px_20px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 hover:bg-[#4338CA] hover:shadow-[0_12px_24px_rgba(79,70,229,0.27)] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-65"
          >
            {busy ? 'Signing in…' : <>Sign in securely <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /></>}
          </button>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs font-medium text-mute"><ShieldCheck size={15} className="text-primary/70" /> Access for authorized UniVents administrators</p>
        </form>
      </section>
    </div>
  );
}

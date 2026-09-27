import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

export default function Login() {
  const { isAuthedAdmin, signIn, error: adminError } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          ? 'Supabase Auth could not verify this email and password. The admins table only approves admin access; it cannot securely authenticate a password stored there. Create or reset this email’s password in Supabase Authentication, then sign in with that password.'
          : message);
      }
    } catch (signInError) {
      setError(signInError.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary2 text-lg font-extrabold text-white">
            U
          </div>
          <h1 className="text-xl font-extrabold text-ink">UniVents Admin</h1>
          <p className="mt-1 text-sm text-mute">Sign in with your admin account</p>
        </div>

        <label className="mb-1.5 block text-sm font-semibold text-mute">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mb-4 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary"
          placeholder="admin@example.com"
        />

        <label className="mb-1.5 block text-sm font-semibold text-mute">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mb-5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary"
          placeholder="••••••••"
        />

        {(error || adminError) && (
          <p className="mb-4 text-sm font-semibold text-danger">{error || adminError}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-primary2 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

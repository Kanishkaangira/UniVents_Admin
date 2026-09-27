import { Navigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

export default function ProtectedRoute({ children, requireSuper = false }) {
  const { booting, isAuthedAdmin, isSuper, error, signOut } = useAdmin();

  if (booting) {
    return (
      <div className="flex h-screen items-center justify-center text-mute">
        Loading…
      </div>
    );
  }

  if (!isAuthedAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold text-ink">{error || 'Please sign in.'}</p>
        {error && (
          <button onClick={signOut} className="text-sm font-semibold text-primary">
            Sign out and try a different account
          </button>
        )}
        <Navigate to="/login" replace />
      </div>
    );
  }

  if (requireSuper && !isSuper) {
    return <Navigate to="/" replace />;
  }

  return children;
}

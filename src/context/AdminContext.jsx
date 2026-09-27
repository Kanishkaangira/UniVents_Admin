import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCurrentAdmin } from '../lib/data';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');

  const loadAdmin = useCallback(async currentSession => {
    if (!currentSession) {
      setAdmin(null);
      return;
    }
    try {
      const row = await fetchCurrentAdmin();
      if (!row) {
        setAdmin(null);
        setError('This account is not registered as an admin.');
        return;
      }

      // The RPC confirms admin membership; the signed-in Auth UUID is the
      // canonical identity for created_by filters and may fill an omitted RPC id.
      const normalizedRow = {
        ...row,
        id: row.id || currentSession.user?.id,
        email: row.email || currentSession.user?.email,
      };
      setAdmin(normalizedRow);
      setError(normalizedRow.id ? '' : 'The admin record did not include a valid user ID.');
    } catch (e) {
      setAdmin(null);
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAdmin(data.session);
      setBooting(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'TOKEN_REFRESHED') return; // don't reload state on a routine token refresh
      setSession(newSession);
      await loadAdmin(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadAdmin]);

  const signIn = useCallback(async (email, password) => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { error: authError };

    try {
      const fetchedRow = await fetchCurrentAdmin();
      const authEmail = data.user.email?.trim().toLowerCase();
      const row = fetchedRow && {
        ...fetchedRow,
        id: fetchedRow.id || data.user.id,
        email: fetchedRow.email || data.user.email,
      };
      const approvedEmail = row?.email?.trim().toLowerCase();

      if (!row || !row.id || !authEmail || approvedEmail !== authEmail) {
        await supabase.auth.signOut();
        setSession(null);
        setAdmin(null);
        setError('This account is not approved for the admin panel. Contact a super admin.');
        return { error: { message: 'This account is not approved for the admin panel. Contact a super admin.' } };
      }

      setSession(data.session);
      setAdmin(row);
      setError('');
      return { data, error: null };
    } catch (verificationError) {
      await supabase.auth.signOut();
      setSession(null);
      setAdmin(null);
      const message = `Could not verify admin access: ${verificationError.message}`;
      setError(message);
      return { error: { message } };
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      admin, // null while loading, or { id, email, scope_type, department_id, club_id }
      booting,
      error,
      isSuper: admin?.scope_type === 'super',
      isAuthedAdmin: !!session && !!admin,
      signIn,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, admin, booting, error, signIn],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

// The hook is intentionally colocated with its provider/context.
// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(AdminContext);

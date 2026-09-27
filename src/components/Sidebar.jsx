import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BellDot,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Shield,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fetchPendingApprovalCount } from '../lib/data';

const links = [
  { to: '/', label: 'My posts', icon: LayoutDashboard, end: true },
  { to: '/scope-posts', label: 'All Posts', icon: CalendarDays },
  { to: '/new', label: 'New post', icon: Plus },
  { to: '/pending', label: 'Pending approvals', icon: BellDot, pending: true },
  { to: '/management', label: 'Administration', icon: UsersRound, superOnly: true },
];

const linkClass = ({ isActive }) =>
  `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-primary text-white shadow-[0_8px_18px_rgba(79,70,229,0.22)]'
      : 'text-mute hover:bg-soft/80 hover:text-primary'
  }`;

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary2 text-white shadow-card">
        <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/20" />
        <Shield size={22} strokeWidth={2.4} />
      </div>
      <div>
        <p className="text-[15px] font-extrabold leading-tight tracking-tight text-ink">UniVents</p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-mute">Admin portal</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { admin, isSuper, signOut } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const scopeLabel = isSuper
    ? 'Super admin'
    : admin?.scope_type === 'department'
      ? 'Department admin'
      : 'Club admin';

  useEffect(() => {
    if (!admin?.id) return undefined;

    let active = true;
    const refreshPendingCount = () => {
      fetchPendingApprovalCount()
        .then(count => { if (active) setPendingCount(count); })
        .catch(() => { if (active) setPendingCount(0); });
    };

    refreshPendingCount();
    const intervalId = window.setInterval(refreshPendingCount, 20000);
    window.addEventListener('focus', refreshPendingCount);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshPendingCount);
    };
  }, [admin?.id]);

  const navigation = (
    <nav className="flex flex-col gap-1">
      {links.filter(link => !link.superOnly || isSuper).map(({ to, label, icon: Icon, end, pending }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={linkClass}
          onClick={() => setMobileOpen(false)}
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/60 transition group-hover:bg-white/90">
            <Icon size={17} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">{label}</span>
          {pending && pendingCount > 0 && (
            <span
              aria-label={`${pendingCount} pending approval${pendingCount === 1 ? '' : 's'}`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold leading-4 text-white shadow-sm"
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl md:hidden">
        <Brand />
        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMobileOpen(open => !open)}
          className="relative rounded-xl border border-line bg-white p-2.5 text-ink shadow-sm transition hover:bg-soft"
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          {!mobileOpen && pendingCount > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-accent" />}
        </button>
        {mobileOpen && (
          <div className="absolute inset-x-0 top-full border-b border-line bg-white/98 p-4 shadow-xl backdrop-blur-xl">
            <p className="mb-3 px-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-mute">Workspace</p>
            {navigation}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-bg/80 p-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-primary shadow-sm"><ShieldCheck size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink">{admin?.email}</p>
                <p className="mt-0.5 text-xs text-mute">{scopeLabel}</p>
              </div>
              <button aria-label="Sign out" onClick={signOut} className="rounded-xl p-2 text-mute transition hover:bg-red-50 hover:text-danger">
                <LogOut size={17} />
              </button>
            </div>
          </div>
        )}
      </header>

      <aside className="sticky top-0 hidden h-screen w-[276px] flex-none flex-col justify-between border-r border-white/80 bg-white/90 px-4 py-5 shadow-[8px_0_28px_rgba(43,38,100,0.035)] backdrop-blur-xl md:flex">
        <div>
          <div className="mb-9 rounded-2xl border border-line/80 bg-white/75 p-3"><Brand /></div>
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-mute/80">Workspace</p>
            <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold capitalize text-primary">{admin?.scope_type || 'admin'}</span>
          </div>
          {navigation}
        </div>

        <div className="rounded-2xl border border-line bg-gradient-to-br from-white/90 to-soft/70 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line/70 bg-white text-primary shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">{admin?.email}</p>
              <p className="mt-0.5 text-[11px] font-medium text-mute">{scopeLabel}</p>
            </div>
          </div>
          <button onClick={signOut} className="mt-3 flex w-full items-center justify-between rounded-xl border border-line/80 bg-white/75 px-3 py-2.5 text-left text-xs font-bold text-mute transition hover:border-red-100 hover:bg-red-50 hover:text-danger">
            <span className="flex items-center gap-2"><LogOut size={15} /> Sign out</span>
            <span className="text-[10px] font-semibold text-mute/70">Secure session</span>
          </button>
        </div>
      </aside>
    </>
  );
}

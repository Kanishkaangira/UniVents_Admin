import { NavLink } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

const linkClass = ({ isActive }) =>
  `block rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
    isActive ? 'bg-primary text-white shadow-card' : 'text-mute hover:bg-soft hover:text-primary'
  }`;

export default function Sidebar() {
  const { admin, isSuper, signOut } = useAdmin();

  const scopeLabel = isSuper
    ? 'Super admin'
    : admin?.scope_type === 'department'
      ? `${admin.department_id ? 'Department' : ''} admin`
      : 'Club admin';

  return (
    <aside className="flex h-screen w-60 flex-none flex-col justify-between border-r border-line bg-white p-4">
      <div>
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary2 text-sm font-extrabold text-white">
            U
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-ink">UniVents</p>
            <p className="text-xs text-mute">Admin panel</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass}>
            My posts
          </NavLink>
          <NavLink to="/scope-posts" className={linkClass}>
            Posts in my scope
          </NavLink>
          <NavLink to="/new" className={linkClass}>
            New post
          </NavLink>
          {isSuper && (
            <>
              <NavLink to="/pending" className={linkClass}>Pending approvals</NavLink>
              <NavLink to="/management" className={linkClass}>Administration</NavLink>
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-line pt-3">
        <p className="truncate px-2 text-xs font-semibold text-mute">{admin?.email}</p>
        <p className="px-2 text-xs text-mute">{scopeLabel}</p>
        <button
          onClick={signOut}
          className="mt-2 w-full rounded-xl px-4 py-2 text-left text-sm font-semibold text-danger hover:bg-red-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

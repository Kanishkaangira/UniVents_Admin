import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  deleteAdmin,
  deleteClub,
  deleteDepartment,
  fetchAdmins,
  fetchClubs,
  fetchDepartments,
  saveAdmin,
  saveClub,
  saveDepartment,
} from '../lib/data';

const EMPTY_ADMIN = { id: '', email: '', scope_type: 'department', department_id: '', club_id: '' };

export default function Management() {
  const [tab, setTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' });
  const [clubForm, setClubForm] = useState({ name: '', code: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [adminRows, departmentRows, clubRows] = await Promise.all([
      fetchAdmins(), fetchDepartments(), fetchClubs(),
    ]);
    setAdmins(adminRows || []);
    setDepartments(departmentRows || []);
    setClubs(clubRows || []);
  };

  useEffect(() => {
    Promise.all([fetchAdmins(), fetchDepartments(), fetchClubs()])
      .then(([adminRows, departmentRows, clubRows]) => {
        setAdmins(adminRows || []);
        setDepartments(departmentRows || []);
        setClubs(clubRows || []);
      })
      .catch(e => setError(e.message));
  }, []);

  const run = async (action, successMessage = 'Changes saved and lists refreshed.') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      setNotice(successMessage);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAdmin = e => {
    e.preventDefault();
    const row = {
      id: adminForm.id.trim(),
      email: adminForm.email.trim().toLowerCase(),
      scope_type: adminForm.scope_type,
      department_id: adminForm.scope_type === 'department' ? adminForm.department_id || null : null,
      club_id: adminForm.scope_type === 'club' ? adminForm.club_id || null : null,
    };
    if (!row.id || !row.email) return setError('Enter the existing Auth user UUID and email.');
    if (row.scope_type === 'department' && !row.department_id) return setError('Choose a department for this admin.');
    if (row.scope_type === 'club' && !row.club_id) return setError('Choose a club for this admin.');
    run(async () => { await saveAdmin(row); setAdminForm(EMPTY_ADMIN); });
  };

  const submitDepartment = e => {
    e.preventDefault();
    run(async () => {
      await saveDepartment({ ...(departmentForm.id ? { id: departmentForm.id } : {}), name: departmentForm.name.trim(), code: departmentForm.code.trim() });
      setDepartmentForm({ name: '', code: '' });
    }, 'Department saved to the database. The department list has been refreshed.');
  };

  const submitClub = e => {
    e.preventDefault();
    run(async () => {
      await saveClub({ ...(clubForm.id ? { id: clubForm.id } : {}), name: clubForm.name.trim(), code: clubForm.code.trim() || null });
      setClubForm({ name: '', code: '' });
    }, 'Club saved to the database. The club list has been refreshed.');
  };

  const remove = (label, action) => {
    if (window.confirm(`Delete ${label}? This may be blocked if records still use it.`)) run(action);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink">Administration</h1>
          <p className="text-sm text-mute">Manage admin scopes and campus organizations.</p>
        </header>

        <div className="mb-5 inline-flex rounded-xl bg-white p-1 shadow-card">
          {['admins', 'departments', 'clubs'].map(item => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-soft text-primary' : 'text-mute'}`}>
              {item}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-soft px-4 py-3 text-sm font-semibold text-primary">{notice}</p>}

        {tab === 'admins' && <>
          <form onSubmit={submitAdmin} className="mb-6 grid gap-3 rounded-2xl border border-line bg-white p-5 shadow-card md:grid-cols-2">
            <h2 className="md:col-span-2 text-lg font-bold text-ink">Add or update an admin</h2>
            <Field label="Existing Auth user UUID" value={adminForm.id} onChange={id => setAdminForm({ ...adminForm, id })} placeholder="Copy from Supabase Authentication" />
            <Field label="Auth email" type="email" value={adminForm.email} onChange={email => setAdminForm({ ...adminForm, email })} />
            <label className="text-sm font-semibold text-mute">Scope
              <select value={adminForm.scope_type} onChange={e => setAdminForm({ ...adminForm, scope_type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink">
                <option value="super">Super</option><option value="department">Department</option><option value="club">Club</option>
              </select>
            </label>
            {adminForm.scope_type === 'department' && <SelectField label="Department" value={adminForm.department_id} onChange={department_id => setAdminForm({ ...adminForm, department_id })} items={departments} />}
            {adminForm.scope_type === 'club' && <SelectField label="Club" value={adminForm.club_id} onChange={club_id => setAdminForm({ ...adminForm, club_id })} items={clubs} />}
            <div className="md:col-span-2"><button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Save admin</button></div>
            <p className="md:col-span-2 text-xs text-mute">The user must already exist in Supabase Auth. Passwords stay in Auth and are never stored here.</p>
          </form>
          <ListPanel title="Admin accounts" empty="No admins found." rows={admins.map(row => ({
            id: row.id,
            title: row.email,
            subtitle: row.scope_type === 'department'
              ? `Department · ${departments.find(item => item.id === row.department_id)?.name || row.department_id}`
              : row.scope_type === 'club'
                ? `Club · ${clubs.find(item => item.id === row.club_id)?.name || row.club_id}`
                : 'Super admin · all scopes',
            onEdit: () => setAdminForm({ ...EMPTY_ADMIN, ...row, department_id: row.department_id || '', club_id: row.club_id || '' }),
            onDelete: () => remove(row.email, () => deleteAdmin(row.id)),
          }))} />
        </>}

        {tab === 'departments' && <>
          <form onSubmit={submitDepartment} className="mb-6 grid gap-3 rounded-2xl border border-line bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-3 text-lg font-bold text-ink">{departmentForm.id ? 'Edit department' : 'Add department'}</h2>
            <Field label="Department name" required value={departmentForm.name} onChange={name => setDepartmentForm({ ...departmentForm, name })} />
            <Field label="Short code" required value={departmentForm.code} onChange={code => setDepartmentForm({ ...departmentForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{departmentForm.id ? 'Save' : 'Add'}</button>
          </form>
          <ListPanel title="Departments" empty="No departments found." rows={departments.map(row => ({ id: row.id, title: row.name, subtitle: row.code, onEdit: () => setDepartmentForm({ id: row.id, name: row.name, code: row.code || '' }), onDelete: () => remove(row.name, () => deleteDepartment(row.id)) }))} />
        </>}

        {tab === 'clubs' && <>
          <form onSubmit={submitClub} className="mb-6 grid gap-3 rounded-2xl border border-line bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-3 text-lg font-bold text-ink">{clubForm.id ? 'Edit club' : 'Add club'}</h2>
            <Field label="Club name" required value={clubForm.name} onChange={name => setClubForm({ ...clubForm, name })} />
            <Field label="Short code (optional)" value={clubForm.code} onChange={code => setClubForm({ ...clubForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{clubForm.id ? 'Save' : 'Add'}</button>
          </form>
          <ListPanel title="Clubs" empty="No clubs found." rows={clubs.map(row => ({ id: row.id, title: row.name, subtitle: row.code || '', onEdit: () => setClubForm({ id: row.id, name: row.name, code: row.code || '' }), onDelete: () => remove(row.name, () => deleteClub(row.id)) }))} />
        </>}
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return <label className="text-sm font-semibold text-mute">{label}<input type={type} required={required} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary" /></label>;
}

function SelectField({ label, value, onChange, items }) {
  return <label className="text-sm font-semibold text-mute">{label}<select required value={value} onChange={e => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink"><option value="">Select…</option>{items.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}</select></label>;
}

function ListPanel({ title, empty, rows }) {
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>{rows.length === 0 ? <p className="py-5 text-sm text-mute">{empty}</p> : <div className="divide-y divide-line">{rows.map(row => <div key={row.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{row.title}</p><p className="truncate text-xs text-mute">{row.subtitle}</p></div><div className="flex gap-2">{row.onEdit && <button onClick={row.onEdit} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-soft">Edit</button>}<button onClick={row.onDelete} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-red-50">Delete</button></div></div>)}</div>}</section>;
}

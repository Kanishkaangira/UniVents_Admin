import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  deleteClub,
  deleteDepartment,
  fetchAdmins,
  fetchClubs,
  fetchDepartments,
  saveClub,
  saveDepartment,
} from '../lib/data';

export default function Management() {
  const [tab, setTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [clubs, setClubs] = useState([]);
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">
        <div className="mx-auto max-w-6xl">
        <header className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Workspace settings</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Administration</h1>
          <p className="mt-1 text-sm text-mute">View admin accounts and manage the campus organizations used across UniVents.</p>
        </header>

        <div className="mb-6 inline-flex max-w-full flex-wrap rounded-xl border border-line bg-white p-1 shadow-sm">
          {['admins', 'departments', 'clubs'].map(item => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-soft text-primary' : 'text-mute'}`}>
              {item}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-soft px-4 py-3 text-sm font-semibold text-primary">{notice}</p>}

        {tab === 'admins' && <>
          <ListPanel title="Admin accounts" empty="No admins found." rows={admins.map(row => ({
            id: row.id,
            title: row.email,
            subtitle: row.scope_type === 'department'
              ? `Department · ${departments.find(item => item.id === row.department_id)?.name || row.department_id}`
              : row.scope_type === 'club'
                ? `Club · ${clubs.find(item => item.id === row.club_id)?.name || row.club_id}`
                : 'Super admin · all scopes',
          }))} />
        </>}

        {tab === 'departments' && <>
          <form onSubmit={submitDepartment} className="mb-6 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-3 text-lg font-bold text-ink">{departmentForm.id ? 'Edit department' : 'Add department'}</h2>
            <Field label="Department name" required value={departmentForm.name} onChange={name => setDepartmentForm({ ...departmentForm, name })} />
            <Field label="Short code" required value={departmentForm.code} onChange={code => setDepartmentForm({ ...departmentForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{departmentForm.id ? 'Save' : 'Add'}</button>
          </form>
          <ListPanel title="Departments" empty="No departments found." rows={departments.map(row => ({ id: row.id, title: row.name, subtitle: row.code, onEdit: () => setDepartmentForm({ id: row.id, name: row.name, code: row.code || '' }), onDelete: () => remove(row.name, () => deleteDepartment(row.id)) }))} />
        </>}

        {tab === 'clubs' && <>
          <form onSubmit={submitClub} className="mb-6 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-3 text-lg font-bold text-ink">{clubForm.id ? 'Edit club' : 'Add club'}</h2>
            <Field label="Club name" required value={clubForm.name} onChange={name => setClubForm({ ...clubForm, name })} />
            <Field label="Short code (optional)" value={clubForm.code} onChange={code => setClubForm({ ...clubForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{clubForm.id ? 'Save' : 'Add'}</button>
          </form>
          <ListPanel title="Clubs" empty="No clubs found." rows={clubs.map(row => ({ id: row.id, title: row.name, subtitle: row.code || '', onEdit: () => setClubForm({ id: row.id, name: row.name, code: row.code || '' }), onDelete: () => remove(row.name, () => deleteClub(row.id)) }))} />
        </>}
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return <label className="text-sm font-semibold text-mute">{label}<input type={type} required={required} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function ListPanel({ title, empty, rows }) {
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold text-ink">{title}</h2><span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-mute">{rows.length}</span></div>{rows.length === 0 ? <p className="py-8 text-center text-sm text-mute">{empty}</p> : <div className="divide-y divide-line">{rows.map(row => <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-bold text-ink sm:break-words">{row.title}</p><p className="mt-1 break-words text-xs text-mute">{row.subtitle}</p></div>{(row.onEdit || row.onDelete) && <div className="flex flex-none gap-2">{row.onEdit && <button onClick={row.onEdit} className="rounded-lg px-3 py-2 text-sm font-semibold text-primary transition hover:bg-soft">Edit</button>}{row.onDelete && <button onClick={row.onDelete} className="rounded-lg px-3 py-2 text-sm font-semibold text-danger transition hover:bg-red-50">Delete</button>}</div>}</div>)}</div>}</section>;
}

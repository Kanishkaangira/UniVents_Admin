import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAdmin } from '../context/AdminContext';
import {
  createPost,
  deleteClub,
  deleteDepartment,
  deleteSkillFaculty,
  fetchAdmins,
  fetchClubs,
  fetchDepartments,
  fetchSkillFaculties,
  saveClub,
  saveDepartment,
  saveSkillFaculty,
  sendApprovedEventPush,
} from '../lib/data';

export default function Management() {
  const { admin, isSuper } = useAdmin();
  const [tab, setTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [skillFaculties, setSkillFaculties] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [skillFacultyForm, setSkillFacultyForm] = useState({ name: '', code: '' });
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', skill_faculty_id: '' });
  const [clubForm, setClubForm] = useState({ name: '', code: '' });
  const [notificationForm, setNotificationForm] = useState({
    type: 'app_update',
    title: '',
    message: '',
    audience: 'all',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);

  const load = async () => {
    const [adminRows, departmentRows, facultyRows, clubRows] = await Promise.all([
      fetchAdmins(), fetchDepartments(), fetchSkillFaculties(), fetchClubs(),
    ]);
    setAdmins(adminRows || []);
    setDepartments(departmentRows || []);
    setSkillFaculties(facultyRows || []);
    setClubs(clubRows || []);
  };

  useEffect(() => {
    Promise.all([fetchAdmins(), fetchDepartments(), fetchSkillFaculties(), fetchClubs()])
      .then(([adminRows, departmentRows, facultyRows, clubRows]) => {
        setAdmins(adminRows || []);
        setDepartments(departmentRows || []);
        setSkillFaculties(facultyRows || []);
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
      await saveDepartment({ ...(departmentForm.id ? { id: departmentForm.id } : {}), name: departmentForm.name.trim(), code: departmentForm.code.trim(), skill_faculty_id: departmentForm.skill_faculty_id });
      setDepartmentForm({ name: '', code: '', skill_faculty_id: '' });
    }, 'Department saved to the database. The department list has been refreshed.');
  };

  const submitSkillFaculty = e => {
    e.preventDefault();
    run(async () => {
      await saveSkillFaculty({
        ...(skillFacultyForm.id ? { id: skillFacultyForm.id } : {}),
        name: skillFacultyForm.name.trim(),
        code: skillFacultyForm.code.trim() || null,
      });
      setSkillFacultyForm({ name: '', code: '' });
    }, 'Skill Faculty saved to the database. The linked departments list has been refreshed.');
  };

  const submitClub = e => {
    e.preventDefault();
    run(async () => {
      await saveClub({ ...(clubForm.id ? { id: clubForm.id } : {}), name: clubForm.name.trim(), code: clubForm.code.trim() || null });
      setClubForm({ name: '', code: '' });
    }, 'Club saved to the database. The club list has been refreshed.');
  };

  const submitNotification = async e => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!isSuper) {
      setError('Only a Super admin can send University notifications.');
      return;
    }
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      setError('Enter a notification title and message.');
      return;
    }

    setSendingNotification(true);
    try {
      const { date, time } = getIndiaDateTime();
      const post = await createPost({
        content_type: 'event',
        title: notificationForm.title.trim(),
        description: notificationForm.message.trim(),
        category: notificationForm.type === 'app_update' ? 'App Update' : 'University Update',
        organizer_name: 'University Administration',
        organizer_scope: 'university',
        skill_faculty_id: null,
        department_id: null,
        club_id: null,
        visibility: notificationForm.audience,
        event_date: date,
        start_time: time,
        end_time: null,
        venue: notificationForm.type === 'app_update' ? 'UniVents app update' : 'University update',
        registration_required: false,
        registration_deadline: null,
        capacity: null,
        image_url: null,
        created_by: admin.id,
      });

      if (post.approval !== 'approved') {
        throw new Error('The update was saved but is not approved, so no push was sent.');
      }

      let pushMessage = 'Update saved and approved.';
      try {
        const pushResult = await sendApprovedEventPush(post.id);
        pushMessage += pushResult?.sent
          ? ' The phone push notification was sent.'
          : pushResult?.reason === 'already_sent'
            ? ' Its phone push notification was already sent.'
            : ' The phone push was not confirmed.';
      } catch (pushError) {
        pushMessage += ` The update was saved, but its phone push failed: ${pushError.message}`;
      }

      setNotificationForm(previous => ({ ...previous, title: '', message: '' }));
      setNotice(pushMessage);
    } catch (submitError) {
      setError(submitError.message || 'The University update could not be sent.');
    } finally {
      setSendingNotification(false);
    }
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
          {['admins', ...(isSuper ? ['skill faculties'] : []), 'departments', 'clubs', ...(isSuper ? ['notifications'] : [])].map(item => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-soft text-primary' : 'text-mute'}`}>
              {item}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-soft px-4 py-3 text-sm font-semibold text-primary">{notice}</p>}

        {tab === 'notifications' && isSuper && (
          <form onSubmit={submitNotification} className="max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-ink">Send University notification</h2>
              <p className="mt-1 text-sm leading-6 text-mute">
                This creates an approved University event update and sends it through the same push flow as an event.
              </p>
            </div>
            <label className="mb-4 block text-sm font-semibold text-mute">
              Notification type
              <select
                value={notificationForm.type}
                onChange={e => setNotificationForm(previous => ({ ...previous, type: e.target.value }))}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                <option value="app_update">App update</option>
                <option value="university_update">University update</option>
              </select>
            </label>
            <label className="mb-4 block text-sm font-semibold text-mute">
              Title
              <input
                required
                maxLength={80}
                value={notificationForm.title}
                onChange={e => setNotificationForm(previous => ({ ...previous, title: e.target.value }))}
                placeholder="UniVents app update"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              />
            </label>
            <label className="mb-4 block text-sm font-semibold text-mute">
              Message
              <textarea
                required
                maxLength={500}
                rows={4}
                value={notificationForm.message}
                onChange={e => setNotificationForm(previous => ({ ...previous, message: e.target.value }))}
                placeholder="Describe what's new or important."
                className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              />
            </label>
            <label className="mb-5 block text-sm font-semibold text-mute">
              Audience
              <select
                value={notificationForm.audience}
                onChange={e => setNotificationForm(previous => ({ ...previous, audience: e.target.value }))}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                <option value="all">Everyone</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={sendingNotification}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {sendingNotification ? 'Sending…' : 'Send notification'}
            </button>
          </form>
        )}

        {tab === 'admins' && <>
          <ListPanel title="Admin accounts" empty="No admins found." rows={admins.map(row => ({
            id: row.id,
            title: row.email,
            subtitle: row.scope_type === 'department'
              ? `Department · ${departments.find(item => item.id === row.department_id)?.name || row.department_id}`
              : row.scope_type === 'skill_faculty'
                ? `Skill Faculty · ${skillFaculties.find(item => item.id === row.skill_faculty_id)?.name || row.skill_faculty_id}`
                : row.scope_type === 'club'
                ? `Club · ${clubs.find(item => item.id === row.club_id)?.name || row.club_id}`
                : 'Super admin · all scopes',
          }))} />
        </>}

        {tab === 'skill faculties' && isSuper && <>
          <form onSubmit={submitSkillFaculty} className="mb-6 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-3 text-lg font-bold text-ink">{skillFacultyForm.id ? 'Edit Skill Faculty' : 'Add Skill Faculty'}</h2>
            <Field label="Skill Faculty name" required value={skillFacultyForm.name} onChange={name => setSkillFacultyForm({ ...skillFacultyForm, name })} />
            <Field label="Short code (optional)" value={skillFacultyForm.code} onChange={code => setSkillFacultyForm({ ...skillFacultyForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{skillFacultyForm.id ? 'Save' : 'Add'}</button>
          </form>
          <p className="mb-4 text-sm leading-6 text-mute">
            Assign departments to a Skill Faculty from the Departments tab. Clubs remain independent.
          </p>
          <ListPanel
            title="Skill Faculties"
            empty="No Skill Faculties found."
            rows={skillFaculties.map(row => {
              const linkedDepartments = departments
                .filter(department => department.skill_faculty_id === row.id)
                .map(department => department.name);
              return {
                id: row.id,
                title: row.name,
                subtitle: `${row.code || ''}${linkedDepartments.length ? ` · Departments: ${linkedDepartments.join(', ')}` : ' · No departments linked'}`,
                onEdit: () => setSkillFacultyForm({ id: row.id, name: row.name, code: row.code || '' }),
                onDelete: () => remove(row.name, () => deleteSkillFaculty(row.id)),
              };
            })}
          />
        </>}

        {tab === 'departments' && <>
          <form onSubmit={submitDepartment} className="mb-6 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <h2 className="md:col-span-4 text-lg font-bold text-ink">{departmentForm.id ? 'Edit department' : 'Add department'}</h2>
            <label className="text-sm font-semibold text-mute">Skill Faculty
              <select required value={departmentForm.skill_faculty_id} onChange={e => setDepartmentForm({ ...departmentForm, skill_faculty_id: e.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink">
                <option value="">Select Skill Faculty</option>
                {skillFaculties.map(faculty => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
              </select>
            </label>
            <Field label="Department name" required value={departmentForm.name} onChange={name => setDepartmentForm({ ...departmentForm, name })} />
            <Field label="Short code" required value={departmentForm.code} onChange={code => setDepartmentForm({ ...departmentForm, code })} />
            <button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{departmentForm.id ? 'Save' : 'Add'}</button>
          </form>
          <ListPanel title="Departments" empty="No departments found." rows={departments.map(row => ({ id: row.id, title: row.name, subtitle: `${row.code || ''} · ${skillFaculties.find(faculty => faculty.id === row.skill_faculty_id)?.name || ''}`, onEdit: () => setDepartmentForm({ id: row.id, name: row.name, code: row.code || '', skill_faculty_id: row.skill_faculty_id || '' }), onDelete: () => remove(row.name, () => deleteDepartment(row.id)) }))} />
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

function getIndiaDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return <label className="text-sm font-semibold text-mute">{label}<input type={type} required={required} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>;
}

function ListPanel({ title, empty, rows }) {
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold text-ink">{title}</h2><span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-mute">{rows.length}</span></div>{rows.length === 0 ? <p className="py-8 text-center text-sm text-mute">{empty}</p> : <div className="divide-y divide-line">{rows.map(row => <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-bold text-ink sm:break-words">{row.title}</p><p className="mt-1 break-words text-xs text-mute">{row.subtitle}</p></div>{(row.onEdit || row.onDelete) && <div className="flex flex-none gap-2">{row.onEdit && <button onClick={row.onEdit} className="rounded-lg px-3 py-2 text-sm font-semibold text-primary transition hover:bg-soft">Edit</button>}{row.onDelete && <button onClick={row.onDelete} className="rounded-lg px-3 py-2 text-sm font-semibold text-danger transition hover:bg-red-50">Delete</button>}</div>}</div>)}</div>}</section>;
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Clock3, FileText, MapPin, UsersRound } from 'lucide-react';
import { fetchEventRegistrations, getPublicStorageUrl } from '../lib/data';
import ApprovalBadge from './ApprovalBadge';

const scopeText = post => {
  if (post.organizer_scope === 'university') return 'University level';
  if (post.organizer_scope === 'department') return `Department · ${post.departments?.name || 'Department'}`;
  if (post.organizer_scope === 'club') return `Club · ${post.clubs?.name || 'Club'}`;
  return post.organizer_scope;
};

export default function PostCard({ post, onDelete, actions, canManage = true, canViewRegistrations = canManage }) {
  const [registrationsOpen, setRegistrationsOpen] = useState(false);
  const [registrations, setRegistrations] = useState(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState('');
  const [search, setSearch] = useState('');

  const openRegistrations = async () => {
    setRegistrationsOpen(true);
    setRegistrationsError('');
    if (registrations) return;
    setRegistrationsLoading(true);
    try {
      setRegistrations(await fetchEventRegistrations(post.id));
    } catch (error) {
      setRegistrationsError(error.message || 'Could not load registrations.');
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const visibleRegistrations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return registrations || [];
    return (registrations || []).filter(row => [row.user_name, row.email, row.user_type, row.department_name, row.department_code, row.course, row.batch]
      .some(value => String(value || '').toLowerCase().includes(term)));
  }, [registrations, search]);

  const isEvent = post.content_type === 'event';
  const imageUrl = getPublicStorageUrl(isEvent ? post.image_url : post.attachment_type === 'image' ? post.attachment_url : null);
  const attachmentUrl = getPublicStorageUrl(!isEvent ? post.attachment_url : null);
  const hasAttachment = Boolean(attachmentUrl);
  const registrationCount = post.registration_count ?? 0;
  const organizerLabel = post.organizer_name && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(post.organizer_name)
    ? post.organizer_name
    : scopeText(post);

  return (
    <>
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:border-primary/20 hover:shadow-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 w-full flex-none overflow-hidden bg-gradient-to-br from-primary/10 via-soft to-primary2/20 sm:h-auto sm:min-h-52 sm:w-52 md:w-60">
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={`Open image for ${post.title}`} className="block h-full w-full">
              <img src={imageUrl} alt={isEvent ? `${post.title} poster` : `${post.title} attachment`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" loading="lazy" />
            </a>
          ) : hasAttachment ? (
            <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex h-full min-h-48 flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/5 to-soft px-5 text-center transition hover:from-primary/10 hover:to-soft">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm"><FileText size={28} /></span>
              <span className="max-w-full break-all text-sm font-bold text-ink">{post.attachment_name || 'Open notice attachment'}</span>
              <span className="text-xs font-semibold text-primary">{post.attachment_type === 'pdf' ? 'View PDF' : 'View attachment'}</span>
            </a>
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-5 text-center sm:min-h-52">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-primary shadow-sm">{isEvent ? <CalendarDays size={27} /> : <FileText size={27} />}</span>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary/80">{isEvent ? 'Campus event' : 'Campus notice'}</span>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-primary shadow-sm">{isEvent ? 'Event' : 'Notice'}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ApprovalBadge approval={post.approval} />
            {!canManage && <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-mute">Read only</span>}
            {isEvent && post.status && <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold capitalize text-success">{post.status}</span>}
            {post.category && <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-mute">{post.category}</span>}
          </div>

          <h2 className="mt-3 break-words text-lg font-extrabold leading-snug text-ink sm:text-xl">{post.title}</h2>
          {post.description && <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm leading-6 text-mute">{post.description}</p>}

          <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-2.5 text-sm text-ink sm:grid-cols-2">
            {isEvent && post.event_date && <Detail icon={CalendarDays}>{formatEventDate(post.event_date)}</Detail>}
            {isEvent && post.start_time && <Detail icon={Clock3}>{formatEventTime(post.start_time)}{post.end_time ? ` – ${formatEventTime(post.end_time)}` : ''}</Detail>}
            {isEvent && post.venue && <Detail icon={MapPin}>{post.venue}</Detail>}
            <Detail icon={Building2}>{organizerLabel}</Detail>
            {isEvent && post.registration_required && canViewRegistrations && (
              <Detail icon={UsersRound}>{registrationCount}{post.capacity != null ? ` / ${post.capacity}` : ''} registered</Detail>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mute">
              <span>{scopeText(post)}</span>
              {post.visibility && <span>Audience: {post.visibility === 'all' ? 'Everyone' : post.visibility === 'student' ? 'Students' : 'Faculty'}</span>}
              {hasAttachment && <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">Open attachment</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {isEvent && post.registration_required && canViewRegistrations && post.approval === 'approved' && (
                <button type="button" onClick={openRegistrations} className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/15">View attendees</button>
              )}
              {canManage && <Link to={`/edit/${post.id}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-primary transition hover:bg-soft">Edit</Link>}
              {canManage && onDelete && <button onClick={() => onDelete(post.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-danger transition hover:bg-red-50">Delete</button>}
            </div>
          </div>
        </div>
      </div>
    </article>
    {registrationsOpen && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setRegistrationsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby={`attendees-title-${post.id}`} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-2xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Event registrations</p>
              <h2 id={`attendees-title-${post.id}`} className="mt-1 truncate text-lg font-extrabold text-ink sm:text-xl">{post.title}</h2>
              <p className="mt-1 text-sm text-mute">{registrations?.length ?? post.registration_count ?? 0} registered attendee{(registrations?.length ?? post.registration_count ?? 0) === 1 ? '' : 's'}</p>
            </div>
            <button type="button" aria-label="Close attendee list" onClick={() => setRegistrationsOpen(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-mute hover:bg-bg">Close</button>
          </header>

          <div className="border-b border-line px-5 py-3 sm:px-6">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, email, department, or course"
              className="min-h-11 w-full rounded-xl border border-line bg-bg px-4 text-sm text-ink outline-none transition placeholder:text-mute/75 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
            {registrationsLoading ? (
              <p className="py-12 text-center text-sm font-medium text-mute">Loading registrations…</p>
            ) : registrationsError ? (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{registrationsError}</p>
            ) : visibleRegistrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
                <p className="font-bold text-ink">{registrations?.length ? 'No matching attendees' : 'No registrations yet'}</p>
                <p className="mt-1 text-sm text-mute">{registrations?.length ? 'Try another search.' : 'Attendees will appear here after they register.'}</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-xl border border-line md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-bg text-xs uppercase tracking-wide text-mute">
                      <tr><th className="px-4 py-3 font-bold">Attendee</th><th className="px-4 py-3 font-bold">Department</th><th className="px-4 py-3 font-bold">Program</th><th className="px-4 py-3 font-bold">Registered</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {visibleRegistrations.map(row => <tr key={row.registration_id} className="align-top">
                        <td className="px-4 py-3"><p className="font-bold text-ink">{row.user_name}</p><p className="mt-0.5 text-xs text-mute">{row.email}</p><span className="mt-1 inline-block rounded-full bg-soft px-2 py-0.5 text-[11px] font-bold capitalize text-primary">{row.user_type}</span></td>
                        <td className="px-4 py-3 text-ink">{row.department_name || '—'}{row.department_code && <span className="block text-xs text-mute">{row.department_code}</span>}</td>
                        <td className="px-4 py-3 text-ink">{row.course || '—'}{row.batch && <span className="block text-xs text-mute">Batch {row.batch}{row.semester != null ? ` · Semester ${row.semester}` : ''}</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-mute">{formatRegistrationDate(row.registered_at)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {visibleRegistrations.map(row => <article key={row.registration_id} className="rounded-xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-bold text-ink">{row.user_name}</p><p className="mt-1 break-all text-xs text-mute">{row.email}</p></div><span className="flex-none rounded-full bg-soft px-2 py-1 text-[11px] font-bold capitalize text-primary">{row.user_type}</span></div>
                    <p className="mt-3 text-sm text-ink">{row.department_name || 'Department not set'}{row.department_code ? ` · ${row.department_code}` : ''}</p>
                    {(row.course || row.batch || row.semester != null) && <p className="mt-1 text-xs text-mute">{[row.course, row.batch && `Batch ${row.batch}`, row.semester != null && `Semester ${row.semester}`].filter(Boolean).join(' · ')}</p>}
                    <p className="mt-2 text-xs text-mute">Registered {formatRegistrationDate(row.registered_at)}</p>
                  </article>)}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    )}
    </>
  );
}

function formatRegistrationDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Detail({ icon: Icon, children }) {
  return <div className="flex min-w-0 items-start gap-2"><Icon size={16} className="mt-0.5 flex-none text-primary" /><span className="break-words">{children}</span></div>;
}

function formatEventDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatEventTime(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

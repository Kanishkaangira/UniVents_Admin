import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AttachmentUpload from '../components/AttachmentUpload';
import { useAdmin } from '../context/AdminContext';
import {
  createPost,
  fetchClubs,
  fetchDepartments,
  fetchPostsInScope,
  updatePost,
} from '../lib/data';

const EMPTY = {
  content_type: 'event',
  visibility: 'all',
  title: '',
  description: '',
  category: '',
  organizer_name: '',
  event_date: '',
  start_time: '',
  end_time: '',
  venue: '',
  registration_required: false,
  registration_deadline: '',
  capacity: '',
};

export default function PostForm() {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const { admin } = useAdmin();

  const [departments, setDepartments] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [organizerScope, setOrganizerScope] = useState(
    admin?.scope_type === 'super' ? 'university' : admin?.scope_type || 'university',
  );
  const [departmentId, setDepartmentId] = useState(admin?.department_id || '');
  const [clubId, setClubId] = useState(admin?.club_id || '');
  const [poster, setPoster] = useState(null); // { url, name, type }
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    Promise.all([fetchDepartments(), fetchClubs()])
      .then(([departmentRows, clubRows]) => {
        setDepartments(departmentRows || []);
        setClubs(clubRows || []);
        setLookupError('');
      })
      .catch(e => setLookupError(`Could not load departments and clubs: ${e.message}`));
  }, []);

  // Load the existing post when editing. The scope query and RLS naturally
  // blocks loading a post this admin isn't allowed to see or edit.
  useEffect(() => {
    if (!id) return;
    fetchPostsInScope()
      .then(posts => {
        const post = posts.find(p => p.id === id);
        if (!post) throw new Error('Post not found, or you do not have access to it.');
        setForm({
          content_type: post.content_type,
          visibility: post.visibility || 'all',
          title: post.title,
          description: post.description,
          category: post.category || '',
          organizer_name: post.organizer_name || '',
          event_date: post.event_date || '',
          start_time: post.start_time || '',
          end_time: post.end_time || '',
          venue: post.venue || '',
          registration_required: !!post.registration_required,
          registration_deadline: post.registration_deadline ? post.registration_deadline.slice(0, 16) : '',
          capacity: post.capacity ?? '',
        });
        setOrganizerScope(post.organizer_scope);
        setDepartmentId(post.department_id || '');
        setClubId(post.club_id || '');
        if (post.image_url) setPoster({ url: post.image_url, name: 'Poster', type: 'image' });
        if (post.attachment_url) {
          setAttachment({ url: post.attachment_url, name: post.attachment_name, type: post.attachment_type });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const isEvent = form.content_type === 'event';
  const statusPreview = getEventStatusPreview(form.event_date);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async e => {
    e.preventDefault();
    setError('');

    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.');
      return;
    }
    if (isEvent && (!form.event_date || !form.start_time || !form.venue.trim())) {
      setError('Date, start time, and venue are required for an event. End time is optional.');
      return;
    }

    const selectedDepartment = departments.find(item => item.id === departmentId);
    const selectedClub = clubs.find(item => item.id === clubId);
    if (organizerScope === 'department' && !departmentId && !id) {
      setError('Choose the department this post is for.');
      return;
    }
    if (organizerScope === 'club' && !clubId && !id) {
      setError('Choose the club this post is for.');
      return;
    }

    const defaultOrganizer = organizerScope === 'department'
      ? selectedDepartment?.name || 'Department'
      : organizerScope === 'club'
        ? selectedClub?.name || 'Club'
        : 'University Administration';

    const payload = {
      content_type: form.content_type,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || (isEvent ? 'General' : 'Update'),
      organizer_name: form.organizer_name.trim() || defaultOrganizer,
      organizer_scope: organizerScope,
      department_id: organizerScope === 'department' ? departmentId || null : null,
      club_id: organizerScope === 'club' ? clubId || null : null,
      visibility: form.visibility,
      ...(isEvent
        ? {
            event_date: form.event_date,
            start_time: form.start_time,
            end_time: form.end_time || null,
            venue: form.venue.trim(),
            registration_required: form.registration_required,
            registration_deadline: form.registration_required ? form.registration_deadline : null,
            capacity: form.registration_required && form.capacity !== '' ? Number(form.capacity) : null,
            image_url: poster?.url || null,
          }
        : {
            attachment_url: attachment?.url || null,
            attachment_type: attachment?.type || null,
            attachment_name: attachment?.name || null,
          }),
    };

    setSaving(true);
    try {
      const savedPost = id
        ? await updatePost(id, payload)
        : await createPost({ ...payload, created_by: admin.id });
      const postNotice = savedPost.approval === 'pending'
        ? 'Post submitted and awaiting super admin approval.'
        : savedPost.approval === 'rejected'
          ? 'Post was saved with rejected approval status.'
          : 'Post saved and approved.';
      navigate('/', { state: { postNotice } });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const scopeOptions = ['university', 'department', 'club'];
  const currentAdminOrganizer = admin?.scope_type === 'super'
    ? 'University'
    : admin?.scope_type === 'department'
      ? `Department · ${departments.find(item => item.id === admin.department_id)?.name || 'Your assigned department'}`
      : `Club · ${clubs.find(item => item.id === admin?.club_id)?.name || 'Your assigned club'}`;

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8 text-mute">Loading…</main>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink">{id ? 'Edit post' : 'New post'}</h1>
          <p className="text-sm text-mute">Posts within your admin scope are approved automatically. Posts for another organization are sent to a super admin for approval.</p>
        </div>

        <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card">
          {error && <p className="mb-4 font-semibold text-danger">{error}</p>}
          {lookupError && <p role="alert" className="mb-4 font-semibold text-danger">{lookupError}</p>}

          <div className="mb-5 inline-flex rounded-xl bg-bg p-1">
            {['event', 'notice'].map(t => (
              <button
                type="button"
                key={t}
                onClick={() => update('content_type', t)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${
                  form.content_type === t ? 'bg-white shadow-card text-primary' : 'text-mute'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Field label="Title *" value={form.title} onChange={v => update('title', v)} />
          <TextArea label="Description *" value={form.description} onChange={v => update('description', v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" value={form.category} onChange={v => update('category', v)} placeholder={isEvent ? 'Workshop, Fest…' : 'Exams, Deadline…'} />
            <Field
              label="Organizer name"
              value={form.organizer_name}
              onChange={v => update('organizer_name', v)}
              placeholder={organizerScope === 'department'
                ? 'e.g. Computer Science Department'
                : organizerScope === 'club'
                  ? 'e.g. Robotics Club'
                  : 'e.g. University Administration'}
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-mute">Visibility</label>
            <select
              value={form.visibility}
              onChange={e => update('visibility', e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
            >
              <option value="all">Everyone</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
            </select>
            <p className="mt-1 text-xs text-mute">Controls which account types can see this {isEvent ? 'event' : 'notice'}.</p>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-mute">Organized by</label>
            <div className="w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm font-semibold text-ink" aria-readonly="true">
              {currentAdminOrganizer}
            </div>
            <p className="mt-1 text-xs text-mute">Automatically assigned from your admin account.</p>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-semibold text-mute">Post level</label>
            <select
              value={organizerScope}
              onChange={e => setOrganizerScope(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
            >
              {scopeOptions.map(scope => (
                <option key={scope} value={scope}>
                  {scope === 'university' ? 'University' : scope === 'department' ? 'Department' : 'Club'}
                </option>
              ))}
            </select>
            {organizerScope === 'department' && (
              <select
                aria-label="Department this post is for"
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                <option value="">Select department</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.code ? `${department.code} · ` : ''}{department.name}
                  </option>
                ))}
              </select>
            )}
            {organizerScope === 'club' && (
              <select
                aria-label="Club this post is for"
                value={clubId}
                onChange={e => setClubId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                <option value="">Select club</option>
                {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
              </select>
            )}
            <p className="mt-1 text-xs text-mute">Choose where this post should appear. Requests outside your assigned scope go to a super admin for approval. Visibility controls who can see it after approval.</p>
          </div>

          {isEvent ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Field type="date" label="Date *" value={form.event_date} onChange={v => update('event_date', v)} />
                <Field type="time" label="Start time *" value={form.start_time} onChange={v => update('start_time', v)} />
                  <Field type="time" label="End time (optional)" value={form.end_time} onChange={v => update('end_time', v)} />
              </div>
              <Field label="Venue *" value={form.venue} onChange={v => update('venue', v)} />

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-mute">Event status · automatic</label>
                <div className="inline-flex min-w-32 items-center rounded-xl border border-primary/15 bg-soft px-4 py-2.5 text-sm font-bold text-primary" aria-readonly="true">
                  {statusPreview}
                </div>
                <p className="mt-1 text-xs text-mute">Based on the event date; this status cannot be changed manually.</p>
              </div>

              <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={form.registration_required}
                  onChange={e => update('registration_required', e.target.checked)}
                />
                Registration required
              </label>

              {form.registration_required && (
                <div className="grid grid-cols-2 gap-4">
                  <Field type="datetime-local" label="Registration deadline (optional)" value={form.registration_deadline} onChange={v => update('registration_deadline', v)} />
                  <Field type="number" label="Capacity limit (optional)" value={form.capacity} onChange={v => update('capacity', v)} placeholder="Leave blank for no limit" />
                </div>
              )}

              <AttachmentUpload
                bucket="event-posters"
                folder="Events Folder"
                accept="image/*"
                label="Poster image"
                value={poster}
                onChange={setPoster}
                onBusyChange={setUploading}
              />
            </>
          ) : (
            <AttachmentUpload
              bucket="event-posters"
              folder="Notice Folder"
              accept="application/pdf,image/*"
              label="Notice attachment (PDF or image)"
              helperText="The original filename is saved in the events table's attachment_name column."
              value={attachment}
              onChange={setAttachment}
              onBusyChange={setUploading}
            />
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-xl bg-gradient-to-r from-primary to-primary2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {uploading ? 'Uploading file…' : saving ? 'Saving…' : id ? 'Save changes' : 'Create post'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-mute hover:bg-bg"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-mute">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary"
      />
    </div>
  );
}

function getEventStatusPreview(eventDate) {
  if (!eventDate) return 'Upcoming';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const today = `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}-${parts.find(part => part.type === 'day').value}`;

  if (eventDate < today) return 'Completed';
  if (eventDate === today) return 'Live';
  return 'Upcoming';
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-mute">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-primary"
      />
    </div>
  );
}

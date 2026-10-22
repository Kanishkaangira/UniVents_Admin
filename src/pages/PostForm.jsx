import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AttachmentUpload from '../components/AttachmentUpload';
import { useAdmin } from '../context/AdminContext';
import {
  createPost,
  fetchClubs,
  fetchDepartments,
  fetchSkillFaculties,
  fetchPostsInScope,
  isRejectedPostEditableByAdmin,
  sendApprovedEventPush,
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
  const [skillFaculties, setSkillFaculties] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [existingApproval, setExistingApproval] = useState('');
  const [editingRejectedTargetPost, setEditingRejectedTargetPost] = useState(false);
  const [organizerScope, setOrganizerScope] = useState(
    admin?.scope_type === 'super'
      ? 'university'
      : admin?.scope_type === 'skill_faculty'
        ? 'department'
        : admin?.scope_type || 'university',
  );
  const [departmentId, setDepartmentId] = useState(admin?.department_id || '');
  const [skillFacultyId, setSkillFacultyId] = useState(admin?.skill_faculty_id || '');
  const [clubId, setClubId] = useState(admin?.club_id || '');
  const [poster, setPoster] = useState(null); // { url, name, type }
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    Promise.all([fetchDepartments(), fetchSkillFaculties(), fetchClubs()])
      .then(([departmentRows, facultyRows, clubRows]) => {
        setDepartments(departmentRows || []);
        setSkillFaculties(facultyRows || []);
        setClubs(clubRows || []);
        setLookupsLoaded(true);
        if (!id && admin?.scope_type === 'skill_faculty') {
          const hasDepartments = departmentRows.some(
            department => department.skill_faculty_id === admin.skill_faculty_id,
          );
          setOrganizerScope(hasDepartments ? 'department' : 'skill_faculty');
          setSkillFacultyId(admin.skill_faculty_id || '');
        }
        setLookupError('');
      })
      .catch(e => setLookupError(`Could not load Skill Faculties, departments, and clubs: ${e.message}`));
  }, [id, admin?.scope_type, admin?.skill_faculty_id]);

  // Load the existing post when editing. The scope query and RLS naturally
  // blocks loading a post this admin isn't allowed to see or edit.
  useEffect(() => {
    if (!id) return;
    fetchPostsInScope(
      admin?.id,
      admin?.scope_type,
      admin?.skill_faculty_id,
      admin?.department_id,
      admin?.club_id,
    )
      .then(posts => {
        const post = posts.find(p => p.id === id);
        if (!post) throw new Error('Post not found, or you do not have access to it.');
        const canResubmitRejectedPost = isRejectedPostEditableByAdmin(admin, post);
        if (post.created_by !== admin?.id && !canResubmitRejectedPost) {
          throw new Error('Only the post creator, its target-scope admin, or a Super admin can edit this post.');
        }
        setEditingRejectedTargetPost(
          post.created_by !== admin?.id
          && admin?.scope_type !== 'super'
          && canResubmitRejectedPost,
        );
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
        setExistingApproval(post.approval || '');
        setDepartmentId(post.department_id || '');
        setSkillFacultyId(post.skill_faculty_id || post.departments?.skill_faculty_id || '');
        setClubId(post.club_id || '');
        if (post.image_url) setPoster({ url: post.image_url, name: 'Poster', type: 'image' });
        if (post.attachment_url) {
          setAttachment({ url: post.attachment_url, name: post.attachment_name, type: post.attachment_type });
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, admin, admin?.id, admin?.scope_type, admin?.skill_faculty_id, admin?.department_id, admin?.club_id]);

  const isEvent = form.content_type === 'event';
  const todayDate = getTodayDate();
  const allowedDepartments = departments.filter(department =>
    department.skill_faculty_id === skillFacultyId,
  );
  const facultyHasNoDepartments = lookupsLoaded
    && organizerScope === 'department'
    && !!skillFacultyId
    && allowedDepartments.length === 0;
  const effectiveOrganizerScope = facultyHasNoDepartments ? 'skill_faculty' : organizerScope;
  const departmentSelection = facultyHasNoDepartments
    ? '__skill_faculty__'
    : departmentId;
  const selectedFacultyName = skillFaculties.find(
    faculty => faculty.id === skillFacultyId,
  )?.name || 'the selected Skill Faculty';

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
    if (isEvent && !id && form.event_date < todayDate) {
      setError('Choose today or a future date for a new event.');
      return;
    }

    const selectedDepartment = departments.find(item => item.id === departmentId);
    const selectedFaculty = skillFaculties.find(item => item.id === skillFacultyId);
    const selectedClub = clubs.find(item => item.id === clubId);
    if (!scopeOptions.includes(organizerScope) && !preservingExistingFacultyPost) {
      setError('Choose a valid publish level.');
      return;
    }
    if (organizerScope === 'department' && !departmentId && !facultyHasNoDepartments) {
      setError('Choose the department this post is for.');
      return;
    }
    if (organizerScope === 'club' && !clubId) {
      setError('Choose the club this post is for.');
      return;
    }
    if (organizerScope === 'skill_faculty' && !skillFacultyId) {
      setError('Choose the Skill Faculty this post is for.');
      return;
    }
    if (organizerScope === 'department' && !skillFacultyId) {
      setError('Choose a Skill Faculty before selecting a department.');
      return;
    }

    const defaultOrganizer = effectiveOrganizerScope === 'skill_faculty'
      ? selectedFaculty?.name || 'Skill Faculty'
      : effectiveOrganizerScope === 'department'
      ? selectedDepartment?.name || 'Department'
      : effectiveOrganizerScope === 'club'
        ? selectedClub?.name || 'Club'
        : 'University Administration';

    const payload = {
      content_type: form.content_type,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || (isEvent ? 'General' : 'Update'),
      organizer_name: form.organizer_name.trim() || defaultOrganizer,
      organizer_scope: effectiveOrganizerScope,
      skill_faculty_id: ['skill_faculty', 'department'].includes(effectiveOrganizerScope) ? skillFacultyId || null : null,
      department_id: effectiveOrganizerScope === 'department' ? departmentId || null : null,
      club_id: effectiveOrganizerScope === 'club' ? clubId || null : null,
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
      let pushNotice = '';
      if (
        savedPost.content_type === 'event'
        && savedPost.approval === 'approved'
        && !(id && existingApproval === 'rejected')
      ) {
        try {
          const pushResult = await sendApprovedEventPush(savedPost.id);
          pushNotice = pushResult?.sent
            ? ' A phone push notification was sent.'
            : pushResult?.reason === 'already_sent'
              ? ' Its phone push notification was already sent.'
              : ' No phone push notification was sent.';
        } catch (pushError) {
          pushNotice = ` The event was saved, but its phone push failed: ${pushError.message || 'Check the send-push Edge Function logs.'}`;
        }
      }
      const approvalDestination = savedPost.organizer_scope === 'skill_faculty'
        ? selectedFaculty?.name || 'the selected Skill Faculty'
        : savedPost.organizer_scope === 'department'
        ? selectedDepartment?.name || 'the selected department'
        : savedPost.organizer_scope === 'club'
          ? selectedClub?.name || 'the selected club'
          : 'super admins';
      const postNotice = savedPost.approval === 'pending'
        ? savedPost.organizer_scope === 'university'
          ? 'Post saved. It is now in the super admin Pending approvals inbox.'
          : `Post saved. It is now in the ${approvalDestination} admin Pending approvals inbox.`
        : savedPost.approval === 'rejected'
          ? 'Post was saved with rejected approval status.'
          : `Post saved and approved.${pushNotice}`;
      navigate('/', { state: { postNotice } });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasAssignedDepartments = departments.some(
    department => department.skill_faculty_id === admin?.skill_faculty_id,
  );
  const hasFixedFacultyLevel = admin?.scope_type === 'skill_faculty' && !hasAssignedDepartments;
  const scopeOptions = admin?.scope_type === 'skill_faculty'
    ? ['skill_faculty', 'university', 'department', 'club']
    : ['university', 'department', 'club'];
  const preservingExistingFacultyPost = !!id
    && organizerScope === 'skill_faculty'
    && (admin?.scope_type === 'super'
      || (admin?.scope_type === 'skill_faculty' && skillFacultyId === admin.skill_faculty_id));
  const currentAdminOrganizer = admin?.scope_type === 'super'
    ? 'University'
    : admin?.scope_type === 'skill_faculty'
      ? `Skill Faculty · ${skillFaculties.find(item => item.id === admin.skill_faculty_id)?.name || 'Your assigned Skill Faculty'}`
    : admin?.scope_type === 'department'
      ? `Department · ${departments.find(item => item.id === admin.department_id)?.name || 'Your assigned department'}`
      : `Club · ${clubs.find(item => item.id === admin?.club_id)?.name || 'Your assigned club'}`;
  const assignedFacultyName = skillFaculties.find(
    faculty => faculty.id === admin?.skill_faculty_id,
  )?.name || 'Your assigned Skill Faculty';
  const targetDescription = effectiveOrganizerScope === 'department'
    ? selectedTargetDepartmentName(departments, departmentId)
    : effectiveOrganizerScope === 'skill_faculty'
      ? selectedFacultyName
      : effectiveOrganizerScope === 'club'
        ? clubs.find(club => club.id === clubId)?.name || 'the selected club'
        : 'University';
  const isOwnPublishTarget = admin?.scope_type === 'super'
    || (admin?.scope_type === 'skill_faculty'
      && effectiveOrganizerScope === 'skill_faculty'
      && skillFacultyId === admin.skill_faculty_id)
    || (admin?.scope_type === 'department'
      && effectiveOrganizerScope === 'department'
      && departmentId === admin.department_id)
    || (admin?.scope_type === 'club'
      && effectiveOrganizerScope === 'club'
      && clubId === admin.club_id);
  const needsApproval = !!admin && !isOwnPublishTarget;
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 text-mute sm:px-6 md:px-8 md:py-9">Loading…</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">
        <div className="mx-auto max-w-5xl">
        <div className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Content workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{id ? 'Edit post' : 'New post'}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-mute">Choose where to publish this post. Posts outside your admin scope will wait for approval from the target organization.</p>
          {existingApproval === 'rejected' && (
            <p className="mt-3 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900">
              Save your changes to resubmit this rejected post. It will return to Pending until the target admin reviews it again.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6 lg:p-7">
          {error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          {lookupError && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger">{lookupError}</p>}

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
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Category" value={form.category} onChange={v => update('category', v)} placeholder={isEvent ? 'Workshop, Fest…' : 'Exams, Deadline…'} />
            <Field
              label="Organizer name"
              value={form.organizer_name}
              onChange={v => update('organizer_name', v)}
              placeholder={organizerScope === 'department'
                ? 'e.g. Computer Science Department'
                : organizerScope === 'skill_faculty'
                  ? 'e.g. Skill Faculty of Engineering and Technology'
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
            <label className="mb-1.5 block text-sm font-semibold text-mute">Publish level</label>
            {preservingExistingFacultyPost && !hasFixedFacultyLevel ? (
              <div className="w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm font-semibold text-ink">
                Existing Skill Faculty post
              </div>
            ) : (
              <select
                value={organizerScope}
                onChange={e => setOrganizerScope(e.target.value)}
                disabled={editingRejectedTargetPost}
                className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                {scopeOptions.map(scope => (
                  <option key={scope} value={scope}>
                    {scope === 'skill_faculty'
                      ? assignedFacultyName
                      : scope === 'department' && facultyHasNoDepartments
                        ? 'Skill Faculty'
                        : {university: 'University', department: 'Department', club: 'Club'}[scope]}
                  </option>
                ))}
              </select>
            )}
            {organizerScope === 'department' && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  aria-label="Target Skill Faculty for this department post"
                  required
                  value={skillFacultyId}
                  onChange={e => {
                    const nextFacultyId = e.target.value;
                    setSkillFacultyId(nextFacultyId);
                    setDepartmentId('');
                    if (admin?.scope_type === 'skill_faculty'
                      && nextFacultyId === admin.skill_faculty_id
                      && !departments.some(department => department.skill_faculty_id === nextFacultyId)) {
                      setOrganizerScope('skill_faculty');
                    }
                  }}
                  disabled={editingRejectedTargetPost}
                  className="w-full min-w-0 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="" disabled>Select target Skill Faculty</option>
                  {skillFaculties.map(faculty => <option key={faculty.id} value={faculty.id}>{faculty.code ? `${faculty.code} · ` : ''}{faculty.name}</option>)}
                </select>
                <select
                  aria-label="Target department or Skill Faculty under the selected Skill Faculty"
                  required
                  value={departmentSelection}
                  onChange={e => setDepartmentId(e.target.value === '__skill_faculty__' ? '' : e.target.value)}
                  disabled={!skillFacultyId || editingRejectedTargetPost}
                  className="w-full min-w-0 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="" disabled>{skillFacultyId ? 'Select target department' : 'Choose a Skill Faculty first'}</option>
                  {facultyHasNoDepartments && (
                    <option value="__skill_faculty__">{selectedFacultyName}</option>
                  )}
                  {allowedDepartments.map(department => (
                    <option key={department.id} value={department.id}>
                      {department.code ? `${department.code} · ` : ''}{department.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {facultyHasNoDepartments && organizerScope === 'department' && (
              <p className="mt-2 text-xs leading-5 text-mute">
                No departments are set up under this Skill Faculty. This post will target {selectedFacultyName} directly.
              </p>
            )}
            {organizerScope === 'club' && (
              <select
                aria-label="Target club for this post"
                required
                value={clubId}
                onChange={e => setClubId(e.target.value)}
                disabled={editingRejectedTargetPost}
                className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink"
              >
                <option value="" disabled>Select target club</option>
                {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
              </select>
            )}
            <p className="mt-1 text-xs leading-5 text-mute">
              {effectiveOrganizerScope === 'skill_faculty'
                ? `This post will be published under ${selectedFacultyName}.`
                : organizerScope === 'university'
                  ? 'University posts are sent to the super admin for approval.'
                  : 'Posts outside your scope need approval from the target admin.'}
            </p>
            {needsApproval && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                This post will be submitted to {targetDescription} for approval. It will appear in the app after the target admin approves it.
              </p>
            )}
          </div>

          {isEvent ? (
            <>
              <div className="mb-4 rounded-2xl border border-line bg-white p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-ink">Schedule</h2>
                  <span className="text-xs text-mute">Date and start time required</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    className="mb-0"
                    type="date"
                    label="Date *"
                    value={form.event_date}
                    onChange={v => update('event_date', v)}
                    min={!id ? todayDate : undefined}
                  />
                  <Field className="mb-0" type="time" label="Start time *" value={form.start_time} onChange={v => update('start_time', v)} />
                  <Field className="mb-0" type="time" label="End time (optional)" value={form.end_time} onChange={v => update('end_time', v)} />
                </div>
              </div>
              <Field label="Venue *" value={form.venue} onChange={v => update('venue', v)} />

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-mute">Event status</label>
                <div className="inline-flex min-w-32 items-center rounded-xl border border-primary/15 bg-soft px-4 py-2.5 text-sm font-bold text-primary" aria-readonly="true">
                  Upcoming
                </div>
                <p className="mt-1 text-xs text-mute">Events are shown as Upcoming in the admin panel.</p>
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
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
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

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-xl bg-gradient-to-r from-primary to-primary2 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {uploading ? 'Uploading file…' : saving ? 'Saving…' : id && existingApproval === 'rejected' ? 'Resubmit for approval' : id ? 'Save changes' : needsApproval ? 'Submit for approval' : 'Create post'}
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
        </div>
      </main>
    </div>
  );
}

function selectedTargetDepartmentName(departments, departmentId) {
  return departments.find(department => department.id === departmentId)?.name
    || 'the selected department';
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function Field({ label, value, onChange, type = 'text', placeholder, min, className = 'mb-4' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-mute">{label}</label>
      <div className={type === 'time' ? 'relative' : undefined}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          min={min}
          onChange={e => onChange(e.target.value)}
          onClick={e => {
            if (type === 'time' && typeof e.currentTarget.showPicker === 'function') {
              try {
                e.currentTarget.showPicker();
              } catch {
                // The browser may already have opened its native picker.
              }
            }
          }}
          required={label.includes('*')}
          aria-label={type === 'time' ? label.replace(' *', '') : undefined}
          className={`min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15${type === 'time' && !value ? ' text-transparent' : ''}`}
        />
        {type === 'time' && !value && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-mute/70">
            Select time
          </span>
        )}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-mute">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </div>
  );
}

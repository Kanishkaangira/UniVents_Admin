import { supabase } from './supabase';

const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

const addRegistrationCounts = async posts => {
  const eventIds = (posts || [])
    .filter(post => post.content_type === 'event' && post.registration_required)
    .map(post => post.id);
  if (eventIds.length === 0) return posts || [];

  const counts = check(await supabase.rpc('get_event_registration_counts', {
    p_event_ids: eventIds,
  }));
  const countByEventId = new Map((counts || []).map(row => [row.event_id, Number(row.registration_count)]));
  return posts.map(post => post.registration_required
    ? { ...post, registration_count: countByEventId.get(post.id) }
    : post);
};

// ---- lookups ----
export const fetchDepartments = () =>
  supabase.from('departments').select('id, name, code').order('name').then(check);

export const fetchClubs = () =>
  supabase.from('clubs').select('id, name, code').order('name').then(check);

// Resolve the logged-in user's admin row and scope through the database RPC.
export const fetchCurrentAdmin = async () => {
  const result = check(await supabase.rpc('current_admin'));
  // PostgREST returns SETOF/table functions as arrays. Keep support for a
  // wrapped object too, in case the RPC is changed to return JSON later.
  const row = Array.isArray(result)
    ? result[0]
    : result?.current_admin
      ? Array.isArray(result.current_admin) ? result.current_admin[0] : result.current_admin
      : result;

  if (!row || typeof row !== 'object') return null;

  return {
    ...row,
    id: row.id ?? row.admin_id ?? row.user_id ?? row.auth_user_id,
    email: row.email ?? row.admin_email,
    scope_type: row.scope_type ?? row.admin_scope ?? row.scope,
    department_id: row.department_id ?? null,
    club_id: row.club_id ?? null,
  };
};

// ---- super-admin management ----
export const fetchAdmins = () =>
  supabase.from('admins').select('id, email, scope_type, department_id, club_id').order('email').then(check);

export const saveAdmin = fields =>
  supabase.from('admins').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteAdmin = id =>
  supabase.from('admins').delete().eq('id', id).then(check);

export const saveDepartment = fields =>
  supabase.from('departments').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteDepartment = id =>
  supabase.from('departments').delete().eq('id', id).then(check);

export const saveClub = fields =>
  supabase.from('clubs').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteClub = id =>
  supabase.from('clubs').delete().eq('id', id).then(check);

// ---- events / notices ----
// RLS limits this list to posts the signed-in admin can see within their scope.
export const fetchPostsInScope = () =>
  supabase
    .from('events')
    .select('*, departments:department_id(name, code), clubs:club_id(name)')
    .order('created_at', { ascending: false })
    .then(check)
    .then(addRegistrationCounts);

export const fetchPostsCreatedBy = userId => {
  if (!userId) throw new Error('Your admin account is missing its user ID. Sign out and sign in again.');

  return supabase
    .from('events')
    .select('*, departments:department_id(name, code), clubs:club_id(name)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .then(check)
    .then(addRegistrationCounts);
};

export const fetchPendingPosts = () =>
  supabase.rpc('get_pending_admin_posts')
    .then(check)
    .then(addRegistrationCounts);

// Lightweight inbox count for the navigation badge. The RPC already routes
// each pending post to the signed-in admin's assigned scope.
export const fetchPendingApprovalCount = () =>
  supabase.rpc('get_pending_admin_posts').then(check).then(rows => (rows || []).length);

// Attendee details are returned only by a database RPC that checks the
// requesting admin's event scope. Do not query event_registrations directly.
export const fetchEventRegistrations = eventId =>
  supabase.rpc('get_event_registrants', { p_event_id: eventId }).then(check);

// Older/demo rows may contain a storage object path instead of a full public
// URL. Resolve those paths against the shared event-posters bucket.
export const getPublicStorageUrl = value => {
  if (!value) return '';
  if (/^(https?:|blob:|data:)/i.test(value)) return value;

  const objectPath = value
    .replace(/^\/+/, '')
    .replace(/^storage\/v1\/object\/public\/event-posters\//, '')
    .replace(/^event-posters\//, '');
  return supabase.storage.from('event-posters').getPublicUrl(objectPath).data.publicUrl;
};

export const createPost = fields =>
  supabase.from('events').insert(fields).select().single().then(check);

export const updatePost = (id, fields) =>
  supabase.from('events').update(fields).eq('id', id).select().single().then(check);

export const deletePost = id =>
  supabase.from('events').delete().eq('id', id).then(check);

export const setApproval = (id, approval) =>
  supabase.rpc('review_event_approval', {
    p_event_id: id,
    p_decision: approval,
  }).then(check);

// ---- attachments (poster image or notice PDF) ----
// bucket: 'event-posters' | 'notice-attachments'
export const uploadAttachment = async (bucket, file, folderOverride) => {
  const folderByBucket = {
    'event-posters': 'Events Folder',
    'notice-attachments': 'Notice Folder',
  };
  const folder = folderOverride || folderByBucket[bucket];
  if (!folder) throw new Error(`Unsupported upload bucket: ${bucket}`);
  if (!['Events Folder', 'Notice Folder'].includes(folder)) {
    throw new Error(`Unsupported upload folder: ${folder}`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

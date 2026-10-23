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
  supabase.from('department').select('id, name, code, skill_faculty_id').order('name').then(check);

export const fetchSkillFaculties = () =>
  supabase.from('skill_faculty').select('id, name, code').order('name').then(check);

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
    skill_faculty_id: row.skill_faculty_id ?? null,
    club_id: row.club_id ?? null,
  };
};

// ---- super-admin management ----
export const fetchAdmins = () =>
  supabase.from('admins').select('id, email, scope_type, department_id, skill_faculty_id, club_id').order('email').then(check);

export const saveAdmin = fields =>
  supabase.from('admins').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteAdmin = id =>
  supabase.from('admins').delete().eq('id', id).then(check);

export const saveDepartment = fields =>
  supabase.from('department').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteDepartment = id =>
  supabase.from('department').delete().eq('id', id).then(check);

export const saveSkillFaculty = fields =>
  supabase.from('skill_faculty').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteSkillFaculty = id =>
  supabase.from('skill_faculty').delete().eq('id', id).then(check);

export const saveClub = fields =>
  supabase.from('clubs').upsert(fields, { onConflict: 'id' }).select().single().then(check);

export const deleteClub = id =>
  supabase.from('clubs').delete().eq('id', id).then(check);

// ---- events / notices ----
// Used to load an existing post for editing; includes the creator's pending
// and rejected posts so they remain manageable in My posts.
export const fetchPostsInScope = (
  adminId = null,
  scopeType = null,
  skillFacultyId = null,
  departmentId = null,
  clubId = null,
) =>
  supabase
    .from('events')
    .select('*, departments:department_id(name, code, skill_faculty_id), skill_faculty:skill_faculty_id(name, code), clubs:club_id(name)')
    .order('created_at', { ascending: false })
    .then(check)
    .then(rows => (rows || []).filter(post => {
      if (!adminId || scopeType === 'super' || post.created_by === adminId) return true;
      if (scopeType === 'skill_faculty') {
        return post.skill_faculty_id === skillFacultyId
          && ['skill_faculty', 'department'].includes(post.organizer_scope);
      }
      if (scopeType === 'department') {
        return post.organizer_scope === 'department'
          && post.department_id === departmentId;
      }
      if (scopeType === 'club') {
        return post.organizer_scope === 'club' && post.club_id === clubId;
      }
      return false;
    }))
    .then(addRegistrationCounts);

// The shared All Posts page is for live content only. Pending and rejected
// posts stay in the creator's My posts and the target admin's review inbox.
export const fetchApprovedPosts = () =>
  supabase
    .from('events')
    .select('*, departments:department_id(name, code, skill_faculty_id), skill_faculty:skill_faculty_id(name, code), clubs:club_id(name)')
    .eq('approval', 'approved')
    .order('created_at', { ascending: false })
    .then(check)
    .then(addRegistrationCounts);

export const fetchPostsCreatedBy = userId => {
  if (!userId) throw new Error('Your admin account is missing its user ID. Sign out and sign in again.');

  return supabase
    .from('events')
    .select('*, departments:department_id(name, code, skill_faculty_id), skill_faculty:skill_faculty_id(name, code), clubs:club_id(name)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .then(check)
    .then(addRegistrationCounts);
};

export const isRejectedPostEditableByAdmin = (admin, post) => {
  if (!admin || post?.approval !== 'rejected') return false;
  if (admin.scope_type === 'super') return true;
  if (admin.scope_type === 'skill_faculty') {
    return ['skill_faculty', 'department'].includes(post.organizer_scope)
      && post.skill_faculty_id === admin.skill_faculty_id;
  }
  if (admin.scope_type === 'department') {
    return post.organizer_scope === 'department'
      && post.department_id === admin.department_id;
  }
  if (admin.scope_type === 'club') {
    return post.organizer_scope === 'club'
      && post.club_id === admin.club_id;
  }
  return false;
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
  supabase.from('events').delete().eq('id', id).select('id').then(check).then(rows => {
    if (!rows?.length) {
      throw new Error('Only the post creator or a Super admin can delete this post.');
    }
    return rows[0];
  });

export const setApproval = async (id, approval) => {
  const data = check(await supabase.rpc('review_event_approval', {
    p_event_id: id,
    p_decision: approval,
  }));
  return Array.isArray(data) ? data[0] : data;
};

export const sendApprovedPostPush = async eventId => {
  const { data, error } = await supabase.functions.invoke('send-push', {
    body: { event_id: eventId },
  });
  if (error) {
    let message = error.message;
    try {
      const response = error.context;
      if (response instanceof Response) {
        const body = await response.clone().json();
        message = body.error || message;
      }
    } catch {
      // Keep the SDK message if the function did not return a JSON error body.
    }
    throw new Error(message);
  }
  return data;
};

// Compatibility name used by the management notification flow.
export const sendApprovedEventPush = sendApprovedPostPush;

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

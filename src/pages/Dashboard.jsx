import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, FileText, Sparkles, Trash2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import {
  deletePost,
  fetchApprovedPosts,
  fetchPostsInScope,
  isRejectedPostEditableByAdmin,
} from '../lib/data';
import { useAdmin } from '../context/AdminContext';

export default function Dashboard({ mineOnly = true }) {
  const { admin, isSuper } = useAdmin();
  const location = useLocation();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [filter, setFilter] = useState('all'); // all | event | notice
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const adminId = admin?.id;
  const adminScope = admin?.scope_type;
  const skillFacultyId = admin?.skill_faculty_id;
  const departmentId = admin?.department_id;
  const clubId = admin?.club_id;
  const adminScopeKey = [adminId, adminScope, skillFacultyId, departmentId, clubId].join(':');

  useEffect(() => {
    let active = true;
    const requestKey = `${mineOnly ? 'mine' : 'scope'}:${adminScopeKey || 'missing'}`;

    if (mineOnly && !adminId) {
      return () => { active = false; };
    }

    const query = mineOnly
      ? fetchPostsInScope(adminId, adminScope, skillFacultyId, departmentId, clubId)
        .then(rows => rows.filter(post =>
          post.created_by === adminId || isRejectedPostEditableByAdmin(admin, post),
        ))
      : fetchApprovedPosts();
    query
      .then(rows => {
        if (active) {
          setPosts(rows || []);
          setLoadedFor(requestKey);
        }
      })
      .catch(e => {
        if (active) {
          setPosts([]);
          setError(e.message);
          setLoadedFor(requestKey);
        }
      });

    return () => { active = false; };
  }, [mineOnly, admin, adminId, adminScope, skillFacultyId, departmentId, clubId, adminScopeKey]);

  useEffect(() => {
    if (!deleteTarget) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !deleting) setDeleteTarget(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, deleting]);

  const requestKey = `${mineOnly ? 'mine' : 'scope'}:${adminScopeKey || 'missing'}`;
  const isLoading = loadedFor !== requestKey && !(mineOnly && !adminId);

  const handleDelete = id => {
    const post = posts?.find(item => item.id === id);
    if (!post) return;
    setDeleteError('');
    setDeleteTarget(post);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.id);
      setPosts(prev => prev.filter(post => post.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message || 'The post could not be deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const shown = posts?.filter(p => filter === 'all' || p.content_type === filter);
  const pageCopy = filter === 'event'
    ? { title: 'Your next campus moment starts here', detail: 'Explore events, workshops, and meetups happening across campus.', icon: CalendarDays }
    : filter === 'notice'
      ? { title: 'A clearer view of campus updates', detail: 'Find important announcements, reminders, and updates in one place.', icon: FileText }
      : { title: 'Good things happen on campus', detail: 'Browse the latest events and notices from your university community.', icon: Sparkles };
  const FeedIcon = pageCopy.icon;
  const emptyTitle = mineOnly
    ? filter === 'event'
      ? 'Your next campus moment is waiting to be shared.'
      : filter === 'notice'
        ? 'Your campus bulletin is ready for its first update.'
        : 'Your campus story starts with one post.'
    : filter === 'event'
      ? 'The event calendar is taking a little breather.'
      : filter === 'notice'
        ? 'The noticeboard is quiet for now.'
        : 'The campus feed is taking a little breather.';
  const emptyDetail = mineOnly
    ? filter === 'event'
      ? 'Share a workshop, meetup, or campus moment and bring people together.'
      : filter === 'notice'
        ? 'Post an update so students know what is happening around campus.'
        : 'Create an event or notice and let your campus community know.'
    : 'New updates will appear here as soon as they are approved and ready to go live.';

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">
        <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Content workspace</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{mineOnly ? 'My posts' : 'All Posts'}</h1>
            <p className="mt-1 text-sm text-mute">{mineOnly ? 'Manage your posts and resubmit rejected posts assigned to your scope.' : 'View approved events and notices from every department, Skill Faculty, club, and University.'}</p>
          </div>
          <Link
            to="/new"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-primary/90"
          >
            + New post
          </Link>
        </div>

        {location.state?.postNotice && (
          <div className="mb-5 rounded-xl border border-primary/15 bg-soft px-4 py-3 text-sm font-semibold text-primary">
            {location.state.postNotice}
          </div>
        )}

        <section className="feed-intro mb-5 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-r from-white via-white to-[#efedff] p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="feed-intro-icon flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FeedIcon size={23} />
              </span>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-ink sm:text-lg">{pageCopy.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-mute">{pageCopy.detail}</p>
              </div>
            </div>
            {!isLoading && <span className="w-fit rounded-full border border-primary/10 bg-white/80 px-3 py-1.5 text-xs font-bold text-primary">
              {shown?.length ?? 0} {filter === 'event' ? 'events' : filter === 'notice' ? 'notices' : 'posts'}
            </span>}
          </div>
        </section>

        <div className="mb-5 inline-flex rounded-xl border border-line bg-white p-1 shadow-sm" role="tablist" aria-label="Filter posts">
          {['all', 'event', 'notice'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              role="tab"
              aria-selected={filter === f}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-all duration-200 ${
                filter === f ? 'bg-soft text-primary shadow-sm' : 'text-mute hover:bg-bg hover:text-ink'
              }`}
            >
              {f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}
        </div>

        {mineOnly && !admin?.id && (
          <p className="mb-4 font-semibold text-danger">Your admin account ID is unavailable. Sign out and sign in again.</p>
        )}
        {error && <p className="mb-4 font-semibold text-danger">{error}</p>}

        {isLoading ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm font-medium text-mute" role="status">Loading your campus updates…</div>
        ) : shown.length === 0 ? (
          <section className="empty-feed rounded-3xl border border-white/80 bg-gradient-to-br from-white via-white to-[#f0efff] px-6 py-10 text-center shadow-card sm:px-10 sm:py-14" aria-live="polite">
            <div className="empty-feed-art mx-auto mb-6" aria-hidden="true">
              <span className="empty-feed-orbit empty-feed-orbit-one" />
              <span className="empty-feed-orbit empty-feed-orbit-two" />
              <span className="empty-feed-sparkle empty-feed-sparkle-one"><Sparkles size={15} /></span>
              <span className="empty-feed-sparkle empty-feed-sparkle-two"><span /></span>
              <span className="empty-feed-icon"><FeedIcon size={31} strokeWidth={1.8} /></span>
            </div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary/75">{filter === 'event' ? 'Campus events' : filter === 'notice' ? 'Campus notices' : 'Campus updates'}</p>
            <h2 className="mx-auto max-w-xl text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">{emptyTitle}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-mute">{emptyDetail}</p>
            {mineOnly ? (
              <Link to="/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.2)] transition hover:-translate-y-0.5 hover:bg-primary/90">
                Create your first post <ArrowRight size={16} />
              </Link>
            ) : (
              <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/15 bg-white px-5 py-3 text-sm font-bold text-primary transition hover:-translate-y-0.5 hover:bg-soft">
                View my posts <ArrowRight size={16} />
              </Link>
            )}
          </section>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((post, index) => {
              const canManage = isSuper
                || post.created_by === admin?.id
                || isRejectedPostEditableByAdmin(admin, post);
              const canDelete = isSuper || post.created_by === admin?.id;
              // Registration details and deletion remain limited to the creator
              // and Super admins; target admins can edit rejected posts only.
              const canViewRegistrations = post.created_by === admin?.id;
              return <div key={post.id} className="feed-card-enter" style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}><PostCard post={post} onDelete={handleDelete} canManage={canManage} canDelete={canDelete} canViewRegistrations={canViewRegistrations} /></div>;
            })}
          </div>
        )}

        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
            onMouseDown={event => {
              if (event.target === event.currentTarget && !deleting) setDeleteTarget(null);
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-post-title"
              aria-describedby="delete-post-description"
              className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-red-50 text-danger">
                  <AlertTriangle size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="delete-post-title" className="text-lg font-bold text-ink">Delete this post?</h2>
                  <p id="delete-post-description" className="mt-1 break-words text-sm leading-6 text-mute">
                    “{deleteTarget.title}” will be permanently removed. This action can’t be undone.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close delete confirmation"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg p-1.5 text-mute transition hover:bg-bg hover:text-ink disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              {deleteError && <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-danger">{deleteError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-mute transition hover:bg-bg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white transition hover:bg-danger/90 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {deleting ? 'Deleting…' : 'Delete post'}
                </button>
              </div>
            </section>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

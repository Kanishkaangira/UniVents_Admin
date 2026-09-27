import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import { deletePost, fetchPostsCreatedBy, fetchPostsInScope } from '../lib/data';
import { useAdmin } from '../context/AdminContext';

export default function Dashboard({ mineOnly = true }) {
  const { admin, isSuper } = useAdmin();
  const location = useLocation();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [filter, setFilter] = useState('all'); // all | event | notice

  useEffect(() => {
    let active = true;
    const requestKey = `${mineOnly ? 'mine' : 'scope'}:${admin?.id || 'missing'}`;

    if (mineOnly && !admin?.id) {
      return () => { active = false; };
    }

    const query = mineOnly
      ? fetchPostsCreatedBy(admin.id, admin.scope_type)
      : fetchPostsInScope();
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
  }, [mineOnly, admin?.id, admin?.scope_type]);

  const requestKey = `${mineOnly ? 'mine' : 'scope'}:${admin?.id || 'missing'}`;
  const isLoading = loadedFor !== requestKey && !(mineOnly && !admin?.id);

  const handleDelete = async id => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  const shown = posts?.filter(p => filter === 'all' || p.content_type === filter);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">
        <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Content workspace</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{mineOnly ? 'My posts' : 'All Posts'}</h1>
            <p className="mt-1 text-sm text-mute">{mineOnly ? 'Manage events and notices created by your admin account.' : 'Review events and notices available within your admin scope.'}</p>
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

        <div className="mb-5 inline-flex rounded-xl border border-line bg-white p-1 shadow-sm">
          {['all', 'event', 'notice'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${
                filter === f ? 'bg-soft text-primary' : 'text-mute'
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
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm font-medium text-mute">Loading posts…</div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center shadow-sm">
            <p className="font-semibold text-ink">{mineOnly ? 'You have not created any posts yet' : 'No posts in this scope'}</p>
            <p className="mt-1 text-sm text-mute">{mineOnly ? 'Create a new event or notice to see it here.' : 'Posts visible to your admin scope will appear here.'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map(post => {
              const canManage = isSuper || post.created_by === admin?.id;
              // Registration information belongs to the admin who created
              // the event, even when another admin can view the scoped post.
              const canViewRegistrations = post.created_by === admin?.id;
              return <PostCard key={post.id} post={post} onDelete={handleDelete} canManage={canManage} canViewRegistrations={canViewRegistrations} />;
            })}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

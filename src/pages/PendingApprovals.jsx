import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import { fetchPendingPosts, setApproval } from '../lib/data';
import { useAdmin } from '../context/AdminContext';

export default function PendingApprovals() {
  const { admin } = useAdmin();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetchPendingPosts()
      .then(setPosts)
      .catch(e => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, decision) => {
    try {
      await setApproval(id, decision);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-9">
        <div className="mx-auto max-w-6xl">
        <div className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">Review queue</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Pending approvals</h1>
          <p className="mt-1 text-sm text-mute">
        {admin?.scope_type === 'super'
          ? 'Pending posts waiting for super admin review.'
          : admin?.scope_type === 'department'
            ? 'Posts targeted to your department are waiting for review.'
            : 'Posts targeted to your club are waiting for review.'}
      </p>
        </div>

        {error && <p className="mb-4 font-semibold text-danger">{error}</p>}

        {!posts ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm font-medium text-mute">Loading requests…</div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center shadow-sm">
            <p className="font-semibold text-ink">Nothing pending</p>
            <p className="mt-1 text-sm text-mute">Posts sent to your assigned organization will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                canManage={false}
                canViewRegistrations={post.created_by === admin?.id}
                actions={
                  <>
                    <button
                      onClick={() => decide(post.id, 'approved')}
                      className="rounded-lg bg-success/10 px-3 py-1.5 text-sm font-semibold text-success"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(post.id, 'rejected')}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-danger"
                    >
                      Reject
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

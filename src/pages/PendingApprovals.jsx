import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import { fetchPendingPosts, setApproval } from '../lib/data';

export default function PendingApprovals() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetchPendingPosts()
      .then(setPosts)
      .catch(e => setError(e.message));
  };

  useEffect(load, []);

  const decide = async (id, decision) => {
    try {
      await setApproval(id, decision);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink">Pending approvals</h1>
          <p className="text-sm text-mute">University-wide requests waiting for your review</p>
        </div>

        {error && <p className="mb-4 font-semibold text-danger">{error}</p>}

        {!posts ? (
          <p className="text-mute">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="font-semibold text-ink">Nothing pending</p>
            <p className="mt-1 text-sm text-mute">New university-wide requests will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
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
      </main>
    </div>
  );
}

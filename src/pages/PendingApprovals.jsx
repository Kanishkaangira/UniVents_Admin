import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import { fetchPendingPosts, sendApprovedEventPush, setApproval } from '../lib/data';
import { useAdmin } from '../context/AdminContext';

export default function PendingApprovals() {
  const { admin } = useAdmin();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchPendingPosts()
        .then(rows => {
          if (active) {
            setPosts(rows);
            setError('');
          }
        })
        .catch(e => {
          if (active) setError(e.message);
        });
    };

    load();
    const intervalId = window.setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', load);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!decisionTarget) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !saving) setDecisionTarget(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [decisionTarget, saving]);

  const decide = async () => {
    if (!decisionTarget || saving) return;
    const { post, decision } = decisionTarget;
    setSaving(true);
    setDecisionError('');
    try {
      const reviewedPost = await setApproval(post.id, decision);
      setPosts(prev => prev.filter(item => item.id !== post.id));
      setDecisionTarget(null);
      if (decision === 'approved' && reviewedPost?.content_type === 'event') {
        try {
          const pushResult = await sendApprovedEventPush(reviewedPost.id);
          setNotice(pushResult?.sent
            ? `${post.title} was approved and a push notification was sent.`
            : `${post.title} was approved. ${pushResult?.reason === 'already_sent' ? 'Its push notification was already sent.' : 'No push notification was sent.'}`);
        } catch (pushError) {
          setNotice(`${post.title} was approved, but the push notification failed: ${pushError.message || 'Check the send-push Edge Function logs.'}`);
        }
      } else {
        setNotice(`${post.title} was ${decision === 'approved' ? 'approved' : 'rejected'}.`);
      }
    } catch (e) {
      setDecisionError(e.message || 'The approval decision could not be saved. Please try again.');
    } finally {
      setSaving(false);
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
            : admin?.scope_type === 'skill_faculty'
              ? 'Posts targeted to your Skill Faculty are waiting for review.'
            : 'Posts targeted to your club are waiting for review.'}
      </p>
        </div>

        {error && <p className="mb-4 font-semibold text-danger">{error}</p>}

        {notice && (
          <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
            <CheckCircle2 size={18} className="flex-none" />
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')} className="ml-auto rounded-lg p-1 text-emerald-700 hover:bg-emerald-100">
              <X size={16} />
            </button>
          </div>
        )}

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
                      onClick={() => { setDecisionError(''); setDecisionTarget({ post, decision: 'approved' }); }}
                      className="rounded-lg bg-success/10 px-3 py-1.5 text-sm font-semibold text-success"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setDecisionError(''); setDecisionTarget({ post, decision: 'rejected' }); }}
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

        {decisionTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
            onMouseDown={event => {
              if (event.target === event.currentTarget && !saving) setDecisionTarget(null);
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="approval-decision-title"
              aria-describedby="approval-decision-description"
              className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${decisionTarget.decision === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-danger'}`}>
                  {decisionTarget.decision === 'approved' ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="approval-decision-title" className="text-lg font-bold text-ink">
                    {decisionTarget.decision === 'approved' ? 'Approve this post?' : 'Reject this post?'}
                  </h2>
                  <p id="approval-decision-description" className="mt-1 break-words text-sm leading-6 text-mute">
                    {decisionTarget.post.title} will be marked {decisionTarget.decision}. {decisionTarget.decision === 'approved' ? 'It can then appear in the app.' : 'It will stay hidden from app users.'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close approval confirmation"
                  disabled={saving}
                  onClick={() => setDecisionTarget(null)}
                  className="rounded-lg p-1.5 text-mute transition hover:bg-bg hover:text-ink disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              {decisionError && <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-danger">{decisionError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setDecisionTarget(null)}
                  className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-mute transition hover:bg-bg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={decide}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-wait disabled:opacity-60 ${decisionTarget.decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-danger hover:bg-danger/90'}`}
                >
                  {saving ? 'Saving…' : decisionTarget.decision === 'approved' ? 'Approve post' : 'Reject post'}
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

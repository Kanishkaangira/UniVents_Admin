import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { fetchPendingPosts } from '../lib/data';
import { supabase } from '../lib/supabase';

export default function PendingApprovalNotifier() {
  const { admin } = useAdmin();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!admin?.id) {
      setNotifications([]);
      return undefined;
    }

    let active = true;
    let knownPostIds = null;
    const realtimeCandidates = new Set();
    const refresh = () => {
      fetchPendingPosts()
        .then(posts => {
          if (!active) return;
          const currentIds = new Set((posts || []).map(post => post.id));
          const incoming = (posts || []).filter(post => knownPostIds
            ? !knownPostIds.has(post.id)
            : realtimeCandidates.has(post.id));
          realtimeCandidates.clear();
          if (incoming.length) {
            const timestamp = Date.now();
            setNotifications(previous => [
              ...incoming.slice(0, 3).map((post, index) => ({
                id: `${post.id}-${timestamp}-${index}`,
                title: post.title || 'New post',
              })),
              ...previous,
            ].slice(0, 3));
          }
          knownPostIds = currentIds;
        })
        .catch(() => {});
    };

    refresh();
    const channel = supabase
      .channel(`pending-approvals-${admin.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events',
      }, payload => {
        const insertedPost = payload.new;
        const becamePending = insertedPost?.approval === 'pending'
          && (payload.eventType === 'INSERT' || payload.old?.approval !== 'pending');
        if (becamePending && insertedPost.id) {
          realtimeCandidates.add(insertedPost.id);
          refresh();
        }
      })
      .subscribe();
    const intervalId = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      supabase.removeChannel(channel);
    };
  }, [admin?.id]);

  useEffect(() => {
    if (!notifications.length) return undefined;
    const timeoutId = window.setTimeout(() => setNotifications([]), 12000);
    return () => window.clearTimeout(timeoutId);
  }, [notifications]);

  if (!notifications.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {notifications.map(notification => (
        <div key={notification.id} className="rounded-2xl border border-primary/15 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-soft text-primary">
              <BellRing size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">A post is waiting for your approval</p>
              <p className="mt-0.5 truncate text-xs text-mute" title={notification.title}>{notification.title}</p>
              <Link to="/pending" className="mt-2 inline-flex text-xs font-bold text-primary hover:underline">
                Review post
              </Link>
            </div>
            <button
              type="button"
              aria-label="Dismiss approval notification"
              onClick={() => setNotifications(previous => previous.filter(item => item.id !== notification.id))}
              className="rounded-lg p-1 text-mute hover:bg-bg hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

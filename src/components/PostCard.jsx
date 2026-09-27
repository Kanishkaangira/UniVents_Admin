import { Link } from 'react-router-dom';
import ApprovalBadge from './ApprovalBadge';

const scopeText = post => {
  if (post.organizer_scope === 'university') return 'University-wide';
  if (post.organizer_scope === 'department') return post.departments?.name || 'Department';
  if (post.organizer_scope === 'club') return post.clubs?.name || 'Club';
  return post.organizer_scope;
};

export default function PostCard({ post, onDelete, actions, canManage = true }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-bold text-primary">
            {post.content_type === 'notice' ? 'Notice' : 'Event'}
          </span>
          {post.content_type === 'event' && post.registration_required && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {post.registration_count ?? 0} registered
              {post.capacity != null ? ` / ${post.capacity}` : ''}
            </span>
          )}
          <ApprovalBadge approval={post.approval} />
        </div>
        <p className="truncate font-bold text-ink">{post.title}</p>
        <p className="mt-1 text-sm text-mute">
          {scopeText(post)}
          {post.content_type === 'event' && post.event_date ? ` · ${post.event_date}` : ''}
        </p>
      </div>

      <div className="flex flex-none items-center gap-2">
        {actions}
        {canManage && <Link
          to={`/edit/${post.id}`}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-soft"
        >
          Edit
        </Link>}
        {canManage && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

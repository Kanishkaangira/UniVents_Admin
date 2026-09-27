const STYLES = {
  approved: 'bg-green-50 text-success',
  pending: 'bg-orange-50 text-accent',
  rejected: 'bg-red-50 text-danger',
};

const LABELS = {
  approved: 'Approved',
  pending: 'Awaiting approval',
  rejected: 'Rejected',
};

export default function ApprovalBadge({ approval }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STYLES[approval] || STYLES.pending}`}>
      {LABELS[approval] || approval}
    </span>
  );
}

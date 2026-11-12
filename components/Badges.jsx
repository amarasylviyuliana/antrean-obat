import { STATUS_LABEL, STATUS_COLOR, PAY_LABEL, PAY_COLOR } from '@/lib/constants';

export function StatusBadge({ status, label }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status] || 'bg-slate-100'}`}>
      {label || STATUS_LABEL[status] || status}
    </span>
  );
}

export function PayBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAY_COLOR[status] || 'bg-slate-100'}`}>
      {PAY_LABEL[status] || status}
    </span>
  );
}

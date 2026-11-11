import { STATUS_FR, tone } from '@/lib/format';
export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge badge-${tone(status)}`}>{label ?? STATUS_FR[status] ?? status}</span>;
}

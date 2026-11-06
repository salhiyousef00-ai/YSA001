import type { Transaction, UserRole } from '@wasla/shared';

export interface WalletSummary { inEscrow: number; released: number; refunded: number; commission: number; net: number }

/** Agrégats du séquestre à partir de l'historique (immuable) des transactions. */
export function summarize(txs: Pick<Transaction, 'type' | 'amount_cents'>[], role: UserRole): WalletSummary {
  const sum = (t: Transaction['type']) => txs.filter((x) => x.type === t).reduce((a, x) => a + x.amount_cents, 0);
  const deposit = sum('deposit'), release = sum('release'), commission = sum('commission'), refund = sum('refund');
  return {
    inEscrow: deposit - release - commission - refund,
    released: release + commission,
    refunded: refund,
    commission,
    net: role === 'provider' ? release : -(deposit - refund),
  };
}

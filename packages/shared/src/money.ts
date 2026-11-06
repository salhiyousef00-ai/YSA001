/** Tous les montants sont en centimes de MAD (entiers) pour éviter les erreurs d'arrondi. */
export type Cents = number;

export const DEFAULT_COMMISSION_RATE = 0.15;

export function toCents(mad: number): Cents {
  if (!Number.isFinite(mad) || mad < 0) throw new RangeError('Montant invalide');
  return Math.round(mad * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

export function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new RangeError('Le taux de commission doit être dans [0, 1[');
  }
}

/** Répartition d'une libération : commission arrondie au centime (half-up), le reste au prestataire. */
export function splitRelease(amount: Cents, rate: number): { commission: Cents; payout: Cents } {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('Montant invalide');
  assertRate(rate);
  const commission = Math.round(amount * rate);
  return { commission, payout: amount - commission };
}

export function formatMAD(cents: Cents, locale = 'fr-MA'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'MAD' }).format(cents / 100);
}

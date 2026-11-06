import { describe, expect, it } from '@jest/globals';
import { summarize } from './wallet';

describe('summarize', () => {
  const txs = [
    { type: 'deposit' as const, amount_cents: 100_000 },
    { type: 'release' as const, amount_cents: 85_000 },
    { type: 'commission' as const, amount_cents: 15_000 },
    { type: 'deposit' as const, amount_cents: 50_000 },
    { type: 'deposit' as const, amount_cents: 20_000 },
    { type: 'refund' as const, amount_cents: 20_000 },
  ];
  it('séquestre = dépôts − libérations − commissions − remboursements', () => {
    expect(summarize(txs, 'client').inEscrow).toBe(50_000);
  });
  it('net prestataire = versements hors commission', () => {
    expect(summarize(txs, 'provider').net).toBe(85_000);
  });
  it('net client = dépenses effectives', () => {
    expect(summarize(txs, 'client').net).toBe(-150_000);
  });
});

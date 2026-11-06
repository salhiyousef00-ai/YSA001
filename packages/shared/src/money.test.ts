import { describe, expect, it } from 'vitest';
import { SimulatedPaymentProvider, splitRelease, toCents, DEFAULT_COMMISSION_RATE } from './index';

describe('splitRelease', () => {
  it('commission 15 % par défaut', () => {
    expect(splitRelease(100_000, DEFAULT_COMMISSION_RATE)).toEqual({ commission: 15_000, payout: 85_000 });
  });
  it('commission + payout = montant (pas de centime perdu)', () => {
    for (const amount of [1, 33, 999, 12_345, 777_777]) {
      const { commission, payout } = splitRelease(amount, 0.15);
      expect(commission + payout).toBe(amount);
    }
  });
  it('rejette les taux et montants invalides', () => {
    expect(() => splitRelease(100, 1)).toThrow();
    expect(() => splitRelease(100, -0.1)).toThrow();
    expect(() => splitRelease(10.5, 0.15)).toThrow();
  });
  it('toCents arrondit', () => {
    expect(toCents(12.345)).toBe(1235);
    expect(() => toCents(-1)).toThrow();
  });
});

describe('SimulatedPaymentProvider', () => {
  it('retourne une référence', async () => {
    const p = new SimulatedPaymentProvider();
    const r = await p.deposit({ milestoneId: 'm', amount: 100, payerId: 'u' });
    expect(r.ok).toBe(true);
    expect(r.providerRef).toMatch(/^sim_dep_/);
  });
  it('refuse un montant nul et simule un échec', async () => {
    expect((await new SimulatedPaymentProvider().release({ milestoneId: 'm', amount: 0, payeeId: 'u' })).ok).toBe(false);
    expect((await new SimulatedPaymentProvider({ failNext: true }).refund({ milestoneId: 'm', amount: 5, payerId: 'u' })).ok).toBe(false);
  });
});

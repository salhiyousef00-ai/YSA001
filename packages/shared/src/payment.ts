import type { Cents } from './money';

/**
 * Interface à implémenter pour brancher un vrai prestataire de paiement (CMI, Stripe, ...).
 * Le MVP utilise SimulatedPaymentProvider : aucun mouvement de fonds réel.
 */
export interface PaymentResult {
  ok: boolean;
  providerRef: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Le client dépose (bloque) le montant d'une étape sur le compte séquestre. */
  deposit(input: { milestoneId: string; amount: Cents; payerId: string }): Promise<PaymentResult>;
  /** Libère les fonds au prestataire (montant net de commission). */
  release(input: { milestoneId: string; amount: Cents; payeeId: string }): Promise<PaymentResult>;
  /** Rembourse le client. */
  refund(input: { milestoneId: string; amount: Cents; payerId: string }): Promise<PaymentResult>;
}

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';
  private seq = 0;
  constructor(private readonly opts: { failNext?: boolean } = {}) {}

  private result(kind: string, amount: Cents): PaymentResult {
    if (this.opts.failNext) {
      this.opts.failNext = false;
      return { ok: false, providerRef: '', error: 'simulated_failure' };
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, providerRef: '', error: 'invalid_amount' };
    }
    this.seq += 1;
    return { ok: true, providerRef: `sim_${kind}_${Date.now()}_${this.seq}` };
  }

  async deposit(i: Parameters<PaymentProvider['deposit']>[0]) { return this.result('dep', i.amount); }
  async release(i: Parameters<PaymentProvider['release']>[0]) { return this.result('rel', i.amount); }
  async refund(i: Parameters<PaymentProvider['refund']>[0]) { return this.result('ref', i.amount); }
}

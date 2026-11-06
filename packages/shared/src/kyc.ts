import type { DocType, VerificationStatus } from './enums';

/**
 * Adapter KYC. Pour le MVP : ManualKycProvider (validation manuelle par un admin).
 * Plus tard : SumsubKycProvider / OnfidoKycProvider implémentant la même interface.
 */
export interface KycSubmission {
  providerId: string;
  documents: { type: DocType; storagePath: string }[];
}

export interface KycProvider {
  readonly name: string;
  submit(sub: KycSubmission): Promise<{ externalId: string | null }>;
  getStatus(providerId: string): Promise<VerificationStatus>;
}

export class ManualKycProvider implements KycProvider {
  readonly name = 'manual';
  constructor(private readonly lookup: (providerId: string) => Promise<VerificationStatus>) {}
  async submit(): Promise<{ externalId: string | null }> {
    // Rien à faire : les documents sont déjà en base, un admin les examine dans la file d'attente.
    return { externalId: null };
  }
  getStatus(providerId: string) { return this.lookup(providerId); }
}

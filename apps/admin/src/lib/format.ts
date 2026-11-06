export { formatMAD } from '@wasla/shared';
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const STATUS_FR: Record<string, string> = {
  draft: 'Brouillon', open: 'Ouverte', quoted: 'Devis reçus', in_progress: 'En cours', completed: 'Terminée', disputed: 'En litige', cancelled: 'Annulée',
  pending: 'En attente', funded: 'Financée', submitted: 'Rapport envoyé', approved: 'Validée', released: 'Payée', refunded: 'Remboursée',
  verified: 'Vérifié', rejected: 'Refusé', suspended: 'Suspendu',
  deposit: 'Dépôt', release: 'Versement', commission: 'Commission', refund: 'Remboursement',
  resolved_release: 'Résolu : versé', resolved_refund: 'Résolu : remboursé', resolved_resubmit: 'Résolu : à refaire',
};
export const DOC_FR: Record<string, string> = {
  cin_front: 'CIN recto', cin_back: 'CIN verso', selfie: 'Selfie', anthropometric: 'Fiche anthropométrique',
  legal_status: 'Statut AE / ICE', diploma: 'Diplôme', insurance: 'Assurance',
};
const TONE: Record<string, string> = {
  verified: 'success', completed: 'success', released: 'success', approved: 'success',
  pending: 'warning', submitted: 'warning', open: 'info', quoted: 'info', in_progress: 'primary', funded: 'info',
  rejected: 'danger', disputed: 'danger', suspended: 'danger',
};
export const tone = (s: string) => TONE[s] ?? 'neutral';

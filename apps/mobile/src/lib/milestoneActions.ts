import type { MilestoneStatus, UserRole } from '@wasla/shared';
import { canTransitionMilestone } from '@wasla/shared';

export type MilestoneAction = 'fund' | 'report' | 'approve' | 'dispute' | 'view';

/** Actions disponibles pour un rôle donné — reflète les contrôles serveur (RPC). */
export function milestoneActions(status: MilestoneStatus, role: UserRole, missionActive: boolean): MilestoneAction[] {
  const out: MilestoneAction[] = [];
  if (missionActive) {
    if (role === 'client' && canTransitionMilestone(status, 'funded') && status === 'pending') out.push('fund');
    if (role === 'provider' && canTransitionMilestone(status, 'submitted') && status === 'funded') out.push('report');
    if (role === 'client' && status === 'submitted') out.push('approve', 'dispute');
  }
  if (['submitted', 'approved', 'disputed', 'released'].includes(status)) out.push('view');
  return out;
}

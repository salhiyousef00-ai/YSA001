import type { MilestoneStatus, MissionStatus } from './enums';

/**
 * Transitions autorisées. Miroir exact des contrôles SQL (supabase/migrations/*_rpc.sql).
 * Toute modification ici DOIT être répercutée côté SQL (et inversement).
 */
export const MISSION_TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['quoted', 'cancelled'],
  quoted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'disputed', 'cancelled'],
  disputed: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const MILESTONE_TRANSITIONS: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  pending: ['funded'],
  funded: ['submitted', 'refunded'],
  submitted: ['approved', 'disputed', 'submitted'],
  approved: ['released'],
  disputed: ['released', 'refunded', 'funded'],
  released: [],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Invalid ${entity} transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return MILESTONE_TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) throw new InvalidTransitionError('mission', from, to);
}

export function assertMilestoneTransition(from: MilestoneStatus, to: MilestoneStatus): void {
  if (!canTransitionMilestone(from, to)) throw new InvalidTransitionError('milestone', from, to);
}

/** Une mission est terminée lorsque toutes ses étapes sont libérées (ou remboursées, au moins une libérée). */
export function deriveMissionCompletion(milestones: readonly MilestoneStatus[]): boolean {
  if (milestones.length === 0) return false;
  const terminal = milestones.every((s) => s === 'released' || s === 'refunded');
  return terminal && milestones.some((s) => s === 'released');
}

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = ['completed', 'cancelled'];

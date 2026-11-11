import { describe, expect, it } from 'vitest';
import {
  MILESTONE_STATUSES, MISSION_STATUSES, assertMilestoneTransition, canTransitionMilestone,
  canTransitionMission, deriveMissionCompletion, MISSION_TRANSITIONS,
} from './index';

describe('mission state machine', () => {
  it('suit le chemin nominal', () => {
    expect(canTransitionMission('draft', 'open')).toBe(true);
    expect(canTransitionMission('open', 'quoted')).toBe(true);
    expect(canTransitionMission('quoted', 'in_progress')).toBe(true);
    expect(canTransitionMission('in_progress', 'completed')).toBe(true);
  });
  it('interdit de sauter des étapes ou de sortir d’un état terminal', () => {
    expect(canTransitionMission('open', 'in_progress')).toBe(false);
    expect(canTransitionMission('completed', 'in_progress')).toBe(false);
    expect(canTransitionMission('cancelled', 'open')).toBe(false);
  });
  it('couvre tous les statuts', () => {
    expect(Object.keys(MISSION_TRANSITIONS).sort()).toEqual([...MISSION_STATUSES].sort());
  });
});

describe('milestone state machine (séquestre)', () => {
  it('impose dépôt avant rapport et validation avant libération', () => {
    expect(canTransitionMilestone('pending', 'submitted')).toBe(false);
    expect(canTransitionMilestone('pending', 'funded')).toBe(true);
    expect(canTransitionMilestone('funded', 'released')).toBe(false);
    expect(canTransitionMilestone('submitted', 'released')).toBe(false);
    expect(canTransitionMilestone('approved', 'released')).toBe(true);
  });
  it('litige : libération ou remboursement', () => {
    expect(canTransitionMilestone('disputed', 'released')).toBe(true);
    expect(canTransitionMilestone('disputed', 'refunded')).toBe(true);
  });
  it('ne rembourse jamais une étape non financée ou déjà libérée', () => {
    expect(canTransitionMilestone('pending', 'refunded')).toBe(false);
    expect(canTransitionMilestone('released', 'refunded')).toBe(false);
  });
  it('lève une erreur explicite', () => {
    expect(() => assertMilestoneTransition('released', 'funded')).toThrow(/milestone/);
  });
  it('terminaux sans sortie', () => {
    for (const s of MILESTONE_STATUSES) {
      if (s === 'released' || s === 'refunded') expect(canTransitionMilestone(s, 'funded')).toBe(false);
    }
  });
});

describe('deriveMissionCompletion', () => {
  it.each([
    [[], false],
    [['released', 'released'], true],
    [['released', 'funded'], false],
    [['refunded', 'refunded'], false],
    [['released', 'refunded'], true],
  ] as const)('%j -> %s', (input, expected) => {
    expect(deriveMissionCompletion(input)).toBe(expected);
  });
});

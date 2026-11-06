import { describe, expect, it } from '@jest/globals';
import { milestoneActions } from './milestoneActions';

describe('milestoneActions', () => {
  it('client : dépôt sur étape à financer', () => {
    expect(milestoneActions('pending', 'client', true)).toEqual(['fund']);
    expect(milestoneActions('pending', 'provider', true)).toEqual([]);
  });
  it('prestataire : rapport seulement après dépôt', () => {
    expect(milestoneActions('funded', 'provider', true)).toEqual(['report']);
    expect(milestoneActions('funded', 'client', true)).toEqual([]);
  });
  it('client : valider ou contester un rapport', () => {
    expect(milestoneActions('submitted', 'client', true)).toEqual(['approve', 'dispute', 'view']);
    expect(milestoneActions('submitted', 'provider', true)).toEqual(['view']);
  });
  it('mission inactive : lecture seule', () => {
    expect(milestoneActions('pending', 'client', false)).toEqual([]);
    expect(milestoneActions('released', 'client', false)).toEqual(['view']);
  });
});

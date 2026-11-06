import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('expo-device', () => ({}));
jest.mock('expo-constants', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./supabase', () => ({ supabase: {} }));
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({}) }));

import { routeForNotification } from './notifications';

describe('routeForNotification', () => {
  it('message → chat de la mission', () => {
    expect(routeForNotification('new_message', { mission_id: 'm1' })).toBe('/mission/m1/chat');
  });
  it('nouveau devis → demande', () => {
    expect(routeForNotification('new_quote', { request_id: 'r1' })).toBe('/request/r1');
  });
  it('rapport / étape validée → mission', () => {
    expect(routeForNotification('new_report', { mission_id: 'm1' })).toBe('/mission/m1');
    expect(routeForNotification('milestone_approved', { mission_id: 'm2' })).toBe('/mission/m2');
  });
  it('payload invalide → aucune navigation', () => {
    expect(routeForNotification('new_report', {})).toBeNull();
  });
});

import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, getCurrentPositionAsync: jest.fn() }));
import { toMediaPayload } from './proof';

describe('toMediaPayload', () => {
  it('conserve horodatage et coordonnées', () => {
    const p = toMediaPayload({ uri: 'file://x.jpg', kind: 'photo', mimeType: 'image/jpeg', capturedAt: '2026-11-06T10:00:00.000Z',
      latitude: 33.57, longitude: -7.59, accuracy: 5 }, 'm/ms/a.jpg');
    expect(p).toEqual({ storage_path: 'm/ms/a.jpg', kind: 'photo', captured_at: '2026-11-06T10:00:00.000Z', latitude: 33.57, longitude: -7.59, accuracy_m: 5 });
  });
});

import * as Location from 'expo-location';

export interface CapturedProof {
  uri: string;
  kind: 'photo' | 'video';
  mimeType: string;
  capturedAt: string;     // ISO, horloge de l'appareil au moment de la prise
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export class ProofLocationError extends Error {}

/** Position actuelle haute précision. Refuse les positions simulées (Android « mock location »). */
export async function currentFix(): Promise<Location.LocationObject> {
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  if (fix.mocked) throw new ProofLocationError('mocked_location');
  return fix;
}

/** Charge utile attendue par la RPC submit_report. */
export function toMediaPayload(p: CapturedProof, storagePath: string) {
  return {
    storage_path: storagePath, kind: p.kind, captured_at: p.capturedAt,
    latitude: p.latitude, longitude: p.longitude, accuracy_m: p.accuracy,
  };
}

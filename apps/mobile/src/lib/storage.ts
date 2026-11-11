import { supabase } from './supabase';

export type Bucket = 'verification' | 'request-photos' | 'reports' | 'chat' | 'avatars';

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Upload d'un fichier local (URI expo) vers un bucket. Le 1er segment du chemin conditionne la RLS. */
export async function uploadFile(bucket: Bucket, folder: string, uri: string, contentType: string, name?: string) {
  const ext = contentType.includes('mp4') || contentType.includes('quicktime') ? 'mp4'
    : contentType.includes('png') ? 'png' : contentType.includes('pdf') ? 'pdf' : 'jpg';
  const path = `${folder}/${name ?? randomId()}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** URL signée courte durée pour les buckets privés. */
export async function signedUrl(bucket: Bucket, path: string, expiresIn = 600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function signedUrls(bucket: Bucket, paths: string[], expiresIn = 600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

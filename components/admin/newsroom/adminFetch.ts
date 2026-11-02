'use client';

import { supabase } from '@/lib/supabaseClient';

// Calls a v2 admin API route with the signed-in admin's Supabase session.
export async function adminFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  const res = await fetch(path, { ...init, headers, cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(json?.error ?? `Request failed (${res.status})`);
    err.issues = json?.issues ?? [];
    throw err;
  }
  return json;
}

// Resizes an image in the browser before upload: at most 1,600 px wide,
// WebP, about 500 KB. Keeps uploads small for storage and page speed.
export async function resizeImage(file: File, maxWidth = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.82, 0.7, 0.55]) {
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', q));
    if (blob && (blob.size <= 600_000 || q === 0.55)) return blob;
  }
  return file;
}

// "2026-11-03T18:30" typed in the admin is IST, whatever the browser's zone.
export function istInputToIso(v: string): string {
  return new Date(`${v}:00+05:30`).toISOString();
}

export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

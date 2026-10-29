import { NextResponse } from 'next/server';

import { ForbiddenError, UnauthorizedError, requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { MEDIA_BUCKET, getServiceClient } from '@/lib/supabase/clients';
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  mediaMetadataSchema,
} from '@/lib/validation/schemas';
import { randomId, slugify } from '@/lib/utils';

/**
 * Media upload.
 *
 * File validation is deliberately not based on the filename or the
 * browser-supplied `Content-Type`, both of which the client controls. The
 * first bytes of the file are read and checked against known magic numbers,
 * so a `.jpg` that is actually an HTML document is rejected before it can be
 * served from the site's own origin as a stored-XSS vector.
 *
 * SVG is the one format where sniffing is not enough: a valid SVG can carry
 * script. Uploaded SVGs are therefore rejected outright. The project's own
 * SVG artwork is generated at build time and committed, never uploaded.
 *
 * Storage requires a Supabase service-role key. Without one the endpoint
 * reports that uploads are disabled rather than writing to a serverless
 * filesystem that vanishes on the next cold start.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Leading bytes that identify each accepted format. */
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'image/avif', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

function sniff(buffer: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    const offset = signature.offset ?? 0;
    if (buffer.length < offset + signature.bytes.length) continue;
    const matches = signature.bytes.every(
      (byte, index) => buffer[offset + index] === byte,
    );
    if (matches) return signature.mime;
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  let actor: string;
  try {
    actor = (await requireRole('editor')).email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi.' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Ruxsat yoʻq.' }, { status: 403 });
    }
    throw error;
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          'Fayl yuklash sozlanmagan. SUPABASE_SERVICE_ROLE_KEY kerak — docs/DEPLOYMENT.md ga qarang.',
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Faylni oʻqib boʻlmadi.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fayl tanlanmagan.' }, { status: 400 });
  }

  const metadata = mediaMetadataSchema.safeParse({
    altText: form.get('altText'),
    caption: form.get('caption') || null,
    category: form.get('category'),
    kind: form.get('kind'),
  });

  if (!metadata.success) {
    return NextResponse.json(
      { error: metadata.error.issues[0]?.message ?? 'Maʼlumotlar notoʻgʻri.' },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Reject SVG before anything else: a valid SVG can execute script when
  // served from our own origin.
  if (
    file.type === 'image/svg+xml' ||
    file.name.toLowerCase().endsWith('.svg')
  ) {
    return NextResponse.json(
      {
        error:
          'SVG yuklash qoʻllab-quvvatlanmaydi (xavfsizlik sababli). PNG, JPEG, WebP yoki AVIF ishlating.',
      },
      { status: 415 },
    );
  }

  const detected = sniff(bytes);
  if (!detected) {
    return NextResponse.json(
      { error: 'Fayl turi aniqlanmadi yoki qoʻllab-quvvatlanmaydi.' },
      { status: 415 },
    );
  }

  const isImage = (ALLOWED_IMAGE_MIME as readonly string[]).includes(detected);
  const isVideo = (ALLOWED_VIDEO_MIME as readonly string[]).includes(detected);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Bu fayl turi ruxsat etilmagan.' }, { status: 415 });
  }

  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (bytes.byteLength > limit) {
    return NextResponse.json(
      { error: `Fayl juda katta. Chegara: ${Math.round(limit / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const extension = detected.split('/')[1] ?? 'bin';
  const safeName = slugify(file.name.replace(/\.[^.]+$/, '')) || 'media';
  const objectPath = `${metadata.data.category}/${safeName}-${randomId(8).toLowerCase()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      // The sniffed type, never the client-supplied one.
      contentType: detected,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    console.error('[media:upload]', uploadError.message);
    return NextResponse.json({ error: 'Faylni saqlab boʻlmadi.' }, { status: 500 });
  }

  const store = getStore();
  const asset = await store.createMedia({
    id: `media-${randomId(12).toLowerCase()}`,
    storagePath: objectPath,
    type: isVideo ? 'video' : 'image',
    kind: metadata.data.kind,
    category: metadata.data.category,
    altText: metadata.data.altText,
    caption: metadata.data.caption ?? null,
    mimeType: detected,
    bytes: bytes.byteLength,
    width: null,
    height: null,
  });

  await store.recordAudit({
    actor,
    action: 'media.uploaded',
    entityType: 'media',
    entityId: asset.id,
    changes: { path: { from: null, to: objectPath } },
  });

  return NextResponse.json({ ok: true, asset }, { status: 201 });
}

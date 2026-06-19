// Cliente para Cloudflare R2 (compatible con la API de S3).
//
// Variables de entorno requeridas:
//   R2_ACCOUNT_ID            ID de la cuenta de Cloudflare
//   R2_ACCESS_KEY_ID         credencial de R2
//   R2_SECRET_ACCESS_KEY     credencial de R2
//   R2_BUCKET                nombre del bucket (ej. odontiacloud-files)
//
// Si faltan, hasStorage() devuelve false y los endpoints de adjuntos
// responden 503 con un mensaje claro.

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';

export function hasStorage(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!hasStorage()) throw new Error('Storage no configurado: faltan variables R2_*');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    });
  }
  return client;
}

// Construye una key única dentro del bucket. Estructura:
//   <clinic-slug>/<user-id>/<timestamp>-<random>.<ext>
export function buildStorageKey(clinicSlug: string, userId: number, originalName: string): string {
  const ext = (originalName.split('.').pop() || '').toLowerCase().slice(0, 8);
  const stamp = Date.now();
  const r = randomBytes(6).toString('hex');
  return `${clinicSlug}/${userId}/${stamp}-${r}${ext ? `.${ext}` : ''}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

// URL firmada para descargar/ver el archivo. Expira en 10 minutos.
// disposition='inline' → el navegador lo muestra (preview)
// disposition='attachment' → el navegador lo descarga directamente
export async function getSignedDownloadUrl(
  key: string,
  fileName?: string,
  disposition: 'inline' | 'attachment' = 'inline',
): Promise<string> {
  const safeName = fileName ? fileName.replace(/"/g, '') : '';
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: fileName
      ? `${disposition}; filename="${safeName}"`
      : undefined,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 600 });
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

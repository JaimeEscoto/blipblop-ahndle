import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';
import { hasStorage, putObject, getSignedDownloadUrl, deleteObject, buildStorageKey } from '../storage';

const router = Router();

// Solo se permiten imágenes comunes y PDFs. Máx 10 MB por archivo.
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido. Usa imágenes (JPG/PNG/WebP) o PDF.'));
  },
});

router.use(requireClinic, requireAuth, requireClinicMember);

// 503 claro si el admin del sistema no configuró storage
router.use((req, res, next) => {
  if (!hasStorage()) {
    return res.status(503).json({ error: 'El almacenamiento de archivos no está configurado. Pide al administrador del sistema que configure R2_*.' });
  }
  next();
});

// Verifica que el paciente pertenezca a la clínica.
async function ensureUserInClinic(userId: string | number, clinicId: number): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [userId, clinicId]);
  return !!r.rows[0];
}

// Lista los adjuntos de un paciente. Si ?record_id=X, solo los de esa visita.
// Sin parámetro, devuelve TODOS los del paciente (incluidos los a nivel paciente).
router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.user_id as string | undefined;
  const recordId = req.query.record_id as string | undefined;
  if (!userId) return res.status(400).json({ error: 'Falta user_id' });
  if (!(await ensureUserInClinic(userId, req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });

  const params: any[] = [req.clinic!.id, userId];
  let where = 'clinic_id = $1 AND user_id = $2';
  if (recordId === 'null') {
    where += ' AND record_id IS NULL';
  } else if (recordId) {
    params.push(recordId);
    where += ` AND record_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT id, user_id, record_id, file_name, mime_type, size_bytes,
            uploaded_by_email, uploaded_by_name, uploaded_at
     FROM attachments
     WHERE ${where}
     ORDER BY uploaded_at DESC`,
    params
  );
  res.json(rows);
});

// Subir un archivo. Multipart form-data:
//   field "file"      → el archivo
//   field "user_id"   → paciente (obligatorio)
//   field "record_id" → visita clínica (opcional; si va, el adjunto pertenece a esa visita)
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No se envió ningún archivo' });

  const userId = Number(req.body.user_id);
  const recordId = req.body.record_id ? Number(req.body.record_id) : null;
  if (!userId) return res.status(400).json({ error: 'Falta user_id' });
  if (!(await ensureUserInClinic(userId, req.clinic!.id))) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (recordId) {
    const ok = await pool.query('SELECT 1 FROM clinical_records WHERE id = $1 AND user_id = $2 AND clinic_id = $3',
      [recordId, userId, req.clinic!.id]);
    if (!ok.rows[0]) return res.status(404).json({ error: 'Registro clínico no encontrado' });
  }

  const key = buildStorageKey(req.clinic!.slug, userId, file.originalname);
  try {
    await putObject(key, file.buffer, file.mimetype);
  } catch (e: any) {
    console.error('Error subiendo a R2:', e);
    return res.status(502).json({ error: 'No se pudo subir el archivo al almacenamiento.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO attachments
       (clinic_id, user_id, record_id, file_name, mime_type, size_bytes, storage_key, uploaded_by_email, uploaded_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, record_id, file_name, mime_type, size_bytes, uploaded_by_email, uploaded_by_name, uploaded_at`,
    [req.clinic!.id, userId, recordId, file.originalname, file.mimetype, file.size, key,
     req.account!.email, req.account!.name]
  );
  res.status(201).json(rows[0]);
});

// Devuelve dos URLs firmadas (válidas 10 min):
//   previewUrl  → para mostrar en pantalla (inline)
//   downloadUrl → fuerza descarga (attachment)
router.get('/:id/url', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT storage_key, file_name FROM attachments WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Adjunto no encontrado' });
  try {
    const [previewUrl, downloadUrl] = await Promise.all([
      getSignedDownloadUrl(rows[0].storage_key, rows[0].file_name, 'inline'),
      getSignedDownloadUrl(rows[0].storage_key, rows[0].file_name, 'attachment'),
    ]);
    res.json({ previewUrl, downloadUrl });
  } catch (e) {
    console.error('Error firmando URL R2:', e);
    res.status(502).json({ error: 'No se pudo generar el enlace de descarga.' });
  }
});

// Renombrar (cambiar etiqueta visible del adjunto). Solo modifica file_name,
// el archivo en R2 sigue con su storage_key original.
router.patch('/:id', async (req: Request, res: Response) => {
  const fileName = (req.body.file_name || '').trim();
  if (!fileName) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  if (fileName.length > 200) return res.status(400).json({ error: 'El nombre es demasiado largo (máx 200)' });

  const { rows } = await pool.query(
    `UPDATE attachments SET file_name = $1 WHERE id = $2 AND clinic_id = $3
     RETURNING id, user_id, record_id, file_name, mime_type, size_bytes, uploaded_by_email, uploaded_by_name, uploaded_at`,
    [fileName, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Adjunto no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM attachments WHERE id = $1 AND clinic_id = $2 RETURNING *',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Adjunto no encontrado' });
  // Borrar del bucket en background (si falla, el registro ya no existe — no es crítico)
  deleteObject(rows[0].storage_key).catch(err => console.error('Error borrando de R2:', err));
  res.json({ id: rows[0].id });
});

export default router;

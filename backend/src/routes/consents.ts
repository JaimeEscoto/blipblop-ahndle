import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';
import { hasStorage, putObject, getSignedDownloadUrl, deleteObject, buildStorageKey } from '../storage';

const router = Router();
router.use(requireClinic, requireAuth, requireClinicMember);

// ── PLANTILLAS ────────────────────────────────────────────────────────────

router.get('/templates', async (req: Request, res: Response) => {
  const showAll = req.query.all === '1';
  const { rows } = await pool.query(
    `SELECT * FROM consent_templates WHERE clinic_id = $1 ${showAll ? '' : 'AND active = true'} ORDER BY title ASC`,
    [req.clinic!.id]
  );
  res.json(rows);
});

router.post('/templates', async (req: Request, res: Response) => {
  const title = (req.body.title || '').trim();
  const body = (req.body.body || '').trim();
  if (!title || !body) return res.status(400).json({ error: 'Faltan título y contenido' });
  if (title.length > 200) return res.status(400).json({ error: 'Título demasiado largo' });
  const { rows } = await pool.query(
    `INSERT INTO consent_templates (clinic_id, title, body) VALUES ($1, $2, $3) RETURNING *`,
    [req.clinic!.id, title, body]
  );
  res.status(201).json(rows[0]);
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  const title = (req.body.title || '').trim();
  const body = (req.body.body || '').trim();
  const active = req.body.active !== false;
  if (!title || !body) return res.status(400).json({ error: 'Faltan título y contenido' });
  const { rows } = await pool.query(
    `UPDATE consent_templates SET title = $1, body = $2, active = $3, updated_at = NOW()
     WHERE id = $4 AND clinic_id = $5 RETURNING *`,
    [title, body, active, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  res.json(rows[0]);
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM consent_templates WHERE id = $1 AND clinic_id = $2 RETURNING id',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  res.json(rows[0]);
});

// ── CONSENTIMIENTOS FIRMADOS ──────────────────────────────────────────────

const SELECT_CONSENT = `
  SELECT c.id, c.clinic_id, c.user_id, c.template_id, c.appointment_id,
    c.title, c.body, c.signer_name, c.signer_document,
    c.pdf_storage_key, c.signed_at, c.witnessed_by_email, c.witnessed_by_name
  FROM consents c
`;

router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.user_id as string | undefined;
  if (!userId) return res.status(400).json({ error: 'Falta user_id' });
  const { rows } = await pool.query(
    `${SELECT_CONSENT} WHERE c.clinic_id = $1 AND c.user_id = $2 ORDER BY c.signed_at DESC`,
    [req.clinic!.id, userId]
  );
  res.json(rows);
});

// Devuelve un consentimiento completo (incluye body y signature_data_url
// para que el frontend pueda regenerar el PDF si hace falta).
router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM consents WHERE id = $1 AND clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });
  res.json(rows[0]);
});

// Crear un consentimiento firmado. Body:
//   { user_id, template_id?, appointment_id?, title, body, signer_name, signer_document?, signature_data_url }
router.post('/', async (req: Request, res: Response) => {
  const { user_id, template_id, appointment_id, title, body, signer_name, signer_document, signature_data_url } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Falta el paciente' });
  if (!title || !body) return res.status(400).json({ error: 'Faltan título y contenido' });
  if (!signer_name?.trim()) return res.status(400).json({ error: 'Falta el nombre del firmante' });
  if (!signature_data_url || !/^data:image\//.test(signature_data_url)) {
    return res.status(400).json({ error: 'Falta la firma' });
  }

  // Verifica que el paciente pertenezca a la clínica
  const u = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [user_id, req.clinic!.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string) || null;

  const { rows } = await pool.query(
    `INSERT INTO consents
       (clinic_id, user_id, template_id, appointment_id, title, body,
        signer_name, signer_document, signature_data_url,
        signed_ip, signed_user_agent, witnessed_by_email, witnessed_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, clinic_id, user_id, template_id, appointment_id, title, body,
               signer_name, signer_document, pdf_storage_key, signed_at,
               witnessed_by_email, witnessed_by_name`,
    [req.clinic!.id, user_id, template_id || null, appointment_id || null,
     title.trim(), body.trim(), signer_name.trim(), signer_document?.trim() || null,
     signature_data_url, ip, ua, req.account!.email, req.account!.name]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const r = await pool.query(
    'DELETE FROM consents WHERE id = $1 AND clinic_id = $2 RETURNING id, pdf_storage_key',
    [req.params.id, req.clinic!.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });
  if (r.rows[0].pdf_storage_key) {
    deleteObject(r.rows[0].pdf_storage_key).catch(err => console.error('Error borrando PDF de consentimiento:', err));
  }
  res.json({ id: r.rows[0].id });
});

// ── PDF del consentimiento ───────────────────────────────────────────────

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('El archivo debe ser PDF'));
  },
});

router.post('/:id/pdf', pdfUpload.single('file'), async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No se envió ningún PDF' });

  const c = await pool.query(
    'SELECT user_id, pdf_storage_key FROM consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!c.rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });

  const oldKey: string | null = c.rows[0].pdf_storage_key;
  const key = buildStorageKey(req.clinic!.slug, c.rows[0].user_id, `consentimiento-${req.params.id}.pdf`);
  try {
    await putObject(key, file.buffer, 'application/pdf');
  } catch (e) {
    console.error('Error subiendo PDF de consentimiento a R2:', e);
    return res.status(502).json({ error: 'No se pudo subir el PDF' });
  }
  await pool.query('UPDATE consents SET pdf_storage_key = $1 WHERE id = $2', [key, req.params.id]);
  if (oldKey && oldKey !== key) deleteObject(oldKey).catch(err => console.error('Error borrando PDF previo:', err));
  res.json({ ok: true });
});

router.get('/:id/pdf', async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const c = await pool.query(
    'SELECT pdf_storage_key, title FROM consents WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!c.rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });
  if (!c.rows[0].pdf_storage_key) return res.status(404).json({ error: 'Este consentimiento no tiene PDF generado' });
  try {
    const url = await getSignedDownloadUrl(c.rows[0].pdf_storage_key, `${c.rows[0].title}.pdf`, 'inline');
    res.json({ url });
  } catch (e) {
    console.error('Error firmando PDF de consentimiento:', e);
    res.status(502).json({ error: 'No se pudo generar el enlace del PDF' });
  }
});

export default router;

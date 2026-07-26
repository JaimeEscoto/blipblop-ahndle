import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../database';
import { requireAuth, requireClinicMember } from '../auth';
import { requireClinic } from '../tenant';
import { hasStorage, putObject, getSignedDownloadUrl, deleteObject, buildStorageKey } from '../storage';
import { generatePublicCode } from '../utils/code';

const router = Router();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('El archivo debe ser PDF'));
  },
});

// ════════════════════════════════════════════════════════════════════════
// PÚBLICO (sin sesión): el paciente abre el enlace desde su celular, ve la
// plantilla en PDF y firma. El código es único globalmente, como el de citas.
// ════════════════════════════════════════════════════════════════════════

router.get('/public/:code', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT co.status, co.title, co.signed_at, co.signer_name,
       ct.pdf_storage_key AS template_pdf_key,
       cl.name AS clinic_name, u.name AS user_name
     FROM consents co
     LEFT JOIN consent_templates ct ON ct.id = co.template_id
     JOIN clinics cl ON cl.id = co.clinic_id
     JOIN users u ON u.id = co.user_id
     WHERE co.public_code = $1`,
    [req.params.code]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Enlace no válido' });
  const row = rows[0];

  let pdf_view_url: string | null = null;
  if (row.template_pdf_key && hasStorage()) {
    try {
      pdf_view_url = await getSignedDownloadUrl(row.template_pdf_key, `${row.title}.pdf`, 'inline');
    } catch (e) {
      console.error('Error firmando PDF público de plantilla:', e);
    }
  }

  res.json({
    status: row.status,
    title: row.title,
    clinic_name: row.clinic_name,
    user_name: row.user_name,
    signed_at: row.signed_at,
    signer_name: row.signer_name,
    pdf_view_url,
  });
});

router.post('/public/:code/sign', async (req: Request, res: Response) => {
  const { signer_name, signer_document, signature_data_url } = req.body;
  if (!signer_name?.trim()) return res.status(400).json({ error: 'Falta el nombre del firmante' });
  if (!signature_data_url || !/^data:image\//.test(signature_data_url)) {
    return res.status(400).json({ error: 'Falta la firma' });
  }

  const existing = await pool.query('SELECT status FROM consents WHERE public_code = $1', [req.params.code]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Enlace no válido' });
  if (existing.rows[0].status === 'signed') {
    return res.status(409).json({ error: 'Este documento ya fue firmado.' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string) || null;

  const { rows } = await pool.query(
    `UPDATE consents SET
       status = 'signed', signer_name = $1, signer_document = $2, signature_data_url = $3,
       signed_ip = $4, signed_user_agent = $5, signed_at = NOW()
     WHERE public_code = $6 AND status = 'pending'
     RETURNING status, signed_at`,
    [signer_name.trim(), signer_document?.trim() || null, signature_data_url, ip, ua, req.params.code]
  );
  // Si no afectó filas es porque alguien más lo firmó justo antes (carrera improbable).
  if (!rows[0]) return res.status(409).json({ error: 'Este documento ya fue firmado.' });
  res.json(rows[0]);
});

// A partir de aquí, todo requiere clínica + sesión válida en esa clínica
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
  if (!title) return res.status(400).json({ error: 'Falta el título' });
  if (title.length > 200) return res.status(400).json({ error: 'Título demasiado largo' });
  const { rows } = await pool.query(
    `INSERT INTO consent_templates (clinic_id, title) VALUES ($1, $2) RETURNING *`,
    [req.clinic!.id, title]
  );
  res.status(201).json(rows[0]);
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  const title = (req.body.title || '').trim();
  const active = req.body.active !== false;
  if (!title) return res.status(400).json({ error: 'Falta el título' });
  const { rows } = await pool.query(
    `UPDATE consent_templates SET title = $1, active = $2, updated_at = NOW()
     WHERE id = $3 AND clinic_id = $4 RETURNING *`,
    [title, active, req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  res.json(rows[0]);
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM consent_templates WHERE id = $1 AND clinic_id = $2 RETURNING id, pdf_storage_key',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  if (rows[0].pdf_storage_key) {
    deleteObject(rows[0].pdf_storage_key).catch(err => console.error('Error borrando PDF de plantilla:', err));
  }
  res.json({ id: rows[0].id });
});

// Sube (o reemplaza) el PDF de una plantilla.
router.post('/templates/:id/pdf', pdfUpload.single('file'), async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No se envió ningún PDF' });

  const t = await pool.query(
    'SELECT pdf_storage_key FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!t.rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const oldKey: string | null = t.rows[0].pdf_storage_key;
  const key = buildStorageKey(req.clinic!.slug, 0, `plantilla-${req.params.id}.pdf`);
  try {
    await putObject(key, file.buffer, 'application/pdf');
  } catch (e) {
    console.error('Error subiendo PDF de plantilla a R2:', e);
    return res.status(502).json({ error: 'No se pudo subir el PDF' });
  }
  await pool.query('UPDATE consent_templates SET pdf_storage_key = $1, updated_at = NOW() WHERE id = $2', [key, req.params.id]);
  if (oldKey && oldKey !== key) deleteObject(oldKey).catch(err => console.error('Error borrando PDF previo:', err));
  res.json({ ok: true });
});

router.get('/templates/:id/pdf', async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const t = await pool.query(
    'SELECT pdf_storage_key, title FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.clinic!.id]
  );
  if (!t.rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  if (!t.rows[0].pdf_storage_key) return res.status(404).json({ error: 'Esta plantilla no tiene un PDF cargado' });
  try {
    const url = await getSignedDownloadUrl(t.rows[0].pdf_storage_key, `${t.rows[0].title}.pdf`, 'inline');
    res.json({ url });
  } catch (e) {
    console.error('Error firmando PDF de plantilla:', e);
    res.status(502).json({ error: 'No se pudo generar el enlace del PDF' });
  }
});

// ── CONSENTIMIENTOS ───────────────────────────────────────────────────────

const SELECT_CONSENT = `
  SELECT c.id, c.clinic_id, c.user_id, c.template_id, c.appointment_id,
    c.title, c.status, c.public_code, c.signer_name, c.signer_document,
    c.pdf_storage_key, c.signed_at, c.witnessed_by_email, c.witnessed_by_name
  FROM consents c
`;

router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.user_id as string | undefined;
  if (!userId) return res.status(400).json({ error: 'Falta user_id' });
  const { rows } = await pool.query(
    `${SELECT_CONSENT} WHERE c.clinic_id = $1 AND c.user_id = $2
     ORDER BY COALESCE(c.signed_at, c.id::text::timestamptz) DESC, c.id DESC`,
    [req.clinic!.id, userId]
  );
  res.json(rows);
});

// Devuelve un consentimiento completo (incluye signature_data_url para regenerar evidencia si hace falta).
router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM consents WHERE id = $1 AND clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });
  res.json(rows[0]);
});

// Firma presencial e inmediata: el paciente firma ahí mismo, en el dispositivo del staff.
// Body: { user_id, template_id, appointment_id?, signer_name, signer_document?, signature_data_url }
router.post('/', async (req: Request, res: Response) => {
  const { user_id, template_id, appointment_id, signer_name, signer_document, signature_data_url } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Falta el paciente' });
  if (!template_id) return res.status(400).json({ error: 'Selecciona una plantilla' });
  if (!signer_name?.trim()) return res.status(400).json({ error: 'Falta el nombre del firmante' });
  if (!signature_data_url || !/^data:image\//.test(signature_data_url)) {
    return res.status(400).json({ error: 'Falta la firma' });
  }

  const u = await pool.query('SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2', [user_id, req.clinic!.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

  const tpl = await pool.query(
    'SELECT title, pdf_storage_key FROM consent_templates WHERE id = $1 AND clinic_id = $2',
    [template_id, req.clinic!.id]
  );
  if (!tpl.rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  if (!tpl.rows[0].pdf_storage_key) return res.status(400).json({ error: 'Esta plantilla todavía no tiene un PDF cargado' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string) || null;

  const { rows } = await pool.query(
    `INSERT INTO consents
       (clinic_id, user_id, template_id, appointment_id, title, status,
        signer_name, signer_document, signature_data_url,
        signed_ip, signed_user_agent, witnessed_by_email, witnessed_by_name)
     VALUES ($1,$2,$3,$4,$5,'signed',$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, clinic_id, user_id, template_id, appointment_id, title, status, public_code,
               signer_name, signer_document, pdf_storage_key, signed_at,
               witnessed_by_email, witnessed_by_name`,
    [req.clinic!.id, user_id, template_id, appointment_id || null, tpl.rows[0].title,
     signer_name.trim(), signer_document?.trim() || null, signature_data_url, ip, ua,
     req.account!.email, req.account!.name]
  );
  res.status(201).json(rows[0]);
});

// Asigna una plantilla a una cita y genera el enlace público para firma remota.
// Body: { user_id, appointment_id, template_id }
router.post('/assign', async (req: Request, res: Response) => {
  const { user_id, appointment_id, template_id } = req.body;
  if (!user_id || !appointment_id || !template_id) {
    return res.status(400).json({ error: 'Faltan paciente, cita o plantilla' });
  }

  const ap = await pool.query(
    'SELECT 1 FROM appointments WHERE id = $1 AND clinic_id = $2 AND user_id = $3',
    [appointment_id, req.clinic!.id, user_id]
  );
  if (!ap.rows[0]) return res.status(404).json({ error: 'La cita no existe o no pertenece a este paciente' });

  const tpl = await pool.query(
    'SELECT title, pdf_storage_key FROM consent_templates WHERE id = $1 AND clinic_id = $2 AND active = true',
    [template_id, req.clinic!.id]
  );
  if (!tpl.rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });
  if (!tpl.rows[0].pdf_storage_key) return res.status(400).json({ error: 'Esta plantilla todavía no tiene un PDF cargado' });

  const { rows } = await pool.query(
    `INSERT INTO consents (clinic_id, user_id, template_id, appointment_id, title, status, public_code)
     VALUES ($1,$2,$3,$4,$5,'pending',$6)
     RETURNING id, clinic_id, user_id, template_id, appointment_id, title, status, public_code,
               signer_name, signer_document, pdf_storage_key, signed_at,
               witnessed_by_email, witnessed_by_name`,
    [req.clinic!.id, user_id, template_id, appointment_id, tpl.rows[0].title, generatePublicCode()]
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

// ── PDF del consentimiento firmado ───────────────────────────────────────
// Si el consentimiento tiene su propio PDF (flujo antiguo) lo usa; si no,
// cae al PDF de la plantilla (flujo nuevo: la plantilla ES el documento firmado).

router.get('/:id/pdf', async (req: Request, res: Response) => {
  if (!hasStorage()) return res.status(503).json({ error: 'Almacenamiento no configurado' });
  const c = await pool.query(
    `SELECT co.pdf_storage_key AS own_key, co.title, ct.pdf_storage_key AS template_key
     FROM consents co
     LEFT JOIN consent_templates ct ON ct.id = co.template_id
     WHERE co.id = $1 AND co.clinic_id = $2`,
    [req.params.id, req.clinic!.id]
  );
  if (!c.rows[0]) return res.status(404).json({ error: 'Consentimiento no encontrado' });
  const key = c.rows[0].own_key || c.rows[0].template_key;
  if (!key) return res.status(404).json({ error: 'Este consentimiento no tiene PDF' });
  try {
    const url = await getSignedDownloadUrl(key, `${c.rows[0].title}.pdf`, 'inline');
    res.json({ url });
  } catch (e) {
    console.error('Error firmando PDF de consentimiento:', e);
    res.status(502).json({ error: 'No se pudo generar el enlace del PDF' });
  }
});

export default router;

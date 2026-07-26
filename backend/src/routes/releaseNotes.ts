import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../auth';

const router = Router();

// Todas las rutas requieren sesión, pero NO clínica: las novedades son
// globales, un mismo aviso se muestra a superuser y a admins de clínicas.
router.use(requireAuth);

// ── GET /api/release-notes ─────────────────────────────────────────────
// Devuelve las novedades pendientes para el usuario actual:
//  · publicadas DESPUÉS de que su cuenta fue creada (no le mostramos las
//    que ya estaban vivas cuando entró — no son "nuevas" para él).
//  · aún no acked.
// El visitante demo (id=0, sin fila real en accounts) recibe [] siempre.
router.get('/', async (req: Request, res: Response) => {
  const acc = req.account!;
  if (acc.is_demo_visitor || !acc.id) return res.json([]);

  const { rows } = await pool.query(
    `SELECT rn.id, rn.icon, rn.title, rn.body,
       TO_CHAR(rn.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS published_at
     FROM release_notes rn
     JOIN accounts a ON a.id = $1
     WHERE rn.published_at > COALESCE(a.created_at, NOW())
       AND NOT EXISTS (
         SELECT 1 FROM release_note_acks ack
         WHERE ack.account_id = a.id AND ack.release_note_id = rn.id
       )
     ORDER BY rn.published_at DESC, rn.id DESC`,
    [acc.id]
  );
  res.json(rows);
});

// ── POST /api/release-notes/:id/ack ────────────────────────────────────
// Registra que el usuario ya vio esta novedad. ON CONFLICT DO NOTHING para
// que reintentos (o clicks dobles) sean idempotentes.
router.post('/:id/ack', async (req: Request, res: Response) => {
  const acc = req.account!;
  if (acc.is_demo_visitor || !acc.id) return res.json({ ok: true });

  const noteId = Number(req.params.id);
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'ID inválido' });

  await pool.query(
    `INSERT INTO release_note_acks (account_id, release_note_id)
     VALUES ($1, $2)
     ON CONFLICT (account_id, release_note_id) DO NOTHING`,
    [acc.id, noteId]
  );
  res.json({ ok: true });
});

export default router;

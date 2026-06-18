import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import pool from '../database';
import { requireAuth, requireClinicMember, SUPERUSER_EMAIL } from '../auth';
import { requireClinic } from '../tenant';

const router = Router();

// Invitaciones administradas por el dueño/admin de cada clínica.
// El super admin queda totalmente fuera de esta tabla (nunca aparece).
router.use(requireClinic, requireAuth, requireClinicMember);

function requireAdmin(req: Request, res: Response, next: any) {
  if (req.account?.role !== 'clinic_admin' && req.account?.role !== 'superuser') {
    return res.status(403).json({ error: 'Solo el administrador de la clínica puede gestionar invitaciones' });
  }
  next();
}
router.use(requireAdmin);

router.get('/', async (req: Request, res: Response) => {
  // Ocultamos cualquier invitación al super admin (no debería existir, pero por defensa)
  const { rows } = await pool.query(
    'SELECT * FROM invitations WHERE clinic_id = $1 AND email <> $2 ORDER BY created_at DESC',
    [req.clinic!.id, SUPERUSER_EMAIL]
  );
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }
  if (email === SUPERUSER_EMAIL) {
    return res.status(400).json({ error: 'Ese correo no puede ser invitado' });
  }
  // ¿Ya tiene cuenta en esta clínica?
  const acc = await pool.query('SELECT id FROM accounts WHERE email = $1 AND clinic_id = $2', [email, req.clinic!.id]);
  if (acc.rows[0]) return res.status(409).json({ error: 'Ese correo ya tiene una cuenta' });

  const token = randomBytes(24).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO invitations (email, invited_by, token, clinic_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (clinic_id, email) DO UPDATE SET status = 'pending', created_at = NOW(), invited_by = $2,
       token = COALESCE(invitations.token, EXCLUDED.token)
     RETURNING *`,
    [email, req.account?.email || null, token, req.clinic!.id]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM invitations WHERE id = $1 AND clinic_id = $2 RETURNING *',
    [req.params.id, req.clinic!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invitación no encontrada' });
  res.json(rows[0]);
});

export default router;

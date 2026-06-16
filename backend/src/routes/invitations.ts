import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireSuperuser } from '../auth';

const router = Router();

// Todas las rutas de invitaciones requieren superusuario
router.use(requireAuth, requireSuperuser);

router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM invitations ORDER BY created_at DESC');
  res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }
  // ¿Ya tiene cuenta?
  const acc = await pool.query('SELECT id FROM accounts WHERE email = $1', [email]);
  if (acc.rows[0]) return res.status(409).json({ error: 'Ese correo ya tiene una cuenta' });

  const { rows } = await pool.query(
    `INSERT INTO invitations (email, invited_by) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET status = 'pending', created_at = NOW(), invited_by = $2
     RETURNING *`,
    [email, req.account?.email || null]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query('DELETE FROM invitations WHERE id = $1 RETURNING *', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Invitación no encontrada' });
  res.json(rows[0]);
});

export default router;

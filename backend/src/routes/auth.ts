import { Router, Request, Response } from 'express';
import pool from '../database';
import { verifyGoogleToken, signSession, requireAuth, SessionAccount } from '../auth';

const router = Router();

// Login / registro con Google. Solo se permite si:
//  - es el superusuario, o
//  - ya tiene cuenta, o
//  - tiene una invitación pendiente (se acepta automáticamente)
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Falta el token de Google' });

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'No se pudo verificar Google' });
  }
  const { email, name, sub } = profile;

  // ¿Ya existe la cuenta?
  const existing = await pool.query('SELECT id, email, name, role FROM accounts WHERE email = $1', [email]);
  let account: SessionAccount;

  if (existing.rows[0]) {
    account = existing.rows[0];
    await pool.query('UPDATE accounts SET google_sub = $1, name = COALESCE(name, $2), last_login = NOW() WHERE id = $3',
      [sub, name, account.id]);
  } else {
    // No tiene cuenta: necesita una invitación pendiente
    const invite = await pool.query(`SELECT id FROM invitations WHERE email = $1 AND status = 'pending'`, [email]);
    if (!invite.rows[0]) {
      return res.status(403).json({ error: 'Tu correo no tiene una invitación. Pide al administrador que te invite.' });
    }
    const created = await pool.query(
      `INSERT INTO accounts (email, name, role, google_sub, last_login)
       VALUES ($1, $2, 'staff', $3, NOW()) RETURNING id, email, name, role`,
      [email, name, sub]
    );
    account = created.rows[0];
    await pool.query(`UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [invite.rows[0].id]);
  }

  const token = signSession(account);
  res.json({ token, account });
});

// Datos de la sesión actual
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ account: req.account });
});

export default router;

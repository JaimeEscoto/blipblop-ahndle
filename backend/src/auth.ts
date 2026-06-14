import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion';
const SESSION_TTL = '30d';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface SessionAccount {
  id: number;
  email: string;
  name: string | null;
  role: 'superuser' | 'staff';
}

// Verifica el ID token de Google y devuelve los datos del perfil
export async function verifyGoogleToken(credential: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) {
    throw new Error('Token de Google inválido o correo no verificado');
  }
  return {
    email: payload.email.toLowerCase(),
    name: payload.name || null,
    sub: payload.sub,
  };
}

export function signSession(account: SessionAccount): string {
  return jwt.sign(account, JWT_SECRET, { expiresIn: SESSION_TTL });
}

// Extiende Request con la cuenta autenticada
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: SessionAccount;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.account = jwt.verify(token, JWT_SECRET) as SessionAccount;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function requireSuperuser(req: Request, res: Response, next: NextFunction) {
  if (req.account?.role !== 'superuser') {
    return res.status(403).json({ error: 'Solo el superusuario puede acceder a esta sección' });
  }
  next();
}

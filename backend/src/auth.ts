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
  role: 'superuser' | 'clinic_admin' | 'staff';
  clinic_id: number | null; // null solo para el superuser global
  // Sesión "sombra": super admin accediendo a una clínica ajena.
  // Sus acciones quedan en activity_log con internal=true y no se le ve
  // en las listas de usuarios/invitaciones de la clínica.
  is_shadow?: boolean;
  // Visitante de una clínica demo: entró por link público + nombre.
  // No tiene fila propia en accounts; las acciones se auditan con su
  // nombre pero accountId=NULL. Sandbox compartido y reseteable.
  is_demo_visitor?: boolean;
}

export const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || 'jaimeted@gmail.com').toLowerCase();

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
      // Estado del registro ANTES de una edición, para que la bitácora
      // pueda detallar qué campos cambiaron y su valor anterior.
      auditBefore?: any;
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

// Guard para el portal de super admin: además del rol, exige que la sesión
// haya sido emitida para uso de super admin (no una sesión sombra de clínica).
export function requireSuperAdminPortal(req: Request, res: Response, next: NextFunction) {
  if (req.account?.role !== 'superuser' || req.account.clinic_id !== null) {
    return res.status(403).json({ error: 'Solo el super admin puede acceder a esta sección' });
  }
  next();
}

// Garantiza que la sesión actual pertenece a la clínica del subdominio (req.clinic).
// El super admin global (clinic_id NULL, role superuser) NUNCA pasa por aquí: si
// quiere actuar dentro de una clínica usa una sesión sombra con clinic_id=<esa>.
export function requireClinicMember(req: Request, res: Response, next: NextFunction) {
  if (!req.clinic) return res.status(404).json({ error: 'Clínica no encontrada' });
  if (!req.account) return res.status(401).json({ error: 'No autenticado' });
  if (req.account.clinic_id !== req.clinic.id) {
    return res.status(403).json({ error: 'Sesión no válida para esta clínica' });
  }
  next();
}

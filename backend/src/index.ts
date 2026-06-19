import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import cors from 'cors';
import { initDB } from './database';
import { auditLog } from './audit';
import authRouter from './routes/auth';
import clinicsRouter from './routes/clinics';
import superRouter from './routes/super';
import invitationsRouter from './routes/invitations';
import usersRouter from './routes/users';
import doctorsRouter from './routes/doctors';
import appointmentsRouter from './routes/appointments';
import medicalRouter from './routes/medical';
import inventoryRouter from './routes/inventory';
import remindersRouter from './routes/reminders';
import activityRouter from './routes/activity';
import attachmentsRouter from './routes/attachments';
import proceduresRouter from './routes/procedures';
import invoicesRouter from './routes/invoices';
import financeRouter from './routes/finance';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

const capacitorOrigins = ['https://localhost', 'capacitor://localhost'];

// En multi-tenant aceptamos cualquier subdominio de odontiacloud.com
function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return cb(null, true); // peticiones sin Origin (curl, app móvil sin webview)
  if (capacitorOrigins.includes(origin)) return cb(null, true);
  // Dev: cualquier *.localhost o el FRONTEND_URL definido
  if (/^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/i.test(origin)) return cb(null, true);
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
  // Prod: cualquier *.odontiacloud.com (y el ápice)
  if (/^https?:\/\/(?:[a-z0-9-]+\.)?odontiacloud\.com$/i.test(origin)) return cb(null, true);
  return cb(null, false);
}

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Bitácora: registra automáticamente toda operación que modifica datos.
app.use(auditLog);

// Públicas (sin contexto de clínica)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/clinics', clinicsRouter);
app.use('/api/super', superRouter);
app.use('/api/admin', adminRouter); // ahora solo desde superadmin host

// Auth (cada ruta interna decide si necesita clínica)
app.use('/api/auth', authRouter);

// Rutas de clínica (todas requieren subdominio válido)
app.use('/api/invitations', invitationsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/medical', medicalRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/procedures', proceduresRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/finance', financeRouter);

initDB()
  .then(() => app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`)))
  .catch(err => { console.error('Error al inicializar DB:', err); process.exit(1); });

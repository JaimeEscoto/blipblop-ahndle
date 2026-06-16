import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import cors from 'cors';
import { initDB } from './database';
import { requireAuth } from './auth';
import { auditLog } from './audit';
import authRouter from './routes/auth';
import invitationsRouter from './routes/invitations';
import usersRouter from './routes/users';
import doctorsRouter from './routes/doctors';
import appointmentsRouter from './routes/appointments';
import medicalRouter from './routes/medical';
import inventoryRouter from './routes/inventory';
import remindersRouter from './routes/reminders';
import activityRouter from './routes/activity';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// Orígenes de la app móvil (Capacitor): Android usa https://localhost,
// iOS usa capacitor://localhost. Siempre permitidos para que la app nativa
// pueda consumir la API.
const capacitorOrigins = ['https://localhost', 'capacitor://localhost'];

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, ...capacitorOrigins]
  : ['http://localhost:5173', 'http://localhost:4173', ...capacitorOrigins];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Bitácora: registra automáticamente toda operación que modifica datos.
// Va antes de los routers para poder envolver la respuesta; lee req.account,
// que cada router rellena con requireAuth antes de ejecutar el handler.
app.use(auditLog);

// Públicas
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Solo superusuario (el router aplica su propio guard)
app.use('/api/invitations', invitationsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/admin', adminRouter);

// El router de citas protege todo internamente salvo /public/:code
app.use('/api/appointments', appointmentsRouter);

// Protegidas: requieren sesión válida
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/doctors', requireAuth, doctorsRouter);
app.use('/api/medical', requireAuth, medicalRouter);
app.use('/api/inventory', requireAuth, inventoryRouter);
app.use('/api/reminders', requireAuth, remindersRouter);

initDB()
  .then(() => app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`)))
  .catch(err => { console.error('Error al inicializar DB:', err); process.exit(1); });

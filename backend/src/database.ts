import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { generateAppointmentCode } from './utils/code';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      document_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      license_number TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      time TIME NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS medical_info (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blood_type TEXT,
      allergies TEXT,
      medical_conditions TEXT,
      current_medications TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clinical_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      appointment_id INTEGER REFERENCES appointments(id),
      date DATE NOT NULL,
      diagnosis TEXT,
      treatment TEXT,
      observations TEXT,
      tooth_chart JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('material','medication','equipment','product')),
      quantity NUMERIC NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      min_quantity NUMERIC NOT NULL DEFAULT 5,
      price NUMERIC,
      supplier TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      time TIME,
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task','patient')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('superuser','staff')),
      google_sub TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
      invited_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      account_id INTEGER,
      account_email TEXT,
      account_name TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      summary TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS activity_log_account_idx ON activity_log(account_email);
  `);

  // --- Migración: datos demográficos del paciente (Honduras) ---
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT;
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
  `);

  // --- Migración: idioma preferido por usuario (ES/EN) ---
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'`);

  // --- Migración: contraseña para cuentas que no usan Google ---
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_hash TEXT`);

  // --- Migración: token único de invitación (enlace para crear cuenta) ---
  await pool.query(`ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token)`);
  // Rellena las invitaciones existentes que aún no tienen token
  {
    const { rows: noToken } = await pool.query(`SELECT id FROM invitations WHERE token IS NULL`);
    for (const r of noToken) {
      await pool.query(`UPDATE invitations SET token = $1 WHERE id = $2`,
        [randomBytes(24).toString('hex'), r.id]);
    }
  }

  const superEmail = (process.env.SUPERUSER_EMAIL || 'jaimeted@gmail.com').toLowerCase();

  // ════════════════════════════════════════════════════════════
  // Migración multi-tenant: tabla clinics + clinic_id en todo
  // ════════════════════════════════════════════════════════════

  // 1) Tabla de clínicas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinics (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      owner_email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2) Garantiza la clínica "demo" (donde se reasignan los datos previos a multi-tenant)
  const demoRes = await pool.query(
    `INSERT INTO clinics (slug, name, owner_email) VALUES ('demo', 'Clínica Demo', $1)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
    [superEmail]
  );
  const demoClinicId: number = demoRes.rows[0].id;

  // 3) Agregar clinic_id a todas las tablas que pertenecen a una clínica
  const tenantTables = ['users','doctors','appointments','medical_info','clinical_records',
                        'inventory','reminders','invitations','accounts','activity_log'];
  for (const t of tenantTables) {
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  }

  // 4) Reasignar las filas existentes a la clínica "demo"
  //    (excepto al superuser de accounts, que vive fuera de toda clínica)
  for (const t of ['users','doctors','appointments','medical_info','clinical_records',
                   'inventory','reminders','invitations','activity_log']) {
    await pool.query(`UPDATE ${t} SET clinic_id = $1 WHERE clinic_id IS NULL`, [demoClinicId]);
  }
  await pool.query(`UPDATE accounts SET clinic_id = $1 WHERE clinic_id IS NULL AND email <> $2`,
    [demoClinicId, superEmail]);

  // 5) Hacer clinic_id NOT NULL donde aplica (en accounts es nullable solo para el superuser)
  for (const t of ['users','doctors','appointments','medical_info','clinical_records',
                   'inventory','reminders','invitations']) {
    await pool.query(`ALTER TABLE ${t} ALTER COLUMN clinic_id SET NOT NULL`);
  }

  // 6) Convertir constraints únicos globales en compuestos por clínica
  //    (el mismo correo puede existir como cuenta/invitación/médico/paciente en clínicas distintas)
  await pool.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_email_key`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS accounts_clinic_email_idx ON accounts(clinic_id, email)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS accounts_super_email_idx ON accounts(email) WHERE clinic_id IS NULL`);

  await pool.query(`ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_email_key`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS invitations_clinic_email_idx ON invitations(clinic_id, email)`);

  await pool.query(`ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_email_key`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS doctors_clinic_email_idx ON doctors(clinic_id, email)`);

  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_clinic_email_idx ON users(clinic_id, email) WHERE email IS NOT NULL`);

  // 7) Nuevo rol "clinic_admin" (dueño/admin de una clínica)
  await pool.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check`);
  await pool.query(`ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK(role IN ('superuser','clinic_admin','staff'))`);

  // 8) activity_log: flag "internal" para acciones ocultas del super admin
  //    + índice para consultas por clínica
  await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`CREATE INDEX IF NOT EXISTS activity_log_clinic_idx ON activity_log(clinic_id, created_at DESC)`);

  // 9) Adjuntos a expedientes (RX, fotos intraorales, PDFs).
  //    Pueden estar asociados a una visita clínica (record_id) o ser del
  //    paciente en general (record_id NULL). Los bytes viven en R2.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id INTEGER REFERENCES clinical_records(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      storage_key TEXT NOT NULL,
      uploaded_by_email TEXT,
      uploaded_by_name TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS attachments_user_idx ON attachments(clinic_id, user_id, uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS attachments_record_idx ON attachments(record_id) WHERE record_id IS NOT NULL;
  `);

  // --- Superusuario: cuenta global (clinic_id NULL), siempre tiene acceso ---
  const sup = await pool.query(`SELECT id FROM accounts WHERE email = $1 AND clinic_id IS NULL`, [superEmail]);
  if (!sup.rows[0]) {
    await pool.query(
      `INSERT INTO accounts (email, name, role, clinic_id) VALUES ($1, $2, 'superuser', NULL)`,
      [superEmail, 'Superusuario']
    );
  } else {
    await pool.query(`UPDATE accounts SET role = 'superuser' WHERE id = $1`, [sup.rows[0].id]);
  }

  // --- Migración: código público para las citas (QR de invitación) ---
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS public_code TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS appointments_public_code_idx ON appointments(public_code)`);
  // Rellena las citas existentes que aún no tienen código
  const { rows: pending } = await pool.query(`SELECT id FROM appointments WHERE public_code IS NULL`);
  for (const r of pending) {
    let ok = false;
    while (!ok) {
      try {
        await pool.query(`UPDATE appointments SET public_code=$1 WHERE id=$2`, [generateAppointmentCode(), r.id]);
        ok = true;
      } catch {
        // colisión improbable de código: reintenta con otro
      }
    }
  }
}

export default pool;

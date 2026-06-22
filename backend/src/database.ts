import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { Pool } from 'pg';
import { randomBytes, createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
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

  // 9) Ajustes financieros por clínica: moneda, IVA por defecto, próximo número de factura
  await pool.query(`
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'HNL';
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS next_invoice_number INTEGER NOT NULL DEFAULT 1;
  `);

  // 10) Finanzas: catálogo de procedimientos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS procedures (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      default_price NUMERIC NOT NULL DEFAULT 0,
      duration_minutes INTEGER,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS procedures_clinic_idx ON procedures(clinic_id);
  `);

  // 11) Facturas + items + abonos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      tax NUMERIC NOT NULL DEFAULT 0,
      discount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('draft','issued','partial','paid','cancelled')),
      notes TEXT,
      created_by_email TEXT,
      created_by_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_clinic_number_idx ON invoices(clinic_id, number);
    CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices(clinic_id, user_id, date DESC);
    CREATE INDEX IF NOT EXISTS invoices_date_idx ON invoices(clinic_id, date DESC);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      procedure_id INTEGER REFERENCES procedures(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id, position);

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount NUMERIC NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash','card','transfer','other')),
      reference TEXT,
      date DATE NOT NULL,
      notes TEXT,
      received_by_email TEXT,
      received_by_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS payments_clinic_date_idx ON payments(clinic_id, date DESC);
  `);

  // 11b) Storage key del PDF generado para cada factura (se sube a R2 al crear).
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT`);

  // 11c) Consentimientos informados firmados por el paciente.
  //   - consent_templates: plantillas reutilizables por clínica (cuerpo del documento).
  //   - consents: instancias firmadas (snapshot del cuerpo + firma + PDF).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_templates (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS consent_templates_clinic_idx ON consent_templates(clinic_id);

    CREATE TABLE IF NOT EXISTS consents (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES consent_templates(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signer_document TEXT,
      signature_data_url TEXT NOT NULL,
      pdf_storage_key TEXT,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      signed_ip TEXT,
      signed_user_agent TEXT,
      witnessed_by_email TEXT,
      witnessed_by_name TEXT
    );
    CREATE INDEX IF NOT EXISTS consents_user_idx ON consents(clinic_id, user_id, signed_at DESC);
  `);

  // 12) Adjuntos a expedientes (RX, fotos intraorales, PDFs).
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

  // ════════════════════════════════════════════════════════════
  // Términos de Servicio: catálogo de versiones + aceptaciones
  // ════════════════════════════════════════════════════════════
  await pool.query(`
    CREATE TABLE IF NOT EXISTS terms_versions (
      id SERIAL PRIMARY KEY,
      version TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_current BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      terms_version_id INTEGER NOT NULL REFERENCES terms_versions(id),
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS terms_acceptances_lookup_idx ON terms_acceptances(user_email, terms_version_id)`);

  // Carga todos los terms/*.md del repo. Insert if missing, marca como vigente
  // al de mayor effective_from (orden alfabético del nombre del archivo).
  try {
    const termsDir = path.resolve(__dirname, '..', 'terms');
    const files = readdirSync(termsDir).filter(f => f.endsWith('.md')).sort();
    for (const file of files) {
      const version = file.replace(/\.md$/, ''); // ej "v1"
      const content = readFileSync(path.join(termsDir, file), 'utf8');
      const hash = createHash('sha256').update(content).digest('hex');
      // Si la versión ya existe pero su contenido cambió, NO se sobreescribe.
      // Hay que crear un archivo nuevo (v1_1.md) — los términos son append-only.
      await pool.query(
        `INSERT INTO terms_versions (version, content, content_hash) VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [version, content, hash]
      );
    }
    // Marca la versión más nueva como current
    if (files.length > 0) {
      const latestVersion = files[files.length - 1].replace(/\.md$/, '');
      await pool.query(`UPDATE terms_versions SET is_current = (version = $1)`, [latestVersion]);
    }
  } catch (e) {
    console.warn('No se pudieron cargar los términos desde backend/terms/:', e);
  }

  // ════════════════════════════════════════════════════════════
  // Tracking de visitas al sitio público (landing, login, registro)
  // ════════════════════════════════════════════════════════════
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      session_id TEXT,
      path TEXT,
      host TEXT,
      referrer TEXT,
      referrer_source TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      ip TEXT,
      country TEXT,
      country_code TEXT,
      region TEXT,
      city TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      user_agent TEXT,
      language TEXT
    );
    CREATE INDEX IF NOT EXISTS visits_created_idx ON visits(created_at DESC);
    CREATE INDEX IF NOT EXISTS visits_source_idx ON visits(referrer_source);
  `);

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

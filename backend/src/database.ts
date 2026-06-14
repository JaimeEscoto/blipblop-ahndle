import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { Pool } from 'pg';
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
  `);

  // --- Superusuario: siempre tiene acceso, sin invitación ---
  const superEmail = (process.env.SUPERUSER_EMAIL || 'jaimeted@gmail.com').toLowerCase();
  await pool.query(
    `INSERT INTO accounts (email, name, role) VALUES ($1, $2, 'superuser')
     ON CONFLICT (email) DO UPDATE SET role = 'superuser'`,
    [superEmail, 'Superusuario']
  );

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

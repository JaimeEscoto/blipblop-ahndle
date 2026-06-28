-- ════════════════════════════════════════════════════════════════════════
--  Dental Sur — Datos demo
-- ════════════════════════════════════════════════════════════════════════
--  Genera una clínica completa con datos coherentes para mostrar el sistema:
--    • 1 clínica  (slug: dental-sur)
--    • 3 doctores
--    • 20 pacientes
--    • 10 procedimientos en el catálogo
--    • ~250 citas entre 2026-06-01 y 2026-07-31 (pasado completadas,
--                                                 futuro programadas)
--    • Facturas para casi todas las citas completadas, mezcla de
--      pagadas / parciales / emitidas / borrador
--    • 15 ventas de insumos (facturas type='supply', sin cita)
--    • Información médica básica para algunos pacientes
--
--  Idempotente: borra y recrea la clínica `dental-sur` con todo en cascada.
--  Para correr:
--      psql "$DATABASE_URL" -f seed_dental_sur.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Garantiza columnas demo en `clinics` por si esta DB aún no ha visto la
-- migración del backend (el seed es autocontenido).
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS demo_token TEXT;
CREATE INDEX IF NOT EXISTS clinics_demo_token_idx ON clinics(demo_token) WHERE demo_token IS NOT NULL;

-- Limpia data previa de la clínica demo (cascada borra todo lo asociado)
DELETE FROM clinics WHERE slug = 'dental-sur';

-- Clínica (marcada como demo con token público para el link especial).
-- Cambia el demo_token por uno propio si el actual se filtró: ese token es la
-- contraseña del link.
INSERT INTO clinics (slug, name, owner_email, currency, tax_rate, next_invoice_number, is_demo, demo_token)
VALUES ('dental-sur', 'Dental Sur', 'demo@odontiacloud.com', 'HNL', 15, 1, true, 'DSUR-DEMO-2026');

DO $seed$
DECLARE
  v_clinic_id INTEGER;
  v_doc_ids   INTEGER[];
  v_pat_ids   INTEGER[];
  v_proc_ids  INTEGER[];
  v_today     DATE := DATE '2026-06-28';

  d            DATE;
  i            INTEGER;
  appt_id      INTEGER;
  inv_id       INTEGER;
  inv_number   INTEGER;
  pat          INTEGER;
  doc          INTEGER;
  proc         INTEGER;
  proc2        INTEGER;
  appt_status  TEXT;
  inv_status   TEXT;
  pay_method   TEXT;
  appts_today  INTEGER;
  subtotal     NUMERIC;
  tax_amount   NUMERIC;
  total_amount NUMERIC;
  pay_amount   NUMERIC;
  v_tax_rate   NUMERIC := 15;
  v_supply_descs TEXT[] := ARRAY[
    'Cepillo dental sensitivo',
    'Hilo dental cera 50m',
    'Enjuague bucal 500ml',
    'Crema dental remineralizante 100g',
    'Pack 2 cepillos interdentales',
    'Protector bucal nocturno',
    'Pasta blanqueadora 75ml',
    'Kit de higiene viaje'
  ];
BEGIN
  SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'dental-sur';

  -- ── Doctores ────────────────────────────────────────────────────────
  WITH ins AS (
    INSERT INTO doctors (clinic_id, name, specialty, email, phone, license_number) VALUES
      (v_clinic_id, 'Dra. Carmen Mejía',   'Odontología general', 'carmen.mejia@dentalsur.hn',   '+504 9555 0101', 'RM-OD-1001'),
      (v_clinic_id, 'Dr. Juan Velásquez',  'Ortodoncia',          'juan.velasquez@dentalsur.hn', '+504 9555 0102', 'RM-OD-1002'),
      (v_clinic_id, 'Dra. Sofía Rivera',   'Endodoncia',          'sofia.rivera@dentalsur.hn',   '+504 9555 0103', 'RM-OD-1003')
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_doc_ids FROM ins;

  -- ── Pacientes (20) ──────────────────────────────────────────────────
  WITH ins AS (
    INSERT INTO users (clinic_id, name, email, phone, document_id) VALUES
      (v_clinic_id, 'María Fernanda López', 'maria.lopez@gmail.com',      '+504 3344 1001', '0801-1990-12001'),
      (v_clinic_id, 'Carlos Núñez',          'carlos.nunez@gmail.com',     '+504 3344 1002', '0801-1985-12002'),
      (v_clinic_id, 'Ana Castro',            'ana.castro@gmail.com',       '+504 3344 1003', '0801-1992-12003'),
      (v_clinic_id, 'Luis Pérez',            'luis.perez@gmail.com',       '+504 3344 1004', '0801-1988-12004'),
      (v_clinic_id, 'Sofía Reyes',           'sofia.reyes@gmail.com',      '+504 3344 1005', '0801-1995-12005'),
      (v_clinic_id, 'David Guerrero',        'david.guerrero@gmail.com',   '+504 3344 1006', '0801-1991-12006'),
      (v_clinic_id, 'Valentina García',      'valentina.garcia@gmail.com', '+504 3344 1007', '0801-1993-12007'),
      (v_clinic_id, 'Andrés Gómez',          'andres.gomez@gmail.com',     '+504 3344 1008', '0801-1987-12008'),
      (v_clinic_id, 'Daniela Herrera',       'daniela.herrera@gmail.com',  '+504 3344 1009', '0801-1994-12009'),
      (v_clinic_id, 'Santiago Moreno',       'santiago.moreno@gmail.com',  '+504 3344 1010', '0801-1989-12010'),
      (v_clinic_id, 'Isabella Torres',       'isabella.torres@gmail.com',  '+504 3344 1011', '0801-1996-12011'),
      (v_clinic_id, 'Sebastián Vargas',      'sebastian.vargas@gmail.com', '+504 3344 1012', '0801-1986-12012'),
      (v_clinic_id, 'Camila Jiménez',        'camila.jimenez@gmail.com',   '+504 3344 1013', '0801-1997-12013'),
      (v_clinic_id, 'Miguel Reyes',          'miguel.reyes@gmail.com',     '+504 3344 1014', '0801-1984-12014'),
      (v_clinic_id, 'Luisa Castro',          'luisa.castro@gmail.com',     '+504 3344 1015', '0801-1998-12015'),
      (v_clinic_id, 'Alejandro Ramírez',     'ale.ramirez@gmail.com',      '+504 3344 1016', '0801-1983-12016'),
      (v_clinic_id, 'Paula Suárez',          'paula.suarez@gmail.com',     '+504 3344 1017', '0801-1999-12017'),
      (v_clinic_id, 'Nicolás Pardo',         'nicolas.pardo@gmail.com',    '+504 3344 1018', '0801-1982-12018'),
      (v_clinic_id, 'Gabriela Molina',       'gabriela.molina@gmail.com',  '+504 3344 1019', '0801-2000-12019'),
      (v_clinic_id, 'Felipe Mendoza',        'felipe.mendoza@gmail.com',   '+504 3344 1020', '0801-1981-12020')
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_pat_ids FROM ins;

  -- Información médica para algunos pacientes (realismo)
  INSERT INTO medical_info (user_id, blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone, clinic_id)
  VALUES
    (v_pat_ids[1],  'O+',  'Penicilina', 'Hipertensión',     'Losartán 50mg',  'Carlos López (esposo)',   '+504 3344 9001', v_clinic_id),
    (v_pat_ids[3],  'A+',  NULL,         'Asma',             'Salbutamol',     'Pedro Castro (padre)',    '+504 3344 9002', v_clinic_id),
    (v_pat_ids[6],  'B+',  'Látex',      NULL,               NULL,             'Andrea Guerrero (mamá)',  '+504 3344 9003', v_clinic_id),
    (v_pat_ids[10], 'O-',  NULL,         'Diabetes tipo 2',  'Metformina 850', 'Lucía Torres (hermana)',  '+504 3344 9004', v_clinic_id);

  -- ── Catálogo de procedimientos (10) ─────────────────────────────────
  WITH ins AS (
    INSERT INTO procedures (clinic_id, code, name, description, default_price, duration_minutes, active) VALUES
      (v_clinic_id, 'D-001', 'Consulta odontológica general', 'Valoración inicial y diagnóstico',    500, 20, true),
      (v_clinic_id, 'D-002', 'Profilaxis dental',             'Limpieza y pulido completo',          800, 30, true),
      (v_clinic_id, 'D-003', 'Resina simple',                 'Restauración estética de una cara', 1200, 45, true),
      (v_clinic_id, 'D-004', 'Resina compuesta',              'Restauración multifaz',             1800, 60, true),
      (v_clinic_id, 'D-005', 'Extracción simple',             'Exodoncia de pieza erupcionada',     900, 30, true),
      (v_clinic_id, 'D-006', 'Endodoncia unirradicular',      'Conducto en pieza anterior',        3500, 60, true),
      (v_clinic_id, 'D-007', 'Endodoncia multirradicular',    'Conducto en pieza posterior',       5500, 90, true),
      (v_clinic_id, 'D-008', 'Radiografía periapical',        'Imagen diagnóstica individual',      250, 10, true),
      (v_clinic_id, 'D-009', 'Blanqueamiento',                'Por sesión',                        2500, 60, true),
      (v_clinic_id, 'D-010', 'Corona individual',             'Corona de porcelana',               8000, 90, true)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_proc_ids FROM ins;

  -- ── Citas: Jun 1 – Jul 31 ───────────────────────────────────────────
  FOR d IN SELECT generate_series('2026-06-01'::date, '2026-07-31'::date, '1 day'::interval)::date LOOP
    -- Domingos: 0-1; sábados: 2-3; resto: 4-6
    IF EXTRACT(DOW FROM d) = 0 THEN
      appts_today := (random() * 1)::int;
    ELSIF EXTRACT(DOW FROM d) = 6 THEN
      appts_today := 2 + (random() * 1)::int;
    ELSE
      appts_today := 4 + (random() * 2)::int;
    END IF;

    FOR i IN 1..appts_today LOOP
      pat  := v_pat_ids[1 + floor(random() * array_length(v_pat_ids, 1))::int];
      doc  := v_doc_ids[1 + floor(random() * array_length(v_doc_ids, 1))::int];
      proc := v_proc_ids[1 + floor(random() * array_length(v_proc_ids, 1))::int];

      -- Status según fecha
      IF d < v_today THEN
        IF random() < 0.85 THEN
          appt_status := 'completed';
        ELSIF random() < 0.6 THEN
          appt_status := 'cancelled';
        ELSE
          appt_status := 'scheduled'; -- pendiente de cerrar
        END IF;
      ELSIF d = v_today THEN
        appt_status := CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END;
      ELSE
        appt_status := 'scheduled';
      END IF;

      -- Inserta la cita
      INSERT INTO appointments (clinic_id, user_id, doctor_id, date, time, reason, status, public_code)
      VALUES (
        v_clinic_id, pat, doc, d,
        (TIME '08:00' + (i * INTERVAL '50 minutes'))::time,
        (SELECT name FROM procedures WHERE id = proc),
        appt_status,
        upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
        upper(substr(md5(random()::text || clock_timestamp()::text || i::text), 1, 4))
      )
      RETURNING id INTO appt_id;

      -- Procedimiento planeado
      INSERT INTO appointment_procedures (appointment_id, procedure_id, quantity, unit_price, position)
      VALUES (appt_id, proc, 1, (SELECT default_price FROM procedures WHERE id = proc), 0);

      -- A veces dos procedimientos
      IF random() < 0.25 THEN
        proc2 := v_proc_ids[1 + floor(random() * array_length(v_proc_ids, 1))::int];
        IF proc2 <> proc THEN
          INSERT INTO appointment_procedures (appointment_id, procedure_id, quantity, unit_price, position)
          VALUES (appt_id, proc2, 1, (SELECT default_price FROM procedures WHERE id = proc2), 1);
        END IF;
      END IF;

      -- Si la cita se completó: factura
      IF appt_status = 'completed' THEN
        SELECT COALESCE(SUM(quantity * unit_price), 0) INTO subtotal
        FROM appointment_procedures WHERE appointment_id = appt_id;

        tax_amount   := round(subtotal * (v_tax_rate / 100.0), 2);
        total_amount := subtotal + tax_amount;

        -- Distribución realista: 65% pagadas, 18% parciales, 14% emitidas sin pago, 3% borrador
        IF random() < 0.65 THEN inv_status := 'paid';
        ELSIF random() < 0.83 THEN inv_status := 'partial';
        ELSIF random() < 0.97 THEN inv_status := 'issued';
        ELSE inv_status := 'draft';
        END IF;

        UPDATE clinics SET next_invoice_number = next_invoice_number + 1
        WHERE id = v_clinic_id
        RETURNING next_invoice_number - 1 INTO inv_number;

        INSERT INTO invoices (
          clinic_id, number, user_id, doctor_id, appointment_id, type, date,
          subtotal, tax_rate, tax, discount, total, status,
          created_by_email, created_by_name
        )
        VALUES (
          v_clinic_id, inv_number, pat, doc, appt_id, 'appointment', d,
          subtotal, v_tax_rate, tax_amount, 0, total_amount, inv_status,
          'sistema@dentalsur.hn', 'Sistema'
        )
        RETURNING id INTO inv_id;

        -- Items de la factura: copia los procedimientos planeados
        INSERT INTO invoice_items (invoice_id, procedure_id, description, quantity, unit_price, total, position)
        SELECT inv_id, ap.procedure_id, p.name, ap.quantity, ap.unit_price,
               (ap.quantity * ap.unit_price), ap.position
        FROM appointment_procedures ap
        JOIN procedures p ON p.id = ap.procedure_id
        WHERE ap.appointment_id = appt_id;

        -- Pagos
        IF inv_status = 'paid' THEN
          pay_method := (ARRAY['cash','card','transfer'])[1 + floor(random() * 3)::int];
          INSERT INTO payments (clinic_id, invoice_id, amount, method, date, received_by_email, received_by_name)
          VALUES (v_clinic_id, inv_id, total_amount, pay_method, d, 'recepcion@dentalsur.hn', 'Recepción');
        ELSIF inv_status = 'partial' THEN
          pay_amount := round((total_amount * (0.3 + random() * 0.4))::numeric, 2);
          pay_method := (ARRAY['cash','card','transfer'])[1 + floor(random() * 3)::int];
          INSERT INTO payments (clinic_id, invoice_id, amount, method, date, received_by_email, received_by_name)
          VALUES (v_clinic_id, inv_id, pay_amount, pay_method, d, 'recepcion@dentalsur.hn', 'Recepción');
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- ── Ventas de insumos (15 ventas, esparcidas Jun+Jul, todas pagadas) ─
  FOR i IN 1..15 LOOP
    d   := '2026-06-01'::date + floor(random() * 60)::int;
    pat := v_pat_ids[1 + floor(random() * array_length(v_pat_ids, 1))::int];

    subtotal     := 80 + floor(random() * 420)::int;     -- entre 80 y 500 HNL
    tax_amount   := round(subtotal * (v_tax_rate / 100.0), 2);
    total_amount := subtotal + tax_amount;

    UPDATE clinics SET next_invoice_number = next_invoice_number + 1
    WHERE id = v_clinic_id
    RETURNING next_invoice_number - 1 INTO inv_number;

    INSERT INTO invoices (
      clinic_id, number, user_id, doctor_id, appointment_id, type, date,
      subtotal, tax_rate, tax, discount, total, status,
      created_by_email, created_by_name
    )
    VALUES (
      v_clinic_id, inv_number, pat, NULL, NULL, 'supply', d,
      subtotal, v_tax_rate, tax_amount, 0, total_amount, 'paid',
      'recepcion@dentalsur.hn', 'Recepción'
    )
    RETURNING id INTO inv_id;

    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total, position)
    VALUES (
      inv_id,
      v_supply_descs[1 + floor(random() * array_length(v_supply_descs, 1))::int],
      1, subtotal, subtotal, 0
    );

    pay_method := (ARRAY['cash','card'])[1 + floor(random() * 2)::int];
    INSERT INTO payments (clinic_id, invoice_id, amount, method, date, received_by_email, received_by_name)
    VALUES (v_clinic_id, inv_id, total_amount, pay_method, d, 'recepcion@dentalsur.hn', 'Recepción');
  END LOOP;

  RAISE NOTICE 'Dental Sur: % pacientes, % doctores, % procedimientos cargados.',
    array_length(v_pat_ids, 1), array_length(v_doc_ids, 1), array_length(v_proc_ids, 1);
END
$seed$;

-- Resumen rápido
SELECT
  (SELECT COUNT(*) FROM users        WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS pacientes,
  (SELECT COUNT(*) FROM doctors      WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS doctores,
  (SELECT COUNT(*) FROM procedures   WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS procedimientos,
  (SELECT COUNT(*) FROM appointments WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS citas,
  (SELECT COUNT(*) FROM invoices     WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS facturas,
  (SELECT COUNT(*) FROM invoices     WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur') AND type='supply') AS ventas_insumos,
  (SELECT COUNT(*) FROM payments     WHERE clinic_id = (SELECT id FROM clinics WHERE slug='dental-sur')) AS pagos;

COMMIT;

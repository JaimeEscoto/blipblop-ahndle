-- ════════════════════════════════════════════════════════════════════════
--  Clínica de Dr. Jaime — Datos de Prueba y Configuración Inicial
-- ════════════════════════════════════════════════════════════════════════
--  Genera la clínica "Clinica de Dr. Jaime":
--    • 1 clínica (slug: clinica-dr-jaime, owner: veggiehncompras@gmail.com)
--    • 1 cuenta admin para veggiehncompras@gmail.com
--    • 5 doctores con especialidades
--    • 10 pacientes con datos demográficos completos (Honduras) y ficha médica
--    • Catálogo de procedimientos odontológicos
--    • Citas programadas para todo el mes de Septiembre 2026
--    • Inventario inicial de materiales y medicamentos
--    • Plantillas de consentimientos informados
--    • Recordatorios de gestión clínica
--    • SIN DATOS FINANCIEROS (sin facturas ni pagos, según requerimiento)
--
--  Idempotente: limpia datos previos de 'clinica-dr-jaime' y los vuelve a crear.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Limpia data previa de la clínica si ya existe (cascada borra todo lo asociado)
DELETE FROM clinics WHERE slug = 'clinica-dr-jaime';

-- 1. Crear la clínica
INSERT INTO clinics (slug, name, owner_email, currency, tax_rate, next_invoice_number, default_country)
VALUES ('clinica-dr-jaime', 'Clinica de Dr. Jaime', 'veggiehncompras@gmail.com', 'HNL', 15, 1, 'HN');

DO $seed$
DECLARE
  v_clinic_id INTEGER;
  v_doc_ids   INTEGER[];
  v_pat_ids   INTEGER[];
  v_proc_ids  INTEGER[];

  d           DATE;
  h           TIME;
  appt_id     INTEGER;
  pat_idx     INTEGER := 1;
  doc_idx     INTEGER := 1;
  proc_idx    INTEGER := 1;
  time_idx    INTEGER := 1;
  
  time_list   TIME[] := ARRAY[
    TIME '08:00', TIME '09:00', TIME '10:30', TIME '11:30', 
    TIME '14:00', TIME '15:30', TIME '16:30'
  ];
  
  reasons_list TEXT[] := ARRAY[
    'Consulta general y diagnóstico',
    'Limpieza dental y profilaxis ultra-sónica',
    'Evaluación de ortodoncia y toma de impresiones',
    'Tratamiento de conducto (Endodoncia) - Sesión 1',
    'Restauración con resina en molar',
    'Extracción de pieza dañada',
    'Control periódico de ortodoncia',
    'Evaluación periodontal y sondaje',
    'Blanqueamiento dental profesional',
    'Aplicación de sellantes y flúor (Odontopediatría)'
  ];

BEGIN
  SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'clinica-dr-jaime';

  -- 2. Asignar / Crear la cuenta de usuario admin para la clínica
  DELETE FROM accounts WHERE clinic_id = v_clinic_id;

  INSERT INTO accounts (clinic_id, email, name, role, language)
  VALUES (v_clinic_id, 'veggiehncompras@gmail.com', 'Dr. Jaime', 'clinic_admin', 'es')
  ON CONFLICT DO NOTHING;

  -- 3. Doctores (5)
  WITH ins_doc AS (
    INSERT INTO doctors (clinic_id, name, specialty, email, phone, license_number) VALUES
      (v_clinic_id, 'Dr. Jaime Escoto',      'Odontología General / Director', 'jaime.escoto@clinicadrjaime.hn', '+504 9888-0101', 'RM-OD-5001'),
      (v_clinic_id, 'Dra. Elena Torres',    'Ortodoncia',                     'elena.torres@clinicadrjaime.hn', '+504 9888-0102', 'RM-OD-5002'),
      (v_clinic_id, 'Dr. Roberto Mendoza',  'Endodoncia',                     'roberto.mendoza@clinicadrjaime.hn', '+504 9888-0103', 'RM-OD-5003'),
      (v_clinic_id, 'Dra. Patricia Morales', 'Periodoncia',                    'patricia.morales@clinicadrjaime.hn', '+504 9888-0104', 'RM-OD-5004'),
      (v_clinic_id, 'Dr. Carlos Alvarado',  'Odontopediatría',                'carlos.alvarado@clinicadrjaime.hn', '+504 9888-0105', 'RM-OD-5005')
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_doc_ids FROM ins_doc;

  -- 4. Pacientes (10)
  WITH ins_pat AS (
    INSERT INTO users (
      clinic_id, name, email, phone, document_type, document_id, 
      birth_date, gender, address, city, department, country, occupation
    ) VALUES
      (v_clinic_id, 'José Luis Rodríguez', 'jose.rodriguez@gmail.com', '+504 3177-1001', 'DNI', '0801-1990-04521', '1990-05-14', 'M', 'Col. Palmira, Ave. República de Chile', 'Tegucigalpa', 'Francisco Morazán', 'HN', 'Ingeniero de Sistemas'),
      (v_clinic_id, 'Ana Maria Gutierrez', 'ana.gutierrez@yahoo.com',  '+504 9455-2002', 'DNI', '0801-1988-12894', '1988-11-22', 'F', 'Col. Las Minitas, Calle Principal',  'Tegucigalpa', 'Francisco Morazán', 'HN', 'Arquitecta'),
      (v_clinic_id, 'Carlos Eduardo Mejía', 'carlos.mejia@outlook.com', '+504 8833-3003', 'DNI', '0501-1995-09123', '1995-03-08', 'M', 'Barrio Los Andes, 7 Calle',        'San Pedro Sula', 'Cortés',          'HN', 'Contador Público'),
      (v_clinic_id, 'Laura Sofía Zelaya',  'laura.zelaya@gmail.com',   '+504 3211-4004', 'DNI', '0801-1998-03411', '1998-07-19', 'F', 'Residencial El Trapiche',          'Tegucigalpa', 'Francisco Morazán', 'HN', 'Diseñadora Gráfica'),
      (v_clinic_id, 'Fernando José Suazo', 'fernando.suazo@gmail.com',  '+504 9644-5005', 'DNI', '0801-1983-05672', '1983-01-30', 'M', 'Col. Alameda, Calle los Alcaldes',   'Tegucigalpa', 'Francisco Morazán', 'HN', 'Abogado'),
      (v_clinic_id, 'Gabriela María López','gaby.lopez@hotmail.com',   '+504 3399-6006', 'DNI', '0801-2001-08912', '2001-09-12', 'F', 'Col. Lomas del Guijarro',         'Tegucigalpa', 'Francisco Morazán', 'HN', 'Estudiante Universitaria'),
      (v_clinic_id, 'Mario Roberto Nuñez', 'mario.nunez@gmail.com',    '+504 9722-7007', 'DNI', '0501-1992-01234', '1992-04-25', 'M', 'Col. Trejo, 21 Avenida',            'San Pedro Sula', 'Cortés',          'HN', 'Administrador de Empresas'),
      (v_clinic_id, 'Claudia Patricia V.', 'claudia.valle@gmail.com',  '+504 3188-8008', 'DNI', '0801-1987-07456', '1987-12-05', 'F', 'Residencial Agua Dulce',          'Tegucigalpa', 'Francisco Morazán', 'HN', 'Docente'),
      (v_clinic_id, 'Ricardo Antonio Cruz','ricardo.cruz@gmail.com',   '+504 9911-9009', 'DNI', '0801-1994-06789', '1994-08-17', 'M', 'Col. Tepeyac, Blvd. Juan Pablo II', 'Tegucigalpa', 'Francisco Morazán', 'HN', 'Mercadólogo'),
      (v_clinic_id, 'Andrea Nicole Reyes', 'andrea.reyes@gmail.com',   '+504 3244-1010', 'DNI', '0801-2003-02345', '2003-06-02', 'F', 'Col. Miramontes, Calle 3',         'Tegucigalpa', 'Francisco Morazán', 'HN', 'Estudiante')
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_pat_ids FROM ins_pat;

  -- 5. Información Médica (Ficha médica para los 10 pacientes)
  INSERT INTO medical_info (clinic_id, user_id, blood_type, allergies, medical_conditions, current_medications, emergency_contact, emergency_phone) VALUES
    (v_clinic_id, v_pat_ids[1],  'O+',  'Penicilina', 'Hipertensión leve', 'Enalapril 10mg', 'Martha Rodríguez (Esposa)', '+504 9900-1122'),
    (v_clinic_id, v_pat_ids[2],  'A+',  'Ninguna', 'Ninguna', 'Ninguno', 'Carlos Gutiérrez (Padre)', '+504 9900-2233'),
    (v_clinic_id, v_pat_ids[3],  'B+',  'Aspirina', 'Asma bronquial', 'Inhalador Salbutamol', 'Lucía Mejía (Hermana)', '+504 9900-3344'),
    (v_clinic_id, v_pat_ids[4],  'O-',  'Latex', 'Ninguna', 'Ninguno', 'Roberto Zelaya (Padre)', '+504 9900-4455'),
    (v_clinic_id, v_pat_ids[5],  'A-',  'AINEs', 'Diabetes Tipo 2', 'Metformina 850mg', 'Elena Suazo (Esposa)', '+504 9900-5566'),
    (v_clinic_id, v_pat_ids[6],  'AB+','Ninguna', 'Ninguna', 'Ninguno', 'María López (Madre)', '+504 9900-6677'),
    (v_clinic_id, v_pat_ids[7],  'O+',  'Mariscos', 'Hipertensión', 'Losartán 50mg', 'Karla Núñez (Esposa)', '+504 9900-7788'),
    (v_clinic_id, v_pat_ids[8],  'A+',  'Sulfa', 'Migraña frecuente', 'Ibupirac en crisis', 'Juan Valle (Esposo)', '+504 9900-8899'),
    (v_clinic_id, v_pat_ids[9],  'O+',  'Ninguna', 'Ninguna', 'Ninguno', 'Sofia Cruz (Hermana)', '+504 9900-9900'),
    (v_clinic_id, v_pat_ids[10], 'B-',  'Ninguna', 'Ninguna', 'Ninguno', 'Carmen Reyes (Madre)', '+504 9900-0011');

  -- 6. Catálogo de Procedimientos (Procedures)
  WITH ins_proc AS (
    INSERT INTO procedures (clinic_id, code, name, description, default_price, duration_minutes, default_sessions, active) VALUES
      (v_clinic_id, 'PROC-001', 'Consulta Odontológica y Diagnóstico', 'Examen clínico completo y plan de tratamiento', 500, 30, 1, true),
      (v_clinic_id, 'PROC-002', 'Limpieza Dental Profunda y Profilaxis', 'Eliminación de sarro con ultrasonido y pulido', 800, 45, 1, true),
      (v_clinic_id, 'PROC-003', 'Restauración con Resina Estética', 'Obturación fotocurable en pieza anterior o posterior', 1200, 45, 1, true),
      (v_clinic_id, 'PROC-004', 'Tratamiento de Conducto (Endodoncia Unirradicular)', 'Desinfección y sellado de conductos', 3500, 60, 2, true),
      (v_clinic_id, 'PROC-005', 'Tratamiento de Conducto (Endodoncia Multirradicular)', 'Endodoncia en molar con técnica mecanizada', 4800, 90, 3, true),
      (v_clinic_id, 'PROC-006', 'Control Mensual de Ortodoncia', 'Ajuste de arcos, cambio de ligaduras y seguimiento', 1000, 30, 1, true),
      (v_clinic_id, 'PROC-007', 'Blanqueamiento Dental LED', 'Sesión clínica de aclaramiento dental con luz fría', 3000, 60, 1, true),
      (v_clinic_id, 'PROC-008', 'Exodoncia / Extracción Simple', 'Extracción quirúrgica simple de pieza dental', 1500, 45, 1, true),
      (v_clinic_id, 'PROC-009', 'Detartraje y Curetaje Periodontal', 'Tratamiento periodontal por cuadrante', 2200, 60, 2, true),
      (v_clinic_id, 'PROC-010', 'Aplicación de Fluoruro y Sellantes', 'Prevención de caries en pacientes infantiles', 600, 30, 1, true)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_proc_ids FROM ins_proc;

  -- 7. Citas para TODO el mes de SEPTIEMBRE 2026 (Sept 1 a Sept 30)
  -- Se generan citas diarias de lunes a sábado distribuidas entre los 5 doctores y 10 pacientes.
  FOR d IN SELECT generate_series(DATE '2026-09-01', DATE '2026-09-30', INTERVAL '1 day')::DATE LOOP
    -- Saltar domingos (extract dow: 0 = domingo)
    IF EXTRACT(DOW FROM d) <> 0 THEN
      -- Crear 2 a 3 citas por día hábil
      FOR i IN 1..((EXTRACT(DAY FROM d)::INT % 2) + 2) LOOP
        h := time_list[time_idx];
        
        INSERT INTO appointments (
          clinic_id, user_id, doctor_id, date, time, reason, status, notes, public_code
        ) VALUES (
          v_clinic_id,
          v_pat_ids[pat_idx],
          v_doc_ids[doc_idx],
          d,
          h,
          reasons_list[proc_idx],
          'scheduled',
          'Cita programada en agenda de Septiembre.',
          CONCAT('JAIME-', TO_CHAR(d, 'YYYYMMDD'), '-', pat_idx, doc_idx, i)
        ) RETURNING id INTO appt_id;

        -- Enlazar procedimiento planificado a la cita
        INSERT INTO appointment_procedures (
          appointment_id, procedure_id, quantity, unit_price, position
        ) VALUES (
          appt_id,
          v_proc_ids[proc_idx],
          1,
          (SELECT default_price FROM procedures WHERE id = v_proc_ids[proc_idx]),
          0
        );

        -- Rotación de índices
        pat_idx  := (pat_idx % 10) + 1;
        doc_idx  := (doc_idx % 5) + 1;
        proc_idx := (proc_idx % 10) + 1;
        time_idx := (time_idx % 7) + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- 8. Inventario Inicial (12 items)
  INSERT INTO inventory (clinic_id, name, category, quantity, unit, min_quantity, price, supplier) VALUES
    (v_clinic_id, 'Anestésico Lidocaína 2% con Epinefrina (Caja x 50)', 'medication', 15, 'caja', 5, 450, 'Depósito Dental OdontoHonduras'),
    (v_clinic_id, 'Guantes de Nitrilo Talla M (Caja x 100)',          'material',   25, 'caja', 10, 180, 'Insumos Médicos del Sur'),
    (v_clinic_id, 'Resina Fotocurable A2 Filtek Z250 (Jeringa 4g)',    'material',   8,  'jeringa', 3, 650, '3M Oral Care HN'),
    (v_clinic_id, 'Agujas Cortas 30G para Carpuled (Caja x 100)',       'material',   12, 'caja', 4, 220, 'Depósito Dental OdontoHonduras'),
    (v_clinic_id, 'Baberos Desechables Impermeables (Paquete x 125)', 'material',   20, 'paquete', 5, 150, 'Insumos Médicos del Sur'),
    (v_clinic_id, 'Eyectores de Saliva Flexibles (Bolsa x 100)',      'material',   30, 'bolsa', 8, 120, 'Depósito Dental OdontoHonduras'),
    (v_clinic_id, 'Amoxicilina 500mg (Caja x 30 cápsulas)',            'medication', 10, 'caja', 3, 140, 'Droguería Farmacéutica Central'),
    (v_clinic_id, 'Ibuprofeno 600mg (Caja x 20 tabletas)',             'medication', 15, 'caja', 4, 95,  'Droguería Farmacéutica Central'),
    (v_clinic_id, 'Pieza de Mano de Alta Velocidad Push Button',       'equipment',  6,  'unidad', 2, 3500, 'Kavo Dental Corp'),
    (v_clinic_id, 'Lámpara de Fotocurado LED Inalámbrica',             'equipment',  4,  'unidad', 1, 4200, 'Woodpecker Medical'),
    (v_clinic_id, 'Kit de Hilo Dental Profiláctico 50m',               'product',    40, 'unidad', 10, 65, 'Oral-B Profesional'),
    (v_clinic_id, 'Pasta Dental Remineralizante Sensitiva 100g',       'product',    25, 'unidad', 5,  110, 'Colgate Professional')
  ON CONFLICT DO NOTHING;

  -- 9. Plantillas de Consentimiento Informado (4 plantillas)
  INSERT INTO consent_templates (clinic_id, title, body, active) VALUES
    (v_clinic_id, 'Consentimiento Informado para Tratamiento Odontológico General', 
     'Por medio del presente documento autorizo al equipo profesional de Clinica de Dr. Jaime a realizar los diagnósticos, limpiezas y restauraciones necesarias para mi salud bucal, habiendo comprendido los beneficios y posibles molestias temporales.', true),
    (v_clinic_id, 'Consentimiento Informado para Tratamiento de Ortodoncia', 
     'Autorizo el inicio del tratamiento de ortodoncia. Comprendo la importancia de la higiene bucal estricta, la asistencia puntual a los controles mensuales y el uso de retenedores al finalizar el tratamiento.', true),
    (v_clinic_id, 'Consentimiento Informado para Endodoncia (Tratamiento de Conductos)', 
     'Autorizo la realización del tratamiento de conductos en la pieza dental indicada. Se me han explicado las alternativas, el porcentaje de éxito del procedimiento y la necesidad de una restauración definitiva posterior.', true),
    (v_clinic_id, 'Consentimiento Informado para Exodoncia (Extracción Dental)', 
     'Autorizo la extracción de la pieza dental diagnosticada. Acepto seguir las indicaciones post-operatorias de reposo, medicación y cuidados indicados por el especialista para evitar complicaciones como alveolitis o sangrado.', true)
  ON CONFLICT DO NOTHING;

  -- 10. Recordatorios Internos de Gestión (Reminders)
  INSERT INTO reminders (clinic_id, title, description, date, time, type, status) VALUES
    (v_clinic_id, 'Confirmación de citas de la primera semana de Septiembre', 'Llamar o enviar mensaje a pacientes con cita programada entre el 1 y 5 de Septiembre.', '2026-09-01', TIME '08:30', 'task', 'pending'),
    (v_clinic_id, 'Mantenimiento preventivo de compresor y unidades dentales',  'Revisión técnica trimestral con el proveedor de equipos.', '2026-09-15', TIME '10:00', 'task', 'pending'),
    (v_clinic_id, 'Pedido de reposición de insumos de anestesia y guantes',     'Revisar stock mínimo en inventario y enviar orden a Depósito Dental OdontoHonduras.', '2026-09-20', TIME '14:00', 'task', 'pending')
  ON CONFLICT DO NOTHING;

END $seed$;

COMMIT;

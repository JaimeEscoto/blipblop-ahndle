import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth, requireSuperAdminPortal } from '../auth';
import { isSuperAdminHost } from '../tenant';
import { recordActivity } from '../audit';

const router = Router();

// Herramientas globales: SOLO el super admin desde el portal superadmin.*
router.use((req, res, next) => {
  if (!isSuperAdminHost(req)) return res.status(404).json({ error: 'No encontrado' });
  next();
});
router.use(requireAuth, requireSuperAdminPortal);

// Convierte un valor de JS al literal SQL equivalente.
function sqlValue(v: any): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Genera un volcado SQL completo (esquema + datos) de todo el esquema public.
// El archivo es autocontenido y restaurable con `psql ... -f archivo.sql`.
async function generateBackup(): Promise<string> {
  const { rows: tables } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  const out: string[] = [
    '-- ============================================================',
    '-- Respaldo completo odontiacloud (esquema + datos)',
    `-- Generado: ${new Date().toISOString()}`,
    '-- ADVERTENCIA: este script ELIMINA y recrea todas las tablas.',
    '-- Restaurar:   psql "<cadena de conexión>" -f este_archivo.sql',
    '-- ============================================================',
    '',
    'BEGIN;',
    '',
  ];

  const foreignKeys: string[] = [];   // se añaden al final para evitar problemas de orden
  const sequenceResets: string[] = []; // reajuste de secuencias tras cargar los datos

  for (const { tablename } of tables) {
    // Definición de columnas (tipo exacto, NOT NULL y DEFAULT).
    const { rows: cols } = await pool.query(
      `SELECT a.attname AS name,
              format_type(a.atttypid, a.atttypmod) AS type,
              a.attnotnull AS notnull,
              pg_get_expr(d.adbin, d.adrelid) AS def
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [`"${tablename}"`]
    );

    // Restricciones (PK, UNIQUE, CHECK y FK).
    const { rows: cons } = await pool.query(
      `SELECT conname AS name, contype AS type, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY contype`,
      [`"${tablename}"`]
    );

    const lines: string[] = [];
    let hasId = false;
    for (const c of cols) {
      if (c.name === 'id') hasId = true;
      const isSerial = c.def && /^nextval\(/.test(c.def);
      let line = `  "${c.name}" `;
      if (isSerial && /int/.test(c.type)) {
        line += c.type === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
      } else {
        line += c.type;
        if (c.def) line += ` DEFAULT ${c.def}`;
      }
      if (c.notnull) line += ' NOT NULL';
      lines.push(line);
    }
    for (const c of cons) {
      if (c.type === 'f') {
        foreignKeys.push(`ALTER TABLE "${tablename}" ADD CONSTRAINT "${c.name}" ${c.def};`);
      } else {
        lines.push(`  CONSTRAINT "${c.name}" ${c.def}`);
      }
    }

    out.push(`-- ---------- Tabla: ${tablename} ----------`);
    out.push(`DROP TABLE IF EXISTS "${tablename}" CASCADE;`);
    out.push(`CREATE TABLE "${tablename}" (`);
    out.push(lines.join(',\n'));
    out.push(');');
    out.push('');

    // Datos.
    const { rows: data } = await pool.query(`SELECT * FROM "${tablename}"`);
    if (data.length) {
      const colNames = Object.keys(data[0]);
      const colList = colNames.map(c => `"${c}"`).join(', ');
      for (const row of data) {
        const vals = colNames.map(c => sqlValue(row[c])).join(', ');
        out.push(`INSERT INTO "${tablename}" (${colList}) VALUES (${vals});`);
      }
      out.push('');
    }

    if (hasId) {
      sequenceResets.push(
        `SELECT setval(pg_get_serial_sequence('"${tablename}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tablename}"), 1), true);`
      );
    }
  }

  if (foreignKeys.length) {
    out.push('-- ---------- Llaves foráneas ----------', ...foreignKeys, '');
  }
  if (sequenceResets.length) {
    out.push('-- ---------- Reinicio de secuencias ----------', ...sequenceResets, '');
  }

  out.push('COMMIT;', '');
  return out.join('\n');
}

router.get('/backup', async (req: Request, res: Response) => {
  try {
    const sql = await generateBackup();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `backup-odontiacloud-${stamp}.sql`;
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sql);
    // Operación sensible: dejamos constancia en la bitácora.
    recordActivity({
      accountId: req.account!.id,
      accountEmail: req.account!.email,
      accountName: req.account!.name,
      action: 'Descargó',
      entity: 'Respaldo',
      summary: 'Descargó un respaldo completo de la base de datos',
      method: 'GET',
      path: req.originalUrl,
      statusCode: 200,
    });
  } catch (err) {
    console.error('Error al generar respaldo:', err);
    res.status(500).json({ error: 'No se pudo generar el respaldo' });
  }
});

export default router;

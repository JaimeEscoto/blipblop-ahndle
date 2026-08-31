import fs from 'fs/promises';
import path from 'path';
import pool, { initDB } from '../database';

async function main() {
  console.log('🔄 Inicializando base de datos y esquemas...');
  await initDB();

  console.log('🌱 Ejecutando seed para "Clinica de Dr. Jaime"...');
  
  const sqlPath = path.resolve(__dirname, '../../../piloto_clinicas/seed_clinica_dr_jaime.sql');
  const sql = await fs.readFile(sqlPath, 'utf8');

  await pool.query(sql);

  console.log('✅ ¡Se ha creado la "Clinica de Dr. Jaime" con éxito!');
  console.log('📌 Detalles:');
  console.log('   - Clínica: Clinica de Dr. Jaime (slug: clinica-dr-jaime)');
  console.log('   - Propietario / Admin: veggiehncompras@gmail.com');
  console.log('   - Doctores: 5');
  console.log('   - Pacientes: 10 (con expediente médico completo)');
  console.log('   - Citas: Distribuidas en todo el mes de Septiembre 2026');
  console.log('   - Procedimientos, Inventario, Consentimientos y Recordatorios poblados');
  console.log('   - Finanzas: 0 facturas y 0 pagos (se mantuvo limpio)');
  
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error al ejecutar el seed:', err);
  process.exit(1);
});

// Genera un código corto, legible y aleatorio para identificar una cita
// (sin caracteres ambiguos como O/0, I/1).
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAppointmentCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  // Formato agrupado: ABCD-2345
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

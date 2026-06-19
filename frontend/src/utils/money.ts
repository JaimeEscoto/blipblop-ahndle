// Símbolos por código de moneda. Si no está en el mapa, usamos el código directamente.
const SYMBOLS: Record<string, string> = {
  HNL: 'L', USD: '$', GTQ: 'Q', MXN: '$', EUR: '€', COP: '$', NIO: 'C$', CRC: '₡', PEN: 'S/',
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return 'L';
  return SYMBOLS[code.toUpperCase()] || code.toUpperCase() + ' ';
}

export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount) || 0;
  const sym = currencySymbol(currency);
  return `${sym} ${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

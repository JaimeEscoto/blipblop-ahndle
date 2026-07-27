import { describe, it, expect } from 'vitest';
import { currencySymbol, formatMoney } from './money';

describe('currencySymbol', () => {
  it('maps known currency codes to their symbol', () => {
    expect(currencySymbol('HNL')).toBe('L');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('CRC')).toBe('₡');
    expect(currencySymbol('PEN')).toBe('S/');
  });

  it('is case-insensitive', () => {
    expect(currencySymbol('usd')).toBe('$');
    expect(currencySymbol('eur')).toBe('€');
  });

  it('defaults to "L" (HNL) when the code is missing', () => {
    expect(currencySymbol(null)).toBe('L');
    expect(currencySymbol(undefined)).toBe('L');
    expect(currencySymbol('')).toBe('L');
  });

  it('falls back to the uppercased code plus a space for unknown codes', () => {
    expect(currencySymbol('JPY')).toBe('JPY ');
    expect(currencySymbol('gbp')).toBe('GBP ');
  });
});

describe('formatMoney', () => {
  it('formats a number with symbol and two decimals', () => {
    // es-ES no agrupa millares por debajo de 10.000 (regla de la locale),
    // por eso 1234,50 no lleva punto de millar. Ver el test de agrupación abajo.
    expect(formatMoney(1234.5, 'USD')).toBe('$ 1234,50');
    expect(formatMoney(0, 'USD')).toBe('$ 0,00');
  });

  it('groups thousands once the integer part reaches five digits (es-ES rule)', () => {
    expect(formatMoney(12345.5, 'USD')).toBe('$ 12.345,50');
  });

  it('uses the HNL symbol by default when no currency is given', () => {
    expect(formatMoney(50)).toBe('L 50,00');
  });

  it('parses numeric strings', () => {
    expect(formatMoney('99.9', 'USD')).toBe('$ 99,90');
  });

  it('treats nullish / non-numeric amounts as zero', () => {
    expect(formatMoney(null, 'USD')).toBe('$ 0,00');
    expect(formatMoney(undefined, 'USD')).toBe('$ 0,00');
    expect(formatMoney('abc', 'USD')).toBe('$ 0,00');
  });

  it('groups thousands (es-ES locale)', () => {
    expect(formatMoney(1000000, 'HNL')).toBe('L 1.000.000,00');
  });

  it('prefixes an unknown currency code with a trailing space', () => {
    expect(formatMoney(10, 'JPY')).toBe('JPY  10,00');
  });
});

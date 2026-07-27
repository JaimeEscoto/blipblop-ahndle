import { describe, it, expect } from 'vitest';
import {
  round2,
  computeTotals,
  statusFor,
  computeBalance,
  clampTaxRate,
  clampSessions,
  clampTotalAmount,
  clampIntervalWeeks,
  perSessionAmount,
} from './finance';

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(2.345)).toBe(2.35);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(10)).toBe(10);
    expect(round2(1.4999)).toBe(1.5);
  });

  it('documents the IEEE-754 half-cent limitation (1.005 → 1.00, not 1.01)', () => {
    // 1.005 * 100 === 100.49999999999999 en coma flotante, así que Math.round
    // baja a 100. No es lo "matemáticamente" esperado, pero es el
    // comportamiento real de round2; este test lo fija para que un cambio
    // futuro sea deliberado.
    expect(round2(1.005)).toBe(1);
  });

  it('treats non-numeric / nullish input as 0', () => {
    expect(round2(null)).toBe(0);
    expect(round2(undefined)).toBe(0);
    expect(round2('' as any)).toBe(0);
    expect(round2('abc' as any)).toBe(0);
    expect(round2(NaN)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(round2('3.14159' as any)).toBe(3.14);
  });
});

describe('computeTotals', () => {
  it('sums quantity * unit_price into subtotal', () => {
    const t = computeTotals(
      [
        { quantity: 2, unit_price: 100 },
        { quantity: 1, unit_price: 50.5 },
      ],
      0,
      0
    );
    expect(t.subtotal).toBe(250.5);
    expect(t.discount).toBe(0);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(250.5);
  });

  it('applies a percentage tax on the discounted base', () => {
    // subtotal 1000, descuento 100 → base 900, IVA 15% = 135, total 1035
    const t = computeTotals([{ quantity: 1, unit_price: 1000 }], 15, 100);
    expect(t.subtotal).toBe(1000);
    expect(t.discount).toBe(100);
    expect(t.tax).toBe(135);
    expect(t.total).toBe(1035);
  });

  it('never lets the discount push the base below zero', () => {
    const t = computeTotals([{ quantity: 1, unit_price: 100 }], 10, 500);
    expect(t.subtotal).toBe(100);
    expect(t.discount).toBe(500);
    expect(t.tax).toBe(0); // base es 0, no negativa
    expect(t.total).toBe(0);
  });

  it('handles an empty item list', () => {
    const t = computeTotals([], 15, 0);
    expect(t).toEqual({ subtotal: 0, tax: 0, discount: 0, total: 0 });
  });

  it('coerces string quantities/prices and ignores bad values', () => {
    const t = computeTotals(
      [
        { quantity: '3', unit_price: '10' },
        { quantity: 'x', unit_price: 999 }, // qty inválida → 0
      ],
      0,
      0
    );
    expect(t.subtotal).toBe(30);
    expect(t.total).toBe(30);
  });

  it('rounds floating point noise cleanly (0.1 + 0.2 case)', () => {
    const t = computeTotals(
      [
        { quantity: 1, unit_price: 0.1 },
        { quantity: 1, unit_price: 0.2 },
      ],
      0,
      0
    );
    expect(t.subtotal).toBe(0.3);
    expect(t.total).toBe(0.3);
  });

  it('rounds the tax amount to two decimals', () => {
    // base 33.33, IVA 7% = 2.3331 → 2.33
    const t = computeTotals([{ quantity: 1, unit_price: 33.33 }], 7, 0);
    expect(t.tax).toBe(2.33);
    expect(t.total).toBe(35.66);
  });

  it('treats missing tax rate and discount as zero', () => {
    const t = computeTotals([{ quantity: 2, unit_price: 25 }], null, undefined);
    expect(t.total).toBe(50);
  });
});

describe('statusFor', () => {
  it('keeps a cancelled invoice cancelled regardless of payments', () => {
    expect(statusFor(100, 100, 'cancelled')).toBe('cancelled');
    expect(statusFor(100, 0, 'cancelled')).toBe('cancelled');
  });

  it('is paid when payment covers the total', () => {
    expect(statusFor(100, 100, 'issued')).toBe('paid');
  });

  it('is paid when payment exceeds the total (overpayment)', () => {
    expect(statusFor(100, 150, 'issued')).toBe('paid');
  });

  it('is partial when there is some payment but not enough', () => {
    expect(statusFor(100, 40, 'issued')).toBe('partial');
  });

  it('is issued when nothing has been paid', () => {
    expect(statusFor(100, 0, 'issued')).toBe('issued');
  });

  it('is not "paid" when the total is zero even with a zero payment', () => {
    // Regla: paid requiere total > 0. Total 0 y pagado 0 → issued.
    expect(statusFor(0, 0, 'issued')).toBe('issued');
  });

  it('rounds both sides before comparing (cent tolerance)', () => {
    expect(statusFor(100.004, 100.001, 'issued')).toBe('paid'); // 100 vs 100
  });
});

describe('computeBalance', () => {
  it('subtracts paid from invoiced', () => {
    expect(computeBalance(1000, 250)).toBe(750);
  });

  it('can be negative (patient overpaid / credit)', () => {
    expect(computeBalance(100, 150)).toBe(-50);
  });

  it('rounds to two decimals', () => {
    expect(computeBalance(100.1, 33.33)).toBe(66.77);
  });

  it('coerces numeric strings from the DB (numeric columns)', () => {
    expect(computeBalance('500.00', '199.99')).toBe(300.01);
  });

  it('treats nullish as zero', () => {
    expect(computeBalance(null, null)).toBe(0);
    expect(computeBalance(100, null)).toBe(100);
  });
});

describe('clampTaxRate', () => {
  it('clamps below 0 up to 0', () => {
    expect(clampTaxRate(-5)).toBe(0);
  });

  it('clamps above 100 down to 100', () => {
    expect(clampTaxRate(150)).toBe(100);
  });

  it('passes through a valid rate', () => {
    expect(clampTaxRate(15)).toBe(15);
    expect(clampTaxRate('12.5')).toBe(12.5);
  });

  it('treats non-numeric as 0', () => {
    expect(clampTaxRate('abc')).toBe(0);
    expect(clampTaxRate(null)).toBe(0);
  });
});

describe('treatment plan math', () => {
  describe('clampSessions', () => {
    it('never goes below 1', () => {
      expect(clampSessions(0)).toBe(1);
      expect(clampSessions(-3)).toBe(1);
      expect(clampSessions('nope')).toBe(1);
      expect(clampSessions(null)).toBe(1);
    });
    it('passes through valid counts', () => {
      expect(clampSessions(6)).toBe(6);
      expect(clampSessions('4')).toBe(4);
    });
  });

  describe('clampTotalAmount', () => {
    it('never negative', () => {
      expect(clampTotalAmount(-100)).toBe(0);
      expect(clampTotalAmount('bad')).toBe(0);
    });
    it('passes through valid amounts', () => {
      expect(clampTotalAmount(1200)).toBe(1200);
    });
  });

  describe('clampIntervalWeeks', () => {
    it('never negative', () => {
      expect(clampIntervalWeeks(-1)).toBe(0);
    });
    it('allows zero (same-day sessions)', () => {
      expect(clampIntervalWeeks(0)).toBe(0);
    });
    it('passes through valid intervals', () => {
      expect(clampIntervalWeeks(2)).toBe(2);
    });
  });

  describe('perSessionAmount', () => {
    it('divides the total across sessions, rounded to cents', () => {
      expect(perSessionAmount(1200, 4)).toBe(300);
      expect(perSessionAmount(100, 3)).toBe(33.33);
    });
    it('returns 0 when there are no sessions (guard against /0)', () => {
      expect(perSessionAmount(1000, 0)).toBe(0);
    });
  });
});

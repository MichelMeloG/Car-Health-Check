import { describe, expect, it } from 'vitest';

import type { Expense } from '../../data/types';
import { categoryTotals, filterExpenses, totalOf } from './metrics';

const expenses: Expense[] = [
  {
    id: '1',
    category: 'Combustível',
    amountCents: 10000,
    occurredAt: '2026-09-05',
    odometerKm: null,
    description: '',
    updatedAt: '2026-09-05T10:00:00.000Z',
  },
  {
    id: '2',
    category: 'Manutenção',
    amountCents: 25000,
    occurredAt: '2026-08-12',
    odometerKm: null,
    description: '',
    updatedAt: '2026-08-12T10:00:00.000Z',
  },
  {
    id: '3',
    category: 'Combustível',
    amountCents: 5000,
    occurredAt: '2026-07-20',
    odometerKm: null,
    description: '',
    updatedAt: '2026-07-20T10:00:00.000Z',
  },
];

describe('dashboard metrics', () => {
  it('calcula totais por período sem usar ponto flutuante', () => {
    expect(totalOf(filterExpenses(expenses, 'current', new Date(2026, 8, 10)))).toBe(10000);
    expect(totalOf(filterExpenses(expenses, 'previous', new Date(2026, 8, 10)))).toBe(25000);
    expect(totalOf(filterExpenses(expenses, 'threeMonths', new Date(2026, 8, 10)))).toBe(40000);
  });

  it('agrupa e ordena categorias pelo maior gasto', () => {
    expect(categoryTotals(expenses)).toEqual([
      ['Manutenção', 25000],
      ['Combustível', 15000],
    ]);
  });
});

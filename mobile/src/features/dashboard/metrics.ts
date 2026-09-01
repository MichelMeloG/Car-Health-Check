import type { Expense } from '../../data/types';

export type Period = 'current' | 'previous' | 'threeMonths' | 'all';

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function periodLabel(period: Period) {
  return {
    current: 'Este mês',
    previous: 'Mês anterior',
    threeMonths: 'Últimos 3 meses',
    all: 'Todo o histórico',
  }[period];
}

export function filterExpenses(expenses: Expense[], period: Period, now = new Date()) {
  if (period === 'all') return expenses;
  const current = monthKey(now);
  if (period === 'current')
    return expenses.filter((expense) => expense.occurredAt.startsWith(current));
  if (period === 'previous') {
    const previous = monthKey(shiftMonth(now, -1));
    return expenses.filter((expense) => expense.occurredAt.startsWith(previous));
  }
  const firstMonth = monthKey(shiftMonth(now, -2));
  return expenses.filter((expense) => expense.occurredAt >= `${firstMonth}-01`);
}

export function totalOf(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

export function categoryTotals(expenses: Expense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const category = expense.category.trim() || 'Sem categoria';
    totals.set(category, (totals.get(category) ?? 0) + expense.amountCents);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

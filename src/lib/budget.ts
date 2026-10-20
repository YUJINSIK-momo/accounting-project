import type { DB } from '../types';
import { postedLines } from '../data/store';

export interface BudgetRow {
  dept: string;
  accountCode: string;
  budget: number;
  spent: number;
  pending: number;
}

const usageAccount = (d: DB, code: string) => d.usages.find((u) => u.code === code)?.accountCode ?? '830';
const key = (dept: string, acct: string) => `${dept}|${acct}`;

/** 결재 중이거나 결재가 끝났지만 아직 전표가 없는 문서 — 곧 집행될 금액 */
export function pendingSpend(d: DB, excludeId?: string) {
  const out = new Map<string, number>();
  const add = (dept: string, acct: string, amt: number) => out.set(key(dept, acct), (out.get(key(dept, acct)) ?? 0) + amt);
  const waiting = (status: string, voucherId?: string) => status === '결재중' || (status === '결재완료' && !voucherId);
  for (const c of d.claims) {
    if (c.id === excludeId || !waiting(c.status, c.voucherId)) continue;
    const dept = d.employees.find((e) => e.id === c.empId)?.dept ?? '-';
    c.items.forEach((i) => add(dept, usageAccount(d, i.usageCode), i.amount));
  }
  for (const x of d.disbursements) {
    if (x.id === excludeId || !waiting(x.status, x.voucherId)) continue;
    x.lines.forEach((l) => add(x.dept, usageAccount(d, l.usageCode), l.evidence === '세금계산서' ? l.supply : l.supply + l.vat));
  }
  return out;
}

/** 발행된 전표의 비용 집행액 — 부서 관리항목 기준 */
export function postedSpend(d: DB, year: string) {
  const out = new Map<string, number>();
  for (const l of postedLines(d)) {
    if (!l.voucher.date.startsWith(year) || !l.dept) continue;
    if (d.accounts.find((a) => a.code === l.accountCode)?.type !== '비용') continue;
    const k = key(l.dept, l.accountCode);
    out.set(k, (out.get(k) ?? 0) + (l.side === '차변' ? l.amount : -l.amount));
  }
  return out;
}

export function budgetRows(d: DB, year: string): BudgetRow[] {
  const spent = postedSpend(d, year);
  const pending = pendingSpend(d);
  return d.budgets
    .filter((b) => b.year === year)
    .map((b) => ({ dept: b.dept, accountCode: b.accountCode, budget: b.amount, spent: spent.get(key(b.dept, b.accountCode)) ?? 0, pending: pending.get(key(b.dept, b.accountCode)) ?? 0 }));
}

/** 이 문서가 예산을 넘는지 — 계정별로 예산 · 기집행 · 진행 중 · 이 문서 · 잔액 */
export function checkBudget(d: DB, year: string, dept: string, entries: Array<{ accountCode: string; amount: number }>, excludeId?: string) {
  const spent = postedSpend(d, year);
  const pending = pendingSpend(d, excludeId);
  const mine = new Map<string, number>();
  entries.forEach((e) => e.accountCode && mine.set(e.accountCode, (mine.get(e.accountCode) ?? 0) + e.amount));
  return [...mine.entries()].map(([acct, amount]) => {
    const budget = d.budgets.find((b) => b.year === year && b.dept === dept && b.accountCode === acct)?.amount;
    const used = (spent.get(key(dept, acct)) ?? 0) + (pending.get(key(dept, acct)) ?? 0);
    return { accountCode: acct, budget, used, amount, remaining: budget === undefined ? undefined : budget - used - amount };
  });
}

export { usageAccount };

// 화면과 어시스턴트가 함께 쓰는 쓰기 동작 — 값 검사 후 저장한다
import type { DB, PayMethod } from '../types';
import { nextDocNo } from '../data/store';
import { today, uid } from './format';

export interface ManualExpense {
  date: string;
  merchant: string;
  payMethod: PayMethod;
  amount: number;
  usageCode: string;
  memo: string;
}

/** 이번 달 경비청구서에 현금 · 개인카드 지출 한 건을 넣는다. 문제가 있으면 이유를 돌려준다 */
export function checkManualExpense(d: DB, empId: string, e: ManualExpense): string | null {
  const ym = today().slice(0, 7);
  if (!e.merchant.trim() || e.amount <= 0 || !e.usageCode) return '사용처 · 금액 · 용도가 필요합니다.';
  if (e.date.slice(0, 7) !== ym) return '이번 달 사용분만 바로 넣을 수 있습니다. 지난달 것은 경비청구작성 화면에서 넣어 주세요.';
  const claim = d.claims.find((c) => c.empId === empId && c.period === ym);
  if (claim && claim.status !== '작성중' && claim.status !== '반려') return `이번 달 청구서는 이미 ${claim.status} 상태라 더 넣을 수 없습니다.`;
  return null;
}

export function addManualExpense(d: DB, empId: string, e: ManualExpense) {
  const ym = today().slice(0, 7);
  let c = d.claims.find((x) => x.empId === empId && x.period === ym);
  if (!c) {
    c = { id: `cl-${uid()}`, docNo: nextDocNo(d, 'EXP'), empId, period: ym, items: [], status: '작성중' };
    d.claims.push(c);
  }
  c.items.push({ id: `ci-${uid()}`, usedAt: `${e.date} 12:00`, merchant: e.merchant.trim(), payMethod: e.payMethod, amount: e.amount, usageCode: e.usageCode, memo: e.memo.trim() });
  c.items.sort((a, b) => a.usedAt.localeCompare(b.usedAt));
  return c.id;
}

/** 품의서를 작성중으로 만든다. 상신은 결재선을 고른 뒤 따로 한다 */
export function createProposal(d: DB, empId: string, p: { title: string; amount: number; body: string }) {
  const id = `p-${uid()}`;
  d.proposals.push({ id, docNo: nextDocNo(d, 'PRO'), title: p.title.trim(), amount: p.amount, body: p.body, draftDate: today(), empId, status: '작성중' });
  return id;
}

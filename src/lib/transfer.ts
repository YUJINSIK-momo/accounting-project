// 지급 · 이체 — 지급 대기 모으기, 이체 묶음(파일) 만들기, 은행 결과 반영
import type { DB, TransferBatch, TransferColumn, TransferItem } from '../types';
import { addVoucher, nextSeq } from '../data/store';
import { paymentJournal } from './journal';
import { notify } from './approval';
import { netPay } from './payroll';
import { bankCode, digits } from './banks';
export { DEFAULT_COLUMNS } from './banks';
import { nowStamp, sum, uid } from './format';

export interface Payable {
  key: string;
  refKind: TransferItem['refKind'];
  docNo: string;
  title: string;
  empId?: string;
  payee: string;
  bank: string;
  accountNo: string;
  holder: string;
  amount: number;
  dueDate: string;
  /** 지난 이체에서 실패한 사유 */
  lastFail?: string;
  /** 계좌 정보가 빠졌으면 이유 — 파일에 넣을 수 없다 */
  problem?: string;
}


const personalTotal = (d: DB, claimId: string) => sum(d.claims.find((c) => c.id === claimId)?.items.filter((i) => i.payMethod !== '법인카드') ?? [], (i) => i.amount);

/** 결과를 기다리는 묶음에 든 대상 — 다시 고를 수 없다 */
export function lockedKeys(d: DB) {
  return new Set(d.transferBatches.filter((b) => b.status === '결과 대기').flatMap((b) => b.items.map((i) => i.key)));
}

export function payables(d: DB): Payable[] {
  const locked = lockedKeys(d);
  const lastFail = (key: string) =>
    [...d.transferBatches]
      .reverse()
      .flatMap((b) => b.items)
      .find((i) => i.key === key && i.status === '실패')?.reason;
  const check = (bank: string, accountNo: string, holder: string) => (!bank || !digits(accountNo) ? '계좌 정보 없음' : !holder ? '예금주 없음' : !bankCode(bank) ? '은행코드를 모름' : undefined);
  const out: Payable[] = [];

  for (const x of d.disbursements) {
    if (x.status !== '결재완료' || !x.voucherId || x.paidVoucherId) continue;
    const amount = sum(x.lines, (l) => l.supply + l.vat);
    out.push({ key: `D:${x.id}`, refKind: '지출결의', docNo: x.docNo, title: x.title, payee: x.holder, bank: x.bank, accountNo: x.accountNo, holder: x.holder, amount, dueDate: x.payDate || x.acctDate, problem: check(x.bank, x.accountNo, x.holder) });
  }
  for (const c of d.claims) {
    if (c.status !== '결재완료' || !c.voucherId || c.reimbursedVoucherId) continue;
    const amount = personalTotal(d, c.id);
    if (!amount) continue;
    const e = d.employees.find((x) => x.id === c.empId)!;
    const [y, m] = c.period.split('-').map(Number);
    const due = new Date(y, m, 25);
    out.push({ key: `C:${c.id}`, refKind: '경비', docNo: c.docNo, title: `${c.period} 개인 경비`, empId: e.id, payee: e.name, bank: e.bank, accountNo: e.accountNo, holder: e.name, amount, dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-25`, problem: check(e.bank, e.accountNo, e.name) });
  }
  for (const r of d.payrolls) {
    if (r.status !== '확정') continue;
    for (const l of r.lines) {
      if (r.paidEmpIds?.includes(l.empId)) continue;
      const e = d.employees.find((x) => x.id === l.empId)!;
      out.push({ key: `P:${r.id}:${e.id}`, refKind: '급여', docNo: `${r.ym} 급여`, title: `${r.ym} 급여 · ${e.dept}`, empId: e.id, payee: e.name, bank: e.bank, accountNo: e.accountNo, holder: e.name, amount: netPay(l), dueDate: r.payDate, problem: check(e.bank, e.accountNo, e.name) });
    }
  }
  return out.filter((p) => !locked.has(p.key)).map((p) => ({ ...p, lastFail: lastFail(p.key) }));
}

/** 고른 대상으로 이체 묶음을 만든다 */
export function createBatch(d: DB, picked: Payable[], scheduledDate: string, fromAccountId: string, myMemoOf: (p: Payable) => string): TransferBatch {
  const n = nextSeq(d, `TR${scheduledDate}`);
  const batch: TransferBatch = {
    id: `tb-${uid()}`,
    no: `TR-${scheduledDate.replaceAll('-', '')}-${String(n).padStart(2, '0')}`,
    createdAt: nowStamp(),
    by: d.currentEmpId,
    scheduledDate,
    fromAccountId,
    status: '결과 대기',
    items: picked.map((p) => ({
      id: `ti-${uid()}`,
      key: p.key,
      refKind: p.refKind,
      docNo: p.docNo,
      empId: p.empId,
      payee: p.payee,
      bank: p.bank,
      accountNo: p.accountNo,
      holder: p.holder,
      amount: p.amount,
      payeeMemo: d.company.replace(/\(주\)|주식회사/g, '').trim().slice(0, 7),
      myMemo: myMemoOf(p).slice(0, 7),
      status: '예약',
    })),
  };
  d.transferBatches.push(batch);
  return batch;
}

/** 은행에 올릴 표 — 이체 양식 설정의 열 순서 · 이름을 따른다 */
export function batchRows(d: DB, batch: TransferBatch): Array<Array<string | number>> {
  const cols = d.transferColumns.filter((c) => c.include);
  const value = (i: TransferItem, idx: number, key: TransferColumn['key']): string | number => {
    switch (key) {
      case 'seq':
        return idx + 1;
      case 'bankCode':
        return bankCode(i.bank);
      case 'bankName':
        return i.bank;
      case 'accountNo':
        return digits(i.accountNo);
      case 'holder':
        return i.holder;
      case 'amount':
        return i.amount;
      case 'payeeMemo':
        return i.payeeMemo;
      case 'myMemo':
        return i.myMemo;
      case 'scheduledDate':
        return batch.scheduledDate.replaceAll('-', '');
      case 'docNo':
        return i.docNo;
    }
  };
  return [cols.map((c) => c.header), ...batch.items.map((i, idx) => cols.map((c) => value(i, idx, c.key)))];
}

export interface ResultRow {
  accountNo: string;
  amount: number;
  ok: boolean;
  reason?: string;
}

/** 은행 결과 표에서 계좌 · 금액 · 결과 · 사유 열을 머리글로 찾는다 */
export function parseResultRows(rows: Array<Array<string | number>>): { results: ResultRow[]; error?: string } {
  const headIdx = rows.findIndex((r) => r.some((c) => /계좌/.test(String(c))) && r.some((c) => /금액/.test(String(c))));
  if (headIdx < 0) return { results: [], error: '머리글에서 「계좌」 · 「금액」 열을 찾지 못했습니다.' };
  const head = rows[headIdx].map(String);
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const [ca, cm, cs, cr] = [col(/계좌/), col(/금액/), col(/결과|상태|처리/), col(/사유|오류|불능|메시지/)];
  if (cs < 0) return { results: [], error: '머리글에서 「처리결과」(또는 결과 · 상태) 열을 찾지 못했습니다.' };
  const results = rows
    .slice(headIdx + 1)
    .filter((r) => digits(String(r[ca] ?? '')))
    .map((r) => {
      const status = String(r[cs] ?? '');
      const ok = /정상|성공|완료|OK/i.test(status) && !/불능|실패|오류|에러/.test(status);
      return { accountNo: digits(String(r[ca])), amount: Number(String(r[cm]).replace(/[^\d-]/g, '')) || 0, ok, reason: ok ? undefined : String(r[cr] ?? status) || '처리 실패' };
    });
  return { results };
}

/** 결과를 묶음에 맞춘다 — 계좌번호와 금액이 같은 줄끼리 짝짓는다 */
export function matchResults(batch: TransferBatch, results: ResultRow[]) {
  const pool = [...results];
  const map = new Map<string, ResultRow>();
  for (const i of batch.items) {
    const k = pool.findIndex((r) => r.accountNo === digits(i.accountNo) && r.amount === i.amount);
    if (k >= 0) map.set(i.id, pool.splice(k, 1)[0]);
  }
  return { map, unmatched: pool };
}

/** 결과 반영 — 성공은 지급 처리 · 전표 · 입금 알림, 실패는 사유를 남기고 지급 대기로 돌린다 */
export function applyResults(d: DB, batchId: string, outcome: Record<string, { ok: boolean; reason?: string }>) {
  const b = d.transferBatches.find((x) => x.id === batchId);
  if (!b || b.status !== '결과 대기') return;
  for (const item of b.items) {
    const o = outcome[item.id];
    if (!o) continue;
    item.status = o.ok ? '완료' : '실패';
    item.reason = o.ok ? undefined : o.reason || '처리 실패';
    if (!o.ok) continue;
    const [kind, id, empId] = item.key.split(':');
    if (kind === 'D') {
      const x = d.disbursements.find((y) => y.id === id);
      if (x && !x.paidVoucherId) x.paidVoucherId = addVoucher(d, { date: b.scheduledDate, kind: '지급', sourceId: x.id, memo: `${x.title} 이체 (${b.no})`, lines: paymentJournal(d, x), status: '발행' });
    } else if (kind === 'C') {
      const c = d.claims.find((y) => y.id === id);
      if (c && !c.reimbursedVoucherId) {
        c.reimbursedVoucherId = addVoucher(d, {
          date: b.scheduledDate,
          kind: '지급',
          sourceId: c.id,
          memo: `${c.period} 개인 경비 이체 (${b.no})`,
          lines: [
            { side: '차변', accountCode: '262', amount: item.amount, vendor: item.payee, memo: `${c.period} 개인 경비` },
            { side: '대변', accountCode: '103', amount: item.amount, vendor: item.payee, memo: `${c.period} 개인 경비 이체` },
          ],
          status: '발행',
        });
        notify(d, c.empId, '입금', `경비 ${item.amount.toLocaleString('ko-KR')}원이 입금됩니다`, `${c.docNo} · ${b.scheduledDate} 이체 · ${item.bank} ${item.accountNo}`, '/claims');
      }
    } else if (kind === 'P') {
      // 급여는 급여 전표에서 이미 보통예금 지급으로 잡혀 있다 — 이체 완료만 표시한다
      const r = d.payrolls.find((y) => y.id === id);
      if (r && !r.paidEmpIds?.includes(empId)) {
        r.paidEmpIds = [...(r.paidEmpIds ?? []), empId];
        notify(d, empId, '입금', `${r.ym} 급여가 입금됩니다`, `${b.scheduledDate} 이체 · ${item.amount.toLocaleString('ko-KR')}원`, '/payslips');
      }
    }
  }
  if (b.items.every((i) => i.status !== '예약')) {
    b.status = '반영 완료';
    b.resultAt = nowStamp();
  }
}

/** 결과 전에 묶음을 취소하면 대상이 다시 지급 대기로 돌아간다 */
export function cancelBatch(d: DB, batchId: string) {
  const b = d.transferBatches.find((x) => x.id === batchId);
  if (b && b.status === '결과 대기' && b.items.every((i) => i.status === '예약')) b.status = '취소';
}

/** 데모용 은행 결과 표 — 마지막 한 건은 계좌 오류로 돌려준다(두 건 이상일 때) */
export function demoResultRows(batch: TransferBatch): Array<Array<string | number>> {
  return [
    ['입금은행', '입금계좌번호', '예금주', '이체금액', '처리결과', '불능사유'],
    ...batch.items.map((i, idx) => {
      const fail = batch.items.length > 1 && idx === batch.items.length - 1;
      return [i.bank, digits(i.accountNo), i.holder, i.amount, fail ? '불능' : '정상', fail ? '계좌번호 오류' : ''];
    }),
  ];
}

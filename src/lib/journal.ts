import type { Claim, ClaimItem, DB, Disbursement, DisbLine, VoucherLine } from '../types';
import { sum } from './format';

export const ACCT = {
  BANK: '103',
  VAT_IN: '135',
  PAYABLE: '253',
  ACCRUED: '262',
} as const;

const usageAccount = (d: DB, usageCode: string) =>
  d.usages.find((u) => u.code === usageCode)?.accountCode ?? '830';

/** 경비청구 → 전표. 비용은 용도별 계정으로, 상대계정은 결제수단에 따라 나눈다. */
export function claimJournal(d: DB, claim: Claim): VoucherLine[] {
  const emp = d.employees.find((e) => e.id === claim.empId);
  const lines: VoucherLine[] = claim.items.map((it) => ({
    side: '차변',
    accountCode: usageAccount(d, it.usageCode),
    amount: it.amount,
    vendor: it.merchant,
    memo: it.memo,
  }));
  const corp = sum(claim.items.filter((i) => i.payMethod === '법인카드'), (i) => i.amount);
  const personal = sum(claim.items.filter((i) => i.payMethod !== '법인카드'), (i) => i.amount);
  if (corp) lines.push({ side: '대변', accountCode: ACCT.PAYABLE, amount: corp, vendor: '법인카드 결제대금', memo: `${claim.period} 법인카드 사용분` });
  if (personal) lines.push({ side: '대변', accountCode: ACCT.ACCRUED, amount: personal, vendor: emp?.name ?? '', memo: `${claim.period} 개인 지출 청구` });
  return lines;
}

/** 지출결의 → 전표. 세금계산서는 부가세를 부가세대급금으로 따로 잡는다. */
export function disbJournal(d: DB, disb: Disbursement): VoucherLine[] {
  const vendorName = (id: string) => d.vendors.find((v) => v.id === id)?.name ?? '';
  const debit: VoucherLine[] = [];
  for (const l of disb.lines) {
    const deductible = l.evidence === '세금계산서' && l.vat > 0;
    debit.push({
      side: '차변',
      accountCode: usageAccount(d, l.usageCode),
      amount: deductible ? l.supply : l.supply + l.vat,
      vendor: vendorName(l.vendorId),
      memo: l.memo,
    });
    if (deductible) {
      debit.push({ side: '차변', accountCode: ACCT.VAT_IN, amount: l.vat, vendor: vendorName(l.vendorId), memo: `${l.memo} 부가세` });
    }
  }
  const credit: VoucherLine[] =
    disb.splitMode === '지출내역별'
      ? disb.lines.map((l) => ({ side: '대변', accountCode: ACCT.PAYABLE, amount: l.supply + l.vat, vendor: vendorName(l.vendorId), memo: l.memo }))
      : [{ side: '대변', accountCode: ACCT.PAYABLE, amount: sum(disb.lines, (l) => l.supply + l.vat), vendor: vendorName(disb.lines[0]?.vendorId ?? ''), memo: disb.title }];
  return [...debit, ...credit];
}

/** 지급: 미지급금을 보통예금으로 지운다. */
export function paymentJournal(d: DB, disb: Disbursement): VoucherLine[] {
  const total = sum(disb.lines, (l) => l.supply + l.vat);
  const vendor = d.vendors.find((v) => v.id === disb.lines[0]?.vendorId)?.name ?? disb.holder;
  return [
    { side: '차변', accountCode: ACCT.PAYABLE, amount: total, vendor, memo: `${disb.title} 지급` },
    { side: '대변', accountCode: ACCT.BANK, amount: total, vendor: `${disb.bank} ${disb.accountNo}`, memo: `${disb.title} 지급` },
  ];
}

export function balance(lines: VoucherLine[]) {
  const debit = sum(lines.filter((l) => l.side === '차변'), (l) => l.amount);
  const credit = sum(lines.filter((l) => l.side === '대변'), (l) => l.amount);
  return { debit, credit, diff: debit - credit };
}

export type Check = { level: '적합' | '확인필요' | '부적합'; reasons: string[] };

const isLateNight = (usedAt: string) => {
  const h = Number(usedAt.slice(11, 13));
  return h >= 23 || h < 6;
};
const isWeekend = (usedAt: string) => {
  const day = new Date(usedAt.slice(0, 10)).getDay();
  return day === 0 || day === 6;
};

export function checkClaimItem(item: ClaimItem, siblings: ClaimItem[]): Check {
  const bad: string[] = [];
  if (!item.usageCode) bad.push('용도 없음');
  if (!item.memo.trim()) bad.push('내용 없음');
  if (item.amount <= 0) bad.push('금액 0원');
  if (bad.length) return { level: '부적합', reasons: bad };
  const warn: string[] = [];
  if (isLateNight(item.usedAt)) warn.push('제한시간(23~06시) 사용');
  if (isWeekend(item.usedAt)) warn.push('주말 사용');
  const dup = siblings.some((s) => s.id !== item.id && s.merchant === item.merchant && s.usedAt.slice(0, 10) === item.usedAt.slice(0, 10));
  if (dup) warn.push('같은 날 동일 가맹점');
  return warn.length ? { level: '확인필요', reasons: warn } : { level: '적합', reasons: [] };
}

export function checkDisbLine(line: DisbLine): Check {
  const bad: string[] = [];
  if (!line.usageCode) bad.push('용도 없음');
  if (!line.vendorId) bad.push('거래처 없음');
  if (line.supply <= 0) bad.push('공급가액 0원');
  if ((line.evidence === '세금계산서' || line.evidence === '계산서') && !line.evidenceNo.trim()) bad.push('승인번호 없음');
  if (line.evidence === '계산서' && line.vat > 0) bad.push('계산서(면세)에 부가세');
  if (bad.length) return { level: '부적합', reasons: bad };
  if (line.evidence === '세금계산서' && Math.abs(line.vat - Math.round(line.supply * 0.1)) > 1) {
    return { level: '확인필요', reasons: ['부가세가 공급가액의 10%와 다름'] };
  }
  return { level: '적합', reasons: [] };
}

export function worst(checks: Check[]): Check['level'] {
  if (checks.some((c) => c.level === '부적합')) return '부적합';
  if (checks.some((c) => c.level === '확인필요')) return '확인필요';
  return '적합';
}

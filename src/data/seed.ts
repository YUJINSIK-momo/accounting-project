import type { Approval, Card, CardTxn, Claim, ClaimItem, DB, Disbursement, Employee, PayrollRun, Proposal, TaxInvoice, Usage, Vendor, VoucherLine } from '../types';
import { claimJournal, disbJournal, paymentJournal } from '../lib/journal';
import { CEO, FINANCE_LEAD, defaultLine, notify } from '../lib/approval';
import { DEFAULT_RATES, calcLine, deductionTotal, grossPay, netPay } from '../lib/payroll';

// 모든 값은 가상의 예시다. 실제 회사 · 사람 · 사업자번호가 아니다.
export const DB_VERSION = 2;

const accounts: DB['accounts'] = [
  { code: '103', name: '보통예금', type: '자산' },
  { code: '135', name: '부가세대급금', type: '자산' },
  { code: '253', name: '미지급금', type: '부채' },
  { code: '254', name: '예수금', type: '부채' },
  { code: '262', name: '미지급비용', type: '부채' },
  { code: '801', name: '급여', type: '비용' },
  { code: '811', name: '복리후생비', type: '비용' },
  { code: '812', name: '여비교통비', type: '비용' },
  { code: '813', name: '접대비', type: '비용' },
  { code: '814', name: '통신비', type: '비용' },
  { code: '821', name: '보험료', type: '비용' },
  { code: '822', name: '차량유지비', type: '비용' },
  { code: '826', name: '도서인쇄비', type: '비용' },
  { code: '830', name: '소모품비', type: '비용' },
  { code: '831', name: '지급수수료', type: '비용' },
  { code: '833', name: '광고선전비', type: '비용' },
];

const usages: Usage[] = [
  { code: '100', name: '소모품비', accountCode: '830' },
  { code: '110', name: '도서인쇄비', accountCode: '826' },
  { code: '190', name: '주차비', accountCode: '822' },
  { code: '200', name: '주유비', accountCode: '822' },
  { code: '210', name: '수수료', accountCode: '831' },
  { code: '260', name: '보험료', accountCode: '821' },
  { code: '270', name: '통신비', accountCode: '814' },
  { code: '300', name: '야근식대', accountCode: '811' },
  { code: '310', name: '회식비', accountCode: '811' },
  { code: '320', name: '교통비', accountCode: '812' },
  { code: '330', name: '출장숙박비', accountCode: '812' },
  { code: '340', name: '접대비', accountCode: '813' },
  { code: '350', name: '광고비', accountCode: '833' },
];

const vendors: Vendor[] = [
  { id: 'v1', name: '오피스몰', bizNo: '101-11-00001' },
  { id: 'v2', name: '온라인광고센터', bizNo: '101-11-00002' },
  { id: 'v3', name: '클라우드호스팅', bizNo: '101-11-00003' },
  { id: 'v4', name: '러닝랩 교육', bizNo: '101-11-00004' },
  { id: 'v5', name: '그린인쇄', bizNo: '101-11-00005' },
];

// 메일 주소는 예시용 도메인(example.com)만 쓴다
const employees: Employee[] = [
  { id: 'e1', name: '김하늘', dept: '경영지원팀', rank: '팀장', bank: '가상은행', accountNo: '000-0001-0001', email: 'haneul@example.com', joinDate: '2019-03-04', baseSalary: 5200000, dependents: 3 },
  { id: 'e2', name: '이도윤', dept: '개발팀', rank: '매니저', bank: '가상은행', accountNo: '000-0001-0002', email: 'doyun@example.com', joinDate: '2021-07-01', baseSalary: 4300000, dependents: 2 },
  { id: 'e3', name: '박서연', dept: '개발팀', rank: '사원', bank: '예시은행', accountNo: '000-0001-0003', email: 'seoyeon@example.com', joinDate: '2025-01-02', baseSalary: 3100000, dependents: 1 },
  { id: 'e4', name: '최민준', dept: '영업팀', rank: '과장', bank: '예시은행', accountNo: '000-0001-0004', email: 'minjun@example.com', joinDate: '2020-09-14', baseSalary: 4600000, dependents: 4 },
  { id: 'e5', name: '정유나', dept: '마케팅팀', rank: '대리', bank: '가상은행', accountNo: '000-0001-0005', email: 'yuna@example.com', joinDate: '2022-04-11', baseSalary: 3700000, dependents: 1 },
  { id: 'e6', name: '한지호', dept: '영업팀', rank: '사원', bank: '예시은행', accountNo: '000-0001-0006', email: 'jiho@example.com', joinDate: '2024-08-19', baseSalary: 3000000, dependents: 1 },
  { id: 'e7', name: '윤서준', dept: '경영진', rank: '대표이사', bank: '가상은행', accountNo: '000-0001-0007', email: 'seojun@example.com', joinDate: '2018-01-02', baseSalary: 8000000, dependents: 3 },
];

const cards: Card[] = [
  { id: 'c1', name: '법인카드 A', last4: '1001', ownerId: 'e2', kind: '법인카드' },
  { id: 'c2', name: '법인카드 B', last4: '1002', ownerId: 'e4', kind: '법인카드' },
  { id: 'c3', name: '법인카드 C', last4: '1003', ownerId: 'e5', kind: '법인카드' },
  { id: 'c4', name: '개인카드', last4: '2001', ownerId: 'e3', kind: '개인카드' },
  { id: 'c5', name: '개인카드', last4: '2002', ownerId: 'e6', kind: '개인카드' },
];

// 가맹점 → 기본 용도. 시드가 금액 범위와 내용 문구도 함께 고른다.
const merchants: Array<{ name: string; usage: string; min: number; max: number; memo: string; hour: [number, number] }> = [
  { name: '역삼 커피랩', usage: '340', min: 12000, max: 48000, memo: '고객 미팅 음료', hour: [10, 17] },
  { name: '문구나라', usage: '100', min: 8000, max: 95000, memo: '사무용품 구매', hour: [9, 18] },
  { name: '책방 북스', usage: '110', min: 15000, max: 68000, memo: '업무 도서 구입', hour: [11, 20] },
  { name: '선릉 주유소', usage: '200', min: 40000, max: 92000, memo: '업무 차량 주유', hour: [7, 21] },
  { name: '타워 주차장', usage: '190', min: 3000, max: 24000, memo: '외근 주차', hour: [9, 19] },
  { name: '시티 택시', usage: '320', min: 6800, max: 38000, memo: '외근 이동', hour: [8, 23] },
  { name: '한그릇 식당', usage: '300', min: 9000, max: 36000, memo: '야근 식대', hour: [19, 22] },
  { name: '고기마을', usage: '310', min: 180000, max: 620000, memo: '팀 회식', hour: [18, 22] },
  { name: '데이터 통신', usage: '270', min: 33000, max: 88000, memo: '업무폰 요금', hour: [9, 10] },
  { name: '클라우드 결제', usage: '210', min: 25000, max: 210000, memo: '개발 도구 구독', hour: [0, 23] },
  { name: '바다 호텔', usage: '330', min: 98000, max: 189000, memo: '지방 출장 숙박', hour: [15, 23] },
  { name: '한우 명가', usage: '340', min: 160000, max: 480000, memo: '거래처 접대', hour: [18, 22] },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function makeTxns(): CardTxn[] {
  const r = rng(20261020);
  const txns: CardTxn[] = [];
  const months: Array<{ ym: string; days: number }> = [
    { ym: '2026-08', days: 31 },
    { ym: '2026-09', days: 30 },
    { ym: '2026-10', days: 19 },
  ];
  let n = 0;
  for (const card of cards) {
    for (const { ym, days } of months) {
      const count = 7 + Math.floor(r() * 6);
      for (let i = 0; i < count; i++) {
        const m = merchants[Math.floor(r() * merchants.length)];
        const day = 1 + Math.floor(r() * days);
        const hour = m.hour[0] + Math.floor(r() * (m.hour[1] - m.hour[0] + 1));
        const amount = Math.round((m.min + r() * (m.max - m.min)) / 100) * 100;
        txns.push({
          id: `t${++n}`,
          cardId: card.id,
          usedAt: `${ym}-${pad(day)} ${pad(hour)}:${pad(Math.floor(r() * 60))}`,
          merchant: m.name,
          bizNo: `220-81-${String(10000 + merchants.indexOf(m)).slice(1)}`,
          amount,
          blocked: false,
        });
      }
    }
  }
  // 점검 화면에서 보이도록 일부러 넣은 사례: 심야 사용, 같은 날 같은 가맹점
  txns.push({ id: `t${++n}`, cardId: 'c1', usedAt: '2026-10-07 23:48', merchant: '시티 택시', bizNo: '220-81-0005', amount: 41200, blocked: false });
  txns.push({ id: `t${++n}`, cardId: 'c1', usedAt: '2026-10-14 12:10', merchant: '역삼 커피랩', bizNo: '220-81-0000', amount: 23500, blocked: false });
  txns.push({ id: `t${++n}`, cardId: 'c1', usedAt: '2026-10-14 15:40', merchant: '역삼 커피랩', bizNo: '220-81-0000', amount: 18900, blocked: false });
  return txns.sort((a, b) => a.usedAt.localeCompare(b.usedAt));
}

export const merchantUsage = (merchant: string) => merchants.find((m) => m.name === merchant);

/** 결재선 시드: done 은 승인된 발신 단계 수('all' 이면 전부), received 는 수신까지 끝났는지 */
function approval(drafter: string, line: string[], receivers: string[], done: number | 'all', submittedAt: string, decidedAt: string, received: boolean): Approval {
  const n = done === 'all' ? line.length : done;
  const a: Approval = {
    line: line.map((empId, i) => (i < n ? { empId, decision: '승인', decidedAt } : { empId })),
    receivers: receivers.map((empId) => (n === line.length && received ? { empId, decision: '승인', decidedAt } : { empId })),
    refs: [],
    history: [{ at: submittedAt, empId: drafter, action: '상신' }],
  };
  a.line.slice(0, n).forEach((s) => a.history.push({ at: decidedAt, empId: s.empId, action: '승인' }));
  a.receivers.filter((r) => r.decision).forEach((r) => a.history.push({ at: decidedAt, empId: r.empId, action: '수신' }));
  return a;
}

export function seed(): DB {
  const db: DB = {
    version: DB_VERSION,
    company: '데모상사(주)',
    currentEmpId: 'e2',
    accounts,
    usages,
    vendors,
    employees,
    cards,
    cardTxns: makeTxns(),
    claims: [],
    proposals: [],
    disbursements: [],
    vouchers: [],
    payrolls: [],
    taxInvoices: [],
    rates: { ...DEFAULT_RATES },
    notifications: [],
    seq: {},
  };

  const next = (key: string) => (db.seq[key] = (db.seq[key] ?? 0) + 1);
  const docNo = (prefix: string) => `${prefix}-2026-${String(next(prefix)).padStart(4, '0')}`;
  const voucherNo = (date: string) => `${date.replaceAll('-', '')}-${String(next(`V${date}`)).padStart(4, '0')}`;

  const issue = (kind: '경비' | '지출결의' | '지급' | '급여', sourceId: string, date: string, memo: string, lines: VoucherLine[]) => {
    const id = `vc${db.vouchers.length + 1}`;
    db.vouchers.push({ id, no: voucherNo(date), date, kind, sourceId, memo, lines, status: '발행' });
    return id;
  };

  // 8 · 9월 카드 사용분은 청구 → 결재 → 전표까지 끝난 상태로 둔다. 10월은 진행 중.
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    for (const card of cards) {
      const txns = db.cardTxns.filter((t) => t.cardId === card.id && t.usedAt.startsWith(ym));
      if (ym === '2026-10' && card.ownerId === 'e2') continue; // 현재 사용자의 10월분은 직접 청구해 보도록 남긴다
      const items: ClaimItem[] = txns.map((t, i) => {
        const m = merchantUsage(t.merchant);
        const itemId = `${card.id}-${ym}-${i}`;
        t.claimItemId = itemId;
        return {
          id: itemId,
          usedAt: t.usedAt,
          merchant: t.merchant,
          payMethod: card.kind,
          amount: t.amount,
          usageCode: m?.usage ?? '100',
          memo: m?.memo ?? '',
          txnId: t.id,
        };
      });
      // 10월: 최민준(c2)은 경영지원팀장 결재 대기, 정유나(c3)는 종결 후 수신 대기, 박서연(c4)은 현재 사용자(이도윤) 결재 대기
      const status: Claim['status'] = ym === '2026-10' ? (card.id === 'c2' || card.id === 'c4' ? '결재중' : card.id === 'c3' ? '결재완료' : '작성중') : '결재완료';
      const claim: Claim = {
        id: `cl-${card.id}-${ym}`,
        docNo: docNo('EXP'),
        empId: card.ownerId,
        period: ym,
        items,
        status,
        // 진행 중인 10월분은 오늘 이전 날짜로 둔다
        submittedAt: status === '작성중' ? undefined : ym === '2026-10' ? '2026-10-16 10:00' : `${ym}-25 10:00`,
        decidedAt: status === '결재완료' ? (ym === '2026-10' ? '2026-10-17 15:00' : `${ym}-26 15:00`) : undefined,
      };
      if (status !== '작성중') {
        const submitted = claim.submittedAt!;
        const decided = claim.decidedAt ?? '2026-10-17 15:00';
        claim.approval = approval(card.ownerId, defaultLine(db, card.ownerId), [FINANCE_LEAD], status === '결재완료' ? 'all' : 0, submitted, decided, ym !== '2026-10');
      }
      if (ym !== '2026-10') {
        const date = `${ym}-28`;
        claim.voucherId = issue('경비', claim.id, date, `${ym} 경비청구 (${employees.find((e) => e.id === claim.empId)?.name})`, claimJournal(db, claim));
      }
      db.claims.push(claim);
    }
  }

  const proposals: Proposal[] = [
    { id: 'p1', docNo: docNo('PRO'), title: '개발팀 모니터 구매 품의', amount: 1980000, draftDate: '2026-09-03', empId: 'e2', body: '신규 입사자 2명 업무용 27인치 모니터 4대', status: '결재완료', submittedAt: '2026-09-03 09:30', decidedAt: '2026-09-04 11:00' },
    { id: 'p2', docNo: docNo('PRO'), title: '10월 온라인 광고 집행 품의', amount: 5000000, draftDate: '2026-09-25', empId: 'e5', body: '검색 광고 10월분 집행', status: '결재완료', submittedAt: '2026-09-25 14:00', decidedAt: '2026-09-26 10:20' },
    { id: 'p3', docNo: docNo('PRO'), title: '사내 교육 외부 강사 섭외', amount: 1200000, draftDate: '2026-10-15', empId: 'e1', body: '11월 정보보호 교육 2시간', status: '결재중', submittedAt: '2026-10-15 16:10' },
  ];
  proposals[0].approval = approval('e2', defaultLine(db, 'e2'), [], 'all', '2026-09-03 09:30', '2026-09-04 11:00', true);
  proposals[1].approval = approval('e5', defaultLine(db, 'e5'), [], 'all', '2026-09-25 14:00', '2026-09-26 10:20', true);
  proposals[2].approval = approval('e1', defaultLine(db, 'e1'), [], 0, '2026-10-15 16:10', '', false);
  db.proposals = proposals;

  const pay = (empId: string) => {
    const e = employees.find((x) => x.id === empId)!;
    return { empId, dept: e.dept, bank: e.bank, accountNo: e.accountNo, holder: e.name };
  };
  const disbursements: Disbursement[] = [
    {
      id: 'd1', docNo: docNo('DIS'), title: '개발팀 모니터 구매', acctDate: '2026-09-10', proposalId: 'p1', project: '사내 운영', splitMode: '지출결의별',
      lines: [{ id: 'd1l1', usageCode: '100', memo: '27인치 모니터 4대', vendorId: 'v1', supply: 1800000, vat: 180000, evidence: '세금계산서', evidenceNo: '20260910-41000001-00000001' }],
      evidenceDate: '2026-09-10', payDate: '2026-09-30', ...pay('e2'), bank: '가상은행', accountNo: '000-9000-0001', holder: '오피스몰',
      status: '결재완료', submittedAt: '2026-09-10 10:00', decidedAt: '2026-09-11 09:00',
    },
    {
      id: 'd2', docNo: docNo('DIS'), title: '10월 검색 광고비', acctDate: '2026-10-05', proposalId: 'p2', project: '마케팅', splitMode: '지출결의별',
      lines: [{ id: 'd2l1', usageCode: '350', memo: '검색 광고 10월분', vendorId: 'v2', supply: 4545455, vat: 454545, evidence: '세금계산서', evidenceNo: '20261005-41000001-00000002' }],
      evidenceDate: '2026-10-05', payDate: '2026-10-31', ...pay('e5'), bank: '가상은행', accountNo: '000-9000-0002', holder: '온라인광고센터',
      status: '결재완료', submittedAt: '2026-10-05 11:00', decidedAt: '2026-10-06 10:00',
    },
    {
      id: 'd3', docNo: docNo('DIS'), title: '서버 호스팅 10월분', acctDate: '2026-10-16', project: '서비스 운영', splitMode: '지출내역별',
      lines: [
        { id: 'd3l1', usageCode: '210', memo: '클라우드 서버', vendorId: 'v3', supply: 820000, vat: 82000, evidence: '세금계산서', evidenceNo: '20261016-41000001-00000003' },
        { id: 'd3l2', usageCode: '110', memo: '교육 교재 인쇄', vendorId: 'v5', supply: 150000, vat: 0, evidence: '계산서', evidenceNo: '20261016-41000001-00000004' },
      ],
      evidenceDate: '2026-10-16', payDate: '2026-10-31', ...pay('e2'), bank: '예시은행', accountNo: '000-9000-0003', holder: '클라우드호스팅',
      status: '결재중', submittedAt: '2026-10-16 17:00',
    },
  ];
  disbursements[0].approval = approval('e2', defaultLine(db, 'e2'), [FINANCE_LEAD], 'all', '2026-09-10 10:00', '2026-09-11 09:00', true);
  disbursements[1].approval = approval('e5', defaultLine(db, 'e5'), [FINANCE_LEAD], 'all', '2026-10-05 11:00', '2026-10-06 10:00', true);
  disbursements[2].approval = approval('e2', defaultLine(db, 'e2'), [FINANCE_LEAD], 0, '2026-10-16 17:00', '', false);
  db.disbursements = disbursements;
  const d1 = disbursements[0];
  d1.voucherId = issue('지출결의', d1.id, d1.acctDate, d1.title, disbJournal(db, d1));
  d1.paidVoucherId = issue('지급', d1.id, d1.payDate, `${d1.title} 지급`, paymentJournal(db, d1));

  // 급여: 1~9월은 확정 · 전표발행, 10월은 작성중. 설 · 추석이 든 달에 기본급 50% 상여.
  const r = rng(7);
  for (let m = 1; m <= 10; m++) {
    const ym = `2026-${pad(m)}`;
    const payDate = m === 12 ? '2027-01-10' : `2026-${pad(m + 1)}-10`;
    const lines = employees.map((e) =>
      calcLine(db.rates, e, {
        base: e.baseSalary,
        overtime: e.rank === '대표이사' ? 0 : Math.round((r() * 6) * 10) * 10000,
        bonus: m === 2 || m === 9 ? Math.round(e.baseSalary * 0.5) : 0,
        meal: 200000,
        car: e.dept === '영업팀' ? 200000 : 0,
      }),
    );
    const run: PayrollRun = { id: `pr-${ym}`, ym, payDate, status: m === 10 ? '작성중' : '확정', lines };
    if (run.status === '확정') run.voucherId = issue('급여', run.id, payDate, `${ym} 급여`, payrollJournal(run));
    db.payrolls.push(run);
  }

  const inv = (kind: TaxInvoice['kind'], issueDate: string, partner: string, bizNo: string, item: string, supply: number, vat: number, extra: Partial<TaxInvoice> = {}): TaxInvoice => ({
    id: `ti-${db.taxInvoices.length + 1}`,
    kind,
    approvalNo: `${issueDate.replaceAll('-', '')}-4100${kind === '매입' ? '0001' : '0002'}-${String(db.taxInvoices.length + 1).padStart(8, '0')}`,
    issueDate,
    partner,
    bizNo,
    item,
    supply,
    vat,
    ...extra,
  });
  const push = (t: TaxInvoice) => (db.taxInvoices.push(t), t);
  push(inv('매입', '2026-07-31', '클라우드호스팅', '101-11-00003', '7월 서버 호스팅', 800000, 80000, { disbLineId: '-' }));
  push(inv('매입', '2026-08-31', '클라우드호스팅', '101-11-00003', '8월 서버 호스팅', 810000, 81000, { disbLineId: '-' }));
  push(inv('매입', '2026-09-10', '오피스몰', '101-11-00001', '27인치 모니터 4대', 1800000, 180000, { disbLineId: 'd1l1', approvalNo: '20260910-41000001-00000001' }));
  push(inv('매입', '2026-10-05', '온라인광고센터', '101-11-00002', '검색 광고 10월분', 4545455, 454545, { disbLineId: 'd2l1', approvalNo: '20261005-41000001-00000002' }));
  push(inv('매입', '2026-10-16', '클라우드호스팅', '101-11-00003', '10월 서버 호스팅', 820000, 82000, { disbLineId: 'd3l1', approvalNo: '20261016-41000001-00000003' }));
  push(inv('매입', '2026-10-12', '그린인쇄', '101-11-00005', '명함 · 리플릿 인쇄', 300000, 30000));
  push(inv('매입', '2026-10-14', '러닝랩 교육', '101-11-00004', '실무 교육 위탁', 1090909, 109091));
  push(inv('매출', '2026-07-15', 'A 고객사', '301-81-00011', '7월 유지보수 용역', 12000000, 1200000));
  push(inv('매출', '2026-08-20', 'B 유통', '301-81-00012', '시스템 구축 2차', 8500000, 850000));
  push(inv('매출', '2026-09-25', 'C 솔루션', '301-81-00013', '데이터 분석 용역', 15000000, 1500000));
  push(inv('매출', '2026-10-10', 'A 고객사', '301-81-00011', '10월 유지보수 용역', 12000000, 1200000));
  const b = push(inv('매출', '2026-10-15', 'B 유통', '301-81-00012', '시스템 구축 3차', 6000000, 600000));
  push(inv('매출', '2026-10-18', 'B 유통', '301-81-00012', '시스템 구축 3차 (공급가액 변동)', -1000000, -100000, { modifiedFrom: b.id, modifyReason: '공급가액 변동' }));

  // 알림 — 현재 사용자(이도윤)에게 몇 건 쌓아 둔다
  notify(db, 'e2', '결재요청', '경비청구 결재 요청', '박서연 · 2026년 10월 경비청구', '/approvals?doc=' + encodeURIComponent('경비청구:cl-c4-2026-10'), '2026-10-16 10:00');
  notify(db, 'e2', '급여', '9월 급여명세서가 발행되었습니다', '지급일 2026-10-10', '/payslips', '2026-10-10 09:00');
  notify(db, 'e1', '결재요청', '지출결의서 결재 요청', '이도윤 · 서버 호스팅 10월분', '/approvals?doc=' + encodeURIComponent('지출결의서:d3'), '2026-10-16 17:00');
  notify(db, 'e1', '수신', '수신 문서가 도착했습니다', '정유나 · 2026년 10월 경비청구', '/approvals?doc=' + encodeURIComponent('경비청구:cl-c3-2026-10'), '2026-10-17 15:00');
  notify(db, CEO, '결재요청', '품의서 결재 요청', '김하늘 · 사내 교육 외부 강사 섭외', '/approvals?doc=' + encodeURIComponent('품의서:p3'), '2026-10-15 16:10');
  db.notifications.forEach((n) => n.at < '2026-10-11' && (n.read = true));

  return db;
}

/** 급여 전표: 총지급액은 급여, 공제액은 예수금, 차인지급액은 보통예금 */
export function payrollJournal(run: PayrollRun): VoucherLine[] {
  const gross = run.lines.reduce((a, l) => a + grossPay(l), 0);
  const ded = run.lines.reduce((a, l) => a + deductionTotal(l), 0);
  const net = run.lines.reduce((a, l) => a + netPay(l), 0);
  return [
    { side: '차변', accountCode: '801', amount: gross, vendor: '임직원', memo: `${run.ym} 급여` },
    { side: '대변', accountCode: '254', amount: ded, vendor: '4대보험 · 원천세', memo: `${run.ym} 급여 공제` },
    { side: '대변', accountCode: '103', amount: net, vendor: '임직원', memo: `${run.ym} 급여 지급` },
  ];
}

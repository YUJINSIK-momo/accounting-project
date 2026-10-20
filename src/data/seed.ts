import type { Card, CardTxn, Claim, ClaimItem, DB, Disbursement, Employee, Proposal, Usage, Vendor } from '../types';
import { claimJournal, disbJournal, paymentJournal } from '../lib/journal';

// 모든 값은 가상의 예시다. 실제 회사 · 사람 · 사업자번호가 아니다.
export const DB_VERSION = 1;

const accounts: DB['accounts'] = [
  { code: '103', name: '보통예금', type: '자산' },
  { code: '135', name: '부가세대급금', type: '자산' },
  { code: '253', name: '미지급금', type: '부채' },
  { code: '262', name: '미지급비용', type: '부채' },
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

const employees: Employee[] = [
  { id: 'e1', name: '김하늘', dept: '경영지원팀', rank: '팀장', bank: '가상은행', accountNo: '000-0001-0001' },
  { id: 'e2', name: '이도윤', dept: '개발팀', rank: '매니저', bank: '가상은행', accountNo: '000-0001-0002' },
  { id: 'e3', name: '박서연', dept: '개발팀', rank: '사원', bank: '예시은행', accountNo: '000-0001-0003' },
  { id: 'e4', name: '최민준', dept: '영업팀', rank: '과장', bank: '예시은행', accountNo: '000-0001-0004' },
  { id: 'e5', name: '정유나', dept: '마케팅팀', rank: '대리', bank: '가상은행', accountNo: '000-0001-0005' },
  { id: 'e6', name: '한지호', dept: '영업팀', rank: '사원', bank: '예시은행', accountNo: '000-0001-0006' },
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
    seq: {},
  };

  const next = (key: string) => (db.seq[key] = (db.seq[key] ?? 0) + 1);
  const docNo = (prefix: string) => `${prefix}-2026-${String(next(prefix)).padStart(4, '0')}`;
  const voucherNo = (date: string) => `${date.replaceAll('-', '')}-${String(next(`V${date}`)).padStart(4, '0')}`;

  const issue = (kind: '경비' | '지출결의' | '지급', sourceId: string, date: string, memo: string, lines: DB['vouchers'][number]['lines']) => {
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
      const status: Claim['status'] = ym === '2026-10' ? (card.id === 'c2' ? '결재중' : card.id === 'c3' ? '결재완료' : '작성중') : '결재완료';
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
  db.disbursements = disbursements;
  const d1 = disbursements[0];
  d1.voucherId = issue('지출결의', d1.id, d1.acctDate, d1.title, disbJournal(db, d1));
  d1.paidVoucherId = issue('지급', d1.id, d1.payDate, `${d1.title} 지급`, paymentJournal(db, d1));

  return db;
}

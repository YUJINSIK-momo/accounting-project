// AI 어시스턴트 — 말을 의도로 바꾸고(규칙 또는 AI 모델), 답은 항상 앱 데이터로 만든다.
// 쓰기 요청은 저장하지 않고 확인 카드로 "제안"만 한다. 사용자가 카드의 버튼을 눌러야 실행된다.
import type { DB, PayMethod } from '../types';
import { docList, inbox, pendingStep } from './approval';
import { budgetRows } from './budget';
import { postedLines } from '../data/store';
import { monthLabel, prevMonth, sum, today, toDate, won } from './format';
import { netPay } from './payroll';

export type Intent =
  | { kind: 'proposal'; title: string; amount: number; body: string }
  | { kind: 'expense'; date: string; merchant: string; amount: number; usageCode: string; memo: string; payMethod: PayMethod }
  | { kind: 'submit_claim' }
  | { kind: 'pending' }
  | { kind: 'mine'; filter: 'all' | '반려' | '결재중' }
  | { kind: 'budget'; dept?: string; accountCode?: string }
  | { kind: 'spend'; period: string; usageCode?: string; dept?: string; scope: 'me' | 'dept' | 'all' }
  | { kind: 'payroll' }
  | { kind: 'vat' }
  | { kind: 'invoices'; partner?: string }
  | { kind: 'pnl' }
  | { kind: 'unposted' }
  | { kind: 'search'; query: string }
  | { kind: 'navigate'; to: string; label: string }
  | { kind: 'help' };

export type CardIntent = Extract<Intent, { kind: 'proposal' | 'expense' | 'submit_claim' }>;

export interface Reply {
  text: string;
  table?: { title: string; columns: string[]; rows: Array<Array<string | number>> };
  links?: Array<{ label: string; to: string }>;
  card?: CardIntent;
  suggestions?: string[];
}

export const SUGGESTIONS = ['내 미결문서 보여줘', '우리 팀 예산 얼마 남았어?', '11월 교육 강사료 120만원 품의 올려줘', '어제 택시 23,000원 외근 이동 경비 넣어줘', '이번 달 내 경비 얼마야?', '부가세 얼마 내야 해?'];

// 용도 낱말 → 용도 코드
const USAGE_WORDS: Array<[RegExp, string]> = [
  [/택시|교통|버스|지하철|ktx|기차|이동/i, '320'],
  [/주차/, '190'],
  [/주유|기름|휘발유|경유/, '200'],
  [/회식/, '310'],
  [/야근|식대|저녁|점심|도시락|식사/, '300'],
  [/접대|미팅|커피|다과|거래처/, '340'],
  [/문구|소모품|사무용품|토너|용지/, '100'],
  [/책|도서|인쇄|명함/, '110'],
  [/통신|휴대폰|핸드폰|요금제/, '270'],
  [/숙박|호텔|출장/, '330'],
  [/광고|홍보/, '350'],
  [/수수료|구독|클라우드|서버|소프트웨어/, '210'],
  [/보험/, '260'],
];

export function usageFromText(d: DB, text: string): string | undefined {
  const byName = d.usages.find((u) => text.includes(u.name));
  if (byName) return byName.code;
  return USAGE_WORDS.find(([re]) => re.test(text))?.[1];
}

const UNIT: Record<string, number> = { 억: 1e8, 천만: 1e7, 백만: 1e6, 십만: 1e5, 만: 1e4, 천: 1e3 };
const AMOUNT_RE = /((?:\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|십만|만|천)\s*)+(?:\d[\d,]*\s*)?원?|\d[\d,]*\s*원)/;

/** "120만원", "1,200,000원", "2만3천원", "1억 2천만" → 숫자 */
export function parseAmount(text: string): { value: number; raw: string } | undefined {
  const m = text.match(AMOUNT_RE);
  if (!m) return undefined;
  let value = 0;
  for (const t of m[1].matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|십만|만|천)?/g)) value += Number(t[1].replace(/,/g, '')) * (t[2] ? UNIT[t[2]] : 1);
  return value > 0 ? { value: Math.round(value), raw: m[1] } : undefined;
}

/** "오늘 · 어제 · 그제 · 3일 전 · 10월 14일 · 10/14 · 2026-10-14" → YYYY-MM-DD */
export function parseDate(text: string, base = new Date()): string {
  const shift = (n: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    return toDate(d);
  };
  if (/그제|그저께/.test(text)) return shift(2);
  if (/어제/.test(text)) return shift(1);
  const ago = text.match(/(\d+)\s*일\s*전/);
  if (ago) return shift(Number(ago[1]));
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? text.match(/(?<![\d])(\d{1,2})\/(\d{1,2})(?![\d])/);
  if (md) return `${base.getFullYear()}-${String(md[1]).padStart(2, '0')}-${String(md[2]).padStart(2, '0')}`;
  return toDate(base);
}

const DATE_WORDS = /^(오늘|어제|그제|그저께|\d+일|전|\d{1,2}월|\d{1,2}일|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})$/;
const FILLER = /^(샀어|샀음|샀다|구매|구매했어|했어|냈어|경비|지출|비용|넣어|넣어줘|넣어 줘|등록|등록해|등록해줘|추가|추가해|추가해줘|청구|청구해|청구해줘|해줘|해 줘|줘|좀|로|으로|썼어|썼음|사용|결제|개인카드로|현금으로|개인카드|현금|법인카드)$/;

function periodFrom(text: string): string {
  const now = today().slice(0, 7);
  if (/지난\s*달|전월|저번\s*달/.test(text)) return prevMonth(now);
  const m = text.match(/(\d{1,2})\s*월/);
  if (m) return `${now.slice(0, 4)}-${m[1].padStart(2, '0')}`;
  return now;
}

export const MENUS: Array<[RegExp, string, string]> = [
  [/결재함/, '/approvals', '결재함'],
  [/경비청구작성|카드 내역/, '/claims/new', '경비청구작성'],
  [/청구내역/, '/claims', '청구내역'],
  [/품의서/, '/proposals', '품의서'],
  [/지출결의/, '/disbursements', '지출결의서'],
  [/전표처리/, '/vouchers', '전표처리'],
  [/분개장/, '/journal', '분개장'],
  [/원장/, '/ledger', '총계정원장'],
  [/시산표/, '/trial-balance', '합계잔액시산표'],
  [/재무제표|손익계산서|재무상태표/, '/statements', '재무제표'],
  [/예산/, '/budget', '예산 대비 집행'],
  [/급여대장/, '/payroll', '급여대장'],
  [/급여명세서|명세서/, '/payslips', '급여명세서'],
  [/퇴직금/, '/severance', '퇴직금 시뮬레이션'],
  [/연말정산/, '/year-end', '연말정산'],
  [/세금계산서|부가세/, '/tax-invoices', '세금계산서 · 부가세'],
  [/기초정보|조직도|요율/, '/master', '기초정보관리'],
  [/매뉴얼|사용법/, '/manual', '매뉴얼'],
];

/** 규칙으로 의도를 고른다 — AI 모델이 없을 때 쓰고, 모델이 실패해도 여기로 돌아온다 */
export function parseLocal(d: DB, text: string): Intent {
  const t = text.trim();
  const write = /(올려|작성|써\s?줘|만들어|기안|상신)/.test(t);

  if (/품의/.test(t) && write) {
    const amt = parseAmount(t);
    const bodyMatch = t.match(/(?:내용은|내용:|목적은|사유는)\s*(.+)$/);
    const head = bodyMatch ? t.slice(0, bodyMatch.index) : t;
    const title = head
      .replace(amt?.raw ?? '', ' ')
      .replace(/품의서?|올려\s?줘|올려|작성해?\s?줘?|써\s?줘|만들어\s?줘|기안해?\s?줘?|상신해?\s?줘?|해\s?줘|좀|부탁해/g, ' ')
      .replace(/\s(로|으로|을|를|건|관련)\s/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*(로|으로|을|를)$/, '')
      .trim();
    return { kind: 'proposal', title, amount: amt?.value ?? 0, body: bodyMatch?.[1].trim() ?? '' };
  }

  if (/경비|청구서/.test(t) && /상신|결재\s?올려/.test(t)) return { kind: 'submit_claim' };

  const amt = parseAmount(t);
  if (amt && (/(경비|지출|썼|사용했|결제했)/.test(t) || /(넣어|등록|추가|청구)/.test(t))) {
    const [before, after] = [t.slice(0, t.indexOf(amt.raw)), t.slice(t.indexOf(amt.raw) + amt.raw.length)];
    const known = [...new Set(d.cardTxns.map((x) => x.merchant))].find((m) => t.includes(m));
    const words = (s: string) => s.split(/\s+/).filter((w) => w && !DATE_WORDS.test(w) && !FILLER.test(w));
    const merchant = known ?? words(before).join(' ');
    const memo = words(after).join(' ').replace(/(경비|지출)\s*$/, '').trim();
    const usageCode = usageFromText(d, t) ?? '';
    return {
      kind: 'expense',
      date: parseDate(t),
      merchant,
      amount: amt.value,
      usageCode,
      memo: memo || d.usages.find((u) => u.code === usageCode)?.name || '',
      payMethod: /개인카드/.test(t) ? '개인카드' : '현금',
    };
  }

  if (/도움|뭘 할 수|무엇을 할|뭐 할 수|기능|할 수 있/.test(t)) return { kind: 'help' };
  if (/미결|결재할|승인할|내 차례|결재 대기|결재 요청/.test(t)) return { kind: 'pending' };
  if (/반려/.test(t)) return { kind: 'mine', filter: '반려' };
  if (/상신한|올린 문서|내 문서|진행 중/.test(t)) return { kind: 'mine', filter: /진행/.test(t) ? '결재중' : 'all' };
  if (/미발행|전표.*(안|대기)/.test(t)) return { kind: 'unposted' };
  if (/예산/.test(t)) {
    const dept = d.depts.find((x) => t.includes(x.name))?.name;
    const acct = d.accounts.find((a) => t.includes(a.name))?.code ?? d.usages.find((u) => u.code === usageFromText(d, t))?.accountCode;
    return { kind: 'budget', dept, accountCode: /예산\s*(얼마|남|잔액)?\s*$/.test(t) && !acct ? undefined : acct };
  }
  if (/급여|월급|실수령|연봉/.test(t)) return { kind: 'payroll' };
  if (/부가세/.test(t)) return { kind: 'vat' };
  if (/세금계산서|계산서/.test(t)) return { kind: 'invoices', partner: [...new Set(d.taxInvoices.map((x) => x.partner))].find((p) => t.includes(p) || t.includes(p.split(' ').pop()!)) };
  if (/매출|이익|손익|순이익/.test(t)) return { kind: 'pnl' };
  if (/(얼마|합계|총).*(썼|사용|경비|지출)|(썼|사용|경비|지출).*(얼마|합계)|경비\s*(현황|내역)/.test(t)) {
    const dept = d.depts.find((x) => t.includes(x.name))?.name;
    return { kind: 'spend', period: periodFrom(t), usageCode: usageFromText(d, t), dept, scope: dept || /우리\s*팀|팀\s/.test(t) ? 'dept' : /전체|회사|모든/.test(t) ? 'all' : 'me' };
  }
  const menu = MENUS.find(([re]) => re.test(t));
  if (menu && /(열어|가\s?줘|이동|화면|들어가)/.test(t)) return { kind: 'navigate', to: menu[1], label: menu[2] };
  const q = t.replace(/(찾아\s?줘|찾아|검색해?\s?줘?|보여\s?줘|알려\s?줘|어디|있어\??|좀)/g, ' ').replace(/\s+/g, ' ').trim();
  return q ? { kind: 'search', query: q } : { kind: 'help' };
}

const docLink = (kind: string, id: string) => `/approvals?doc=${encodeURIComponent(`${kind}:${id}`)}`;

/** 의도를 앱 데이터로 답한다 — 숫자는 모두 여기서 계산한다 */
export function answer(d: DB, intent: Intent): Reply {
  const me = d.employees.find((e) => e.id === d.currentEmpId)!;
  const name = (id: string) => d.employees.find((e) => e.id === id)?.name ?? '-';
  const docs = docList(d);

  switch (intent.kind) {
    case 'proposal':
      return { text: intent.amount ? '아래 내용으로 품의서를 만들까요? 고칠 곳이 있으면 카드에서 바로 고친 뒤 눌러 주세요.' : '금액을 찾지 못했어요. 카드에 금액을 넣어 주세요.', card: intent };
    case 'expense':
      return { text: `${monthLabel(today().slice(0, 7))} 경비청구서에 아래 한 건을 넣을까요?${intent.usageCode ? '' : ' 용도를 골라 주세요.'}`, card: intent };
    case 'submit_claim': {
      const c = d.claims.find((x) => x.empId === me.id && x.period === today().slice(0, 7));
      if (!c || !c.items.length) return { text: '이번 달 경비청구서에 내역이 없어요. 카드 내역을 먼저 가져오거나 경비를 넣어 주세요.', links: [{ label: '경비청구작성 열기', to: '/claims/new' }] };
      if (c.status !== '작성중' && c.status !== '반려') return { text: `이번 달 청구서(${c.docNo})는 이미 ${c.status} 상태입니다.`, links: [{ label: '문서 보기', to: docLink('경비청구', c.id) }] };
      return { text: `${c.docNo} · ${c.items.length}건 · ${won(sum(c.items, (i) => i.amount))}원을 상신할까요? 결재선을 고르는 창이 열립니다.`, card: { kind: 'submit_claim' } };
    }
    case 'pending': {
      const rows = inbox(docs, me.id).미결문서;
      if (!rows.length) return { text: '지금 결재하거나 수신할 문서가 없어요.', suggestions: ['내가 상신한 문서 보여줘', '반려된 문서 있어?'] };
      return {
        text: `${me.name}님 차례인 문서가 ${rows.length}건 있어요.`,
        table: { title: '미결문서', columns: ['문서', '제목', '기안자', '금액', '단계'], rows: rows.map((r) => [r.docNo, r.title, name(r.empId), r.amount, pendingStep(r.approval, r.status)?.phase === '수신' ? '수신' : '결재']) },
        links: rows.slice(0, 5).map((r) => ({ label: `${r.docNo} 열기`, to: docLink(r.kind, r.id) })),
      };
    }
    case 'mine': {
      const rows = inbox(docs, me.id).상신문서.filter((r) => intent.filter === 'all' || r.status === intent.filter);
      if (!rows.length) return { text: intent.filter === '반려' ? '반려된 문서가 없어요.' : '상신한 문서가 없어요.' };
      return {
        text: `${intent.filter === 'all' ? '상신한' : intent.filter} 문서가 ${rows.length}건 있어요.`,
        table: { title: '상신문서', columns: ['문서', '제목', '금액', '상태', '대기'], rows: rows.map((r) => [r.docNo, r.title, r.amount, r.status, pendingStep(r.approval, r.status) ? name(pendingStep(r.approval, r.status)!.empId) : '-']) },
        links: rows.slice(0, 5).map((r) => ({ label: `${r.docNo} 열기`, to: docLink(r.kind, r.id) })),
      };
    }
    case 'budget': {
      const dept = intent.dept ?? me.dept;
      const rows = budgetRows(d, today().slice(0, 4)).filter((r) => r.dept === dept && (!intent.accountCode || r.accountCode === intent.accountCode));
      if (!rows.length) return { text: `${dept}에 잡힌 ${intent.accountCode ? '해당 계정 ' : ''}예산이 없어요.`, links: [{ label: '예산 대비 집행 열기', to: '/budget' }] };
      const acct = (c: string) => d.accounts.find((a) => a.code === c)?.name ?? c;
      const left = sum(rows, (r) => r.budget - r.spent - r.pending);
      const over = rows.filter((r) => r.spent + r.pending > r.budget);
      return {
        text: `${dept} ${intent.accountCode ? acct(intent.accountCode) + ' ' : ''}예산은 ${won(sum(rows, (r) => r.budget))}원 중 ${won(left)}원 남았어요.${over.length ? ` 초과한 계정이 ${over.length}개 있어요(${over.map((r) => acct(r.accountCode)).join(', ')}).` : ''}`,
        table: { title: `${dept} 예산`, columns: ['계정', '예산', '집행', '결재 진행', '잔액'], rows: rows.map((r) => [acct(r.accountCode), r.budget, r.spent, r.pending, r.budget - r.spent - r.pending]) },
        links: [{ label: '예산 대비 집행 열기', to: '/budget' }],
      };
    }
    case 'spend': {
      const who = (empId: string) => (intent.scope === 'me' ? empId === me.id : intent.scope === 'dept' ? d.employees.find((e) => e.id === empId)?.dept === (intent.dept ?? me.dept) : true);
      const items = d.claims.filter((c) => c.period === intent.period && who(c.empId)).flatMap((c) => c.items.map((i) => ({ ...i, empId: c.empId })));
      const picked = items.filter((i) => !intent.usageCode || i.usageCode === intent.usageCode);
      const label = intent.scope === 'me' ? '내' : intent.scope === 'dept' ? (intent.dept ?? me.dept) : '전체';
      const usage = intent.usageCode ? d.usages.find((u) => u.code === intent.usageCode)?.name : '';
      const byUsage = Object.entries(picked.reduce<Record<string, number>>((a, i) => ((a[i.usageCode] = (a[i.usageCode] ?? 0) + i.amount), a), {})).sort((a, b) => b[1] - a[1]);
      return {
        text: `${monthLabel(intent.period)} ${label} ${usage ? usage + ' ' : ''}경비는 ${picked.length}건 · ${won(sum(picked, (i) => i.amount))}원이에요. (작성중 · 결재중 포함)`,
        table: picked.length ? { title: '용도별 합계', columns: ['용도', '건수', '금액'], rows: byUsage.map(([code, amt]) => [d.usages.find((u) => u.code === code)?.name ?? code, picked.filter((i) => i.usageCode === code).length, amt]) } : undefined,
        links: [{ label: '청구내역 열기', to: '/claims' }],
      };
    }
    case 'payroll': {
      const runs = d.payrolls.filter((r) => r.status === '확정').sort((a, b) => b.ym.localeCompare(a.ym));
      const rows = runs.slice(0, 6).map((r) => ({ r, l: r.lines.find((x) => x.empId === me.id) })).filter((x) => x.l);
      if (!rows.length) return { text: '확정된 급여가 아직 없어요.' };
      const last = rows[0];
      return {
        text: `최근 ${monthLabel(last.r.ym)} 급여(지급 ${last.r.payDate}) 실수령액은 ${won(netPay(last.l!))}원이에요.`,
        table: { title: '최근 급여', columns: ['귀속', '지급일', '소득세', '실수령'], rows: rows.map((x) => [x.r.ym, x.r.payDate, x.l!.incomeTax, netPay(x.l!)]) },
        links: [{ label: '급여명세서 열기', to: '/payslips' }],
      };
    }
    case 'vat': {
      const now = today();
      const q = Math.floor((Number(now.slice(5, 7)) - 1) / 3);
      const from = `${now.slice(0, 4)}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      const inv = d.taxInvoices.filter((t) => t.issueDate >= from && t.issueDate <= now);
      const out = sum(inv.filter((t) => t.kind === '매출'), (t) => t.vat);
      const inn = sum(inv.filter((t) => t.kind === '매입'), (t) => t.vat);
      return {
        text: `이번 분기(${from} ~ ${now}) 세금계산서 기준 납부 예상 부가세는 ${won(out - inn)}원이에요. 매출세액 ${won(out)}원 − 매입세액 ${won(inn)}원. 카드 · 현금영수증 매입세액은 빠져 있어요.`,
        links: [{ label: '부가세 집계 열기', to: '/tax-invoices' }],
      };
    }
    case 'invoices': {
      const rows = d.taxInvoices.filter((t) => !intent.partner || t.partner === intent.partner).sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 12);
      return {
        text: intent.partner ? `${intent.partner} 세금계산서 최근 ${rows.length}건이에요.` : `최근 세금계산서 ${rows.length}건이에요.`,
        table: { title: '세금계산서', columns: ['구분', '작성일', '거래처', '품목', '공급가액', '세액'], rows: rows.map((t) => [t.kind, t.issueDate, t.partner, t.item, t.supply, t.vat]) },
        links: [{ label: '세금계산서 열기', to: '/tax-invoices' }],
      };
    }
    case 'pnl': {
      const year = today().slice(0, 4);
      const lines = postedLines(d).filter((l) => l.voucher.date.startsWith(year));
      const typeOf = (c: string) => d.accounts.find((a) => a.code === c)?.type;
      const rev = sum(lines.filter((l) => typeOf(l.accountCode) === '수익'), (l) => (l.side === '대변' ? l.amount : -l.amount));
      const exp = sum(lines.filter((l) => typeOf(l.accountCode) === '비용'), (l) => (l.side === '차변' ? l.amount : -l.amount));
      return {
        text: `${year}년 누적(발행 전표 기준) 매출액은 ${won(rev)}원, 판매비와관리비는 ${won(exp)}원, 당기순이익은 ${won(rev - exp)}원이에요.`,
        links: [{ label: '재무제표 열기', to: '/statements' }],
      };
    }
    case 'unposted': {
      const rows = [
        ...d.claims.filter((c) => c.status === '결재완료' && !c.voucherId).map((c) => ['경비청구', c.docNo, `${monthLabel(c.period)} 경비 · ${name(c.empId)}`, sum(c.items, (i) => i.amount)]),
        ...d.disbursements.filter((x) => x.status === '결재완료' && !x.voucherId).map((x) => ['지출결의서', x.docNo, x.title, sum(x.lines, (l) => l.supply + l.vat)]),
      ] as Array<Array<string | number>>;
      return { text: rows.length ? `전표가 아직 발행되지 않은 결재완료 문서가 ${rows.length}건이에요.` : '전표를 기다리는 문서가 없어요.', table: rows.length ? { title: '미발행 문서', columns: ['구분', '문서', '내용', '금액'], rows } : undefined, links: [{ label: '전표처리 열기', to: '/vouchers' }] };
    }
    case 'navigate':
      return { text: `${intent.label} 화면으로 갈게요.`, links: [{ label: `${intent.label} 열기`, to: intent.to }] };
    case 'search': {
      const q = intent.query;
      const words = q.split(/\s+/).filter((w) => w.length > 1);
      const hit = (s: string) => s.includes(q) || (words.length > 0 && words.every((w) => s.includes(w)));
      const docHits = docs.filter((x) => hit(`${x.docNo} ${x.title} ${name(x.empId)}`)).slice(0, 8);
      const invHits = d.taxInvoices.filter((t) => hit(`${t.partner} ${t.item} ${t.approvalNo}`)).slice(0, 5);
      const empHits = d.employees.filter((e) => hit(`${e.name} ${e.dept} ${e.rank}`)).slice(0, 5);
      if (!docHits.length && !invHits.length && !empHits.length) return { text: `"${q}"(으)로 찾은 문서 · 세금계산서 · 직원이 없어요. 이렇게 물어볼 수 있어요.`, suggestions: SUGGESTIONS.slice(0, 4) };
      const rows: Array<Array<string | number>> = [
        ...docHits.map((x) => [x.kind, x.docNo, x.title, x.amount, x.status]),
        ...invHits.map((t) => [`${t.kind} 세금계산서`, t.approvalNo.slice(0, 13), `${t.partner} · ${t.item}`, t.supply + t.vat, t.issueDate]),
        ...empHits.map((e) => ['직원', e.email, `${e.name} · ${e.dept} ${e.rank}`, '', d.companies.find((c) => c.id === e.companyId)?.name ?? '']),
      ];
      return {
        text: `"${q}"(으)로 ${rows.length}건을 찾았어요.`,
        table: { title: '검색 결과', columns: ['종류', '번호', '내용', '금액', '상태 · 날짜'], rows },
        links: docHits.slice(0, 4).map((x) => ({ label: `${x.docNo} 열기`, to: docLink(x.kind, x.id) })),
      };
    }
    case 'help':
    default:
      return {
        text: '이런 일을 할 수 있어요. 작성 요청은 바로 저장하지 않고 확인 카드로 보여 드려요.\n· 품의 올리기 · 경비 한 건 넣기 · 이번 달 경비 상신\n· 미결 · 상신 · 반려 문서 찾기\n· 예산 잔액 · 경비 합계 · 급여 · 부가세 · 매출과 이익 · 미발행 전표\n· 문서번호 · 거래처 · 직원 검색, 메뉴 열기',
        suggestions: SUGGESTIONS,
      };
  }
}

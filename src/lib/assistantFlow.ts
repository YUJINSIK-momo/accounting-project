// 버튼 길잡이 — 모든 답은 다음에 누를 칩으로 끝난다. 흐름의 상태는 칩의 params 에 싣고, 글로 답하면 "바로 앞 답"의 단계를 이어 간다.
import type { DB } from '../types';
import { SUGGESTIONS, answer, parseAmount, parseDate, parseLocal, usageFromText, type CardIntent, type Intent, type Reply } from './assistant';
import { inbox, docList, pendingStep } from './approval';
import { monthLabel, prevMonth, today } from './format';

export interface Action {
  id: string;
  params?: Record<string, string>;
}
export type Chip = { type: 'action'; label: string; action: Action } | { type: 'message'; label: string; text: string };
export interface CardButton {
  label: string;
  to?: string;
  action?: Action;
}
export type Part =
  | { kind: 'text'; text: string }
  | { kind: 'notice'; tone: 'info' | 'warning'; text: string }
  | { kind: 'card'; title: string; description?: string; columns?: string[]; rows?: Array<Array<string | number>>; buttons?: CardButton[] }
  | { kind: 'confirm'; intent: CardIntent }
  | { kind: 'suggestions'; items: Chip[] };

/** 글로 받을 값 — 고르던 단계에서 글을 쓰면 이 칸을 채워 action 으로 잇는다 */
export interface Expect {
  field: 'title' | 'amount' | 'usage' | 'date' | 'amountText' | 'query';
  action: Action;
}

export interface BotReply {
  parts: Part[];
  expects?: Expect;
  generatedBy: 'template' | 'ai';
}

const chip = (label: string, id: string, params?: Record<string, string>): Chip => ({ type: 'action', label, action: { id, params } });
export const HOME = chip('처음으로', 'menu.home');
const EXAMPLES = chip('이렇게 물어볼 수 있어요', 'examples');

/** 칩을 붙여 답을 닫는다 — 같은 이름은 한 번만, 칩이 없으면 「처음으로」 */
function reply(parts: Part[], chips: Chip[], expects?: Expect, generatedBy: BotReply['generatedBy'] = 'template', home = true): BotReply {
  const seen = new Set<string>();
  const items = [...chips, ...(home ? [HOME] : [])].filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
  return { parts: [...parts, { kind: 'suggestions', items }], expects, generatedBy };
}

const MENU: Chip[] = [
  chip('품의 올리기', 'proposal.start'),
  chip('경비 넣기', 'expense.start'),
  chip('이번 달 경비 상신', 'claim.submit'),
  chip('내 결재함', 'inbox.start'),
  chip('예산 보기', 'budget.start'),
  chip('경비 합계', 'spend.start'),
  chip('내 급여', 'payroll'),
  chip('부가세', 'vat'),
  chip('매출 · 이익', 'pnl'),
  chip('미발행 전표', 'unposted'),
  chip('자료 찾기', 'search.start'),
];

/** 엔진의 답(Reply)을 조각으로 바꾼다 */
export function toParts(r: Reply): Part[] {
  const parts: Part[] = [{ kind: 'text', text: r.text }];
  if (r.card) parts.push({ kind: 'confirm', intent: r.card });
  if (r.table) parts.push({ kind: 'card', title: r.table.title, columns: r.table.columns, rows: r.table.rows, buttons: r.links?.map((l) => ({ label: l.label, to: l.to })) });
  else if (r.links?.length) parts.push({ kind: 'card', title: '바로가기', buttons: r.links.map((l) => ({ label: l.label, to: l.to })) });
  return parts;
}

const fromIntent = (d: DB, intent: Intent, more: Chip[] = [], generatedBy: BotReply['generatedBy'] = 'template'): BotReply => {
  const r = answer(d, intent);
  const sug = (r.suggestions ?? []).map((t): Chip => ({ type: 'message', label: t, text: t }));
  return reply(toParts(r), [...more, ...sug], undefined, generatedBy);
};

const PROPOSAL_TOPICS = ['교육 · 세미나', '장비 구매', '광고 집행', '외주 용역', '행사 · 워크숍', '소프트웨어 구독'];
const AMOUNTS: Array<[string, string]> = [['50만원', '500000'], ['100만원', '1000000'], ['300만원', '3000000'], ['500만원', '5000000'], ['1,000만원', '10000000']];

export function runAction(d: DB, action: Action): BotReply {
  const p = action.params ?? {};
  const me = d.employees.find((e) => e.id === d.currentEmpId)!;
  switch (action.id) {
    case 'menu.home':
      return reply([{ kind: 'text', text: `${me.name}님, 무엇을 도와드릴까요? 버튼을 누르거나 하고 싶은 일을 그대로 적어 주세요.` }], [...MENU, EXAMPLES], undefined, 'template', false);
    case 'examples':
      return reply([{ kind: 'text', text: '이렇게 물어볼 수 있어요. 누르면 그 문장을 보낸 것처럼 답합니다.' }], SUGGESTIONS.map((t) => ({ type: 'message', label: t, text: t })));

    // 품의: 주제 → 금액 → 확인 카드
    case 'proposal.start':
      return reply([{ kind: 'text', text: '어떤 품의인가요? 고르거나 제목을 직접 적어 주세요.' }], PROPOSAL_TOPICS.map((t) => chip(t, 'proposal.amount', { title: t })), { field: 'title', action: { id: 'proposal.amount' } });
    case 'proposal.amount':
      return reply(
        [{ kind: 'text', text: `「${p.title}」 품의 금액은 얼마인가요? (부가세 포함) 고르거나 "120만원"처럼 적어 주세요.` }],
        AMOUNTS.map(([label, v]) => chip(label, 'proposal.confirm', { ...p, amount: v })),
        { field: 'amount', action: { id: 'proposal.confirm', params: p } },
      );
    case 'proposal.confirm':
      return reply([{ kind: 'text', text: '이 내용으로 품의서를 만들까요? 카드에서 내용을 더 적거나 고친 뒤 눌러 주세요.' }, { kind: 'confirm', intent: { kind: 'proposal', title: p.title ?? '', amount: Number(p.amount) || 0, body: p.body ?? '' } }], []);

    // 경비 한 건: 용도 → 날짜 → 금액 · 사용처 → 확인 카드
    case 'expense.start':
      return reply(
        [{ kind: 'text', text: '무엇에 쓰셨나요?' }],
        ['320', '190', '200', '300', '310', '340', '100', '110', '270', '330'].map((code) => chip(d.usages.find((u) => u.code === code)?.name ?? code, 'expense.date', { usage: code })),
        { field: 'usage', action: { id: 'expense.date' } },
      );
    case 'expense.date':
      return reply(
        [{ kind: 'text', text: '언제 쓰셨나요? 고르거나 "10월 14일"처럼 적어 주세요.' }],
        [['오늘', 0], ['어제', 1], ['그제', 2]].map(([label, n]) => {
          const dt = new Date();
          dt.setDate(dt.getDate() - (n as number));
          return chip(label as string, 'expense.amount', { ...p, date: dt.toISOString().slice(0, 10) });
        }),
        { field: 'date', action: { id: 'expense.amount', params: p } },
      );
    case 'expense.amount':
      return reply([{ kind: 'text', text: '사용처와 금액을 적어 주세요. 예: 시티 택시 23,000원 외근 이동' }], [], { field: 'amountText', action: { id: 'expense.confirm', params: p } });
    case 'expense.confirm':
      return reply(
        [
          { kind: 'text', text: `${monthLabel(today().slice(0, 7))} 경비청구서에 이 한 건을 넣을까요?` },
          { kind: 'confirm', intent: { kind: 'expense', date: p.date ?? today(), merchant: p.merchant ?? '', amount: Number(p.amount) || 0, usageCode: p.usage ?? '', memo: p.memo ?? d.usages.find((u) => u.code === p.usage)?.name ?? '', payMethod: '현금' } },
        ],
        [chip('하나 더 넣기', 'expense.start'), chip('이번 달 경비 상신', 'claim.submit')],
      );
    case 'claim.submit':
      return fromIntent(d, { kind: 'submit_claim' }, [chip('경비 넣기', 'expense.start')]);

    // 결재함
    case 'inbox.start': {
      const boxes = inbox(docList(d), me.id);
      return reply([{ kind: 'text', text: `미결 ${boxes.미결문서.length}건 · 상신 ${boxes.상신문서.length}건 · 수신참조 ${boxes.수신참조문서.length}건이 있어요. 어느 것을 볼까요?` }], [
        chip(`미결문서 ${boxes.미결문서.length}`, 'inbox.list', { box: '미결문서' }),
        chip(`상신문서 ${boxes.상신문서.length}`, 'inbox.list', { box: '상신문서' }),
        chip('반려된 문서', 'inbox.list', { box: '반려' }),
        chip(`수신참조 ${boxes.수신참조문서.length}`, 'inbox.list', { box: '수신참조문서' }),
      ]);
    }
    case 'inbox.list': {
      const boxes = inbox(docList(d), me.id);
      const rows = p.box === '반려' ? boxes.상신문서.filter((x) => x.status === '반려') : boxes[p.box as keyof typeof boxes] ?? [];
      const name = (id: string) => d.employees.find((e) => e.id === id)?.name ?? '-';
      const others = ['미결문서', '상신문서', '반려', '수신참조문서'].filter((b) => b !== p.box).map((b) => chip(b === '반려' ? '반려된 문서' : b, 'inbox.list', { box: b }));
      if (!rows.length) return reply([{ kind: 'text', text: `${p.box === '반려' ? '반려된 문서' : p.box}가 없어요.` }], others);
      return reply(
        [
          { kind: 'text', text: `${p.box === '반려' ? '반려된 문서' : p.box} ${rows.length}건이에요. 열면 바로 결재할 수 있어요.` },
          {
            kind: 'card',
            title: p.box === '반려' ? '반려된 문서' : p.box,
            columns: ['문서', '제목', '기안자', '금액', '상태'],
            rows: rows.map((r) => [r.docNo, r.title, name(r.empId), r.amount, pendingStep(r.approval, r.status) ? `${name(pendingStep(r.approval, r.status)!.empId)} 차례` : r.status]),
            buttons: rows.slice(0, 4).map((r) => ({ label: `${r.docNo} 열기`, to: `/approvals?doc=${encodeURIComponent(`${r.kind}:${r.id}`)}` })),
          },
        ],
        others,
      );
    }

    // 예산: 부서 → 결과
    case 'budget.start': {
      const teams = [...new Set(d.budgets.map((b) => b.dept))].sort((a, b) => (a === me.dept ? -1 : b === me.dept ? 1 : a.localeCompare(b)));
      return reply([{ kind: 'text', text: '어느 부서 예산을 볼까요?' }], teams.map((t) => chip(t === me.dept ? `${t} (우리 팀)` : t, 'budget.dept', { dept: t })));
    }
    case 'budget.dept':
      return fromIntent(d, { kind: 'budget', dept: p.dept }, [chip('다른 부서', 'budget.start')]);

    // 경비 합계: 기간 → 범위 → 결과
    case 'spend.start': {
      const now = today().slice(0, 7);
      return reply([{ kind: 'text', text: '어느 달 경비를 볼까요?' }], [chip(`이번 달 (${monthLabel(now)})`, 'spend.scope', { period: now }), chip(`지난달 (${monthLabel(prevMonth(now))})`, 'spend.scope', { period: prevMonth(now) }), chip(monthLabel(prevMonth(prevMonth(now))), 'spend.scope', { period: prevMonth(prevMonth(now)) })]);
    }
    case 'spend.scope':
      return reply([{ kind: 'text', text: `${monthLabel(p.period)} — 누구 경비를 볼까요?` }], [chip('나', 'spend.result', { ...p, scope: 'me' }), chip(`우리 팀 (${me.dept})`, 'spend.result', { ...p, scope: 'dept' }), chip('회사 전체', 'spend.result', { ...p, scope: 'all' })]);
    case 'spend.result':
      return fromIntent(d, { kind: 'spend', period: p.period, scope: (p.scope as 'me' | 'dept' | 'all') ?? 'me' }, [chip('다른 달', 'spend.start')]);

    case 'payroll':
      return fromIntent(d, { kind: 'payroll' });
    case 'vat':
      return fromIntent(d, { kind: 'vat' }, [chip('세금계산서 보기', 'invoices')]);
    case 'invoices':
      return fromIntent(d, { kind: 'invoices' });
    case 'pnl':
      return fromIntent(d, { kind: 'pnl' });
    case 'unposted':
      return fromIntent(d, { kind: 'unposted' });
    case 'search.start':
      return reply([{ kind: 'text', text: '무엇을 찾을까요? 문서번호(예: DIS-2026-0002) · 제목 · 거래처 · 직원 이름을 적어 주세요.' }], [], { field: 'query', action: { id: 'search.run' } });
    case 'search.run':
      return fromIntent(d, { kind: 'search', query: p.query ?? '' }, [chip('다시 찾기', 'search.start')]);
    default:
      return runAction(d, { id: 'menu.home' });
  }
}

/** 칩 이름과 견줄 꼴 — 띄어쓰기 · 끝 문장부호 · 끝의 (으)로 · (이)요를 뗀다 */
const key = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/[.!?~…]+$/u, '')
    .replace(/\(.*\)$/u, '')
    .replace(/(?:으로|로)?(?:이요|요)?$/u, '');

/** 고르던 단계에서 쓴 글을 단계 안에서 푼다. 풀리지 않으면 null — 그때는 자유 질문으로 본다 */
export function continueStep(d: DB, text: string, last: BotReply | undefined): BotReply | null {
  if (!last) return null;
  const chips = (last.parts.at(-1) as Extract<Part, { kind: 'suggestions' }> | undefined)?.items ?? [];
  const typed = chips.find((c) => c.type === 'action' && c.label !== HOME.label && key(c.label) === key(text));
  if (typed && typed.type === 'action') return runAction(d, typed.action);
  const ex = last.expects;
  if (!ex) return null;
  const params = { ...(ex.action.params ?? {}) };
  switch (ex.field) {
    case 'title':
      if (parseAmount(text)) return null; // 금액까지 한 번에 말했으면 자유 질문으로 푼다
      return runAction(d, { id: ex.action.id, params: { ...params, title: text.trim() } });
    case 'amount': {
      const amt = parseAmount(text) ?? (/^\d[\d,]*$/.test(text.trim()) ? { value: Number(text.replace(/,/g, '')) } : undefined);
      if (!amt) return { ...runAction(d, { id: 'proposal.amount', params }), parts: [{ kind: 'notice', tone: 'warning', text: '금액을 찾지 못했어요. "120만원"처럼 적어 주세요.' }, ...runAction(d, { id: 'proposal.amount', params }).parts] };
      return runAction(d, { id: ex.action.id, params: { ...params, amount: String(amt.value) } });
    }
    case 'usage': {
      const usage = usageFromText(d, text);
      return usage ? runAction(d, { id: ex.action.id, params: { ...params, usage } }) : null;
    }
    case 'date':
      return runAction(d, { id: ex.action.id, params: { ...params, date: parseDate(text) } });
    case 'amountText': {
      const amt = parseAmount(text);
      if (!amt) return { ...runAction(d, { id: 'expense.amount', params }), parts: [{ kind: 'notice', tone: 'warning', text: '금액을 찾지 못했어요. "23,000원"처럼 적어 주세요.' }, ...runAction(d, { id: 'expense.amount', params }).parts] };
      const [before, after] = [text.slice(0, text.indexOf(amt.raw)).trim(), text.slice(text.indexOf(amt.raw) + amt.raw.length).trim()];
      return runAction(d, { id: ex.action.id, params: { ...params, amount: String(amt.value), merchant: before || after, memo: before ? after : '' } });
    }
    case 'query':
      return runAction(d, { id: ex.action.id, params: { ...params, query: text.trim() } });
  }
}

/** 자유 질문 — 규칙(또는 AI 모델이 고른 의도)으로 답한다 */
export function freeText(d: DB, text: string, intent?: Intent): BotReply {
  const i = intent ?? parseLocal(d, text);
  const more: Chip[] =
    i.kind === 'proposal' ? [chip('품의 처음부터', 'proposal.start')] : i.kind === 'expense' ? [chip('경비 처음부터', 'expense.start')] : i.kind === 'help' ? [...MENU] : [];
  return fromIntent(d, i, more, intent ? 'ai' : 'template');
}

export const welcome = (d: DB) => runAction(d, { id: 'menu.home' });

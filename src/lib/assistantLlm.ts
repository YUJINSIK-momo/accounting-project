// 선택 기능: 사용자가 넣은 Claude API 키로 말을 의도로 바꾼다. 답과 숫자는 여전히 앱 데이터로 만든다.
import type { DB } from '../types';
import { MENUS, parseAmount, parseDate, type Intent } from './assistant';
import { today } from './format';

export const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (빠름)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
];

const INTENTS = ['proposal', 'expense', 'submit_claim', 'pending', 'mine', 'budget', 'spend', 'payroll', 'vat', 'invoices', 'pnl', 'unposted', 'payable', 'search', 'navigate', 'help'] as const;

function tool(d: DB) {
  return {
    name: 'route',
    description: '사용자 요청을 회계 앱이 처리할 의도 하나로 정리한다. 사용자 말에 없는 금액 · 날짜는 지어내지 않는다.',
    input_schema: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: INTENTS, description: 'proposal=품의 작성, expense=경비 한 건 입력, submit_claim=이번 달 경비 상신, pending=내 미결, mine=내가 상신한 문서, budget=예산 잔액, spend=경비 합계, payroll=급여, vat=부가세, invoices=세금계산서 목록, pnl=매출 · 이익, unposted=미발행 전표, payable=이체 기다리는 지급, search=문서 · 거래처 · 직원 검색, navigate=메뉴 열기, help=도움말' },
        title: { type: 'string', description: '품의 제목(금액 제외)' },
        amount: { type: 'integer', description: '원 단위 금액. 사용자가 말한 경우만' },
        body: { type: 'string', description: '품의 내용 · 목적' },
        date: { type: 'string', description: '사용일 YYYY-MM-DD' },
        merchant: { type: 'string' },
        usage: { type: 'string', enum: d.usages.map((u) => u.name) },
        memo: { type: 'string' },
        payMethod: { type: 'string', enum: ['현금', '개인카드'] },
        filter: { type: 'string', enum: ['all', '반려', '결재중'] },
        dept: { type: 'string', enum: [...new Set(d.depts.map((x) => x.name))] },
        account: { type: 'string', enum: d.accounts.filter((a) => a.type === '비용').map((a) => a.name) },
        period: { type: 'string', description: 'YYYY-MM' },
        scope: { type: 'string', enum: ['me', 'dept', 'all'] },
        partner: { type: 'string' },
        query: { type: 'string' },
        menu: { type: 'string', enum: MENUS.map((m) => m[2]) },
      },
      required: ['intent'],
    },
  };
}

type Raw = Partial<Record<string, string | number>> & { intent: (typeof INTENTS)[number] };

function normalize(d: DB, r: Raw, text: string): Intent {
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  const num = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0);
  const usageCode = d.usages.find((u) => u.name === str('usage'))?.code ?? '';
  switch (r.intent) {
    case 'proposal':
      return { kind: 'proposal', title: str('title'), amount: num('amount') || parseAmount(text)?.value || 0, body: str('body') };
    case 'expense':
      return { kind: 'expense', date: /^\d{4}-\d{2}-\d{2}$/.test(str('date')) ? str('date') : parseDate(text), merchant: str('merchant'), amount: num('amount') || parseAmount(text)?.value || 0, usageCode, memo: str('memo'), payMethod: str('payMethod') === '개인카드' ? '개인카드' : '현금' };
    case 'mine':
      return { kind: 'mine', filter: (['all', '반려', '결재중'] as const).find((f) => f === str('filter')) ?? 'all' };
    case 'budget':
      return { kind: 'budget', dept: str('dept') || undefined, accountCode: d.accounts.find((a) => a.name === str('account'))?.code };
    case 'spend':
      return { kind: 'spend', period: /^\d{4}-\d{2}$/.test(str('period')) ? str('period') : today().slice(0, 7), usageCode: usageCode || undefined, dept: str('dept') || undefined, scope: (['me', 'dept', 'all'] as const).find((s) => s === str('scope')) ?? 'me' };
    case 'invoices':
      return { kind: 'invoices', partner: d.taxInvoices.find((t) => t.partner === str('partner'))?.partner };
    case 'search':
      return { kind: 'search', query: str('query') || text };
    case 'navigate': {
      const m = MENUS.find((x) => x[2] === str('menu'));
      return m ? { kind: 'navigate', to: m[1], label: m[2] } : { kind: 'help' };
    }
    default:
      return { kind: r.intent } as Intent;
  }
}

export async function llmIntent(d: DB, apiKey: string, model: string, text: string, history: string[]): Promise<Intent> {
  const me = d.employees.find((e) => e.id === d.currentEmpId);
  const system = `너는 사내 경비 · 지출 회계 앱의 어시스턴트다. 오늘은 ${today()}이고, 사용자는 ${me?.name}(${me?.dept} ${me?.rank})이다. 사용자의 마지막 요청을 route 도구 하나로 정리한다. 금액은 원 단위 정수, 날짜는 YYYY-MM-DD 로 바꾼다. 사용자가 말하지 않은 금액 · 날짜 · 이름은 넣지 않는다.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system,
      tools: [tool(d)],
      tool_choice: { type: 'tool', name: 'route' },
      messages: [...history.slice(-4).map((h) => ({ role: 'user', content: h })), { role: 'user', content: text }].reduce<Array<{ role: string; content: string }>>(
        // 연속된 user 메시지는 하나로 합친다
        (acc, m) => (acc.length ? (acc[0].content += `\n(이전 요청) ${m.content}`, acc) : [m]),
        [],
      ),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  const use = (data.content as Array<{ type: string; input?: Raw }>).find((c) => c.type === 'tool_use');
  if (!use?.input?.intent) throw new Error('모델이 의도를 돌려주지 않았습니다');
  return normalize(d, use.input, text);
}

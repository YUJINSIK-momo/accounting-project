import type { AppNotification, Approval, ApprovalStatus, Claim, DB, Disbursement, Proposal } from '../types';
import { monthLabel, nowStamp, sum } from './format';

export type DocKind = '경비청구' | '품의서' | '지출결의서';

export interface Doc {
  kind: DocKind;
  id: string;
  docNo: string;
  title: string;
  empId: string;
  amount: number;
  status: ApprovalStatus;
  submittedAt?: string;
  decidedAt?: string;
  approval?: Approval;
}

type Source = Claim | Proposal | Disbursement;

export function notify(d: DB, to: string, kind: AppNotification['kind'], title: string, body: string, link: string, at = nowStamp()) {
  if (!to) return;
  d.notifications.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, to, at, kind, title, body, link, read: false });
}

const docLink = (kind: DocKind, id: string) => `/approvals?doc=${encodeURIComponent(`${kind}:${id}`)}`;
const empName = (d: DB, id: string) => d.employees.find((e) => e.id === id)?.name ?? '';
const titleOf = (kind: DocKind, src: Source) => ('title' in src ? src.title : `${monthLabel((src as Claim).period)} 경비청구`) || kind;

export function docList(d: DB): Doc[] {
  return [
    ...d.claims.map((c) => ({ kind: '경비청구' as const, id: c.id, docNo: c.docNo, title: `${monthLabel(c.period)} 경비청구`, empId: c.empId, amount: sum(c.items, (i) => i.amount), status: c.status, submittedAt: c.submittedAt, decidedAt: c.decidedAt, approval: c.approval })),
    ...d.proposals.map((p) => ({ kind: '품의서' as const, id: p.id, docNo: p.docNo, title: p.title, empId: p.empId, amount: p.amount, status: p.status, submittedAt: p.submittedAt, decidedAt: p.decidedAt, approval: p.approval })),
    ...d.disbursements.map((x) => ({ kind: '지출결의서' as const, id: x.id, docNo: x.docNo, title: x.title, empId: x.empId, amount: sum(x.lines, (l) => l.supply + l.vat), status: x.status, submittedAt: x.submittedAt, decidedAt: x.decidedAt, approval: x.approval })),
  ];
}

export function sourceOf(d: DB, kind: DocKind, id: string): Source | undefined {
  const list: Source[] = kind === '경비청구' ? d.claims : kind === '품의서' ? d.proposals : d.disbursements;
  return list.find((x) => x.id === id);
}

export const RANK_ORDER = ['대표이사', '본부장', '팀장', '부장', '차장', '과장', '매니저', '대리', '사원'];
export const FINANCE_LEAD = 'e1';
export const CEO = 'e7';

/** 기본 결재선: 부서장 → 경영지원팀장. 둘 다 본인이면 대표이사. */
export function defaultLine(d: DB, drafterId: string): string[] {
  const me = d.employees.find((e) => e.id === drafterId);
  const leader = d.employees
    .filter((e) => e.dept === me?.dept)
    .sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank))[0];
  const line: string[] = [];
  if (leader && leader.id !== drafterId) line.push(leader.id);
  if (drafterId !== FINANCE_LEAD && !line.includes(FINANCE_LEAD)) line.push(FINANCE_LEAD);
  if (!line.length) line.push(CEO);
  return line;
}

/** 전결 한도 — 이 금액 이하면 그 직급이 최종 결재로 끝낼 수 있다(예시 규정) */
export const DELEGATION_LIMIT: Record<string, number> = { 대표이사: Infinity, 본부장: 50_000_000, 팀장: 10_000_000, 부장: 5_000_000, 차장: 3_000_000, 과장: 3_000_000, 매니저: 3_000_000, 대리: 500_000, 사원: 0 };

export interface LineEntry {
  empId: string;
  role: '결재' | '합의';
}

/** 지금 결재자가 전결로 끝낼 수 있는지 — 뒤에 남은 결재가 있고, 금액이 한도 이하일 때 */
export function canDelegate(d: DB, doc: Doc) {
  const step = pendingStep(doc.approval, doc.status);
  if (!doc.approval || !step || step.phase !== '발신' || step.empId !== d.currentEmpId) return false;
  if ((doc.approval.line[step.index].role ?? '결재') !== '결재') return false;
  const rest = doc.approval.line.slice(step.index + 1).some((s) => !s.decision);
  const rank = d.employees.find((e) => e.id === d.currentEmpId)?.rank ?? '사원';
  return rest && doc.amount <= (DELEGATION_LIMIT[rank] ?? 0);
}

/** 돈이 나가는 문서는 종결 뒤 경영지원팀이 수신해 처리한다 */
export const defaultReceivers = (kind: DocKind) => (kind === '품의서' ? [] : [FINANCE_LEAD]);

export function pendingStep(a: Approval | undefined, status: ApprovalStatus): { phase: '발신' | '수신'; index: number; empId: string } | null {
  if (!a || status === '작성중' || status === '반려') return null;
  const i = a.line.findIndex((s) => !s.decision);
  if (i >= 0) return { phase: '발신', index: i, empId: a.line[i].empId };
  const r = a.receivers.findIndex((s) => !s.decision);
  if (r >= 0) return { phase: '수신', index: r, empId: a.receivers[r].empId };
  return null;
}

export function submitDoc(d: DB, kind: DocKind, id: string, line: LineEntry[], receivers: string[], refs: string[], comment: string) {
  const src = sourceOf(d, kind, id);
  if (!src) return;
  const at = nowStamp();
  src.approval = {
    line: line.map((l) => ({ empId: l.empId, role: l.role })),
    receivers: receivers.map((empId) => ({ empId })),
    refs,
    history: [...(src.approval?.history ?? []), { at, empId: d.currentEmpId, action: '상신', comment: comment || undefined }],
  };
  src.status = '결재중';
  src.submittedAt = at;
  src.decidedAt = undefined;
  const title = titleOf(kind, src);
  const first = line[0];
  if (first) notify(d, first.empId, first.role === '합의' ? '합의요청' : '결재요청', `${kind} ${first.role} 요청`, `${empName(d, d.currentEmpId)} · ${src.docNo} ${title}`, docLink(kind, id), at);
}

export function decideDoc(d: DB, kind: DocKind, id: string, decision: '승인' | '반려' | '전결', comment: string) {
  const src = sourceOf(d, kind, id);
  const step = pendingStep(src?.approval, src?.status ?? '작성중');
  if (!src?.approval || !step || step.empId !== d.currentEmpId) return false;
  const at = nowStamp();
  const target = step.phase === '발신' ? src.approval.line[step.index] : src.approval.receivers[step.index];
  if (decision === '전결' && step.phase !== '발신') return false;
  Object.assign(target, { decision, decidedAt: at, comment: comment || undefined });
  if (decision === '전결') src.approval.line.slice(step.index + 1).forEach((s) => !s.decision && Object.assign(s, { decision: '생략' }));
  const action = step.phase === '수신' ? '수신' : decision === '승인' && target.role === '합의' ? '합의' : decision;
  src.approval.history.push({ at, empId: d.currentEmpId, action, comment: comment || undefined });
  const title = titleOf(kind, src);
  const link = docLink(kind, id);
  const who = empName(d, d.currentEmpId);
  if (decision === '반려') {
    src.status = '반려';
    src.decidedAt = at;
    notify(d, src.empId, '반려', `${kind}가 반려되었습니다`, `${who} · ${src.docNo} ${title}${comment ? ` — ${comment}` : ''}`, link, at);
  } else if (step.phase === '수신') {
    notify(d, src.empId, '수신', '수신 처리되었습니다', `${who} · ${src.docNo} ${title}`, link, at);
  } else {
    const next = pendingStep(src.approval, src.status);
    if (next?.phase === '발신') {
      const role = src.approval.line[next.index].role ?? '결재';
      notify(d, next.empId, role === '합의' ? '합의요청' : '결재요청', `${kind} ${role} 요청`, `${empName(d, src.empId)} · ${src.docNo} ${title}`, link, at);
    } else {
      src.status = '결재완료';
      src.decidedAt = at;
      notify(d, src.empId, '결재완료', `${kind} 결재가 끝났습니다${decision === '전결' ? ` (${who} 전결)` : ''}`, `${src.docNo} ${title}`, link, at);
      src.approval.receivers.forEach((r) => notify(d, r.empId, '수신', '수신 문서가 도착했습니다', `${empName(d, src.empId)} · ${src.docNo} ${title}`, link, at));
      src.approval.refs.forEach((r) => notify(d, r, '참조', '참조 문서가 도착했습니다', `${empName(d, src.empId)} · ${src.docNo} ${title}`, link, at));
    }
  }
  return true;
}

/** 아무도 결재하지 않았을 때만 기안자가 회수할 수 있다 */
export function canRecall(doc: Doc, me: string) {
  return doc.empId === me && doc.status === '결재중' && !!doc.approval && doc.approval.line.every((s) => !s.decision);
}

export function recallDoc(d: DB, kind: DocKind, id: string) {
  const src = sourceOf(d, kind, id);
  if (!src?.approval) return;
  src.approval.history.push({ at: nowStamp(), empId: d.currentEmpId, action: '회수' });
  const first = src.approval.line[0]?.empId;
  if (first) notify(d, first, '회수', '기안자가 문서를 회수했습니다', `${src.docNo} ${titleOf(kind, src)}`, docLink(kind, id));
  src.approval.line = src.approval.line.map((s) => ({ empId: s.empId, role: s.role }));
  src.status = '작성중';
  src.submittedAt = undefined;
}

export function inbox(docs: Doc[], me: string) {
  return {
    미결문서: docs.filter((x) => pendingStep(x.approval, x.status)?.empId === me),
    상신문서: docs.filter((x) => x.empId === me && x.status !== '작성중'),
    기결문서: docs.filter((x) => x.approval?.line.some((s) => s.empId === me && s.decision && s.decision !== '생략')),
    수신참조문서: docs.filter((x) => x.status === '결재완료' && (x.approval?.refs.includes(me) || x.approval?.receivers.some((r) => r.empId === me))),
    전체: docs.filter((x) => x.status !== '작성중'),
  };
}

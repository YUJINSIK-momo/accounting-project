// 결재선 지정 · 결재라인 보기 · 문서 보기(인쇄 · PDF) 부품
import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, CornerUpLeft, Gavel, Inbox, Mail, X } from 'lucide-react';
import { Badge, Button, cx } from '../yuyu';
import { DataTable, Modal, StatusBadge, TextArea, toast } from './ui';
import { KeyValue, Paper, PaperTable, PaperTitle, PrintButton, PrintPortal } from './print';
import { accountName, update, usageName, useDB, vendorName } from '../../data/store';
import { canDelegate, canRecall, decideDoc, docList, pendingStep, recallDoc, sourceOf, submitDoc, type Doc, type DocKind } from '../../lib/approval';
import { ApprovalLineModal } from './orgchart';
import { AttachmentList } from './attachments';
import { disbJournal } from '../../lib/journal';
import { monthLabel, sum, won } from '../../lib/format';
import type { Approval, Claim, DB, Disbursement, Proposal } from '../../types';

const person = (db: DB, id: string) => db.employees.find((e) => e.id === id);

export { ApprovalLineModal } from './orgchart';

/** 결재라인보기 — 발신 · 수신 라인을 화살표로 잇는다 */
export function ApprovalLineView({ approval, drafterId, submittedAt }: { approval?: Approval; drafterId: string; submittedAt?: string }) {
  const db = useDB();
  if (!approval) return <p className="text-sm text-yuyu-fg-subtle">아직 상신하지 않았습니다.</p>;
  const node = (id: string, label: ReactNode, key: string, role?: string) => (
    <li key={key} className="flex items-center">
      <div className="min-w-[132px] rounded-yuyu-sm border border-yuyu-line bg-yuyu-surface px-3 py-2">
        <div className="text-sm font-medium text-yuyu-fg">
          {person(db, id)?.name} <span className="text-xs font-normal text-yuyu-fg-subtle">{person(db, id)?.rank}</span>
          {role === '합의' && <span className="ml-1 rounded-full border border-yuyu-infra/40 px-1.5 text-[10px] text-yuyu-infra">합의</span>}
        </div>
        <div className="mt-0.5 text-[11px]">{label}</div>
      </div>
    </li>
  );
  const stepLabel = (s: Approval['line'][number], waitingText: string) =>
    s.decision === '승인' ? (
      <span className="text-yuyu-success">
        {s.role === '합의' ? '합의' : '승인'} {s.decidedAt?.slice(0, 10)}
      </span>
    ) : s.decision === '전결' ? (
      <span className="font-semibold text-yuyu-success">전결 {s.decidedAt?.slice(0, 10)}</span>
    ) : s.decision === '생략' ? (
      <span className="text-yuyu-fg-subtle">전결로 생략</span>
    ) : s.decision === '반려' ? (
      <span className="text-yuyu-danger">반려 {s.decidedAt?.slice(0, 10)}</span>
    ) : (
      <span className="text-yuyu-fg-subtle">{waitingText}</span>
    );
  const row = (items: ReactNode[]) => (
    <ol className="flex flex-wrap items-center gap-y-2">
      {items.map((it, i) => (
        <span key={i} className="flex items-center">
          {it}
          {i < items.length - 1 && <ChevronRight size={16} className="mx-1 text-yuyu-fg-subtle" aria-hidden />}
        </span>
      ))}
    </ol>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Badge tone="success">발신결재라인</Badge>
        {row([node(drafterId, <span className="text-yuyu-fg-muted">상신 {submittedAt?.slice(0, 10)}</span>, 'drafter'), ...approval.line.map((s, i) => node(s.empId, stepLabel(s, '대기'), `l${i}`, s.role))])}
      </div>
      {approval.receivers.length > 0 && (
        <div className="space-y-1.5">
          <Badge tone="infra">수신결재라인</Badge>
          {row(approval.receivers.map((s, i) => node(s.empId, s.decision ? <span className="text-yuyu-success">수신 {s.decidedAt?.slice(0, 10)}</span> : <span className="text-yuyu-fg-subtle">종결 후 수신</span>, `r${i}`)))}
        </div>
      )}
      {approval.refs.length > 0 && (
        <p className="text-xs text-yuyu-fg-muted">
          참조 · {approval.refs.map((r) => person(db, r)?.name).join(', ')}
        </p>
      )}
    </div>
  );
}

/** 서명 도장 — 이름을 손글씨체로 쓴 붉은 원형 인장 */
export function Seal({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <span
      aria-label={`${name} 서명`}
      className="inline-flex items-center justify-center rounded-full border-2 border-yuyu-danger/80 text-yuyu-danger/90"
      style={{ width: size, height: size, transform: 'rotate(-8deg)', fontFamily: '"Nanum Pen Script", cursive', fontSize: size * 0.42, lineHeight: 1 }}
    >
      {name}
    </span>
  );
}

/** 결재란 — 문서 오른쪽 위. 상신 · 승인하면 그 사람의 서명 도장이 찍힌다 */
function StampBox({ approval, drafterId, submittedAt }: { approval?: Approval; drafterId: string; submittedAt?: string }) {
  const db = useDB();
  const cols = [
    { id: drafterId, label: '기안', signed: Boolean(submittedAt), rejected: false, delegated: false, skipped: false, date: submittedAt },
    ...(approval?.line ?? []).map((s, i) => ({
      id: s.empId,
      label: s.role === '합의' ? '합의' : `결재${(approval?.line ?? []).slice(0, i + 1).filter((x) => (x.role ?? '결재') === '결재').length}`,
      signed: s.decision === '승인' || s.decision === '전결',
      rejected: s.decision === '반려',
      delegated: s.decision === '전결',
      skipped: s.decision === '생략',
      date: s.decidedAt,
    })),
  ];
  const cell = 'border border-yuyu-line-strong px-1 text-center';
  return (
    <table className="ml-auto border-collapse text-[11px]">
      <tbody>
        <tr>
          {cols.map((c, i) => (
            <th key={i} className={cx(cell, 'w-[78px] bg-yuyu-raised py-1 font-semibold')}>
              {c.label}
            </th>
          ))}
        </tr>
        <tr>
          {cols.map((c, i) => (
            <td
              key={i}
              className={cx(cell, 'h-[66px]')}
              style={c.skipped ? { background: 'linear-gradient(to top right, transparent calc(50% - 0.5px), rgb(var(--yuyu-line-strong)) 50%, transparent calc(50% + 0.5px))' } : undefined}
            >
              {c.signed && <Seal name={person(db, c.id)?.name ?? ''} />}
              {c.delegated && <div className="mt-0.5 text-[10px] font-semibold text-yuyu-danger">전결</div>}
              {c.skipped && <span className="text-[12px] font-semibold text-yuyu-fg-muted">전결</span>}
              {c.rejected && <span className="rounded-yuyu-sm border border-yuyu-danger px-1.5 py-0.5 text-[11px] font-semibold text-yuyu-danger">반려</span>}
            </td>
          ))}
        </tr>
        <tr>
          {cols.map((c, i) => (
            <td key={i} className={cx(cell, 'py-0.5 text-[11px] text-yuyu-fg')}>
              {person(db, c.id)?.name} <span className="text-[10px] text-yuyu-fg-muted">{person(db, c.id)?.rank}</span>
            </td>
          ))}
        </tr>
        <tr>
          {cols.map((c, i) => (
            <td key={i} className={cx(cell, 'py-0.5 text-[10px] text-yuyu-fg-muted')}>
              {c.date?.slice(5, 10).replace('-', '/') ?? '\u00a0'}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** 인쇄용 문서 본문 */
export function DocPaper({ kind, id }: { kind: DocKind; id: string }) {
  const db = useDB();
  const src = sourceOf(db, kind, id);
  if (!src) return null;
  const drafter = person(db, src.empId);
  const a = src.approval;
  const names = (ids: string[]) => ids.map((x) => person(db, x)?.name).join(', ') || '-';
  const common: Array<[string, ReactNode]> = [
    ['문서번호', src.docNo],
    ['기안일자', src.submittedAt?.slice(0, 10) ?? '-'],
    ['기안부서', drafter?.dept],
    ['기안자', `${drafter?.name} ${drafter?.rank}`],
    ['수신', names(a?.receivers.map((r) => r.empId) ?? [])],
    ['참조', names(a?.refs ?? [])],
  ];

  let title = kind as string;
  let body: ReactNode = null;
  if (kind === '경비청구') {
    const c = src as Claim;
    title = '경비청구서';
    common.push(['청구년월', monthLabel(c.period)], ['결재상태', c.status]);
    body = (
      <PaperTable
        head={['사용일시', '사용처', '결제방법', '용도', '내용', '금액']}
        rows={c.items.map((i) => [i.usedAt, i.merchant, i.payMethod, usageName(db, i.usageCode), i.memo, <span className="block text-right">{won(i.amount)}</span>])}
        foot={['합계', '', '', '', `${c.items.length}건`, <span className="block text-right">{won(sum(c.items, (i) => i.amount))}</span>]}
      />
    );
  } else if (kind === '품의서') {
    const p = src as Proposal;
    title = '품의서';
    common.push(['제목', p.title], ['품의금액', `${won(p.amount)}원`]);
    body = (
      <div className="min-h-[200px] whitespace-pre-wrap border border-yuyu-line-strong p-4">
        <p className="mb-3 font-semibold">아래와 같이 품의하오니 재가하여 주시기 바랍니다.</p>
        {p.body || '-'}
      </div>
    );
  } else {
    const x = src as Disbursement;
    title = '지출결의서';
    const proposal = db.proposals.find((p) => p.id === x.proposalId);
    common.push(['제목', x.title], ['회계처리일자', x.acctDate], ['품의서', proposal ? `${proposal.docNo} ${proposal.title}` : '-'], ['프로젝트', x.project || '-'], ['지급요청일', x.payDate || '-'], ['지급계좌', `${x.bank} ${x.accountNo} (${x.holder})`]);
    const j = disbJournal(db, x);
    body = (
      <div className="space-y-4">
        <PaperTable
          head={['용도', '내용', '거래처', '증빙', '공급가액', '부가세', '합계']}
          rows={x.lines.map((l) => [usageName(db, l.usageCode), l.memo, vendorName(db, l.vendorId), l.evidence, <span className="block text-right">{won(l.supply)}</span>, <span className="block text-right">{won(l.vat)}</span>, <span className="block text-right">{won(l.supply + l.vat)}</span>])}
          foot={['합계', '', '', '', <span className="block text-right">{won(sum(x.lines, (l) => l.supply))}</span>, <span className="block text-right">{won(sum(x.lines, (l) => l.vat))}</span>, <span className="block text-right">{won(sum(x.lines, (l) => l.supply + l.vat))}</span>]}
        />
        <PaperTable head={['차대', '계정과목', '거래처', '금액']} rows={j.map((l) => [l.side, `${l.accountCode} ${accountName(db, l.accountCode)}`, l.vendor, <span className="block text-right">{won(l.amount)}</span>])} />
      </div>
    );
  }

  return (
    <Paper>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="text-[11px] text-yuyu-fg-muted">{db.company}</div>
        <StampBox approval={a} drafterId={src.empId} submittedAt={src.submittedAt} />
      </div>
      <PaperTitle>{title}</PaperTitle>
      <KeyValue items={common} />
      {body}
      {(src.attachments?.length ?? 0) > 0 && (
        <p className="mt-3 text-[11px]">
          첨부 · {src.attachments!.map((f) => f.name).join(', ')}
        </p>
      )}
      {a && a.history.length > 0 && (
        <div className="mt-4 text-[11px] text-yuyu-fg-muted">
          {a.history.map((h, i) => (
            <div key={i}>
              {h.at} · {person(db, h.empId)?.name} {h.action}
              {h.comment ? ` — ${h.comment}` : ''}
            </div>
          ))}
        </div>
      )}
    </Paper>
  );
}

/** 문서 보기 — 결재 · 반려 · 수신 · 회수 · 인쇄 · 메일 */
export function DocumentModal({ docRef, onClose }: { docRef?: { kind: DocKind; id: string }; onClose: () => void }) {
  const db = useDB();
  const [comment, setComment] = useState('');
  if (!docRef) return null;
  const doc = docList(db).find((x) => x.kind === docRef.kind && x.id === docRef.id);
  if (!doc) return null;
  const step = pendingStep(doc.approval, doc.status);
  const myTurn = step?.empId === db.currentEmpId;

  const act = (decision: '승인' | '반려' | '전결') => {
    if (decision === '반려' && !comment.trim()) return toast('반려 사유를 적어 주세요.');
    update((d) => void decideDoc(d, doc.kind, doc.id, decision, comment.trim()));
    toast(step?.phase === '수신' ? '수신 처리했습니다.' : decision === '전결' ? '전결로 종결했습니다.' : `${decision}했습니다.`);
    setComment('');
  };

  const mail = () => {
    const a = doc.approval;
    const to = [...(a?.receivers.map((r) => r.empId) ?? []), ...(a?.refs ?? [])]
      .map((id) => person(db, id)?.email)
      .filter(Boolean)
      .join(',');
    const subject = `[${doc.kind}] ${doc.docNo} ${doc.title}`;
    const bodyText = [`${doc.kind} ${doc.docNo}`, `제목: ${doc.title}`, `기안자: ${person(db, doc.empId)?.name}`, `금액: ${won(doc.amount)}원`, `상태: ${doc.status}`, '', '문서 PDF 는 「인쇄 · PDF 저장」으로 만든 뒤 첨부해 주세요.'].join('\n');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  };

  return (
    <Modal
      open
      title={`${doc.kind} · ${doc.docNo}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <PrintButton />
          <Button size="sm" variant="ghost" icon={Mail} onClick={mail}>
            메일로 보내기
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {canRecall(doc, db.currentEmpId) && (
              <Button size="sm" variant="outline" icon={CornerUpLeft} onClick={() => (update((d) => recallDoc(d, doc.kind, doc.id)), toast('회수했습니다.'))}>
                회수
              </Button>
            )}
            {myTurn && step?.phase === '발신' && (
              <>
                <Button size="sm" variant="outline" icon={X} onClick={() => act('반려')}>
                  반려
                </Button>
                {canDelegate(db, doc) && (
                  <Button size="sm" variant="outline" icon={Gavel} onClick={() => act('전결')}>
                    전결
                  </Button>
                )}
                <Button size="sm" icon={Check} onClick={() => act('승인')}>
                  {doc.approval?.line[step.index].role === '합의' ? '합의' : '승인'}
                </Button>
              </>
            )}
            {myTurn && step?.phase === '수신' && (
              <Button size="sm" icon={Inbox} onClick={() => act('승인')}>
                수신 확인
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={doc.status} />
          {step && (
            <span className="text-sm text-yuyu-fg-muted">
              {step.phase === '발신' ? '결재 대기' : '수신 대기'} · {person(db, step.empId)?.name}
              {myTurn && <span className="ml-1 font-semibold text-yuyu-brand">(내 차례)</span>}
            </span>
          )}
        </div>
        <ApprovalLineView approval={doc.approval} drafterId={doc.empId} submittedAt={doc.submittedAt} />
        <AttachmentList items={sourceOf(db, doc.kind, doc.id)?.attachments ?? []} />
        {myTurn && <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={step?.phase === '수신' ? '수신 의견(선택)' : '결재 의견 · 반려 시 사유는 필수'} />}
        <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-bg p-3">
          <DocPaper kind={doc.kind} id={doc.id} />
        </div>
      </div>
      <PrintPortal>
        <DocPaper kind={doc.kind} id={doc.id} />
      </PrintPortal>
    </Modal>
  );
}

/** 결재함 표 — 결재라인을 한 줄로 요약한다 */
export function DocTable({ rows, onOpen }: { rows: Doc[]; onOpen: (d: Doc) => void }) {
  const db = useDB();
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => `${r.kind}:${r.id}`}
      onRowClick={onOpen}
      columns={[
        { key: 'kind', header: '문서종류', render: (r) => <span className="text-xs text-yuyu-fg-muted">{r.kind}</span> },
        { key: 'no', header: '문서번호', render: (r) => <span className="font-mono text-xs">{r.docNo}</span> },
        { key: 'title', header: '제목', render: (r) => r.title },
        { key: 'emp', header: '기안자', render: (r) => person(db, r.empId)?.name },
        { key: 'amt', header: '금액', align: 'right', render: (r) => <span className="font-mono">{won(r.amount)}</span> },
        {
          key: 'line',
          header: '결재라인',
          render: (r) => (
            <span className="text-xs">
              {r.approval?.line.map((s, i) => (
                <span key={i} className={s.decision === '승인' || s.decision === '전결' ? 'text-yuyu-success' : s.decision === '반려' ? 'text-yuyu-danger' : pendingStep(r.approval, r.status)?.empId === s.empId ? 'font-semibold text-yuyu-warning' : 'text-yuyu-fg-subtle'}>
                  {i > 0 && ' › '}
                  {person(db, s.empId)?.name}
                  {s.role === '합의' && '(합의)'}
                  {s.decision === '전결' && '(전결)'}
                </span>
              ))}
              {r.approval?.receivers.length ? <span className="text-yuyu-fg-subtle"> · 수신 {r.approval.receivers.map((x) => person(db, x.empId)?.name).join(', ')}</span> : null}
            </span>
          ),
        },
        { key: 'sub', header: '상신일시', render: (r) => <span className="font-mono text-xs text-yuyu-fg-muted">{r.submittedAt ?? '-'}</span> },
        { key: 'st', header: '상태', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

/** 결재선을 고른 뒤 바로 상신까지 한다 */
export function SubmitDocModal({ docRef, drafterId, onClose, onDone }: { docRef?: { kind: DocKind; id: string }; drafterId: string; onClose: () => void; onDone?: () => void }) {
  if (!docRef) return null;
  return (
    <ApprovalLineModal
      open
      kind={docRef.kind}
      drafterId={drafterId}
      onClose={onClose}
      onSubmit={(line, receivers, refs, comment) => {
        update((d) => submitDoc(d, docRef.kind, docRef.id, line, receivers, refs, comment));
        toast('결재를 올렸습니다. 첫 결재자에게 알림이 갔습니다.');
        onClose();
        onDone?.();
      }}
    />
  );
}

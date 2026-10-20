import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileSearch, List, Plus, ReceiptText, Save, Send, Trash2 } from 'lucide-react';
import { Button, Callout, PageHeader } from '../components/yuyu';
import { Amount, CheckBadge, DataTable, Field, Input, Modal, MoneyInput, Section, Select, StatusBadge, toast } from '../components/app/ui';
import { DocumentModal, SubmitDocModal } from '../components/app/approval';
import { accountName, getDB, nextDocNo, update, useDB } from '../data/store';
import { balance, checkDisbLine, disbJournal, worst } from '../lib/journal';
import { sum, today, uid, won } from '../lib/format';
import type { DB, DisbLine, Disbursement, Evidence } from '../types';

const EVIDENCE: Evidence[] = ['세금계산서', '계산서', '카드', '현금영수증', '기타'];

function blank(db: DB, proposalId?: string): Disbursement {
  const me = db.employees.find((e) => e.id === db.currentEmpId)!;
  const p = db.proposals.find((x) => x.id === proposalId);
  return {
    id: '',
    docNo: '',
    title: p ? p.title.replace(/ 품의$/, '') : '',
    acctDate: today(),
    proposalId: p?.id,
    project: '',
    splitMode: '지출결의별',
    lines: [newLine()],
    evidenceDate: today(),
    payDate: '',
    empId: me.id,
    dept: me.dept,
    bank: '',
    accountNo: '',
    holder: '',
    status: '작성중',
  };
}

const newLine = (): DisbLine => ({ id: `dl-${uid()}`, usageCode: '', memo: '', vendorId: '', supply: 0, vat: 0, evidence: '세금계산서', evidenceNo: '' });

export default function DisbursementForm() {
  const db = useDB();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stored = db.disbursements.find((d) => d.id === id);
  const [doc, setDoc] = useState<Disbursement>(() => (stored ? structuredClone(stored) : blank(db, params.get('proposal') ?? undefined)));
  const [submitId, setSubmitId] = useState<string>();
  const [viewing, setViewing] = useState(false);
  const [invOpen, setInvOpen] = useState(false);

  if (id && !stored) {
    return <Callout tone="danger" title="문서를 찾을 수 없습니다">목록에서 다시 골라 주세요.</Callout>;
  }

  const editable = doc.status === '작성중' || doc.status === '반려';
  const set = (patch: Partial<Disbursement>) => setDoc((d) => ({ ...d, ...patch }));
  const setLine = (lid: string, patch: Partial<DisbLine>) =>
    setDoc((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (l.id !== lid) return l;
        const next = { ...l, ...patch };
        // 공급가액이나 증빙이 바뀌면 부가세를 다시 계산한다. 직접 고친 부가세는 그대로 둔다.
        if ('supply' in patch || 'evidence' in patch) next.vat = next.evidence === '세금계산서' ? Math.round(next.supply * 0.1) : next.evidence === '계산서' ? 0 : next.vat;
        return next;
      }),
    }));

  const checks = doc.lines.map(checkDisbLine);
  const journal = disbJournal(db, doc);
  const bal = balance(journal);
  const total = sum(doc.lines, (l) => l.supply + l.vat);
  const proposal = db.proposals.find((p) => p.id === doc.proposalId);
  const spentElsewhere = sum(db.disbursements.filter((d) => d.proposalId === doc.proposalId && d.id !== doc.id && d.status !== '반려').flatMap((d) => d.lines), (l) => l.supply + l.vat);

  const persist = (submit: boolean) => {
    if (!doc.title.trim()) return toast('제목을 입력하세요.');
    if (submit && worst(checks) === '부적합') return toast('부적합 항목을 먼저 고치세요.');
    if (submit && !doc.payDate) return toast('지급요청일을 입력하세요.');
    let savedId = doc.id;
    update((d) => {
      const next = { ...doc };
      if (!next.id) {
        next.id = `d-${uid()}`;
        next.docNo = nextDocNo(d, 'DIS');
      }
      savedId = next.id;
      const i = d.disbursements.findIndex((x) => x.id === next.id);
      if (i >= 0) d.disbursements[i] = next;
      else d.disbursements.push(next);
      // 승인번호가 같은 매입 세금계산서를 이 문서에 연결한다
      d.taxInvoices.forEach((t) => {
        const l = next.lines.find((x) => x.evidenceNo && x.evidenceNo === t.approvalNo);
        if (l) t.disbLineId = l.id;
      });
    });
    setDoc(structuredClone(getDB().disbursements.find((x) => x.id === savedId)!));
    if (submit) return setSubmitId(savedId);
    toast('임시저장했습니다.');
    if (!doc.id) navigate(`/disbursements/${savedId}`, { replace: true });
  };

  const openInvoices = db.taxInvoices.filter((t) => t.kind === '매입' && !t.disbLineId && !doc.lines.some((l) => l.evidenceNo === t.approvalNo));
  const importInvoice = (tid: string) => {
    const t = db.taxInvoices.find((x) => x.id === tid)!;
    let vendorId = db.vendors.find((v) => v.bizNo === t.bizNo)?.id;
    if (!vendorId) {
      const vid = `v-${uid()}`;
      update((d) => void d.vendors.push({ id: vid, name: t.partner, bizNo: t.bizNo }));
      vendorId = vid;
    }
    const line: DisbLine = { id: `dl-${uid()}`, usageCode: '', memo: t.item, vendorId, supply: t.supply, vat: t.vat, evidence: t.vat ? '세금계산서' : '계산서', evidenceNo: t.approvalNo };
    const empty = (l: DisbLine) => !l.vendorId && !l.supply && !l.memo;
    set({ lines: [...doc.lines.filter((l) => !empty(l)), line] });
    toast(`${t.partner} 세금계산서를 가져왔습니다. 용도를 고르세요.`);
    setInvOpen(false);
  };

  const remove = () => {
    if (!doc.id) return navigate('/disbursements');
    update((d) => void (d.disbursements = d.disbursements.filter((x) => x.id !== doc.id)));
    toast('삭제했습니다.');
    navigate('/disbursements');
  };

  const pickEmployee = (empId: string) => {
    const e = db.employees.find((x) => x.id === empId);
    if (e) set({ empId, dept: e.dept });
  };

  const fillVendorAccount = () => {
    const v = db.vendors.find((x) => x.id === doc.lines[0]?.vendorId);
    if (!v) return toast('첫 줄의 거래처를 먼저 고르세요.');
    set({ holder: v.name, bank: doc.bank || '가상은행', accountNo: doc.accountNo || `000-9${v.bizNo.slice(-4)}` });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="품의 · 지출결의" title={doc.docNo ? `지출결의서 ${doc.docNo}` : '지출결의서 작성'}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={doc.status} />
          <span className="text-sm text-yuyu-fg-muted">
            작성자 {db.employees.find((e) => e.id === doc.empId)?.name} · {doc.dept}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={List} to="/disbursements">
              문서목록
            </Button>
            {doc.id && (
              <Button size="sm" variant="outline" icon={FileSearch} onClick={() => setViewing(true)}>
                문서 보기 · PDF
              </Button>
            )}
            {editable && (
              <>
                <Button size="sm" variant="outline" icon={Trash2} onClick={remove}>
                  삭제
                </Button>
                <Button size="sm" variant="outline" icon={Save} onClick={() => persist(false)}>
                  임시저장
                </Button>
                <Button size="sm" icon={Send} onClick={() => persist(true)}>
                  결재상신
                </Button>
              </>
            )}
          </div>
        </div>
      </PageHeader>

      {!editable && (
        <Callout tone={doc.status === '결재완료' ? 'success' : 'warning'} title={`${doc.status} 문서입니다`}>
          결재가 올라간 문서는 고칠 수 없습니다. 전표는 전표처리 화면에서 발행합니다.
        </Callout>
      )}

      <Section title="지출정보">
        <div className="grid gap-4 rounded-yuyu-md border border-yuyu-line/60 bg-yuyu-surface p-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="회계단위">
            <Input value={db.company} disabled />
          </Field>
          <Field label="회계처리일자" required>
            <Input type="date" value={doc.acctDate} disabled={!editable} onChange={(e) => set({ acctDate: e.target.value })} />
          </Field>
          <Field label="품의서첨부" hint={proposal ? `품의 ${won(proposal.amount)}원 · 다른 결의 ${won(spentElsewhere)}원 · 이 문서 ${won(total)}원` : undefined}>
            <Select value={doc.proposalId ?? ''} disabled={!editable} onChange={(e) => set({ proposalId: e.target.value || undefined })}>
              <option value="">없음</option>
              {db.proposals
                .filter((p) => p.status === '결재완료')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.docNo} · {p.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="제목" required className="sm:col-span-2">
            <Input value={doc.title} invalid={!doc.title.trim()} disabled={!editable} onChange={(e) => set({ title: e.target.value })} placeholder="예: 11월 서버 호스팅" />
          </Field>
          <Field label="프로젝트">
            <Input value={doc.project} disabled={!editable} onChange={(e) => set({ project: e.target.value })} placeholder="프로젝트명" />
          </Field>
          <Field label="전표처리구분" hint="지출결의별: 대변 미지급금 한 줄 · 지출내역별: 내역마다 한 줄">
            <div className="flex h-9 items-center gap-4 text-sm">
              {(['지출결의별', '지출내역별'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-yuyu-fg">
                  <input type="radio" name="split" checked={doc.splitMode === m} disabled={!editable} onChange={() => set({ splitMode: m })} />
                  {m}
                </label>
              ))}
            </div>
          </Field>
        </div>
        {proposal && spentElsewhere + total > proposal.amount && (
          <Callout tone="warning" title="품의금액을 넘습니다">
            품의 {won(proposal.amount)}원보다 {won(spentElsewhere + total - proposal.amount)}원 많습니다. 상신은 되지만 결재자가 확인합니다.
          </Callout>
        )}
      </Section>

      <Section
        title="지출내역"
        action={
          editable && (
            <>
              <Button size="sm" variant="outline" icon={ReceiptText} onClick={() => setInvOpen(true)}>
                계산서내역 ({openInvoices.length})
              </Button>
              <Button size="sm" variant="outline" icon={Plus} onClick={() => set({ lines: [...doc.lines, newLine()] })}>
                추가
              </Button>
            </>
          )
        }
      >
        <DataTable
          rows={doc.lines}
          rowKey={(l) => l.id}
          dense
          showFooter
          columns={[
            {
              key: 'u',
              header: '용도',
              width: '120px',
              render: (l) => (
                <Select value={l.usageCode} invalid={!l.usageCode} disabled={!editable} onChange={(e) => setLine(l.id, { usageCode: e.target.value })}>
                  <option value="">선택</option>
                  {db.usages.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              ),
              footer: '합계',
            },
            { key: 'memo', header: '내용', render: (l) => <Input value={l.memo} disabled={!editable} onChange={(e) => setLine(l.id, { memo: e.target.value })} placeholder="내용" /> },
            {
              key: 'v',
              header: '거래처',
              width: '150px',
              render: (l) => (
                <Select value={l.vendorId} invalid={!l.vendorId} disabled={!editable} onChange={(e) => setLine(l.id, { vendorId: e.target.value })}>
                  <option value="">선택</option>
                  {db.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              ),
            },
            { key: 's', header: '공급가액', align: 'right', width: '130px', render: (l) => <MoneyInput value={l.supply} invalid={l.supply <= 0} disabled={!editable} onChange={(n) => setLine(l.id, { supply: n })} />, footer: <Amount value={sum(doc.lines, (l) => l.supply)} /> },
            { key: 'vat', header: '부가세', align: 'right', width: '110px', render: (l) => <MoneyInput value={l.vat} disabled={!editable || l.evidence === '계산서'} onChange={(n) => setLine(l.id, { vat: n })} />, footer: <Amount value={sum(doc.lines, (l) => l.vat)} /> },
            { key: 't', header: '합계액', align: 'right', render: (l) => <Amount value={l.supply + l.vat} />, footer: <Amount value={total} /> },
            {
              key: 'ev',
              header: '증빙',
              width: '120px',
              render: (l) => (
                <Select value={l.evidence} disabled={!editable} onChange={(e) => setLine(l.id, { evidence: e.target.value as Evidence })}>
                  {EVIDENCE.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              ),
            },
            { key: 'no', header: '증빙번호', width: '200px', render: (l) => <Input value={l.evidenceNo} disabled={!editable} onChange={(e) => setLine(l.id, { evidenceNo: e.target.value })} placeholder="승인번호" className="font-mono text-xs" /> },
            { key: 'chk', header: '검증결과', align: 'center', render: (_l, i) => <CheckBadge check={checks[i]} /> },
            {
              key: 'del',
              header: '',
              width: '44px',
              render: (l) => (
                <button
                  type="button"
                  aria-label="행 삭제"
                  disabled={!editable || doc.lines.length === 1}
                  onClick={() => set({ lines: doc.lines.filter((x) => x.id !== l.id) })}
                  className="rounded-yuyu-sm p-1 text-yuyu-fg-subtle hover:bg-yuyu-raised hover:text-yuyu-danger disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>
              ),
            },
          ]}
        />
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section title="지급정보" action={editable && <Button size="sm" variant="ghost" onClick={fillVendorAccount}>거래처 계좌 불러오기</Button>}>
          <div className="grid gap-4 rounded-yuyu-md border border-yuyu-line/60 bg-yuyu-surface p-4 sm:grid-cols-2">
            <Field label="증빙일자">
              <Input type="date" value={doc.evidenceDate} disabled={!editable} onChange={(e) => set({ evidenceDate: e.target.value })} />
            </Field>
            <Field label="지급요청일" required>
              <Input type="date" value={doc.payDate} invalid={!doc.payDate} disabled={!editable} onChange={(e) => set({ payDate: e.target.value })} />
            </Field>
            <Field label="사원">
              <Select value={doc.empId} disabled={!editable} onChange={(e) => pickEmployee(e.target.value)}>
                {db.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="사용부서">
              <Input value={doc.dept} disabled />
            </Field>
            <Field label="은행">
              <Input value={doc.bank} disabled={!editable} onChange={(e) => set({ bank: e.target.value })} placeholder="은행명" />
            </Field>
            <Field label="계좌번호">
              <Input value={doc.accountNo} disabled={!editable} onChange={(e) => set({ accountNo: e.target.value })} placeholder="000-0000-0000" className="font-mono" />
            </Field>
            <Field label="예금주" className="sm:col-span-2">
              <Input value={doc.holder} disabled={!editable} onChange={(e) => set({ holder: e.target.value })} placeholder="예금주" />
            </Field>
          </div>
        </Section>

        <Section title="분개 미리보기">
          <DataTable
            rows={journal.map((l, i) => ({ ...l, i }))}
            rowKey={(l) => String(l.i)}
            dense
            showFooter
            columns={[
              { key: 'side', header: '차대', render: (l) => <span className={l.side === '차변' ? 'text-yuyu-brand' : 'text-yuyu-infra'}>{l.side}</span>, footer: bal.diff === 0 ? '대차 일치' : '대차 불일치' },
              { key: 'acct', header: '계정과목', render: (l) => `${l.accountCode} ${accountName(db, l.accountCode)}` },
              { key: 'v', header: '거래처', render: (l) => l.vendor || '-' },
              { key: 'd', header: '차변', align: 'right', render: (l) => (l.side === '차변' ? <Amount value={l.amount} /> : null), footer: <Amount value={bal.debit} /> },
              { key: 'c', header: '대변', align: 'right', render: (l) => (l.side === '대변' ? <Amount value={l.amount} /> : null), footer: <Amount value={bal.credit} /> },
            ]}
          />
        </Section>
      </div>
      <Modal open={invOpen} title="매입 세금계산서 불러오기" onClose={() => setInvOpen(false)} width="max-w-4xl">
        <DataTable
          rows={openInvoices}
          rowKey={(t) => t.id}
          dense
          empty="연결할 매입 세금계산서가 없습니다"
          onRowClick={(t) => importInvoice(t.id)}
          columns={[
            { key: 'd', header: '작성일자', render: (t) => <span className="font-mono text-xs">{t.issueDate}</span> },
            { key: 'p', header: '공급자', render: (t) => t.partner },
            { key: 'b', header: '사업자번호', render: (t) => <span className="font-mono text-xs">{t.bizNo}</span> },
            { key: 'i', header: '품목', render: (t) => t.item },
            { key: 's', header: '공급가액', align: 'right', render: (t) => <Amount value={t.supply} /> },
            { key: 'v', header: '세액', align: 'right', render: (t) => <Amount value={t.vat} /> },
            { key: 'n', header: '승인번호', render: (t) => <span className="font-mono text-[11px] text-yuyu-fg-muted">{t.approvalNo}</span> },
          ]}
        />
        <p className="mt-2 text-xs text-yuyu-fg-subtle">행을 누르면 지출내역에 한 줄로 들어갑니다. 저장하면 세금계산서가 이 문서에 연결됩니다.</p>
      </Modal>
      <SubmitDocModal docRef={submitId ? { kind: '지출결의서', id: submitId } : undefined} drafterId={doc.empId} onClose={() => setSubmitId(undefined)} onDone={() => navigate('/disbursements')} />
      <DocumentModal docRef={viewing && doc.id ? { kind: '지출결의서', id: doc.id } : undefined} onClose={() => setViewing(false)} />
    </div>
  );
}

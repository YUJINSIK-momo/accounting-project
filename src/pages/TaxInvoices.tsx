import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, PenLine } from 'lucide-react';
import { Button, Callout, PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Input, Modal, MoneyInput, Select, Tabs, Toolbar, toast } from '../components/app/ui';
import { Paper, PaperTable, PrintButton, PrintPortal } from '../components/app/print';
import { addVoucher, update, useDB } from '../data/store';
import { salesJournal } from '../data/seed';
import { sum, today, uid, won } from '../lib/format';
import type { DB, TaxInvoice } from '../types';

type Tab = '매입' | '매출' | '부가세';
const COMPANY_BIZNO = '100-00-00000';
const REASONS = ['기재사항 착오 · 정정', '공급가액 변동', '환입', '계약의 해제'] as const;

const PERIODS = [
  { label: '2026년 1기 예정 (1~3월)', from: '2026-01-01', to: '2026-03-31' },
  { label: '2026년 1기 확정 (4~6월)', from: '2026-04-01', to: '2026-06-30' },
  { label: '2026년 2기 예정 (7~9월)', from: '2026-07-01', to: '2026-09-30' },
  { label: '2026년 2기 확정 (10~12월)', from: '2026-10-01', to: '2026-12-31' },
];

function InvoicePaper({ db, t }: { db: DB; t: TaxInvoice }) {
  const supplier = t.kind === '매출' ? { name: db.company, bizNo: COMPANY_BIZNO } : { name: t.partner, bizNo: t.bizNo };
  const buyer = t.kind === '매출' ? { name: t.partner, bizNo: t.bizNo } : { name: db.company, bizNo: COMPANY_BIZNO };
  const cell = 'border border-yuyu-danger/60 px-2 py-1.5';
  return (
    <Paper>
      <h1 className="mb-1 text-center text-xl font-bold tracking-[0.2em] text-yuyu-danger">{t.modifiedFrom ? '수정 전자세금계산서' : '전자세금계산서'}</h1>
      <p className="mb-4 text-center text-[11px] text-yuyu-fg-muted">승인번호 {t.approvalNo}</p>
      <table className="mb-4 w-full border-collapse text-[12px]">
        <tbody>
          <tr>
            <th className={`${cell} w-16 bg-yuyu-danger/5`} rowSpan={2}>
              공급자
            </th>
            <td className={cell}>등록번호 {supplier.bizNo}</td>
            <th className={`${cell} w-16 bg-yuyu-danger/5`} rowSpan={2}>
              공급받는자
            </th>
            <td className={cell}>등록번호 {buyer.bizNo}</td>
          </tr>
          <tr>
            <td className={cell}>상호 {supplier.name}</td>
            <td className={cell}>상호 {buyer.name}</td>
          </tr>
        </tbody>
      </table>
      <PaperTable
        head={['작성일자', '품목', '공급가액', '세액']}
        rows={[[t.issueDate, t.item, <span className="block text-right">{won(t.supply)}</span>, <span className="block text-right">{won(t.vat)}</span>]]}
        foot={['합계금액', '', <span className="block text-right">{won(t.supply + t.vat)}</span>, '']}
      />
      {t.modifiedFrom && (
        <p className="mt-3 text-[12px]">
          수정사유: {t.modifyReason} · 당초 승인번호 {db.taxInvoices.find((x) => x.id === t.modifiedFrom)?.approvalNo}
        </p>
      )}
      <p className="mt-3 text-[11px] text-yuyu-fg-muted">데모 화면입니다. 실제 국세청 전송은 하지 않습니다.</p>
    </Paper>
  );
}

export default function TaxInvoices() {
  const db = useDB();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('매입');
  const [viewId, setViewId] = useState<string>();
  const [issueOpen, setIssueOpen] = useState(false);
  const [modifyId, setModifyId] = useState<string>();
  const [form, setForm] = useState({ partner: '', bizNo: '', item: '', issueDate: today(), supply: 0 });
  const [mod, setMod] = useState<{ reason: (typeof REASONS)[number]; supply: number }>({ reason: '공급가액 변동', supply: 0 });

  const list = db.taxInvoices.filter((t) => t.kind === tab).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const viewing = db.taxInvoices.find((t) => t.id === viewId);
  const modifying = db.taxInvoices.find((t) => t.id === modifyId);

  const linkedDoc = (t: TaxInvoice) => {
    if (t.disbLineId === '-') return <span className="text-xs text-yuyu-fg-subtle">기처리</span>;
    const d = db.disbursements.find((x) => x.lines.some((l) => l.id === t.disbLineId));
    return d ? (
      <button type="button" className="font-mono text-xs text-yuyu-brand hover:underline" onClick={(e) => (e.stopPropagation(), navigate(`/disbursements/${d.id}`))}>
        {d.docNo}
      </button>
    ) : (
      <span className="text-xs text-yuyu-warning">미연결</span>
    );
  };

  const nextApproval = (date: string) => `${date.replaceAll('-', '')}-4100${tab === '매입' ? '0001' : '0002'}-${String(db.taxInvoices.length + 1).padStart(8, '0')}`;

  const issue = () => {
    if (!form.partner.trim() || !/^\d{3}-\d{2}-\d{5}$/.test(form.bizNo) || form.supply <= 0) return toast('거래처 · 사업자번호(000-00-00000) · 공급가액을 입력하세요.');
    update((d) => {
      const t: TaxInvoice = { id: `ti-${uid()}`, kind: '매출', approvalNo: nextApproval(form.issueDate), ...form, partner: form.partner.trim(), vat: Math.round(form.supply * 0.1) };
      d.taxInvoices.push(t);
      addVoucher(d, { date: t.issueDate, kind: '매출', sourceId: t.id, memo: `${t.partner} ${t.item}`, lines: salesJournal(t), status: '발행' });
    });
    toast('매출 세금계산서를 발행하고 매출 전표를 만들었습니다.');
    setIssueOpen(false);
    setForm({ partner: '', bizNo: '', item: '', issueDate: today(), supply: 0 });
  };

  const modify = () => {
    if (!modifying) return;
    const supply = mod.reason === '계약의 해제' || mod.reason === '환입' ? -Math.abs(mod.supply || modifying.supply) : mod.supply;
    if (!supply) return toast('변동 공급가액을 입력하세요.');
    update((d) => {
      const t: TaxInvoice = {
        id: `ti-${uid()}`,
        kind: modifying.kind,
        approvalNo: nextApproval(today()),
        issueDate: today(),
        partner: modifying.partner,
        bizNo: modifying.bizNo,
        item: `${modifying.item} (${mod.reason})`,
        supply,
        vat: Math.round(supply * 0.1),
        modifiedFrom: modifying.id,
        modifyReason: mod.reason,
      };
      d.taxInvoices.push(t);
      if (t.kind === '매출') addVoucher(d, { date: t.issueDate, kind: '매출', sourceId: t.id, memo: `${t.partner} ${t.item}`, lines: salesJournal(t), status: '발행' });
    });
    toast('수정세금계산서를 발행하고 전표에 반영했습니다.');
    setModifyId(undefined);
  };

  const vat = PERIODS.map((p) => {
    const inRange = (t: TaxInvoice) => t.issueDate >= p.from && t.issueDate <= p.to;
    const sales = db.taxInvoices.filter((t) => t.kind === '매출' && inRange(t));
    const buys = db.taxInvoices.filter((t) => t.kind === '매입' && inRange(t));
    return { ...p, salesSupply: sum(sales, (t) => t.supply), salesVat: sum(sales, (t) => t.vat), buySupply: sum(buys, (t) => t.supply), buyVat: sum(buys, (t) => t.vat), n: sales.length + buys.length };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="급여 · 세무" title="세금계산서 · 부가세" lead="매입 세금계산서를 지출결의서와 잇고, 매출 세금계산서를 발행 · 수정발행하며, 신고 기간별 부가세를 집계합니다." />
      <Tabs<Tab>
        tabs={[
          { value: '매입', label: '매입 세금계산서', count: db.taxInvoices.filter((t) => t.kind === '매입').length },
          { value: '매출', label: '매출 세금계산서', count: db.taxInvoices.filter((t) => t.kind === '매출').length },
          { value: '부가세', label: '부가세 신고 집계' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab !== '부가세' && (
        <>
          {tab === '매출' && (
            <Toolbar>
              <span className="self-center text-sm text-yuyu-fg-muted">행을 누르면 세금계산서를 보고 PDF 로 저장할 수 있습니다.</span>
              <div className="ml-auto">
                <Button size="sm" icon={FilePlus2} onClick={() => setIssueOpen(true)}>
                  세금계산서 발행
                </Button>
              </div>
            </Toolbar>
          )}
          <DataTable
        exportName="세금계산서"
            rows={list}
            rowKey={(t) => t.id}
            onRowClick={(t) => setViewId(t.id)}
            showFooter
            columns={[
              { key: 'd', header: '작성일자', render: (t) => <span className="font-mono text-xs">{t.issueDate}</span>, footer: '합계' },
              { key: 'p', header: tab === '매입' ? '공급자' : '공급받는자', render: (t) => t.partner },
              { key: 'b', header: '사업자번호', render: (t) => <span className="font-mono text-xs">{t.bizNo}</span> },
              { key: 'i', header: '품목', render: (t) => (t.modifiedFrom ? <span><span className="mr-1 text-xs text-yuyu-warning">[수정]</span>{t.item}</span> : t.item) },
              { key: 's', header: '공급가액', align: 'right', render: (t) => <Amount value={t.supply} tone={t.supply < 0 ? 'danger' : undefined} />, footer: <Amount value={sum(list, (t) => t.supply)} /> },
              { key: 'v', header: '세액', align: 'right', render: (t) => <Amount value={t.vat} tone={t.vat < 0 ? 'danger' : undefined} />, footer: <Amount value={sum(list, (t) => t.vat)} /> },
              { key: 'n', header: '승인번호', render: (t) => <span className="font-mono text-[11px] text-yuyu-fg-muted">{t.approvalNo}</span> },
              tab === '매입'
                ? { key: 'link', header: '지출결의', align: 'center', render: linkedDoc }
                : {
                    key: 'mod',
                    header: '',
                    align: 'right',
                    render: (t) =>
                      t.modifiedFrom ? null : (
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" icon={PenLine} onClick={() => (setModifyId(t.id), setMod({ reason: '공급가액 변동', supply: 0 }))}>
                            수정발행
                          </Button>
                        </span>
                      ),
                  },
            ]}
          />
          {tab === '매입' && <p className="text-xs text-yuyu-fg-subtle">미연결 매입 세금계산서는 지출결의서 작성 화면의 「계산서내역」에서 불러올 수 있습니다.</p>}
        </>
      )}

      {tab === '부가세' && (
        <>
          <DataTable
        exportName="부가세집계"
            rows={vat}
            rowKey={(p) => p.label}
            showFooter
            columns={[
              { key: 'l', header: '신고 기간', render: (p) => p.label, footer: '합계' },
              { key: 'ss', header: '매출 공급가액', align: 'right', render: (p) => <Amount value={p.salesSupply} />, footer: <Amount value={sum(vat, (p) => p.salesSupply)} /> },
              { key: 'sv', header: '매출세액', align: 'right', render: (p) => <Amount value={p.salesVat} />, footer: <Amount value={sum(vat, (p) => p.salesVat)} /> },
              { key: 'bs', header: '매입 공급가액', align: 'right', render: (p) => <Amount value={p.buySupply} />, footer: <Amount value={sum(vat, (p) => p.buySupply)} /> },
              { key: 'bv', header: '매입세액', align: 'right', render: (p) => <Amount value={p.buyVat} />, footer: <Amount value={sum(vat, (p) => p.buyVat)} /> },
              {
                key: 'pay',
                header: '납부(환급)세액',
                align: 'right',
                render: (p) => <Amount value={p.salesVat - p.buyVat} tone={p.salesVat - p.buyVat < 0 ? 'success' : undefined} />,
                footer: <Amount value={sum(vat, (p) => p.salesVat - p.buyVat)} />,
              },
            ]}
          />
          <Callout tone="warning" title="세금계산서만 집계합니다">
            카드 · 현금영수증 매입세액 공제, 의제매입세액, 가산세는 넣지 않았습니다. 예정신고 기간의 납부세액은 확정신고 때 다시 정산됩니다.
          </Callout>
        </>
      )}

      <Modal open={!!viewing} title="세금계산서" onClose={() => setViewId(undefined)} width="max-w-3xl" footer={<PrintButton />}>
        {viewing && (
          <>
            <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-bg p-3">
              <InvoicePaper db={db} t={viewing} />
            </div>
            <PrintPortal>
              <InvoicePaper db={db} t={viewing} />
            </PrintPortal>
          </>
        )}
      </Modal>

      <Modal
        open={issueOpen}
        title="매출 세금계산서 발행"
        onClose={() => setIssueOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>
              취소
            </Button>
            <Button icon={FilePlus2} onClick={issue}>
              발행
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="공급받는자 상호" required>
            <Input value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} />
          </Field>
          <Field label="사업자번호" required>
            <Input value={form.bizNo} onChange={(e) => setForm({ ...form, bizNo: e.target.value })} placeholder="000-00-00000" className="font-mono" />
          </Field>
          <Field label="품목">
            <Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </Field>
          <Field label="작성일자">
            <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </Field>
          <Field label="공급가액" required hint={`세액 ${won(Math.round(form.supply * 0.1))}원 (10%)`}>
            <MoneyInput value={form.supply} onChange={(n) => setForm({ ...form, supply: n })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!modifying}
        title="수정세금계산서 발행"
        onClose={() => setModifyId(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModifyId(undefined)}>
              취소
            </Button>
            <Button icon={PenLine} onClick={modify}>
              수정발행
            </Button>
          </>
        }
      >
        {modifying && (
          <div className="grid gap-4">
            <p className="text-sm text-yuyu-fg-muted">
              당초 {modifying.issueDate} · {modifying.partner} · 공급가액 {won(modifying.supply)}원
            </p>
            <Field label="수정사유">
              <Select value={mod.reason} onChange={(e) => setMod({ ...mod, reason: e.target.value as (typeof REASONS)[number] })}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="변동 공급가액" hint={mod.reason === '계약의 해제' || mod.reason === '환입' ? '음수(−)로 발행됩니다. 비우면 당초 금액 전부를 취소합니다.' : '늘어나면 그대로, 줄어들면 앞에 − 를 붙여 입력하세요.'}>
              <Input
                inputMode="numeric"
                value={mod.supply ? mod.supply.toLocaleString('ko-KR') : ''}
                placeholder="0"
                onChange={(e) => setMod({ ...mod, supply: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 })}
                className="text-right font-mono"
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

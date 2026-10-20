import { useState } from 'react';
import { Banknote, FilePlus2, Undo2 } from 'lucide-react';
import { Button, Callout, PageHeader } from '../components/yuyu';
import { Amount, DataTable, Section, StatusBadge, Tabs, toast } from '../components/app/ui';
import { accountName, addVoucher, empName, update, usageName, useDB } from '../data/store';
import { balance, claimJournal, disbJournal, paymentJournal } from '../lib/journal';
import { monthLabel, sum, today } from '../lib/format';
import type { ApprovalStatus, DB, VoucherLine } from '../types';

type Tab = '경비' | '지출결의' | '지급';

interface Row {
  id: string;
  date: string;
  docNo: string;
  title: string;
  empId: string;
  amount: number;
  status: ApprovalStatus;
  voucherId?: string;
  paidVoucherId?: string;
}

function rowsFor(db: DB, tab: Tab): Row[] {
  if (tab === '경비') {
    return db.claims
      .filter((c) => c.status === '결재완료')
      .map((c) => ({ id: c.id, date: `${c.period}-말`, docNo: c.docNo, title: `${monthLabel(c.period)} 경비청구`, empId: c.empId, amount: sum(c.items, (i) => i.amount), status: c.status, voucherId: c.voucherId }));
  }
  return db.disbursements
    .filter((d) => d.status === '결재완료' && (tab === '지출결의' || d.voucherId))
    .map((d) => ({ id: d.id, date: tab === '지급' ? d.payDate : d.acctDate, docNo: d.docNo, title: d.title, empId: d.empId, amount: sum(d.lines, (l) => l.supply + l.vat), status: d.status, voucherId: d.voucherId, paidVoucherId: d.paidVoucherId }));
}

function previewLines(db: DB, tab: Tab, id: string): VoucherLine[] {
  if (tab === '경비') {
    const c = db.claims.find((x) => x.id === id)!;
    return c.voucherId ? db.vouchers.find((v) => v.id === c.voucherId)!.lines : claimJournal(db, c);
  }
  const d = db.disbursements.find((x) => x.id === id)!;
  if (tab === '지급') return d.paidVoucherId ? db.vouchers.find((v) => v.id === d.paidVoucherId)!.lines : paymentJournal(db, d);
  return d.voucherId ? db.vouchers.find((v) => v.id === d.voucherId)!.lines : disbJournal(db, d);
}

export default function VoucherProcessing() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>('경비');
  const [selected, setSelected] = useState<string>();
  const done = (r: Row) => Boolean(tab === '지급' ? r.paidVoucherId : r.voucherId);
  // 미발행 문서를 위로 올린다
  const rows = rowsFor(db, tab).sort((a, b) => Number(done(a)) - Number(done(b)) || b.date.localeCompare(a.date));
  const current = rows.find((r) => r.id === selected) ?? rows[0];
  const lines = current ? previewLines(db, tab, current.id) : [];
  const bal = balance(lines);

  const issue = (r: Row) => {
    update((d) => {
      if (tab === '경비') {
        const c = d.claims.find((x) => x.id === r.id)!;
        c.voucherId = addVoucher(d, { date: `${c.period}-28` > today() ? today() : `${c.period}-28`, kind: '경비', sourceId: c.id, memo: `${c.period} 경비청구 (${empName(d, c.empId)})`, lines: claimJournal(d, c), status: '발행' });
      } else if (tab === '지출결의') {
        const x = d.disbursements.find((y) => y.id === r.id)!;
        x.voucherId = addVoucher(d, { date: x.acctDate, kind: '지출결의', sourceId: x.id, memo: x.title, lines: disbJournal(d, x), status: '발행' });
      } else {
        const x = d.disbursements.find((y) => y.id === r.id)!;
        x.paidVoucherId = addVoucher(d, { date: x.payDate || today(), kind: '지급', sourceId: x.id, memo: `${x.title} 지급`, lines: paymentJournal(d, x), status: '발행' });
      }
    });
    toast(`${r.docNo} 전표를 발행했습니다.`);
  };

  const cancel = (r: Row) => {
    if (tab !== '지급' && r.paidVoucherId) return toast('지급 전표를 먼저 취소하세요.');
    update((d) => {
      const vid = tab === '지급' ? r.paidVoucherId : r.voucherId;
      d.vouchers = d.vouchers.filter((v) => v.id !== vid);
      if (tab === '경비') d.claims.find((x) => x.id === r.id)!.voucherId = undefined;
      else if (tab === '지출결의') d.disbursements.find((x) => x.id === r.id)!.voucherId = undefined;
      else d.disbursements.find((x) => x.id === r.id)!.paidVoucherId = undefined;
    });
    toast(`${r.docNo} 전표 발행을 취소했습니다.`);
  };

  const issueAll = () => {
    const todo = rows.filter((r) => !done(r));
    todo.forEach(issue);
    if (!todo.length) toast('발행할 문서가 없습니다.');
  };

  const claim = tab === '경비' && current ? db.claims.find((c) => c.id === current.id) : undefined;
  const usageAgg = claim
    ? Object.values(
        claim.items.reduce<Record<string, { code: string; n: number; amt: number }>>((acc, i) => {
          const a = (acc[i.usageCode] ??= { code: i.usageCode, n: 0, amt: 0 });
          a.n++;
          a.amt += i.amount;
          return acc;
        }, {}),
      )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="전표처리" lead="결재가 끝난 문서로 분개를 만들고 전표를 발행합니다. 발행된 전표만 분개장 · 원장 · 시산표에 반영됩니다." />
      <Tabs<Tab>
        tabs={(['경비', '지출결의', '지급'] as const).map((t) => ({ value: t, label: t === '경비' ? '경비전표' : t === '지출결의' ? '지출결의전표' : '지급처리', count: rowsFor(db, t).filter((r) => !(t === '지급' ? r.paidVoucherId : r.voucherId)).length }))}
        value={tab}
        onChange={(t) => (setTab(t), setSelected(undefined))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" icon={FilePlus2} onClick={issueAll}>
          {tab === '지급' ? '미지급 일괄 지급처리' : '미발행 일괄 발행'}
        </Button>
      </div>
      <DataTable
        exportName="전표처리"
        rows={rows}
        rowKey={(r) => r.id}
        selectedKey={current?.id}
        onRowClick={(r) => setSelected(r.id)}
        maxHeight="40vh"
        columns={[
          { key: 'date', header: tab === '지급' ? '지급요청일' : '기준일자', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
          { key: 'no', header: '문서번호', render: (r) => <span className="font-mono text-xs">{r.docNo}</span> },
          { key: 't', header: '문서제목', render: (r) => r.title },
          { key: 'dept', header: '기안부서', render: (r) => db.employees.find((e) => e.id === r.empId)?.dept },
          { key: 'emp', header: '기안자', render: (r) => empName(db, r.empId) },
          { key: 'amt', header: '금액', align: 'right', render: (r) => <Amount value={r.amount} /> },
          { key: 'st', header: '결재상태', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'v',
            header: '전표번호',
            render: (r) => {
              const vid = tab === '지급' ? r.paidVoucherId : r.voucherId;
              return vid ? <span className="font-mono text-xs text-yuyu-success">{db.vouchers.find((v) => v.id === vid)?.no}</span> : <span className="text-xs text-yuyu-fg-subtle">미발행</span>;
            },
          },
          {
            key: 'act',
            header: '',
            align: 'right',
            render: (r) =>
              done(r) ? (
                <Button size="sm" variant="ghost" icon={Undo2} onClick={() => cancel(r)}>
                  발행취소
                </Button>
              ) : (
                <Button size="sm" variant="outline" icon={tab === '지급' ? Banknote : FilePlus2} onClick={() => issue(r)}>
                  {tab === '지급' ? '지급처리' : '전표발행'}
                </Button>
              ),
          },
        ]}
      />

      {current ? (
        <div className={`grid gap-4 ${claim ? 'xl:grid-cols-[1fr_320px]' : ''}`}>
          <Section title={`전표분개 · ${current.docNo}`} action={<span className="text-xs text-yuyu-fg-muted">차변 {bal.debit.toLocaleString('ko-KR')} · 대변 {bal.credit.toLocaleString('ko-KR')} · 차이 {bal.diff.toLocaleString('ko-KR')}</span>}>
            <DataTable
        exportName="전표분개"
              rows={lines.map((l, i) => ({ ...l, i }))}
              rowKey={(l) => String(l.i)}
              dense
              showFooter
              maxHeight="45vh"
              columns={[
                { key: 'n', header: '순번', render: (l) => l.i + 1, footer: '합계' },
                { key: 'side', header: '차대', render: (l) => <span className={l.side === '차변' ? 'text-yuyu-brand' : 'text-yuyu-infra'}>{l.side}</span> },
                { key: 'acct', header: '계정과목', render: (l) => `${l.accountCode} ${accountName(db, l.accountCode)}` },
                { key: 'v', header: '거래처', render: (l) => l.vendor || '-' },
                { key: 'memo', header: '적요', render: (l) => <span className="text-yuyu-fg-muted">{l.memo}</span> },
                { key: 'd', header: '차변', align: 'right', render: (l) => (l.side === '차변' ? <Amount value={l.amount} /> : null), footer: <Amount value={bal.debit} /> },
                { key: 'c', header: '대변', align: 'right', render: (l) => (l.side === '대변' ? <Amount value={l.amount} /> : null), footer: <Amount value={bal.credit} /> },
              ]}
            />
          </Section>
          {claim && (
            <Section title="용도별 경비계정">
              <DataTable
                rows={usageAgg}
                rowKey={(a) => a.code}
                dense
                showFooter
                columns={[
                  { key: 'u', header: '용도', render: (a) => usageName(db, a.code), footer: '합계' },
                  { key: 'acct', header: '경비계정', render: (a) => accountName(db, db.usages.find((u) => u.code === a.code)?.accountCode ?? '') },
                  { key: 'n', header: '건수', align: 'right', render: (a) => a.n, footer: sum(usageAgg, (a) => a.n) },
                  { key: 'amt', header: '금액', align: 'right', render: (a) => <Amount value={a.amt} />, footer: <Amount value={sum(usageAgg, (a) => a.amt)} /> },
                ]}
              />
            </Section>
          )}
        </div>
      ) : (
        <Callout tone="neutral" title="처리할 문서가 없습니다">
          결재함에서 문서를 승인하면 여기에 나타납니다.
        </Callout>
      )}
    </div>
  );
}

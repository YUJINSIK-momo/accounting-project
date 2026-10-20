import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button, PageHeader } from '../components/yuyu';
import { Amount, DataTable, StatusBadge, Tabs, toast } from '../components/app/ui';
import { empName, update, useDB } from '../data/store';
import { monthLabel, nowStamp, sum } from '../lib/format';
import type { ApprovalStatus, DB } from '../types';

export interface DocRow {
  kind: '경비청구' | '품의서' | '지출결의서';
  id: string;
  docNo: string;
  title: string;
  empId: string;
  amount: number;
  status: ApprovalStatus;
  submittedAt?: string;
  decidedAt?: string;
}

export function allDocs(db: DB): DocRow[] {
  return [
    ...db.claims.map((c) => ({ kind: '경비청구' as const, id: c.id, docNo: c.docNo, title: `${monthLabel(c.period)} 경비청구`, empId: c.empId, amount: sum(c.items, (i) => i.amount), status: c.status, submittedAt: c.submittedAt, decidedAt: c.decidedAt })),
    ...db.proposals.map((p) => ({ kind: '품의서' as const, id: p.id, docNo: p.docNo, title: p.title, empId: p.empId, amount: p.amount, status: p.status, submittedAt: p.submittedAt, decidedAt: p.decidedAt })),
    ...db.disbursements.map((d) => ({ kind: '지출결의서' as const, id: d.id, docNo: d.docNo, title: d.title, empId: d.empId, amount: sum(d.lines, (l) => l.supply + l.vat), status: d.status, submittedAt: d.submittedAt, decidedAt: d.decidedAt })),
  ];
}

export function decide(row: DocRow, status: '결재완료' | '반려') {
  update((d) => {
    const list = row.kind === '경비청구' ? d.claims : row.kind === '품의서' ? d.proposals : d.disbursements;
    const doc = list.find((x) => x.id === row.id);
    if (!doc) return;
    doc.status = status;
    doc.decidedAt = nowStamp();
  });
  toast(`${row.docNo} ${status === '결재완료' ? '승인' : '반려'}했습니다.`);
}

type Tab = '결재중' | '결재완료' | '반려';

export default function Approvals() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>('결재중');
  const docs = allDocs(db);
  const rows = docs.filter((r) => r.status === tab).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="결재" title="결재함" lead="경비청구 · 품의서 · 지출결의서를 한곳에서 승인하거나 반려합니다. 데모라 결재선 없이 한 번에 결정합니다." />
      <Tabs tabs={(['결재중', '결재완료', '반려'] as const).map((t) => ({ value: t, label: t, count: docs.filter((d) => d.status === t).length }))} value={tab} onChange={setTab} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: 'kind', header: '문서종류', render: (r) => <span className="text-xs text-yuyu-fg-muted">{r.kind}</span> },
          { key: 'no', header: '문서번호', render: (r) => <span className="font-mono text-xs">{r.docNo}</span> },
          { key: 'title', header: '제목', render: (r) => r.title },
          { key: 'emp', header: '기안자', render: (r) => empName(db, r.empId) },
          { key: 'amt', header: '금액', align: 'right', render: (r) => <Amount value={r.amount} /> },
          { key: 'sub', header: tab === '결재중' ? '상신일시' : '결정일시', render: (r) => <span className="font-mono text-xs text-yuyu-fg-muted">{tab === '결재중' ? r.submittedAt : r.decidedAt}</span> },
          { key: 'st', header: '상태', align: 'center', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'act',
            header: '',
            align: 'right',
            render: (r) =>
              r.status === '결재중' ? (
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" icon={Check} onClick={() => decide(r, '결재완료')}>
                    승인
                  </Button>
                  <Button size="sm" variant="outline" icon={X} onClick={() => decide(r, '반려')}>
                    반려
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
    </div>
  );
}

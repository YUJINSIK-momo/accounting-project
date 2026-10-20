import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { Button, PageHeader } from '../components/yuyu';
import { DocumentModal } from '../components/app/approval';
import { Amount, DataTable, Field, Select, StatusBadge, Toolbar } from '../components/app/ui';
import { empName, usageName, useDB } from '../data/store';
import { checkClaimItem, worst } from '../lib/journal';
import { monthLabel, sum } from '../lib/format';
import type { ApprovalStatus } from '../types';

export default function ClaimList() {
  const db = useDB();
  const periods = [...new Set(db.claims.map((c) => c.period))].sort().reverse();
  const [period, setPeriod] = useState('all');
  const [status, setStatus] = useState<'all' | ApprovalStatus>('all');
  const [selected, setSelected] = useState<string>();
  const [viewId, setViewId] = useState<string>();

  const rows = db.claims
    .filter((c) => period === 'all' || c.period === period)
    .filter((c) => status === 'all' || c.status === status)
    .sort((a, b) => b.period.localeCompare(a.period) || a.docNo.localeCompare(b.docNo));
  const current = db.claims.find((c) => c.id === selected);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="경비청구" title="청구내역" lead="직원별 월 경비청구서와 결재 · 전표 상태입니다. 행을 누르면 세부 내역이 아래에 열립니다." />
      <Toolbar>
        <Field label="청구년월" className="w-40">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">전체</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="결재상태" className="w-36">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">전체</option>
            <option>작성중</option>
            <option>결재중</option>
            <option>결재완료</option>
            <option>반려</option>
          </Select>
        </Field>
      </Toolbar>
      <DataTable
        exportName="청구내역"
        rows={rows}
        rowKey={(c) => c.id}
        selectedKey={selected}
        onRowClick={(c) => setSelected(c.id === selected ? undefined : c.id)}
        showFooter
        maxHeight="50vh"
        columns={[
          { key: 'no', header: '문서번호', render: (c) => <span className="font-mono text-xs">{c.docNo}</span>, footer: `${rows.length}건` },
          { key: 'p', header: '청구년월', render: (c) => monthLabel(c.period) },
          { key: 'emp', header: '사원', render: (c) => empName(db, c.empId) },
          { key: 'dept', header: '부서', render: (c) => db.employees.find((e) => e.id === c.empId)?.dept },
          { key: 'n', header: '건수', align: 'right', render: (c) => c.items.length },
          { key: 'amt', header: '청구금액', align: 'right', render: (c) => <Amount value={sum(c.items, (i) => i.amount)} />, footer: <Amount value={sum(rows, (c) => sum(c.items, (i) => i.amount))} /> },
          { key: 'chk', header: '검증', align: 'center', render: (c) => <span className="text-xs text-yuyu-fg-muted">{worst(c.items.map((i) => checkClaimItem(i, c.items)))}</span> },
          { key: 'st', header: '결재상태', align: 'center', render: (c) => <StatusBadge status={c.status} /> },
          { key: 'v', header: '전표', align: 'center', render: (c) => (c.voucherId ? <span className="font-mono text-xs text-yuyu-success">{db.vouchers.find((v) => v.id === c.voucherId)?.no}</span> : <span className="text-xs text-yuyu-fg-subtle">미발행</span>) },
          {
            key: 'doc',
            header: '',
            align: 'right',
            render: (c) =>
              c.status !== '작성중' ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" icon={FileSearch} onClick={() => setViewId(c.id)}>
                    문서
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
      {current && (
        <DataTable
          rows={current.items}
          rowKey={(i) => i.id}
          dense
          showFooter
          columns={[
            { key: 'at', header: '사용일시', render: (i) => <span className="font-mono text-xs">{i.usedAt}</span>, footer: current.docNo },
            { key: 'm', header: '사용처', render: (i) => i.merchant },
            { key: 'pay', header: '결제방법', render: (i) => i.payMethod },
            { key: 'u', header: '용도', render: (i) => usageName(db, i.usageCode) },
            { key: 'memo', header: '내용', render: (i) => i.memo },
            { key: 'amt', header: '금액', align: 'right', render: (i) => <Amount value={i.amount} />, footer: <Amount value={sum(current.items, (i) => i.amount)} /> },
            { key: 'chk', header: '검증결과', render: (i) => <span className="text-xs text-yuyu-fg-muted">{checkClaimItem(i, current.items).reasons.join(', ') || '적합'}</span> },
          ]}
        />
      )}
      <DocumentModal docRef={viewId ? { kind: '경비청구', id: viewId } : undefined} onClose={() => setViewId(undefined)} />
    </div>
  );
}

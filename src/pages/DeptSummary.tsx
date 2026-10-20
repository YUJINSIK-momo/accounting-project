import { useState } from 'react';
import { PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Select, StatusBadge, Toolbar } from '../components/app/ui';
import { useDB } from '../data/store';
import { monthLabel, prevMonth, sum } from '../lib/format';
import type { ApprovalStatus } from '../types';

export default function DeptSummary() {
  const db = useDB();
  const periods = [...new Set(db.claims.map((c) => c.period))].sort().reverse();
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [status, setStatus] = useState<'all' | ApprovalStatus>('all');
  const [dept, setDept] = useState('all');

  const depts = [...new Set(db.employees.map((e) => e.dept))];
  const total = (empId: string, ym: string) => sum(db.claims.filter((c) => c.empId === empId && c.period === ym).flatMap((c) => c.items), (i) => i.amount);

  const rows = db.employees
    .filter((e) => dept === 'all' || e.dept === dept)
    .map((e) => {
      const claim = db.claims.find((c) => c.empId === e.id && c.period === period);
      const amount = total(e.id, period);
      const before = total(e.id, prevMonth(period));
      return { emp: e, claim, amount, before, delta: amount - before };
    })
    .filter((r) => r.claim && (status === 'all' || r.claim.status === status))
    .sort((a, b) => a.emp.dept.localeCompare(b.emp.dept) || b.amount - a.amount);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="경비청구" title="경비부서집계표" lead="부서 · 사원별 청구액을 직전 청구와 비교합니다." />
      <Toolbar>
        <Field label="청구년월" className="w-40">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="부서" className="w-40">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">전체</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
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
        rows={rows}
        rowKey={(r) => r.emp.id}
        showFooter
        columns={[
          { key: 'dept', header: '부서', render: (r) => r.emp.dept, footer: '합계' },
          { key: 'name', header: '사용자', render: (r) => r.emp.name },
          { key: 'rank', header: '직급', render: (r) => r.emp.rank },
          { key: 'st', header: '결재상태', align: 'center', render: (r) => r.claim && <StatusBadge status={r.claim.status} /> },
          { key: 'amt', header: '소계', align: 'right', render: (r) => <Amount value={r.amount} />, footer: <Amount value={sum(rows, (r) => r.amount)} /> },
          { key: 'before', header: '직전청구금액', align: 'right', render: (r) => <Amount value={r.before} />, footer: <Amount value={sum(rows, (r) => r.before)} /> },
          {
            key: 'delta',
            header: '증감액',
            align: 'right',
            render: (r) => <Amount value={r.delta} tone={r.delta > 0 ? 'danger' : r.delta < 0 ? 'success' : undefined} />,
            footer: <Amount value={sum(rows, (r) => r.delta)} />,
          },
        ]}
      />
    </div>
  );
}

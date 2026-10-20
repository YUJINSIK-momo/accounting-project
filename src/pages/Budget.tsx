import { useState } from 'react';
import { Callout, PageHeader, Stat } from '../components/yuyu';
import { Amount, DataTable, Field, MoneyInput, Select, Toolbar } from '../components/app/ui';
import { accountName, update, useDB } from '../data/store';
import { budgetRows } from '../lib/budget';
import { sum, won } from '../lib/format';

export default function Budget() {
  const db = useDB();
  const year = '2026';
  const depts = [...new Set(db.budgets.map((b) => b.dept))];
  const [dept, setDept] = useState('all');
  const [onlyOver, setOnlyOver] = useState(false);

  const all = budgetRows(db, year);
  const rows = all
    .filter((r) => dept === 'all' || r.dept === dept)
    .filter((r) => !onlyOver || r.spent + r.pending > r.budget)
    .sort((a, b) => a.dept.localeCompare(b.dept) || a.accountCode.localeCompare(b.accountCode));
  const total = { budget: sum(rows, (r) => r.budget), spent: sum(rows, (r) => r.spent), pending: sum(rows, (r) => r.pending) };
  const over = all.filter((r) => r.spent + r.pending > r.budget).length;
  const rate = (r: { budget: number; spent: number; pending: number }) => (r.budget ? (r.spent + r.pending) / r.budget : 0);

  const setBudget = (d: string, acct: string, amount: number) =>
    update((x) => {
      const b = x.budgets.find((y) => y.year === year && y.dept === d && y.accountCode === acct);
      if (b) b.amount = amount;
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="예산 대비 집행" lead="부서 × 계정과목 연간 예산을 발행된 전표(집행)와 결재 중인 문서(진행)로 비교합니다. 지출결의서 · 경비청구를 쓸 때 예산 잔액이 함께 보입니다." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat value={`${won(total.budget)}원`} label={`${year}년 예산`} hint={dept === 'all' ? '전체 부서' : dept} />
        <Stat value={`${won(total.spent)}원`} label="집행액" hint="발행된 전표 기준" tone="infra" />
        <Stat value={`${Math.round(rate(total) * 1000) / 10}%`} label="집행률" hint={`결재 진행 ${won(total.pending)}원 포함`} tone={rate(total) > 1 ? 'danger' : 'success'} />
        <Stat value={`${over}건`} label="예산 초과 항목" hint="전체 부서 · 계정" tone={over ? 'danger' : 'success'} />
      </div>
      <Toolbar>
        <Field label="부서" className="w-44">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">전체</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <label className="flex h-9 items-center gap-2 self-end text-sm text-yuyu-fg-muted">
          <input type="checkbox" checked={onlyOver} onChange={(e) => setOnlyOver(e.target.checked)} />
          초과 항목만
        </label>
      </Toolbar>
      <DataTable
        exportName="예산대비집행"
        rows={rows}
        rowKey={(r) => `${r.dept}|${r.accountCode}`}
        dense
        showFooter
        maxHeight="60vh"
        columns={[
          { key: 'd', header: '부서', render: (r) => r.dept, footer: '합계' },
          { key: 'a', header: '계정과목', render: (r) => `${r.accountCode} ${accountName(db, r.accountCode)}` },
          { key: 'b', header: '연간 예산', align: 'right', width: '150px', render: (r) => <MoneyInput value={r.budget} onChange={(n) => setBudget(r.dept, r.accountCode, n)} />, footer: <Amount value={total.budget} /> },
          { key: 's', header: '집행', align: 'right', render: (r) => <Amount value={r.spent} />, footer: <Amount value={total.spent} /> },
          { key: 'p', header: '결재 진행', align: 'right', render: (r) => <Amount value={r.pending} />, footer: <Amount value={total.pending} /> },
          { key: 'l', header: '잔액', align: 'right', render: (r) => <Amount value={r.budget - r.spent - r.pending} tone={r.budget - r.spent - r.pending < 0 ? 'danger' : undefined} />, footer: <Amount value={total.budget - total.spent - total.pending} /> },
          {
            key: 'r',
            header: '집행률',
            width: '160px',
            render: (r) => (
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-yuyu-raised">
                  <div className={`h-full rounded-full ${rate(r) > 1 ? 'bg-yuyu-danger' : rate(r) > 0.8 ? 'bg-yuyu-warning' : 'bg-yuyu-success'}`} style={{ width: `${Math.min(100, rate(r) * 100)}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-xs">{Math.round(rate(r) * 1000) / 10}%</span>
              </div>
            ),
          },
        ]}
      />
      <Callout tone="brand" title="관리항목">
        예산 집행은 분개의 부서 관리항목으로 셉니다. 경비청구는 기안자 부서, 지출결의서는 사용부서, 급여는 직원 부서로 들어갑니다. 프로젝트 관리항목은 지출결의서에 적은 프로젝트가 분개에 함께 남습니다.
      </Callout>
    </div>
  );
}

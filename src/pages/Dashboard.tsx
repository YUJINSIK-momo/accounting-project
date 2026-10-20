import { useState } from 'react';
import { CreditCard, FileText, Receipt } from 'lucide-react';
import { Button, Card, FilterChips, PageHeader, Pipeline, SectionHeader, Stat } from '../components/yuyu';
import { Amount, BarList, DataTable, Field, Select } from '../components/app/ui';
import { empName, postedLines, usageName, useDB } from '../data/store';
import { ACCT } from '../lib/journal';
import { monthLabel, prevMonth, sum, won } from '../lib/format';
import { allDocs } from './Approvals';

type Dim = 'usage' | 'dept' | 'month';

export default function Dashboard() {
  const db = useDB();
  const periods = [...new Set(db.claims.map((c) => c.period))].sort().reverse();
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [dim, setDim] = useState<Dim>('usage');

  const counted = db.claims.filter((c) => c.status !== '작성중' && c.status !== '반려');
  const items = (ym: string) => counted.filter((c) => c.period === ym).flatMap((c) => c.items.map((i) => ({ ...i, empId: c.empId })));
  const now = items(period);
  const total = sum(now, (i) => i.amount);
  const prev = sum(items(prevMonth(period)), (i) => i.amount);
  const diff = total - prev;

  const group = (key: (i: (typeof now)[number]) => string) =>
    Object.entries(now.reduce<Record<string, number>>((acc, i) => ((acc[key(i)] = (acc[key(i)] ?? 0) + i.amount), acc), {}))
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  const bars =
    dim === 'usage'
      ? group((i) => usageName(db, i.usageCode))
      : dim === 'dept'
        ? group((i) => db.employees.find((e) => e.id === i.empId)?.dept ?? '-')
        : periods
            .slice(0, 6)
            .reverse()
            .map((p) => ({ label: monthLabel(p), value: sum(items(p), (i) => i.amount) }));

  const docs = allDocs(db);
  const pending = docs.filter((d) => d.status === '결재중');
  const unposted =
    db.claims.filter((c) => c.status === '결재완료' && !c.voucherId).length + db.disbursements.filter((d) => d.status === '결재완료' && !d.voucherId).length;
  const payable = postedLines(db)
    .filter((l) => l.accountCode === ACCT.PAYABLE || l.accountCode === ACCT.ACCRUED)
    .reduce((acc, l) => acc + (l.side === '대변' ? l.amount : -l.amount), 0);

  const top = [...now].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="현황" title="경비현황분석" lead="결재가 올라간 경비청구를 기준으로 용도 · 부서 · 기간별 사용액을 봅니다.">
        <Pipeline
          nodes={[
            { label: '카드 내역', sub: '사용 내역 수집', tone: 'neutral' },
            { label: '경비청구', sub: '용도 · 내용 입력', tone: 'brand' },
            { label: '결재', sub: '승인 · 반려', tone: 'warning', human: true },
            { label: '분개 · 전표발행', sub: '용도 → 계정과목', tone: 'infra' },
            { label: '장부', sub: '원장 · 시산표', tone: 'success' },
          ]}
        />
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="청구년월" className="w-40">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={`${won(total)}원`} label={`${monthLabel(period)} 청구액`} hint={`${now.length}건 · 결재중 포함`} />
        <Stat value={`${diff >= 0 ? '+' : ''}${won(diff)}원`} label="전월 대비" hint={`전월 ${won(prev)}원`} tone={diff > 0 ? 'warning' : 'success'} />
        <Stat value={`${pending.length}건`} label="결재 대기" hint="결재함에서 처리" tone="warning" />
        <Stat value={`${won(payable)}원`} label="미지급 잔액" hint={`전표 미발행 문서 ${unposted}건`} tone="infra" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-yuyu-fg">경비현황</h2>
            <FilterChips<Dim>
              label="분석 기준"
              value={dim}
              onChange={setDim}
              options={[
                { value: 'usage', label: '용도별' },
                { value: 'dept', label: '조직별' },
                { value: 'month', label: '기간별' },
              ]}
            />
          </div>
          <BarList items={bars} format={(n) => `${won(n)}원`} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-yuyu-fg">빠른 이동</h2>
          <div className="grid gap-2">
            <Button to="/claims/new" variant="outline" icon={CreditCard}>
              경비청구작성
            </Button>
            <Button to="/disbursements/new" variant="outline" icon={FileText}>
              지출결의서 작성
            </Button>
            <Button to="/vouchers" variant="outline" icon={Receipt}>
              전표처리 ({unposted}건 대기)
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader title="큰 금액 사용 5건" description={`${monthLabel(period)} 결재가 올라간 청구 기준`} />
        <DataTable
          rows={top}
          rowKey={(i) => i.id}
          dense
          columns={[
            { key: 'at', header: '사용일시', render: (i) => <span className="font-mono text-xs">{i.usedAt}</span> },
            { key: 'emp', header: '사원', render: (i) => empName(db, i.empId) },
            { key: 'm', header: '사용처', render: (i) => i.merchant },
            { key: 'u', header: '용도', render: (i) => usageName(db, i.usageCode) },
            { key: 'amt', header: '금액', align: 'right', render: (i) => <Amount value={i.amount} /> },
          ]}
        />
      </div>
    </div>
  );
}

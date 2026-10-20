import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button, Callout, Card, PageHeader, Stat } from '../components/yuyu';
import { DataTable, Field, Input, MoneyInput, Select, Toolbar } from '../components/app/ui';
import { useDB } from '../data/store';
import { grossPay, severance } from '../lib/payroll';
import { sum, today, won } from '../lib/format';

export default function Severance() {
  const db = useDB();
  const [empId, setEmpId] = useState(db.currentEmpId);
  const emp = db.employees.find((e) => e.id === empId)!;
  const confirmed = db.payrolls.filter((r) => r.status === '확정').sort((a, b) => b.ym.localeCompare(a.ym));
  const lineOf = (ym: string) => confirmed.find((r) => r.ym === ym)?.lines.find((l) => l.empId === empId);

  // 기본값: 최근 확정 3개월 급여(상여 제외), 최근 12개월 상여
  const last3 = confirmed.slice(0, 3).map((r) => r.lines.find((l) => l.empId === empId)!);
  const [leaveDate, setLeaveDate] = useState(today());
  const [wage3, setWage3] = useState(() => sum(last3, (l) => grossPay(l) - l.bonus));
  const [bonus, setBonus] = useState(() => sum(confirmed.slice(0, 12), (r) => lineOf(r.ym)?.bonus ?? 0));
  const [leavePay, setLeavePay] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof severance>>();

  const pick = (id: string) => {
    setEmpId(id);
    const l3 = confirmed.slice(0, 3).map((r) => r.lines.find((l) => l.empId === id)!);
    setWage3(sum(l3, (l) => grossPay(l) - l.bonus));
    setBonus(sum(confirmed.slice(0, 12), (r) => r.lines.find((l) => l.empId === id)?.bonus ?? 0));
    setResult(undefined);
  };

  const run = () => setResult(severance({ joinDate: emp.joinDate, leaveDate, last3Months: wage3, annualBonus: bonus, annualLeavePay: leavePay }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="급여 · 세무" title="퇴직금 시뮬레이션" lead="입사일 · 퇴직일과 최근 3개월 임금으로 1일 평균임금을 구하고, 재직일수에 비례해 퇴직금 예상액을 계산합니다." />
      <Toolbar>
        <Field label="사원" className="w-44">
          <Select value={empId} onChange={(e) => pick(e.target.value)}>
            {db.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.dept}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="입사일자" className="w-40">
          <Input type="date" value={emp.joinDate} disabled />
        </Field>
        <Field label="퇴직일자" className="w-40">
          <Input type="date" value={leaveDate} onChange={(e) => (setLeaveDate(e.target.value), setResult(undefined))} />
        </Field>
        <Field label="최근 3개월 급여" className="w-40">
          <MoneyInput value={wage3} onChange={(n) => (setWage3(n), setResult(undefined))} />
        </Field>
        <Field label="최근 1년 상여" className="w-36">
          <MoneyInput value={bonus} onChange={(n) => (setBonus(n), setResult(undefined))} />
        </Field>
        <Field label="연차수당" className="w-32">
          <MoneyInput value={leavePay} onChange={(n) => (setLeavePay(n), setResult(undefined))} />
        </Field>
        <Button icon={Calculator} onClick={run} className="self-end">
          퇴직금 계산
        </Button>
      </Toolbar>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat value={`${won(result.amount)}원`} label="퇴직금 예상액" tone={result.eligible ? 'success' : 'danger'} hint={result.eligible ? '' : '재직 1년 미만이라 지급 대상이 아닙니다'} />
            <Stat value={`${won(result.days)}일`} label="재직일수" tone="infra" hint={`약 ${Math.floor(result.days / 30.4)}개월`} />
            <Stat value={`${won(result.dailyAvg)}원`} label="1일 평균임금" tone="brand" />
            <Stat value={`${won(result.wageTotal)}원`} label="3개월 임금총액" tone="neutral" hint={`상여 · 연차수당 3/12 포함 · ${result.periodDays}일`} />
          </div>
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-yuyu-fg">계산식</h2>
            <DataTable
              rows={[
                { k: '3개월 임금총액', v: result.wageTotal, how: `최근 3개월 급여 ${won(wage3)} + 상여 ${won(bonus)} × 3/12 + 연차수당 ${won(leavePay)} × 3/12` },
                { k: '1일 평균임금', v: result.dailyAvg, how: `3개월 임금총액 ÷ 퇴직 전 3개월 일수 ${result.periodDays}일` },
                { k: '퇴직금', v: result.amount, how: `1일 평균임금 × 30일 × 재직일수 ${result.days}일 ÷ 365` },
              ]}
              rowKey={(r) => r.k}
              columns={[
                { key: 'k', header: '계산항목', render: (r) => r.k },
                { key: 'v', header: '금액', align: 'right', render: (r) => <span className="font-mono">{won(r.v)}</span> },
                { key: 'how', header: '계산방법', render: (r) => <span className="text-yuyu-fg-muted">{r.how}</span> },
              ]}
            />
          </Card>
        </>
      ) : (
        <Callout tone="brand" title="퇴직금계산 버튼을 누르세요">
          최근 3개월 급여와 상여는 확정된 급여대장에서 가져왔습니다. 1일 평균임금이 통상임금보다 적으면 통상임금으로 계산해야 하지만, 이 모의 계산에서는 다루지 않습니다.
        </Callout>
      )}
    </div>
  );
}

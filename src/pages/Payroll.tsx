import { useState } from 'react';
import { CheckCircle2, FilePlus2, Plus, Receipt } from 'lucide-react';
import { Button, Callout, PageHeader, Stat } from '../components/yuyu';
import { Amount, DataTable, Field, MoneyInput, Select, Toolbar, toast } from '../components/app/ui';
import { addVoucher, empName, update, useDB } from '../data/store';
import { payrollJournal } from '../data/seed';
import { notify } from '../lib/approval';
import { calcLine, deductionTotal, grossPay, netPay } from '../lib/payroll';
import { monthLabel, sum, won } from '../lib/format';
import type { PayrollLine } from '../types';

const nextYm = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Payroll() {
  const db = useDB();
  const runs = [...db.payrolls].sort((a, b) => b.ym.localeCompare(a.ym));
  const [ym, setYm] = useState(runs[0]?.ym ?? '');
  const run = db.payrolls.find((r) => r.ym === ym);
  const editable = run?.status === '작성중';

  const edit = (empId: string, patch: Partial<Pick<PayrollLine, 'overtime' | 'bonus'>>) =>
    update((d) => {
      const r = d.payrolls.find((x) => x.ym === ym)!;
      const i = r.lines.findIndex((l) => l.empId === empId);
      const old = r.lines[i];
      const emp = d.employees.find((e) => e.id === empId)!;
      r.lines[i] = calcLine(d.rates, emp, { base: old.base, overtime: old.overtime, bonus: old.bonus, meal: old.meal, car: old.car, ...patch });
    });

  const createNext = () => {
    const ym2 = runs[0] ? nextYm(runs[0].ym) : new Date().toISOString().slice(0, 7);
    update((d) => {
      d.payrolls.push({
        id: `pr-${ym2}`,
        ym: ym2,
        payDate: `${nextYm(ym2)}-10`,
        status: '작성중',
        lines: d.employees.map((e) => calcLine(d.rates, e, { base: e.baseSalary, overtime: 0, bonus: 0, meal: 200000, car: e.dept === '영업팀' ? 200000 : 0 })),
      });
    });
    setYm(ym2);
    toast(`${monthLabel(ym2)} 급여대장을 만들었습니다.`);
  };

  const recalc = () =>
    update((d) => {
      const r = d.payrolls.find((x) => x.ym === ym)!;
      r.lines = r.lines.map((l) => calcLine(d.rates, d.employees.find((e) => e.id === l.empId)!, { base: l.base, overtime: l.overtime, bonus: l.bonus, meal: l.meal, car: l.car }));
    });

  const confirm = () => {
    update((d) => {
      const r = d.payrolls.find((x) => x.ym === ym)!;
      r.status = '확정';
      r.lines.forEach((l) => notify(d, l.empId, '급여', `${monthLabel(r.ym)} 급여명세서가 발행되었습니다`, `지급일 ${r.payDate} · 차인지급액 ${won(netPay(l))}원`, '/payslips'));
    });
    toast('급여를 확정했습니다. 직원들에게 명세서 알림이 갔습니다.');
  };

  const issueVoucher = () => {
    update((d) => {
      const r = d.payrolls.find((x) => x.ym === ym)!;
      r.voucherId = addVoucher(d, { date: r.payDate, kind: '급여', sourceId: r.id, memo: `${r.ym} 급여`, lines: payrollJournal(r, d.employees), status: '발행' });
    });
    toast('급여 전표를 발행했습니다.');
  };

  const lines = run?.lines ?? [];
  const total = (f: (l: PayrollLine) => number) => sum(lines, f);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="급여 · 세무" title="급여대장" lead="기본급 · 수당 · 상여와 4대보험 · 원천세를 계산하고, 확정하면 명세서 알림이 가고 급여 전표를 발행할 수 있습니다." />
      <Toolbar>
        <Field label="귀속년월" className="w-40">
          <Select value={ym} onChange={(e) => setYm(e.target.value)}>
            {runs.map((r) => (
              <option key={r.ym} value={r.ym}>
                {monthLabel(r.ym)} · {r.status}
              </option>
            ))}
          </Select>
        </Field>
        <span className="self-center text-sm text-yuyu-fg-muted">지급일 {run?.payDate}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon={Plus} onClick={createNext}>
            다음 달 급여대장
          </Button>
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={recalc}>
                요율로 다시 계산
              </Button>
              <Button size="sm" icon={CheckCircle2} onClick={confirm}>
                급여 확정
              </Button>
            </>
          )}
          {run?.status === '확정' && !run.voucherId && (
            <Button size="sm" icon={FilePlus2} onClick={issueVoucher}>
              급여 전표 발행
            </Button>
          )}
          {run?.voucherId && (
            <span className="flex items-center gap-1 self-center text-xs text-yuyu-success">
              <Receipt size={14} /> 전표 {db.vouchers.find((v) => v.id === run.voucherId)?.no}
            </span>
          )}
        </div>
      </Toolbar>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat value={`${won(total(grossPay))}원`} label="지급합계" />
        <Stat value={`${won(total(deductionTotal))}원`} label="공제합계" tone="warning" />
        <Stat value={`${won(total(netPay))}원`} label="차인지급액" tone="success" />
        <Stat value={`${won(total((l) => l.incomeTax + l.localTax))}원`} label="원천세(소득세+지방세)" tone="infra" />
      </div>

      <DataTable
        exportName="급여대장"
        rows={lines}
        rowKey={(l) => l.empId}
        dense
        showFooter
        columns={[
          { key: 'n', header: '사원', render: (l) => <span className="whitespace-nowrap">{empName(db, l.empId)}</span>, footer: '합계' },
          { key: 'base', header: '기본급', align: 'right', render: (l) => <Amount value={l.base} />, footer: <Amount value={total((l) => l.base)} /> },
          { key: 'ot', header: '연장수당', align: 'right', width: '120px', render: (l) => (editable ? <MoneyInput value={l.overtime} onChange={(n) => edit(l.empId, { overtime: n })} /> : <Amount value={l.overtime} />), footer: <Amount value={total((l) => l.overtime)} /> },
          { key: 'bonus', header: '상여', align: 'right', width: '120px', render: (l) => (editable ? <MoneyInput value={l.bonus} onChange={(n) => edit(l.empId, { bonus: n })} /> : <Amount value={l.bonus} />), footer: <Amount value={total((l) => l.bonus)} /> },
          { key: 'meal', header: '식대', align: 'right', render: (l) => <Amount value={l.meal} /> },
          { key: 'car', header: '자가운전', align: 'right', render: (l) => <Amount value={l.car} /> },
          { key: 'g', header: '지급합계', align: 'right', render: (l) => <Amount value={grossPay(l)} />, footer: <Amount value={total(grossPay)} /> },
          { key: 'p', header: '국민연금', align: 'right', render: (l) => <Amount value={l.pension} />, footer: <Amount value={total((l) => l.pension)} /> },
          { key: 'h', header: '건강보험', align: 'right', render: (l) => <Amount value={l.health} />, footer: <Amount value={total((l) => l.health)} /> },
          { key: 'c', header: '장기요양', align: 'right', render: (l) => <Amount value={l.care} />, footer: <Amount value={total((l) => l.care)} /> },
          { key: 'e', header: '고용보험', align: 'right', render: (l) => <Amount value={l.employment} />, footer: <Amount value={total((l) => l.employment)} /> },
          { key: 'it', header: '소득세', align: 'right', render: (l) => <Amount value={l.incomeTax} />, footer: <Amount value={total((l) => l.incomeTax)} /> },
          { key: 'lt', header: '지방소득세', align: 'right', render: (l) => <Amount value={l.localTax} />, footer: <Amount value={total((l) => l.localTax)} /> },
          { key: 'd', header: '공제합계', align: 'right', render: (l) => <Amount value={deductionTotal(l)} />, footer: <Amount value={total(deductionTotal)} /> },
          { key: 'net', header: '차인지급액', align: 'right', render: (l) => <span className="font-semibold"><Amount value={netPay(l)} /></span>, footer: <Amount value={total(netPay)} /> },
        ]}
      />
      <Callout tone="warning" title="요율과 원천세는 예시 계산입니다">
        4대보험 요율은 기초정보관리 › 요율에서 바꿀 수 있습니다. 소득세는 간이세액표 대신 연간 환산 방식(근로소득공제 · 인적공제 · 근로소득세액공제 · 표준세액공제)으로 근사합니다. 실제 지급 전에는 고시된 요율과 간이세액표로 확인해야 합니다.
      </Callout>
    </div>
  );
}

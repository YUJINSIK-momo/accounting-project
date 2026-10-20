import { useState } from 'react';
import { PageHeader, Stat } from '../components/yuyu';
import { Amount, DataTable, Field, MoneyInput, Select, Tabs, Toolbar } from '../components/app/ui';
import { KeyValue, Paper, PaperTable, PaperTitle, PrintButton, PrintPortal } from '../components/app/print';
import { useDB } from '../data/store';
import { FINANCE_LEAD } from '../lib/approval';
import { calcLine, taxablePay, yearEnd } from '../lib/payroll';
import { sum, won } from '../lib/format';

type Tab = 'ledger' | 'calc';
const YEAR = '2026';

export default function YearEnd() {
  const db = useDB();
  const canAll = db.currentEmpId === FINANCE_LEAD;
  const [empId, setEmpId] = useState(db.currentEmpId);
  const target = canAll ? empId : db.currentEmpId;
  const emp = db.employees.find((e) => e.id === target)!;
  const [tab, setTab] = useState<Tab>('ledger');
  const [extra, setExtra] = useState({ cardSpend: 18_000_000, lifeInsurance: 800_000, medical: 1_200_000, education: 0, donation: 300_000 });

  // 1~12월: 확정된 달은 급여대장 값, 나머지는 기본급 기준 추정
  const months = Array.from({ length: 12 }, (_, i) => `${YEAR}-${String(i + 1).padStart(2, '0')}`).map((ym) => {
    const run = db.payrolls.find((r) => r.ym === ym && r.status === '확정');
    const line = run?.lines.find((l) => l.empId === target);
    if (line) return { ym, payDate: run!.payDate, line, estimated: false };
    return { ym, payDate: '', line: calcLine(db.rates, emp, { base: emp.baseSalary, overtime: 0, bonus: 0, meal: 200000, car: emp.dept === '영업팀' ? 200000 : 0 }), estimated: true };
  });
  const actual = months.filter((m) => !m.estimated);

  const totalSalary = sum(months, (m) => taxablePay(m.line, db.rates));
  const pension = sum(months, (m) => m.line.pension);
  const insurance = sum(months, (m) => m.line.health + m.line.care + m.line.employment);
  const withheld = sum(months, (m) => m.line.incomeTax);
  const r = yearEnd({ totalSalary, dependents: emp.dependents, pension, insurance, ...extra });
  const diff = r.determined - withheld;

  const rows: Array<[string, number, string]> = [
    ['총급여', totalSalary, `확정 ${actual.length}개월 + 추정 ${12 - actual.length}개월 (비과세 제외)`],
    ['근로소득공제', -r.earnedDeduction, '총급여 구간별 공제율, 한도 2천만 원'],
    ['근로소득금액', r.earnedIncome, ''],
    ['인적공제', -r.personal, `기본공제 ${emp.dependents}명 × 150만 원`],
    ['연금보험료공제', -pension, '국민연금 근로자 부담분'],
    ['특별소득공제(보험료)', -insurance, '건강 · 장기요양 · 고용보험'],
    ['신용카드 등 소득공제', -r.card, '총급여 25% 초과 사용분 × 15%, 한도 적용'],
    ['과세표준', r.taxBase, ''],
    ['산출세액', r.tax, '과세표준 구간별 세율 6~45%'],
    ['근로소득세액공제', -r.earnedCredit, '총급여별 한도 적용'],
    [r.special ? '특별세액공제' : '표준세액공제', -(r.special || r.standard), r.special ? '보장성보험 12% · 의료비 15% · 교육비 15% · 기부금 15%' : '특별세액공제가 없으면 13만 원'],
    ['결정세액', r.determined, ''],
    ['기납부세액', -withheld, '매월 원천징수한 소득세'],
    [diff >= 0 ? '추가 납부할 세액' : '환급받을 세액', Math.abs(diff), '지방소득세 10% 별도'],
  ];

  const paper = (
    <Paper>
      <PaperTitle>연말정산 모의 계산서</PaperTitle>
      <KeyValue items={[['회사', db.company], ['귀속연도', YEAR], ['성명', emp.name], ['부서', `${emp.dept} · ${emp.rank}`]]} />
      <PaperTable head={['항목', '금액', '비고']} rows={rows.map(([k, v, note]) => [k, <span className="block text-right">{won(v)}</span>, note])} />
      <p className="mt-3 text-[11px] text-yuyu-fg-muted">단순화한 모의 계산입니다. 자녀세액공제 · 주택자금 · 연금계좌 등은 넣지 않았습니다.</p>
    </Paper>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="급여 · 세무" title="연말정산" lead="근로소득 원천징수부로 월별 원천세를 확인하고, 공제 자료를 넣어 환급 · 추가납부를 미리 계산합니다." />
      <Toolbar>
        <Field label="사원" className="w-48">
          <Select value={target} disabled={!canAll} onChange={(e) => setEmpId(e.target.value)}>
            {db.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.dept}
              </option>
            ))}
          </Select>
        </Field>
        <span className="self-center text-xs text-yuyu-fg-muted">
          입사 {emp.joinDate} · 기본공제 {emp.dependents}명
        </span>
      </Toolbar>
      <Tabs<Tab>
        tabs={[
          { value: 'ledger', label: '근로소득 원천징수부' },
          { value: 'calc', label: '연말정산 모의계산' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'ledger' && (
        <DataTable
        exportName="근로소득원천징수부"
          rows={months}
          rowKey={(m) => m.ym}
          dense
          showFooter
          columns={[
            { key: 'ym', header: '귀속월', render: (m) => <span className={m.estimated ? 'text-yuyu-fg-subtle' : ''}>{m.ym}{m.estimated ? ' (추정)' : ''}</span>, footer: '합계' },
            { key: 'pay', header: '지급일', render: (m) => <span className="font-mono text-xs">{m.payDate || '-'}</span> },
            { key: 'tx', header: '과세급여', align: 'right', render: (m) => <Amount value={taxablePay(m.line, db.rates)} />, footer: <Amount value={sum(actual, (m) => taxablePay(m.line, db.rates))} /> },
            { key: 'nt', header: '비과세', align: 'right', render: (m) => <Amount value={Math.min(m.line.meal, db.rates.mealExempt) + Math.min(m.line.car, db.rates.carExempt)} /> },
            { key: 'p', header: '국민연금', align: 'right', render: (m) => <Amount value={m.line.pension} />, footer: <Amount value={sum(actual, (m) => m.line.pension)} /> },
            { key: 'h', header: '건강 · 장기요양', align: 'right', render: (m) => <Amount value={m.line.health + m.line.care} />, footer: <Amount value={sum(actual, (m) => m.line.health + m.line.care)} /> },
            { key: 'e', header: '고용보험', align: 'right', render: (m) => <Amount value={m.line.employment} />, footer: <Amount value={sum(actual, (m) => m.line.employment)} /> },
            { key: 'it', header: '소득세', align: 'right', render: (m) => <Amount value={m.line.incomeTax} />, footer: <Amount value={sum(actual, (m) => m.line.incomeTax)} /> },
            { key: 'lt', header: '지방소득세', align: 'right', render: (m) => <Amount value={m.line.localTax} />, footer: <Amount value={sum(actual, (m) => m.line.localTax)} /> },
          ]}
        />
      )}

      {tab === 'calc' && (
        <div className="space-y-4">
          <Toolbar>
            {(
              [
                ['cardSpend', '신용카드 등 사용액'],
                ['lifeInsurance', '보장성 보험료'],
                ['medical', '의료비'],
                ['education', '교육비'],
                ['donation', '기부금'],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label} className="w-40">
                <MoneyInput value={extra[k]} onChange={(n) => setExtra({ ...extra, [k]: n })} />
              </Field>
            ))}
            <div className="ml-auto self-end">
              <PrintButton />
            </div>
          </Toolbar>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={`${won(r.determined)}원`} label="결정세액" tone="brand" />
            <Stat value={`${won(withheld)}원`} label="기납부세액" tone="neutral" />
            <Stat value={`${diff >= 0 ? '+' : '−'}${won(Math.abs(diff))}원`} label={diff >= 0 ? '추가 납부' : '환급 예상'} tone={diff >= 0 ? 'danger' : 'success'} hint={`지방소득세 ${won(Math.abs(Math.floor(diff * 0.1)))}원 별도`} />
          </div>
          <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-bg p-3">{paper}</div>
          <PrintPortal>{paper}</PrintPortal>
        </div>
      )}
    </div>
  );
}

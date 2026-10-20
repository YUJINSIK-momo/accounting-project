import { useState } from 'react';
import { PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Modal, Select, Toolbar } from '../components/app/ui';
import { KeyValue, Paper, PaperTable, PaperTitle, PrintButton, PrintPortal } from '../components/app/print';
import { useDB } from '../data/store';
import { FINANCE_LEAD } from '../lib/approval';
import { deductionTotal, grossPay, netPay, taxablePay } from '../lib/payroll';
import { monthLabel, sum, won } from '../lib/format';
import type { DB, PayrollRun } from '../types';

function PayslipPaper({ db, run, empId }: { db: DB; run: PayrollRun; empId: string }) {
  const l = run.lines.find((x) => x.empId === empId)!;
  const e = db.employees.find((x) => x.id === empId)!;
  const pay: Array<[string, number]> = [
    ['기본급', l.base],
    ['연장근로수당', l.overtime],
    ['상여금', l.bonus],
    ['식대(비과세)', l.meal],
    ['자가운전보조금(비과세)', l.car],
  ];
  const ded: Array<[string, number]> = [
    ['국민연금', l.pension],
    ['건강보험', l.health],
    ['장기요양보험', l.care],
    ['고용보험', l.employment],
    ['소득세', l.incomeTax],
    ['지방소득세', l.localTax],
  ];
  const rows = Array.from({ length: Math.max(pay.length, ded.length) }, (_, i) => [pay[i]?.[0] ?? '', pay[i] ? <span className="block text-right">{won(pay[i][1])}</span> : '', ded[i]?.[0] ?? '', ded[i] ? <span className="block text-right">{won(ded[i][1])}</span> : '']);
  return (
    <Paper>
      <PaperTitle>급여명세서</PaperTitle>
      <KeyValue
        items={[
          ['회사', db.company],
          ['귀속년월', monthLabel(run.ym)],
          ['성명', e.name],
          ['지급일', run.payDate],
          ['부서', e.dept],
          ['직급', e.rank],
        ]}
      />
      <PaperTable head={['지급항목', '금액', '공제항목', '금액']} rows={rows} foot={['지급합계', <span className="block text-right">{won(grossPay(l))}</span>, '공제합계', <span className="block text-right">{won(deductionTotal(l))}</span>]} />
      <div className="mt-4 flex items-center justify-between border border-yuyu-line-strong px-3 py-2">
        <span className="font-semibold">차인지급액</span>
        <span className="text-lg font-bold">{won(netPay(l))}원</span>
      </div>
      <p className="mt-3 text-[11px] text-yuyu-fg-muted">
        과세대상 급여 {won(taxablePay(l, db.rates))}원 · 입금계좌 {e.bank} {e.accountNo} · 귀하의 노고에 감사드립니다.
      </p>
    </Paper>
  );
}

export default function Payslips() {
  const db = useDB();
  // 경영지원팀장은 전 직원 명세서를, 나머지는 본인 것만 본다
  const canAll = db.currentEmpId === FINANCE_LEAD;
  const [empId, setEmpId] = useState(db.currentEmpId);
  const target = canAll ? empId : db.currentEmpId;
  const runs = db.payrolls.filter((r) => r.status === '확정').sort((a, b) => b.ym.localeCompare(a.ym));
  const [open, setOpen] = useState<string>();
  const opened = runs.find((r) => r.id === open);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="급여 · 세무" title="급여명세서" lead="확정된 급여의 명세서를 보고 PDF 로 저장합니다. 경영지원팀장은 전 직원 명세서를 볼 수 있습니다." />
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
      </Toolbar>
      <DataTable
        exportName="급여명세서목록"
        rows={runs}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r.id)}
        showFooter
        columns={[
          { key: 'ym', header: '귀속년월', render: (r) => r.ym, footer: '합계' },
          { key: 'pay', header: '지급일자', render: (r) => <span className="font-mono text-xs">{r.payDate}</span> },
          { key: 't', header: '명세서 제목', render: (r) => `${monthLabel(r.ym)} 급여명세서` },
          { key: 'g', header: '지급합계', align: 'right', render: (r) => <Amount value={grossPay(r.lines.find((l) => l.empId === target)!)} />, footer: <Amount value={sum(runs, (r) => grossPay(r.lines.find((l) => l.empId === target)!))} /> },
          { key: 'd', header: '공제합계', align: 'right', render: (r) => <Amount value={deductionTotal(r.lines.find((l) => l.empId === target)!)} />, footer: <Amount value={sum(runs, (r) => deductionTotal(r.lines.find((l) => l.empId === target)!))} /> },
          { key: 'n', header: '차인지급액', align: 'right', render: (r) => <Amount value={netPay(r.lines.find((l) => l.empId === target)!)} />, footer: <Amount value={sum(runs, (r) => netPay(r.lines.find((l) => l.empId === target)!))} /> },
          { key: 'v', header: '급여명세서보기', align: 'center', render: () => <span className="text-xs text-yuyu-brand">상세보기</span> },
        ]}
      />
      <Modal open={!!opened} title="급여명세서" onClose={() => setOpen(undefined)} width="max-w-3xl" footer={<PrintButton />}>
        {opened && (
          <>
            <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-bg p-3">
              <PayslipPaper db={db} run={opened} empId={target} />
            </div>
            <PrintPortal>
              <PayslipPaper db={db} run={opened} empId={target} />
            </PrintPortal>
          </>
        )}
      </Modal>
    </div>
  );
}

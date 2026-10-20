import { Callout, PageHeader } from '../components/yuyu';
import { Amount, DataTable } from '../components/app/ui';
import { postedLines, useDB } from '../data/store';
import { sum } from '../lib/format';

export default function TrialBalance() {
  const db = useDB();
  const posted = postedLines(db);
  const rows = db.accounts
    .map((a) => {
      const debit = sum(posted.filter((l) => l.accountCode === a.code && l.side === '차변'), (l) => l.amount);
      const credit = sum(posted.filter((l) => l.accountCode === a.code && l.side === '대변'), (l) => l.amount);
      const net = debit - credit;
      return { a, debit, credit, debitBal: net > 0 ? net : 0, creditBal: net < 0 ? -net : 0 };
    })
    .filter((r) => r.debit || r.credit);

  const tot = {
    debit: sum(rows, (r) => r.debit),
    credit: sum(rows, (r) => r.credit),
    debitBal: sum(rows, (r) => r.debitBal),
    creditBal: sum(rows, (r) => r.creditBal),
  };
  const ok = tot.debit === tot.credit && tot.debitBal === tot.creditBal;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="합계잔액시산표" lead="발행된 전표 전체를 계정과목별 합계와 잔액으로 모읍니다. 차변과 대변 합이 같아야 장부가 맞습니다." />
      <Callout tone={ok ? 'success' : 'danger'} title={ok ? '대차가 일치합니다' : '대차가 맞지 않습니다'}>
        차변 합계 {tot.debit.toLocaleString('ko-KR')}원 · 대변 합계 {tot.credit.toLocaleString('ko-KR')}원
      </Callout>
      <DataTable
        rows={rows}
        rowKey={(r) => r.a.code}
        showFooter
        columns={[
          { key: 'db', header: '차변 잔액', align: 'right', render: (r) => (r.debitBal ? <Amount value={r.debitBal} /> : null), footer: <Amount value={tot.debitBal} /> },
          { key: 'dt', header: '차변 합계', align: 'right', render: (r) => <Amount value={r.debit} />, footer: <Amount value={tot.debit} /> },
          { key: 'acct', header: '계정과목', align: 'center', render: (r) => `${r.a.code} ${r.a.name}`, footer: '합계' },
          { key: 'type', header: '구분', align: 'center', render: (r) => <span className="text-xs text-yuyu-fg-muted">{r.a.type}</span> },
          { key: 'ct', header: '대변 합계', align: 'right', render: (r) => <Amount value={r.credit} />, footer: <Amount value={tot.credit} /> },
          { key: 'cb', header: '대변 잔액', align: 'right', render: (r) => (r.creditBal ? <Amount value={r.creditBal} /> : null), footer: <Amount value={tot.creditBal} /> },
        ]}
      />
    </div>
  );
}

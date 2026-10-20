import { useState } from 'react';
import { PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Select, Toolbar } from '../components/app/ui';
import { postedLines, useDB } from '../data/store';
import { sum } from '../lib/format';

// 자산 · 비용은 차변이, 부채 · 자본 · 수익은 대변이 늘어나는 쪽이다
export const debitNormal = (type: string) => type === '자산' || type === '비용';

export default function GeneralLedger() {
  const db = useDB();
  const posted = postedLines(db);
  const used = db.accounts.filter((a) => posted.some((l) => l.accountCode === a.code));
  const [code, setCode] = useState(used.find((a) => a.code === '253')?.code ?? used[0]?.code ?? '');
  const account = db.accounts.find((a) => a.code === code);

  let running = 0;
  const rows = posted
    .filter((l) => l.accountCode === code)
    .map((l, i) => {
      const signed = (l.side === '차변' ? 1 : -1) * l.amount * (account && debitNormal(account.type) ? 1 : -1);
      running += signed;
      return { ...l, i, balance: running };
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="총계정원장" lead="계정과목 하나를 골라 발행된 전표의 증감과 잔액을 봅니다." />
      <Toolbar>
        <Field label="계정과목" className="w-60">
          <Select value={code} onChange={(e) => setCode(e.target.value)}>
            {used.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name} ({a.type})
              </option>
            ))}
          </Select>
        </Field>
        <span className="ml-auto self-center text-xs text-yuyu-fg-muted">
          잔액 기준: {account && debitNormal(account.type) ? '차변 − 대변' : '대변 − 차변'}
        </span>
      </Toolbar>
      <DataTable
        exportName="총계정원장"
        rows={rows}
        rowKey={(l) => `${l.voucher.id}-${l.i}`}
        dense
        showFooter
        maxHeight="65vh"
        columns={[
          { key: 'date', header: '일자', render: (l) => <span className="font-mono text-xs">{l.voucher.date}</span>, footer: '합계' },
          { key: 'no', header: '전표번호', render: (l) => <span className="font-mono text-xs">{l.voucher.no}</span> },
          { key: 'memo', header: '적요', render: (l) => l.memo },
          { key: 'v', header: '거래처', render: (l) => <span className="text-yuyu-fg-muted">{l.vendor || '-'}</span> },
          { key: 'd', header: '차변', align: 'right', render: (l) => (l.side === '차변' ? <Amount value={l.amount} /> : null), footer: <Amount value={sum(rows.filter((l) => l.side === '차변'), (l) => l.amount)} /> },
          { key: 'c', header: '대변', align: 'right', render: (l) => (l.side === '대변' ? <Amount value={l.amount} /> : null), footer: <Amount value={sum(rows.filter((l) => l.side === '대변'), (l) => l.amount)} /> },
          { key: 'b', header: '잔액', align: 'right', render: (l) => <Amount value={l.balance} />, footer: <Amount value={running} /> },
        ]}
      />
    </div>
  );
}

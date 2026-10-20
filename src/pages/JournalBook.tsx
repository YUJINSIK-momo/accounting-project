import { useState } from 'react';
import { PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Input, Select, Toolbar } from '../components/app/ui';
import { accountName, postedLines, useDB } from '../data/store';
import { sum } from '../lib/format';
import type { Voucher } from '../types';

export default function JournalBook() {
  const db = useDB();
  const dates = db.vouchers.map((v) => v.date).sort();
  const [from, setFrom] = useState(dates[0] ?? '');
  const [to, setTo] = useState(dates[dates.length - 1] ?? '');
  const [kind, setKind] = useState<'all' | Voucher['kind']>('all');

  const lines = postedLines(db)
    .filter((l) => (!from || l.voucher.date >= from) && (!to || l.voucher.date <= to))
    .filter((l) => kind === 'all' || l.voucher.kind === kind)
    .map((l, i) => ({ ...l, i }));
  const debit = sum(lines.filter((l) => l.side === '차변'), (l) => l.amount);
  const credit = sum(lines.filter((l) => l.side === '대변'), (l) => l.amount);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="분개장" lead="발행된 전표의 분개를 날짜순으로 봅니다." />
      <Toolbar>
        <Field label="시작일">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="종료일">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="전표구분" className="w-36">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">전체</option>
            <option>경비</option>
            <option>지출결의</option>
            <option>지급</option>
          </Select>
        </Field>
        <span className="ml-auto self-center text-xs text-yuyu-fg-muted">
          전표 {new Set(lines.map((l) => l.voucher.id)).size}장 · 분개 {lines.length}줄 · {debit === credit ? '대차 일치' : '대차 불일치'}
        </span>
      </Toolbar>
      <DataTable
        rows={lines}
        rowKey={(l) => `${l.voucher.id}-${l.i}`}
        dense
        showFooter
        maxHeight="65vh"
        columns={[
          { key: 'date', header: '일자', render: (l) => <span className="font-mono text-xs">{l.voucher.date}</span>, footer: '합계' },
          { key: 'no', header: '전표번호', render: (l) => <span className="font-mono text-xs">{l.voucher.no}</span> },
          { key: 'k', header: '구분', render: (l) => <span className="text-xs text-yuyu-fg-muted">{l.voucher.kind}</span> },
          { key: 'acct', header: '계정과목', render: (l) => `${l.accountCode} ${accountName(db, l.accountCode)}` },
          { key: 'v', header: '거래처', render: (l) => l.vendor || '-' },
          { key: 'memo', header: '적요', render: (l) => <span className="text-yuyu-fg-muted">{l.memo}</span> },
          { key: 'd', header: '차변', align: 'right', render: (l) => (l.side === '차변' ? <Amount value={l.amount} /> : null), footer: <Amount value={debit} /> },
          { key: 'c', header: '대변', align: 'right', render: (l) => (l.side === '대변' ? <Amount value={l.amount} /> : null), footer: <Amount value={credit} /> },
        ]}
      />
    </div>
  );
}

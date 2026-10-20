import { useState } from 'react';
import { Callout, PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Select, Tabs, Toolbar } from '../components/app/ui';
import { useDB } from '../data/store';
import { monthLabel } from '../lib/format';
import type { CardTxn } from '../types';

type Tab = 'time' | 'dup';

export default function UsageCheck() {
  const db = useDB();
  const periods = [...new Set(db.cardTxns.map((t) => t.usedAt.slice(0, 7)))].sort().reverse();
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [tab, setTab] = useState<Tab>('time');

  const txns = db.cardTxns.filter((t) => t.usedAt.startsWith(period));
  const late = txns.filter((t) => {
    const h = Number(t.usedAt.slice(11, 13));
    const day = new Date(t.usedAt.slice(0, 10)).getDay();
    return h >= 23 || h < 6 || day === 0 || day === 6;
  });
  const groups = txns.reduce<Record<string, CardTxn[]>>((acc, t) => {
    const k = `${t.cardId}|${t.usedAt.slice(0, 10)}|${t.merchant}`;
    (acc[k] ??= []).push(t);
    return acc;
  }, {});
  const dup = Object.values(groups).filter((g) => g.length > 1).flat();

  const owner = (t: CardTxn) => {
    const card = db.cards.find((c) => c.id === t.cardId);
    const emp = db.employees.find((e) => e.id === card?.ownerId);
    return `${emp?.name ?? '-'} · ${card?.name ?? ''}`;
  };
  const reason = (t: CardTxn) => {
    const h = Number(t.usedAt.slice(11, 13));
    return h >= 23 || h < 6 ? '심야(23~06시)' : '주말';
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="경비청구" title="사용 점검" lead="제한시간 사용과 같은 날 같은 가맹점 중복 사용을 모아 봅니다. 청구 화면의 검증결과와 같은 규칙입니다." />
      <Toolbar>
        <Field label="사용월" className="w-40">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {monthLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
      </Toolbar>
      <Tabs<Tab>
        tabs={[
          { value: 'time', label: '제한시간사용현황', count: late.length },
          { value: 'dup', label: '동일가맹점중복사용현황', count: dup.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Callout tone="warning" title="점검은 막지 않고 표시만 합니다">
        사유가 있으면 청구할 수 있습니다. 결재자가 내용을 보고 판단합니다.
      </Callout>
      <DataTable
        rows={tab === 'time' ? late : dup}
        rowKey={(t) => t.id}
        dense
        columns={[
          { key: 'at', header: '사용일시', render: (t) => <span className="font-mono text-xs">{t.usedAt}</span> },
          { key: 'who', header: '사용자 · 카드', render: owner },
          { key: 'm', header: '가맹점', render: (t) => t.merchant },
          { key: 'amt', header: '금액', align: 'right', render: (t) => <Amount value={t.amount} /> },
          { key: 'why', header: '사유', render: (t) => (tab === 'time' ? reason(t) : '같은 날 같은 가맹점') },
          { key: 'st', header: '청구', align: 'center', render: (t) => <span className="text-xs text-yuyu-fg-muted">{t.claimItemId ? '청구됨' : t.blocked ? '청구불가' : '미청구'}</span> },
        ]}
      />
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { Callout, PageHeader, Stat } from '../components/yuyu';
import { DataTable, Field, Input, Tabs, Toolbar } from '../components/app/ui';
import { Paper, PaperTitle, PrintButton, PrintPortal } from '../components/app/print';
import { postedLines, useDB } from '../data/store';
import { today, won } from '../lib/format';
import type { AccountType, DB } from '../types';

type Tab = 'pl' | 'bs';
interface Line {
  label: string;
  amount?: number;
  level: 0 | 1 | 2;
  strong?: boolean;
}

/** 계정 잔액: 자산 · 비용은 차변 − 대변, 나머지는 대변 − 차변 */
function balances(db: DB, from: string, to: string) {
  const map = new Map<string, number>();
  for (const l of postedLines(db)) {
    if (l.voucher.date < from || l.voucher.date > to) continue;
    const type = db.accounts.find((a) => a.code === l.accountCode)?.type;
    const sign = type === '자산' || type === '비용' ? 1 : -1;
    map.set(l.accountCode, (map.get(l.accountCode) ?? 0) + sign * (l.side === '차변' ? l.amount : -l.amount));
  }
  return map;
}

function section(db: DB, bal: Map<string, number>, type: AccountType) {
  return db.accounts.filter((a) => a.type === type && (bal.get(a.code) ?? 0) !== 0).map((a) => ({ label: `${a.code} ${a.name}`, amount: bal.get(a.code) ?? 0, level: 2 as const }));
}

function StatementTable({ name, lines }: { name: string; lines: Line[] }) {
  return (
    <DataTable
      exportName={name}
      rows={lines.map((l, i) => ({ ...l, i }))}
      rowKey={(l) => String(l.i)}
      dense
      columns={[
        { key: 'l', header: '과목', render: (l) => <span className={l.strong ? 'font-semibold text-yuyu-fg' : 'text-yuyu-fg-muted'} style={{ paddingLeft: l.level * 16 }}>{l.label}</span> },
        { key: 'a', header: '금액', align: 'right', render: (l) => (l.amount === undefined ? '' : <span className={`font-mono ${l.strong ? 'font-semibold' : ''} ${l.amount < 0 ? 'text-yuyu-danger' : ''}`}>{won(l.amount)}</span>) },
      ]}
    />
  );
}

function PaperStatement({ title, sub, lines }: { title: string; sub: string; lines: Line[] }) {
  return (
    <Paper>
      <PaperTitle>{title}</PaperTitle>
      <p className="mb-3 text-center text-[12px] text-yuyu-fg-muted">{sub}</p>
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={l.strong ? 'border-y border-yuyu-line-strong font-semibold' : ''}>
              <td className="px-2 py-1" style={{ paddingLeft: 8 + l.level * 16 }}>
                {l.label}
              </td>
              <td className="px-2 py-1 text-right font-mono">{l.amount === undefined ? '' : won(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[11px] text-yuyu-fg-muted">발행된 전표 기준 · 법인세와 결산 조정(감가상각 · 대손 등)은 반영하지 않은 관리용 재무제표입니다.</p>
    </Paper>
  );
}

export default function Statements() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>('pl');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState(today() < '2026-12-31' ? today() : '2026-12-31');

  // 손익계산서: 기간 안의 수익 · 비용
  const pl = balances(db, from, to);
  const revenue = section(db, pl, '수익');
  const expense = section(db, pl, '비용');
  const rev = revenue.reduce((a, l) => a + l.amount, 0);
  const exp = expense.reduce((a, l) => a + l.amount, 0);
  const profit = rev - exp;
  const plLines: Line[] = [
    { label: 'Ⅰ. 매출액', amount: rev, level: 0, strong: true },
    ...revenue,
    { label: 'Ⅱ. 판매비와관리비', amount: exp, level: 0, strong: true },
    ...expense,
    { label: 'Ⅲ. 영업이익', amount: profit, level: 0, strong: true },
    { label: 'Ⅳ. 법인세비용차감전순이익', amount: profit, level: 0 },
    { label: 'Ⅴ. 당기순이익', amount: profit, level: 0, strong: true },
  ];

  // 재무상태표: 기초부터 기준일까지 누적. 수익 · 비용은 당기순이익으로 자본에 더한다
  const bs = balances(db, '0000-01-01', to);
  const assets = section(db, bs, '자산');
  const liabs = section(db, bs, '부채');
  const equity = section(db, bs, '자본');
  const ytd = balances(db, `${to.slice(0, 4)}-01-01`, to);
  const net = section(db, ytd, '수익').reduce((a, l) => a + l.amount, 0) - section(db, ytd, '비용').reduce((a, l) => a + l.amount, 0);
  const A = assets.reduce((a, l) => a + l.amount, 0);
  const L = liabs.reduce((a, l) => a + l.amount, 0);
  const E = equity.reduce((a, l) => a + l.amount, 0) + net;
  const bsLines: Line[] = [
    { label: 'Ⅰ. 자산', amount: A, level: 0, strong: true },
    ...assets,
    { label: 'Ⅱ. 부채', amount: L, level: 0, strong: true },
    ...liabs,
    { label: 'Ⅲ. 자본', amount: E, level: 0, strong: true },
    ...equity,
    { label: '당기순이익', amount: net, level: 2 },
    { label: '부채와 자본 총계', amount: L + E, level: 0, strong: true },
  ];

  const paper: ReactNode =
    tab === 'pl' ? (
      <PaperStatement title="손익계산서" sub={`${db.company} · ${from} ~ ${to}`} lines={plLines} />
    ) : (
      <PaperStatement title="재무상태표" sub={`${db.company} · ${to} 현재`} lines={bsLines} />
    );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="재무제표" lead="발행된 전표로 손익계산서와 재무상태표를 만듭니다. 기간이나 기준일을 바꾸면 바로 다시 계산합니다." />
      <Tabs<Tab>
        tabs={[
          { value: 'pl', label: '손익계산서' },
          { value: 'bs', label: '재무상태표' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Toolbar>
        {tab === 'pl' && (
          <Field label="시작일">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        )}
        <Field label={tab === 'pl' ? '종료일' : '기준일'}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="ml-auto self-end">
          <PrintButton />
        </div>
      </Toolbar>

      {tab === 'pl' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat value={`${won(rev)}원`} label="매출액" tone="brand" />
          <Stat value={`${won(exp)}원`} label="판매비와관리비" tone="warning" />
          <Stat value={`${won(profit)}원`} label="당기순이익" tone={profit >= 0 ? 'success' : 'danger'} hint={rev ? `이익률 ${Math.round((profit / rev) * 1000) / 10}%` : ''} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat value={`${won(A)}원`} label="자산 총계" tone="brand" />
          <Stat value={`${won(L)}원`} label="부채 총계" tone="warning" />
          <Stat value={`${won(E)}원`} label="자본 총계" tone="success" hint={A === L + E ? '자산 = 부채 + 자본 (일치)' : `차이 ${won(A - L - E)}원`} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <StatementTable name={tab === 'pl' ? '손익계산서' : '재무상태표'} lines={tab === 'pl' ? plLines : bsLines} />
        <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-bg p-3">{paper}</div>
      </div>
      <PrintPortal>{paper}</PrintPortal>
      <Callout tone="warning" title="관리용 재무제표입니다">
        법인세, 감가상각, 대손충당금 같은 결산 조정과 회사 부담 4대보험은 넣지 않았습니다. 법인(회계단위)이 여럿이면 법인별로 나눠 집계하는 기능은 아직 없습니다.
      </Callout>
    </div>
  );
}

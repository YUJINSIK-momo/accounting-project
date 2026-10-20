import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, PageHeader } from '../components/yuyu';
import { DataTable, Field, Input, Select, Tabs, Toolbar, toast } from '../components/app/ui';
import { accountName, empName, update, useDB } from '../data/store';
import { uid } from '../lib/format';
import type { Card } from '../types';

type Tab = 'account' | 'usage' | 'vendor' | 'card' | 'employee';

export default function MasterData() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>('usage');
  const [usage, setUsage] = useState({ code: '', name: '', accountCode: '830' });
  const [vendor, setVendor] = useState({ name: '', bizNo: '' });
  const [card, setCard] = useState<{ name: string; last4: string; ownerId: string; kind: Card['kind'] }>({ name: '', last4: '', ownerId: db.currentEmpId, kind: '법인카드' });

  const addUsage = () => {
    if (!/^\d{3}$/.test(usage.code) || !usage.name.trim()) return toast('코드 세 자리와 이름을 입력하세요.');
    if (db.usages.some((u) => u.code === usage.code)) return toast('이미 있는 코드입니다.');
    update((d) => void d.usages.push({ ...usage, name: usage.name.trim() }));
    setUsage({ code: '', name: '', accountCode: '830' });
  };
  const addVendor = () => {
    if (!vendor.name.trim() || !/^\d{3}-\d{2}-\d{5}$/.test(vendor.bizNo)) return toast('거래처명과 사업자번호(000-00-00000)를 입력하세요.');
    update((d) => void d.vendors.push({ id: `v-${uid()}`, name: vendor.name.trim(), bizNo: vendor.bizNo }));
    setVendor({ name: '', bizNo: '' });
  };
  const addCard = () => {
    if (!card.name.trim() || !/^\d{4}$/.test(card.last4)) return toast('카드 이름과 끝 네 자리를 입력하세요.');
    update((d) => void d.cards.push({ id: `c-${uid()}`, ...card, name: card.name.trim() }));
    setCard({ ...card, name: '', last4: '' });
  };

  const expenseAccounts = db.accounts.filter((a) => a.type === '비용');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="기초정보" title="기초정보관리" lead="계정과목 · 용도 · 거래처 · 카드 · 사원을 관리합니다. 용도는 전표를 만들 때 어느 계정과목으로 갈지 정합니다." />
      <Tabs<Tab>
        tabs={[
          { value: 'usage', label: '용도', count: db.usages.length },
          { value: 'account', label: '계정과목', count: db.accounts.length },
          { value: 'vendor', label: '거래처', count: db.vendors.length },
          { value: 'card', label: '카드', count: db.cards.length },
          { value: 'employee', label: '사원', count: db.employees.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'usage' && (
        <>
          <Toolbar>
            <Field label="코드" className="w-24">
              <Input value={usage.code} onChange={(e) => setUsage({ ...usage, code: e.target.value })} placeholder="400" className="font-mono" />
            </Field>
            <Field label="용도명" className="w-40">
              <Input value={usage.name} onChange={(e) => setUsage({ ...usage, name: e.target.value })} placeholder="예: 세미나비" />
            </Field>
            <Field label="경비계정" className="w-44">
              <Select value={usage.accountCode} onChange={(e) => setUsage({ ...usage, accountCode: e.target.value })}>
                {expenseAccounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button icon={Plus} onClick={addUsage} className="self-end">
              추가
            </Button>
          </Toolbar>
          <DataTable
            rows={[...db.usages].sort((a, b) => a.code.localeCompare(b.code))}
            rowKey={(u) => u.code}
            dense
            columns={[
              { key: 'c', header: '코드', render: (u) => <span className="font-mono">{u.code}</span> },
              { key: 'n', header: '용도', render: (u) => u.name },
              {
                key: 'a',
                header: '경비계정',
                render: (u) => (
                  <Select value={u.accountCode} onChange={(e) => update((d) => void (d.usages.find((x) => x.code === u.code)!.accountCode = e.target.value))} className="w-48">
                    {expenseAccounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} {a.name}
                      </option>
                    ))}
                  </Select>
                ),
              },
              { key: 'used', header: '사용 건수', align: 'right', render: (u) => db.claims.flatMap((c) => c.items).filter((i) => i.usageCode === u.code).length },
            ]}
          />
        </>
      )}

      {tab === 'account' && (
        <DataTable
          rows={db.accounts}
          rowKey={(a) => a.code}
          dense
          columns={[
            { key: 'c', header: '코드', render: (a) => <span className="font-mono">{a.code}</span> },
            { key: 'n', header: '계정과목', render: (a) => a.name },
            { key: 't', header: '구분', render: (a) => a.type },
            { key: 'u', header: '연결된 용도', render: (a) => <span className="text-yuyu-fg-muted">{db.usages.filter((u) => u.accountCode === a.code).map((u) => u.name).join(', ') || '-'}</span> },
          ]}
        />
      )}

      {tab === 'vendor' && (
        <>
          <Toolbar>
            <Field label="거래처명" className="w-48">
              <Input value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
            </Field>
            <Field label="사업자번호" className="w-44">
              <Input value={vendor.bizNo} onChange={(e) => setVendor({ ...vendor, bizNo: e.target.value })} placeholder="000-00-00000" className="font-mono" />
            </Field>
            <Button icon={Plus} onClick={addVendor} className="self-end">
              추가
            </Button>
          </Toolbar>
          <DataTable
            rows={db.vendors}
            rowKey={(v) => v.id}
            dense
            columns={[
              { key: 'n', header: '거래처명', render: (v) => v.name },
              { key: 'b', header: '사업자번호', render: (v) => <span className="font-mono">{v.bizNo}</span> },
              { key: 'u', header: '지출결의 건수', align: 'right', render: (v) => db.disbursements.filter((d) => d.lines.some((l) => l.vendorId === v.id)).length },
            ]}
          />
        </>
      )}

      {tab === 'card' && (
        <>
          <Toolbar>
            <Field label="카드 이름" className="w-40">
              <Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="법인카드 D" />
            </Field>
            <Field label="끝 네 자리" className="w-28">
              <Input value={card.last4} onChange={(e) => setCard({ ...card, last4: e.target.value })} maxLength={4} className="font-mono" />
            </Field>
            <Field label="종류" className="w-32">
              <Select value={card.kind} onChange={(e) => setCard({ ...card, kind: e.target.value as Card['kind'] })}>
                <option>법인카드</option>
                <option>개인카드</option>
              </Select>
            </Field>
            <Field label="사용자" className="w-36">
              <Select value={card.ownerId} onChange={(e) => setCard({ ...card, ownerId: e.target.value })}>
                {db.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button icon={Plus} onClick={addCard} className="self-end">
              카드등록
            </Button>
          </Toolbar>
          <DataTable
            rows={db.cards}
            rowKey={(c) => c.id}
            dense
            columns={[
              { key: 'n', header: '카드', render: (c) => c.name },
              { key: 'l', header: '번호', render: (c) => <span className="font-mono">····{c.last4}</span> },
              { key: 'k', header: '종류', render: (c) => c.kind },
              { key: 'o', header: '사용자', render: (c) => empName(db, c.ownerId) },
              { key: 't', header: '사용 내역', align: 'right', render: (c) => db.cardTxns.filter((t) => t.cardId === c.id).length },
            ]}
          />
        </>
      )}

      {tab === 'employee' && (
        <DataTable
          rows={db.employees}
          rowKey={(e) => e.id}
          dense
          columns={[
            { key: 'n', header: '이름', render: (e) => e.name },
            { key: 'd', header: '부서', render: (e) => e.dept },
            { key: 'r', header: '직급', render: (e) => e.rank },
            { key: 'b', header: '급여계좌', render: (e) => <span className="font-mono text-xs">{e.bank} {e.accountNo}</span> },
            { key: 'a', header: '경비 계정', render: () => <span className="text-yuyu-fg-muted">{accountName(db, '262')}</span> },
          ]}
        />
      )}
    </div>
  );
}

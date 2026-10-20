import { useMemo, useState } from 'react';
import { ArrowRight, Ban, Copy, FileSearch, Plus, Send, Trash2 } from 'lucide-react';
import { Button, Callout, PageHeader, Stat } from '../components/yuyu';
import { Amount, CheckBadge, DataTable, Field, Input, MoneyInput, Select, StatusBadge, StepNav, Toolbar, toast } from '../components/app/ui';
import { DocumentModal, SubmitDocModal } from '../components/app/approval';
import { AttachmentEditor } from '../components/app/attachments';
import { checkBudget, usageAccount } from '../lib/budget';
import { accountName, nextDocNo, update, usageName, useDB } from '../data/store';
import { merchantUsage } from '../data/seed';
import { checkClaimItem, worst } from '../lib/journal';
import { monthLabel, sum, uid, won } from '../lib/format';
import type { Claim, ClaimItem, DB, PayMethod } from '../types';

const STEPS = ['지출내역조회', '지출정보등록', '청구내역조회'] as const;

function suggest(d: DB, merchant: string): { usageCode: string; memo: string } {
  const past = d.claims
    .flatMap((c) => c.items)
    .filter((i) => i.merchant === merchant && i.usageCode)
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))[0];
  if (past) return { usageCode: past.usageCode, memo: past.memo };
  const m = merchantUsage(merchant);
  return { usageCode: m?.usage ?? '', memo: m?.memo ?? '' };
}

export default function ExpenseClaim() {
  const db = useDB();
  const me = db.employees.find((e) => e.id === db.currentEmpId)!;
  const myCards = db.cards.filter((c) => c.ownerId === me.id);
  const months = useMemo(() => {
    const set = new Set(db.cardTxns.filter((t) => myCards.some((c) => c.id === t.cardId)).map((t) => t.usedAt.slice(0, 7)));
    set.add(new Date().toISOString().slice(0, 7));
    return [...set].sort().reverse();
  }, [db.cardTxns, myCards]);

  const [period, setPeriod] = useState(months[0]);
  const [step, setStep] = useState(0);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [viewing, setViewing] = useState(false);

  const claim = db.claims.find((c) => c.empId === me.id && c.period === period);
  const editable = !claim || claim.status === '작성중' || claim.status === '반려';

  const txns = db.cardTxns
    .filter((t) => myCards.some((c) => c.id === t.cardId) && t.usedAt.startsWith(period))
    .filter((t) => cardFilter === 'all' || t.cardId === cardFilter)
    .filter((t) => includeBlocked || !t.blocked)
    .filter((t) => !keyword || t.merchant.includes(keyword));
  const selectable = txns.filter((t) => !t.claimItemId && !t.blocked);

  const ensureClaim = (d: DB): Claim => {
    let c = d.claims.find((x) => x.empId === me.id && x.period === period);
    if (!c) {
      c = { id: `cl-${uid()}`, docNo: nextDocNo(d, 'EXP'), empId: me.id, period, items: [], status: '작성중' };
      d.claims.push(c);
    }
    return c;
  };

  const importPicked = () => {
    if (!picked.size) return toast('가져올 카드 내역을 고르세요.');
    update((d) => {
      const c = ensureClaim(d);
      for (const t of d.cardTxns.filter((x) => picked.has(x.id))) {
        const card = d.cards.find((x) => x.id === t.cardId)!;
        const id = `ci-${uid()}`;
        t.claimItemId = id;
        c.items.push({ id, usedAt: t.usedAt, merchant: t.merchant, payMethod: card.kind, amount: t.amount, txnId: t.id, ...suggest(d, t.merchant) });
      }
      c.items.sort((a, b) => a.usedAt.localeCompare(b.usedAt));
    });
    toast(`${picked.size}건을 지출정보로 가져왔습니다.`);
    setPicked(new Set());
    setStep(1);
  };

  const toggleBlocked = (block: boolean) => {
    if (!picked.size) return toast('내역을 먼저 고르세요.');
    update((d) => d.cardTxns.forEach((t) => picked.has(t.id) && !t.claimItemId && (t.blocked = block)));
    setPicked(new Set());
  };

  const editItem = (id: string, patch: Partial<ClaimItem>) =>
    update((d) => {
      const it = d.claims.find((c) => c.id === claim?.id)?.items.find((i) => i.id === id);
      if (it) Object.assign(it, patch);
    });

  const removeItem = (id: string) =>
    update((d) => {
      const c = d.claims.find((x) => x.id === claim?.id);
      if (!c) return;
      const it = c.items.find((i) => i.id === id);
      if (it?.txnId) {
        const t = d.cardTxns.find((x) => x.id === it.txnId);
        if (t) t.claimItemId = undefined;
      }
      c.items = c.items.filter((i) => i.id !== id);
    });

  const addManual = () =>
    update((d) => {
      const c = ensureClaim(d);
      c.items.push({ id: `ci-${uid()}`, usedAt: `${period}-01 12:00`, merchant: '', payMethod: '현금', amount: 0, usageCode: '', memo: '' });
    });

  const copyPrevious = () => {
    let filled = 0;
    update((d) => {
      const c = d.claims.find((x) => x.id === claim?.id);
      c?.items.forEach((it) => {
        if (it.usageCode && it.memo) return;
        const s = suggest({ ...d, claims: d.claims.filter((x) => x.id !== c.id) }, it.merchant);
        if (s.usageCode) {
          it.usageCode ||= s.usageCode;
          it.memo ||= s.memo;
          filled++;
        }
      });
    });
    toast(filled ? `이전 청구 내역으로 ${filled}건을 채웠습니다.` : '채울 수 있는 이전 내역이 없습니다.');
  };

  const items = claim?.items ?? [];
  const checks = items.map((i) => checkClaimItem(i, items));
  const overall = worst(checks);

  const submit = () => {
    if (!claim || !items.length) return toast('청구할 내역이 없습니다.');
    if (overall === '부적합') return toast('부적합 항목을 먼저 고치세요.');
    setSubmitting(true);
  };

  const budget = checkBudget(db, period.slice(0, 4), me.dept, items.filter((i) => i.usageCode).map((i) => ({ accountCode: usageAccount(db, i.usageCode), amount: i.amount })), claim?.id);
  const byUsage = Object.entries(
    items.reduce<Record<string, number>>((acc, i) => ((acc[i.usageCode] = (acc[i.usageCode] ?? 0) + i.amount), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="경비청구" title="경비청구작성" lead="카드 사용 내역을 불러와 용도와 내용을 적고, 검증을 통과하면 결재를 올립니다." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepNav steps={STEPS} current={step} onSelect={setStep} />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yuyu-fg-muted">청구년월</span>
          <Select value={period} onChange={(e) => (setPeriod(e.target.value), setPicked(new Set()))} className="w-36">
            {months.map((m) => (
              <option key={m} value={m}>
                1차 · {monthLabel(m)}
              </option>
            ))}
          </Select>
          {claim && <StatusBadge status={claim.status} />}
        </div>
      </div>

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {[{ id: 'all', name: '전체', last4: '' }, ...myCards].map((c) => {
              const list = db.cardTxns.filter((t) => t.usedAt.startsWith(period) && (c.id === 'all' ? myCards.some((m) => m.id === t.cardId) : t.cardId === c.id));
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardFilter(c.id)}
                  className={`w-full rounded-yuyu-md border p-3 text-left transition-colors ${cardFilter === c.id ? 'border-yuyu-brand/60 bg-yuyu-brand/10' : 'border-yuyu-line/60 bg-yuyu-surface hover:bg-yuyu-raised'}`}
                >
                  <div className="text-sm font-medium text-yuyu-fg">
                    {c.name}
                    {c.last4 && <span className="ml-1 font-mono text-xs text-yuyu-fg-subtle">··{c.last4}</span>}
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-yuyu-fg-muted">
                    <span>{list.length}건</span>
                    <span className="font-mono">{won(sum(list, (t) => t.amount))}원</span>
                  </div>
                </button>
              );
            })}
            {!myCards.length && <Callout tone="warning" title="등록된 카드가 없습니다">기초정보관리에서 카드를 등록하거나, 2단계에서 직접 입력하세요.</Callout>}
          </div>

          <div className="space-y-3">
            <Toolbar>
              <Field label="가맹점 검색" className="w-48">
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="가맹점명" />
              </Field>
              <label className="flex h-9 items-center gap-2 text-sm text-yuyu-fg-muted">
                <input type="checkbox" checked={includeBlocked} onChange={(e) => setIncludeBlocked(e.target.checked)} />
                청구불가내역 포함
              </label>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={Ban} onClick={() => toggleBlocked(true)} disabled={!editable}>
                  청구불가
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleBlocked(false)} disabled={!editable}>
                  청구불가 해제
                </Button>
                <Button size="sm" icon={ArrowRight} onClick={importPicked} disabled={!editable}>
                  선택 내역 가져오기
                </Button>
              </div>
            </Toolbar>
            <DataTable
              rows={txns}
              rowKey={(t) => t.id}
              maxHeight="60vh"
              showFooter
              empty="조회된 카드내역이 없습니다"
              columns={[
                {
                  key: 'pick',
                  width: '40px',
                  align: 'center',
                  header: (
                    <input
                      type="checkbox"
                      aria-label="전체 선택"
                      checked={selectable.length > 0 && selectable.every((t) => picked.has(t.id))}
                      onChange={(e) => setPicked(new Set(e.target.checked ? selectable.map((t) => t.id) : []))}
                    />
                  ),
                  render: (t) => (
                    <input
                      type="checkbox"
                      aria-label={`${t.merchant} 선택`}
                      disabled={Boolean(t.claimItemId)}
                      checked={picked.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        e.target.checked ? next.add(t.id) : next.delete(t.id);
                        setPicked(next);
                      }}
                    />
                  ),
                },
                { key: 'at', header: '사용일시', render: (t) => <span className="font-mono text-xs">{t.usedAt}</span>, footer: '합계' },
                { key: 'card', header: '카드', render: (t) => db.cards.find((c) => c.id === t.cardId)?.name },
                { key: 'm', header: '가맹점', render: (t) => t.merchant },
                { key: 'biz', header: '사업자번호', render: (t) => <span className="font-mono text-xs text-yuyu-fg-muted">{t.bizNo}</span> },
                { key: 'amt', header: '승인금액', align: 'right', render: (t) => <Amount value={t.amount} />, footer: <Amount value={sum(txns, (t) => t.amount)} /> },
                {
                  key: 'st',
                  header: '상태',
                  align: 'center',
                  render: (t) => (t.claimItemId ? <span className="text-xs text-yuyu-success">청구됨</span> : t.blocked ? <span className="text-xs text-yuyu-danger">청구불가</span> : <span className="text-xs text-yuyu-fg-subtle">미청구</span>),
                },
              ]}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {!editable && (
            <Callout tone="warning" title={`${claim?.status} 문서입니다`}>
              결재가 올라간 청구는 고칠 수 없습니다. 반려되면 다시 고칠 수 있습니다.
            </Callout>
          )}
          <Toolbar>
            <span className="self-center text-sm text-yuyu-fg-muted">
              {claim ? <span className="font-mono">{claim.docNo}</span> : '아직 청구서가 없습니다.'} · {items.length}건
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={Plus} onClick={addManual} disabled={!editable}>
                신규
              </Button>
              <Button size="sm" variant="outline" icon={Copy} onClick={copyPrevious} disabled={!editable || !items.length}>
                이전내역 사본
              </Button>
              <Button size="sm" icon={ArrowRight} onClick={() => setStep(2)}>
                청구내역 확인
              </Button>
            </div>
          </Toolbar>
          <DataTable
            rows={items}
            rowKey={(i) => i.id}
            showFooter
            dense
            columns={[
              {
                key: 'at',
                header: '사용일시',
                width: '150px',
                render: (i) => (i.txnId ? <span className="font-mono text-xs">{i.usedAt}</span> : <Input type="date" value={i.usedAt.slice(0, 10)} disabled={!editable} onChange={(e) => editItem(i.id, { usedAt: `${e.target.value} 12:00` })} />),
                footer: '합계',
              },
              { key: 'm', header: '사용처', render: (i) => (i.txnId ? i.merchant : <Input value={i.merchant} disabled={!editable} onChange={(e) => editItem(i.id, { merchant: e.target.value })} placeholder="사용처" />) },
              {
                key: 'pay',
                header: '결제방법',
                width: '110px',
                render: (i) =>
                  i.txnId ? (
                    <span className="text-xs text-yuyu-fg-muted">{i.payMethod}</span>
                  ) : (
                    <Select value={i.payMethod} disabled={!editable} onChange={(e) => editItem(i.id, { payMethod: e.target.value as PayMethod })}>
                      <option>현금</option>
                      <option>개인카드</option>
                    </Select>
                  ),
              },
              {
                key: 'amt',
                header: '청구금액',
                align: 'right',
                width: '130px',
                render: (i) => (i.txnId ? <Amount value={i.amount} /> : <MoneyInput value={i.amount} disabled={!editable} onChange={(n) => editItem(i.id, { amount: n })} />),
                footer: <Amount value={sum(items, (i) => i.amount)} />,
              },
              {
                key: 'usage',
                header: '용도',
                width: '130px',
                render: (i) => (
                  <Select value={i.usageCode} invalid={!i.usageCode} disabled={!editable} onChange={(e) => editItem(i.id, { usageCode: e.target.value })}>
                    <option value="">선택</option>
                    {db.usages.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                ),
              },
              { key: 'memo', header: '내용', render: (i) => <Input value={i.memo} invalid={!i.memo.trim()} disabled={!editable} onChange={(e) => editItem(i.id, { memo: e.target.value })} placeholder="내용" /> },
              { key: 'chk', header: '검증결과', align: 'center', width: '90px', render: (_i, idx) => <CheckBadge check={checks[idx]} /> },
              {
                key: 'del',
                header: '',
                width: '44px',
                render: (i) => (
                  <button type="button" aria-label="행 삭제" disabled={!editable} onClick={() => removeItem(i.id)} className="rounded-yuyu-sm p-1 text-yuyu-fg-subtle hover:bg-yuyu-raised hover:text-yuyu-danger disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                ),
              },
            ]}
          />
          <p className="text-xs text-yuyu-fg-subtle">검증결과에 마우스를 올리면 사유가 보입니다. 확인필요는 상신할 수 있고, 부적합은 고쳐야 상신됩니다.</p>
          {claim && (
            <div className="rounded-yuyu-md border border-yuyu-line bg-yuyu-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-yuyu-fg">증빙 첨부 (청구서 단위)</h3>
              <AttachmentEditor items={claim.attachments ?? []} onChange={(a) => update((d) => void (d.claims.find((c) => c.id === claim.id)!.attachments = a))} by={me.id} editable={editable} />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat value={`${won(sum(items, (i) => i.amount))}원`} label="청구 합계" />
            <Stat value={`${items.length}건`} label="청구 건수" tone="infra" />
            <Stat value={`${checks.filter((c) => c.level === '확인필요').length}건`} label="확인필요" tone="warning" />
            <Stat value={`${checks.filter((c) => c.level === '부적합').length}건`} label="부적합" tone="danger" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <DataTable
              rows={items}
              rowKey={(i) => i.id}
              showFooter
              dense
              columns={[
                { key: 'st', header: '상태', render: () => (claim ? <StatusBadge status={claim.status} /> : null), footer: '합계' },
                { key: 'at', header: '사용일시', render: (i) => <span className="font-mono text-xs">{i.usedAt}</span> },
                { key: 'm', header: '사용처', render: (i) => i.merchant || '-' },
                { key: 'pay', header: '결제방법', render: (i) => i.payMethod },
                { key: 'amt', header: '청구금액', align: 'right', render: (i) => <Amount value={i.amount} />, footer: <Amount value={sum(items, (i) => i.amount)} /> },
                { key: 'u', header: '용도', render: (i) => usageName(db, i.usageCode) },
                { key: 'memo', header: '내용', render: (i) => i.memo || '-' },
                { key: 'chk', header: '검증결과', align: 'center', render: (_i, idx) => <CheckBadge check={checks[idx]} /> },
              ]}
            />
            <div className="space-y-3 rounded-yuyu-md border border-yuyu-line/60 bg-yuyu-surface p-4">
              <h3 className="text-sm font-semibold text-yuyu-fg">용도별 합계</h3>
              <ul className="space-y-1.5 text-sm">
                {byUsage.map(([code, amt]) => (
                  <li key={code} className="flex justify-between">
                    <span className="text-yuyu-fg-muted">{usageName(db, code)}</span>
                    <Amount value={amt} />
                  </li>
                ))}
                {!byUsage.length && <li className="text-yuyu-fg-subtle">없음</li>}
              </ul>
              <h3 className="pt-2 text-sm font-semibold text-yuyu-fg">{me.dept} 예산 잔액</h3>
              <ul className="space-y-1.5 text-xs">
                {budget.map((b) => (
                  <li key={b.accountCode} className="flex justify-between gap-2">
                    <span className="text-yuyu-fg-muted">{accountName(db, b.accountCode)}</span>
                    {b.remaining === undefined ? <span className="text-yuyu-warning">예산 없음</span> : <Amount value={b.remaining} tone={b.remaining < 0 ? 'danger' : 'success'} />}
                  </li>
                ))}
                {!budget.length && <li className="text-yuyu-fg-subtle">용도를 고르면 보입니다</li>}
              </ul>
              <Button icon={Send} onClick={submit} disabled={!editable || !items.length} className="w-full">
                결재상신
              </Button>
              <Button variant="outline" icon={FileSearch} onClick={() => setViewing(true)} disabled={!claim} className="w-full">
                문서 보기 · PDF
              </Button>
              {claim?.submittedAt && <p className="text-xs text-yuyu-fg-subtle">상신 {claim.submittedAt}</p>}
            </div>
          </div>
        </div>
      )}
      <SubmitDocModal docRef={submitting && claim ? { kind: '경비청구', id: claim.id } : undefined} drafterId={me.id} onClose={() => setSubmitting(false)} />
      <DocumentModal docRef={viewing && claim ? { kind: '경비청구', id: claim.id } : undefined} onClose={() => setViewing(false)} />
    </div>
  );
}

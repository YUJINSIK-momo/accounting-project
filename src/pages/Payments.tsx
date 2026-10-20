import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ban, Download, FileDown, FileUp, Landmark, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button, Callout, FilterChips, PageHeader, Pipeline, Stat, type Tone } from '../components/yuyu';
import { Amount, DataTable, Field, Input, Modal, Select, Tabs, Toolbar, toast } from '../components/app/ui';
import { getDB, update, useDB } from '../data/store';
import { BANKS, DEFAULT_COLUMNS, bankCode, digits } from '../lib/banks';
import { applyResults, batchRows, cancelBatch, createBatch, demoResultRows, matchResults, parseResultRows, payables, type Payable, type ResultRow } from '../lib/transfer';
import { readTableFile } from '../lib/xlsxRead';
import { downloadXlsx } from '../lib/xlsx';
import { sum, today, toDate, uid, won } from '../lib/format';
import type { TransferBatch, TransferItem } from '../types';

type Tab = 'due' | 'batches' | 'format';
type Kind = 'all' | Payable['refKind'];

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDate(d);
};

const statusTone: Record<TransferItem['status'], Tone> = { 예약: 'warning', 완료: 'success', 실패: 'danger' };

export default function Payments() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>('due');
  const [kind, setKind] = useState<Kind>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(tomorrow());
  const [fromId, setFromId] = useState(db.companyAccounts[0]?.id ?? '');
  const [memoMode, setMemoMode] = useState<'doc' | 'kind'>('kind');
  const [selected, setSelected] = useState<string>();
  const [preview, setPreview] = useState<{ batchId: string; outcome: Record<string, { ok: boolean; reason?: string }>; unmatched: ResultRow[]; manual: boolean }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => payables(db), [db]);
  const rows = all.filter((p) => kind === 'all' || p.refKind === kind).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.refKind.localeCompare(b.refKind));
  const chosen = all.filter((p) => picked.has(p.key));
  const batches = [...db.transferBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const batch = db.transferBatches.find((b) => b.id === (selected ?? batches[0]?.id));
  const account = (id: string) => db.companyAccounts.find((a) => a.id === id);

  const makeFile = () => {
    if (!chosen.length) return toast('이체할 건을 고르세요.');
    if (!account(fromId)) return toast('출금계좌를 고르세요.');
    if (date < today()) return toast('예약일은 오늘 이후여야 합니다.');
    let created: TransferBatch | undefined;
    update((d) => void (created = createBatch(d, chosen, date, fromId, (p) => (memoMode === 'doc' ? p.docNo : p.refKind === '급여' ? '급여' : p.refKind === '경비' ? '경비' : p.payee))));
    const b = getDB().transferBatches.find((x) => x.id === created!.id)!;
    downloadXlsx(`이체_${b.no}`, batchRows(getDB(), b));
    toast(`${b.no} 이체 파일을 만들었습니다. 기업뱅킹 대량이체에 올려 예약하세요.`);
    setPicked(new Set());
    setSelected(b.id);
    setTab('batches');
  };

  const onResultFile = async (file?: File) => {
    if (!file || !batch) return;
    try {
      const table = await readTableFile(file);
      const { results, error } = parseResultRows(table);
      if (error) return toast(error);
      const { map, unmatched } = matchResults(batch, results);
      const outcome: Record<string, { ok: boolean; reason?: string }> = {};
      map.forEach((r, itemId) => (outcome[itemId] = { ok: r.ok, reason: r.reason }));
      setPreview({ batchId: batch.id, outcome, unmatched, manual: false });
    } catch (e) {
      toast((e as Error).message || '파일을 읽지 못했습니다.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmApply = () => {
    if (!preview) return;
    const n = Object.values(preview.outcome);
    update((d) => applyResults(d, preview.batchId, preview.outcome));
    toast(`반영했습니다 — 성공 ${n.filter((o) => o.ok).length}건 · 실패 ${n.filter((o) => !o.ok).length}건`);
    setPreview(undefined);
  };

  const cols = db.transferColumns;
  const moveCol = (i: number, dir: -1 | 1) =>
    update((d) => {
      const c = d.transferColumns;
      [c[i], c[i + dir]] = [c[i + dir], c[i]];
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="회계" title="지급 · 이체" lead="결재와 전표가 끝난 지급 건을 은행 대량이체 파일로 만들고, 기업뱅킹에서 예약 · 승인한 뒤 은행 결과 파일을 올려 지급을 마무리합니다.">
        <Pipeline
          nodes={[
            { label: '지급 대기', sub: '결재 · 전표 완료', tone: 'neutral' },
            { label: '이체 파일 만들기', sub: '예약일 · 출금계좌', tone: 'brand' },
            { label: '기업뱅킹 예약', sub: '파일 업로드 · OTP 승인', tone: 'warning', human: true },
            { label: '결과 파일 올리기', sub: '성공 · 실패 반영', tone: 'infra' },
            { label: '지급 전표 · 입금 알림', tone: 'success' },
          ]}
        />
      </PageHeader>

      <Tabs<Tab>
        tabs={[
          { value: 'due', label: '지급 대기', count: all.length },
          { value: 'batches', label: '이체 묶음', count: db.transferBatches.filter((b) => b.status === '결과 대기').length },
          { value: 'format', label: '이체 양식 · 출금계좌' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'due' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat value={`${all.length}건`} label="지급 대기" hint={`${won(sum(all, (p) => p.amount))}원`} tone="warning" />
            <Stat value={`${all.filter((p) => p.lastFail).length}건`} label="재이체 필요" hint="지난 이체에서 실패" tone="danger" />
            <Stat value={`${all.filter((p) => p.problem).length}건`} label="계좌 확인 필요" hint="파일에 넣을 수 없음" tone="neutral" />
            <Stat value={`${chosen.length}건`} label="선택" hint={`${won(sum(chosen, (p) => p.amount))}원`} tone="brand" />
          </div>
          <Toolbar>
            <Field label="예약일(이체일)" className="w-40">
              <Input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="출금계좌" className="w-60">
              <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {db.companyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.bank} {a.accountNo}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="내통장표시" className="w-40">
              <Select value={memoMode} onChange={(e) => setMemoMode(e.target.value as typeof memoMode)}>
                <option value="kind">구분 · 받는 분</option>
                <option value="doc">문서번호</option>
              </Select>
            </Field>
            <div className="ml-auto self-end">
              <Button icon={FileDown} onClick={makeFile} disabled={!chosen.length}>
                이체 파일 만들기 {chosen.length ? `(${chosen.length}건 · ${won(sum(chosen, (p) => p.amount))}원)` : ''}
              </Button>
            </div>
          </Toolbar>
          <FilterChips<Kind>
            label="구분"
            value={kind}
            onChange={(v) => (setKind(v), setPicked(new Set()))}
            options={[
              { value: 'all', label: '전체', count: all.length },
              { value: '지출결의', label: '거래처 대금', count: all.filter((p) => p.refKind === '지출결의').length },
              { value: '경비', label: '개인 경비', count: all.filter((p) => p.refKind === '경비').length },
              { value: '급여', label: '급여', count: all.filter((p) => p.refKind === '급여').length },
            ]}
          />
          <DataTable
            exportName="지급대기"
            rows={rows}
            rowKey={(p) => p.key}
            dense
            showFooter
            maxHeight="55vh"
            empty="지급할 건이 없습니다. 지출결의 · 경비청구는 전표처리에서 전표를 발행해야, 급여는 급여대장을 확정해야 여기에 나옵니다."
            columns={[
              {
                key: 'pick',
                width: '36px',
                align: 'center',
                header: (
                  <input
                    type="checkbox"
                    aria-label="모두 고르기"
                    checked={rows.some((p) => !p.problem) && rows.filter((p) => !p.problem).every((p) => picked.has(p.key))}
                    onChange={(e) => setPicked(new Set(e.target.checked ? rows.filter((p) => !p.problem).map((p) => p.key) : []))}
                  />
                ),
                render: (p) => (
                  <input
                    type="checkbox"
                    aria-label={`${p.payee} 고르기`}
                    disabled={Boolean(p.problem)}
                    checked={picked.has(p.key)}
                    onChange={(e) => {
                      const n = new Set(picked);
                      e.target.checked ? n.add(p.key) : n.delete(p.key);
                      setPicked(n);
                    }}
                  />
                ),
                footer: '',
              },
              { key: 'k', header: '구분', render: (p) => <Badge tone={p.refKind === '급여' ? 'ai' : p.refKind === '경비' ? 'infra' : 'brand'}>{p.refKind === '지출결의' ? '거래처' : p.refKind}</Badge>, footer: '합계' },
              { key: 'doc', header: '문서', render: (p) => <span className="font-mono text-xs">{p.docNo}</span> },
              { key: 't', header: '내용', render: (p) => p.title },
              { key: 'payee', header: '받는 분', render: (p) => p.payee },
              { key: 'bank', header: '은행(코드)', render: (p) => <span className="text-xs">{p.bank} <span className="font-mono text-yuyu-fg-subtle">{bankCode(p.bank) || '?'}</span></span> },
              { key: 'acc', header: '계좌', render: (p) => <span className="font-mono text-xs">{p.accountNo || '-'}</span> },
              { key: 'amt', header: '금액', align: 'right', render: (p) => <Amount value={p.amount} />, footer: <Amount value={sum(rows, (p) => p.amount)} /> },
              { key: 'due', header: '지급요청일', render: (p) => <span className={`font-mono text-xs ${p.dueDate < today() ? 'text-yuyu-danger' : ''}`}>{p.dueDate}</span> },
              {
                key: 'st',
                header: '상태',
                render: (p) =>
                  p.problem ? <span className="text-xs text-yuyu-danger">{p.problem}</span> : p.lastFail ? <span className="text-xs text-yuyu-warning">재이체 필요 · {p.lastFail}</span> : <span className="text-xs text-yuyu-fg-subtle">대기</span>,
              },
            ]}
          />
          <Callout tone="brand" title="파일을 만든 다음">
            ① 기업뱅킹 「대량이체(다건이체)」에서 내려받은 파일을 올리고 ② 이체일을 예약일로 지정한 뒤 ③ OTP · 인증서로 승인합니다. ④ 이체가 끝나면 은행의 처리결과 파일을 「이체 묶음」 탭에 올리세요. 파일로 묶은 건은 결과를 반영하거나 묶음을 취소할 때까지 다시 고를 수 없어 두 번 지급되지 않습니다.
          </Callout>
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-4">
          <DataTable
            exportName="이체묶음"
            rows={batches}
            rowKey={(b) => b.id}
            selectedKey={batch?.id}
            onRowClick={(b) => setSelected(b.id)}
            dense
            empty="아직 만든 이체 파일이 없습니다"
            columns={[
              { key: 'no', header: '묶음번호', render: (b) => <span className="font-mono text-xs">{b.no}</span> },
              { key: 'c', header: '만든 시각', render: (b) => <span className="font-mono text-xs">{b.createdAt}</span> },
              { key: 'd', header: '예약일', render: (b) => <span className="font-mono text-xs">{b.scheduledDate}</span> },
              { key: 'a', header: '출금계좌', render: (b) => `${account(b.fromAccountId)?.label ?? '-'} · ${account(b.fromAccountId)?.bank ?? ''}` },
              { key: 'n', header: '건수', align: 'right', render: (b) => b.items.length },
              { key: 'm', header: '금액', align: 'right', render: (b) => <Amount value={sum(b.items, (i) => i.amount)} /> },
              { key: 'r', header: '성공 · 실패', render: (b) => <span className="text-xs">{b.items.filter((i) => i.status === '완료').length} · {b.items.filter((i) => i.status === '실패').length}</span> },
              { key: 's', header: '상태', render: (b) => <Badge tone={b.status === '결과 대기' ? 'warning' : b.status === '반영 완료' ? 'success' : 'neutral'}>{b.status}</Badge> },
            ]}
          />
          {batch && (
            <div className="space-y-3 rounded-yuyu-md border border-yuyu-line bg-yuyu-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Landmark size={16} className="text-yuyu-brand" />
                <span className="font-semibold text-yuyu-fg">{batch.no}</span>
                <span className="text-sm text-yuyu-fg-muted">
                  예약일 {batch.scheduledDate} · 출금 {account(batch.fromAccountId)?.bank} {account(batch.fromAccountId)?.accountNo} · {batch.items.length}건 {won(sum(batch.items, (i) => i.amount))}원
                </span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" icon={Download} onClick={() => downloadXlsx(`이체_${batch.no}`, batchRows(db, batch))}>
                    이체 파일 다시 받기
                  </Button>
                  {batch.status === '결과 대기' && (
                    <>
                      <Button size="sm" icon={FileUp} onClick={() => fileRef.current?.click()}>
                        결과 파일 올리기
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPreview({ batchId: batch.id, outcome: Object.fromEntries(batch.items.filter((i) => i.status === '예약').map((i) => [i.id, { ok: true }])), unmatched: [], manual: true })}>
                        결과 직접 입력
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadXlsx(`은행결과_데모_${batch.no}`, demoResultRows(batch))}>
                        데모 결과 파일 받기
                      </Button>
                      {batch.items.every((i) => i.status === '예약') && (
                        <Button size="sm" variant="ghost" icon={Ban} onClick={() => (update((d) => cancelBatch(d, batch.id)), toast('묶음을 취소했습니다. 대상이 지급 대기로 돌아갑니다.'))}>
                          묶음 취소
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => onResultFile(e.target.files?.[0])} />
              </div>
              <DataTable
                rows={batch.items}
                rowKey={(i) => i.id}
                dense
                showFooter
                columns={[
                  { key: 'k', header: '구분', render: (i) => (i.refKind === '지출결의' ? '거래처' : i.refKind), footer: '합계' },
                  { key: 'doc', header: '문서', render: (i) => <span className="font-mono text-xs">{i.docNo}</span> },
                  { key: 'p', header: '받는 분', render: (i) => i.payee },
                  { key: 'b', header: '은행', render: (i) => `${i.bank} (${bankCode(i.bank) || '?'})` },
                  { key: 'a', header: '계좌', render: (i) => <span className="font-mono text-xs">{digits(i.accountNo)}</span> },
                  { key: 'm', header: '금액', align: 'right', render: (i) => <Amount value={i.amount} />, footer: <Amount value={sum(batch.items, (i) => i.amount)} /> },
                  { key: 'memo', header: '통장표시(받는분 · 내)', render: (i) => <span className="text-xs text-yuyu-fg-muted">{i.payeeMemo} · {i.myMemo}</span> },
                  { key: 's', header: '결과', render: (i) => <Badge tone={statusTone[i.status]}>{i.status}</Badge> },
                  { key: 'r', header: '사유', render: (i) => <span className="text-xs text-yuyu-danger">{i.reason ?? ''}</span> },
                ]}
              />
              <p className="text-xs text-yuyu-fg-subtle">결과 파일은 계좌번호와 금액이 같은 줄끼리 맞춥니다. 머리글에 「계좌」 · 「금액」 · 「처리결과(결과 · 상태)」가 있으면 은행 양식이 달라도 읽습니다(.xlsx · .csv).</p>
            </div>
          )}
        </div>
      )}

      {tab === 'format' && (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-yuyu-fg">이체 파일 열 (주거래 은행 대량이체 양식에 맞추세요)</h2>
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => update((d) => void (d.transferColumns = DEFAULT_COLUMNS.map((c) => ({ ...c }))))}>
                기본값
              </Button>
            </div>
            <DataTable
              rows={cols.map((c, i) => ({ ...c, i }))}
              rowKey={(c) => c.key}
              dense
              columns={[
                {
                  key: 'mv',
                  header: '순서',
                  width: '70px',
                  render: (c) => (
                    <span className="inline-flex">
                      <button type="button" aria-label="위로" disabled={c.i === 0} onClick={() => moveCol(c.i, -1)} className="p-0.5 text-yuyu-fg-muted disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label="아래로" disabled={c.i === cols.length - 1} onClick={() => moveCol(c.i, 1)} className="p-0.5 text-yuyu-fg-muted disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                    </span>
                  ),
                },
                { key: 'in', header: '넣기', align: 'center', render: (c) => <input type="checkbox" aria-label={`${c.header} 넣기`} checked={c.include} onChange={(e) => update((d) => void (d.transferColumns[c.i].include = e.target.checked))} /> },
                { key: 'h', header: '머리글', render: (c) => <Input value={c.header} onChange={(e) => update((d) => void (d.transferColumns[c.i].header = e.target.value))} className="h-8" /> },
                {
                  key: 'ex',
                  header: '예시',
                  render: (c) => (
                    <span className="font-mono text-xs text-yuyu-fg-muted">
                      {{ seq: '1', bankCode: '088', bankName: '신한은행', accountNo: '110123456789', holder: '홍길동', amount: '1,250,000', payeeMemo: '데모상사', myMemo: '경비', scheduledDate: '20261021', docNo: 'EXP-2026-0010' }[c.key]}
                    </span>
                  ),
                },
              ]}
            />
            <p className="text-xs text-yuyu-fg-subtle">은행마다 열 이름 · 순서 · 첫 줄 머리글 유무가 다릅니다. 기업뱅킹에서 내려받은 「대량이체 양식」을 보고 맞춰 두면 그 은행에 그대로 올릴 수 있습니다. 은행코드는 금융기관 표준 3자리입니다.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-yuyu-fg">출금계좌</h2>
            <DataTable
              rows={db.companyAccounts}
              rowKey={(a) => a.id}
              dense
              columns={[
                { key: 'l', header: '이름', render: (a) => <Input value={a.label} onChange={(e) => update((d) => void (d.companyAccounts.find((x) => x.id === a.id)!.label = e.target.value))} className="h-8" /> },
                {
                  key: 'b',
                  header: '은행',
                  render: (a) => (
                    <Select value={a.bank} onChange={(e) => update((d) => void (d.companyAccounts.find((x) => x.id === a.id)!.bank = e.target.value))} className="h-8">
                      {BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  ),
                },
                { key: 'n', header: '계좌번호', render: (a) => <Input value={a.accountNo} onChange={(e) => update((d) => void (d.companyAccounts.find((x) => x.id === a.id)!.accountNo = e.target.value))} className="h-8 font-mono" /> },
                {
                  key: 'x',
                  header: '',
                  render: (a) => (
                    <button type="button" aria-label="지우기" disabled={db.companyAccounts.length === 1} onClick={() => update((d) => void (d.companyAccounts = d.companyAccounts.filter((x) => x.id !== a.id)))} className="p-1 text-yuyu-fg-muted hover:text-yuyu-danger disabled:opacity-30">
                      <Trash2 size={14} />
                    </button>
                  ),
                },
              ]}
            />
            <Button size="sm" variant="outline" icon={Plus} onClick={() => update((d) => void d.companyAccounts.push({ id: `ca-${uid()}`, bank: '신한은행', accountNo: '', label: '새 계좌' }))}>
              출금계좌 추가
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!preview}
        title={preview?.manual ? '결과 직접 입력' : '은행 결과 확인'}
        onClose={() => setPreview(undefined)}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(undefined)}>
              취소
            </Button>
            <Button onClick={confirmApply} disabled={!preview || !Object.keys(preview.outcome).length}>
              결과 반영
            </Button>
          </>
        }
      >
        {preview && batch && (
          <div className="space-y-3">
            {!preview.manual && (
              <p className="text-sm text-yuyu-fg-muted">
                {Object.keys(preview.outcome).length}건을 맞췄습니다
                {preview.unmatched.length ? ` · 맞추지 못한 줄 ${preview.unmatched.length}개(계좌 · 금액이 묶음에 없음)` : ''}. 맞추지 못한 이체 건은 「예약」으로 남습니다.
              </p>
            )}
            <DataTable
              rows={batch.items.filter((i) => i.status === '예약')}
              rowKey={(i) => i.id}
              dense
              columns={[
                { key: 'p', header: '받는 분', render: (i) => i.payee },
                { key: 'a', header: '계좌', render: (i) => <span className="font-mono text-xs">{digits(i.accountNo)}</span> },
                { key: 'm', header: '금액', align: 'right', render: (i) => <Amount value={i.amount} /> },
                {
                  key: 'r',
                  header: '결과',
                  render: (i) => {
                    const o = preview.outcome[i.id];
                    if (!preview.manual) return o ? <Badge tone={o.ok ? 'success' : 'danger'}>{o.ok ? '성공' : `실패 · ${o.reason}`}</Badge> : <span className="text-xs text-yuyu-fg-subtle">파일에 없음</span>;
                    return (
                      <div className="flex gap-1.5">
                        <Select value={o?.ok === false ? 'fail' : 'ok'} onChange={(e) => setPreview({ ...preview, outcome: { ...preview.outcome, [i.id]: { ok: e.target.value === 'ok', reason: e.target.value === 'ok' ? undefined : o?.reason || '계좌번호 오류' } } })} className="h-8 w-24">
                          <option value="ok">성공</option>
                          <option value="fail">실패</option>
                        </Select>
                        {o?.ok === false && <Input value={o.reason ?? ''} onChange={(e) => setPreview({ ...preview, outcome: { ...preview.outcome, [i.id]: { ok: false, reason: e.target.value } } })} placeholder="사유" className="h-8" />}
                      </div>
                    );
                  },
                },
              ]}
            />
            <p className="text-xs text-yuyu-fg-subtle">성공 건은 지급 전표(거래처 대금 · 개인 경비)를 발행하고 받는 직원에게 입금 알림을 보냅니다. 급여는 급여 전표에서 이미 지급으로 처리되어 있어 이체 완료만 표시합니다. 실패 건은 사유와 함께 지급 대기로 돌아갑니다.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

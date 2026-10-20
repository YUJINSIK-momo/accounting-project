// 결재라인 지정 — 조직도(법인 › 본부 › 팀)에서 사람을 골라 결재 · 합의 · 수신 · 참조로 넣는다
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, ChevronDown, ChevronRight, Folder, FolderOpen, Search, Send, Star, Trash2, X } from 'lucide-react';
import { Badge, Button, cx } from '../yuyu';
import { Input, Modal, Tabs, TextArea, toast } from './ui';
import { update, useDB } from '../../data/store';
import { DELEGATION_LIMIT, RANK_ORDER, defaultLine, defaultReceivers, type DocKind, type LineEntry } from '../../lib/approval';
import { uid, won } from '../../lib/format';
import type { DB, Dept, Employee } from '../../types';

type Box = '결재' | '수신' | '참조';

const rankIdx = (r: string) => (RANK_ORDER.indexOf(r) < 0 ? 99 : RANK_ORDER.indexOf(r));

function subtreeIds(depts: Dept[], id: string): string[] {
  return [id, ...depts.filter((d) => d.parentId === id).flatMap((d) => subtreeIds(depts, d.id))];
}

function DeptNode({ db, dept, depth, selected, onSelect }: { db: DB; dept: Dept; depth: number; selected?: string; onSelect: (id: string) => void }) {
  const children = db.depts.filter((d) => d.parentId === dept.id);
  const [open, setOpen] = useState(true);
  const count = db.employees.filter((e) => subtreeIds(db.depts, dept.id).includes(e.deptId)).length;
  return (
    <li>
      <div className={cx('flex items-center gap-1 rounded-yuyu-sm py-1 pr-2 text-sm', selected === dept.id ? 'bg-yuyu-brand/10 text-yuyu-fg' : 'text-yuyu-fg-muted hover:bg-yuyu-raised')} style={{ paddingLeft: depth * 14 + 4 }}>
        {children.length ? (
          <button type="button" aria-label={open ? '접기' : '펼치기'} onClick={() => setOpen(!open)} className="text-yuyu-fg-subtle">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <button type="button" onClick={() => onSelect(dept.id)} className="flex flex-1 items-center gap-1.5 text-left">
          {selected === dept.id ? <FolderOpen size={14} className="text-yuyu-brand" /> : <Folder size={14} className="text-yuyu-warning" />}
          <span className={selected === dept.id ? 'font-medium text-yuyu-fg' : ''}>{dept.name}</span>
          <span className="ml-auto font-mono text-[10px] text-yuyu-fg-subtle">{count}</span>
        </button>
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((c) => (
            <DeptNode key={c.id} db={db} dept={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ApprovalLineModal({ open, kind, drafterId, onClose, onSubmit }: { open: boolean; kind: DocKind; drafterId: string; onClose: () => void; onSubmit: (line: LineEntry[], receivers: string[], refs: string[], comment: string) => void }) {
  const db = useDB();
  const drafter = db.employees.find((e) => e.id === drafterId);
  const [tab, setTab] = useState<'org' | 'fav'>('org');
  const [deptId, setDeptId] = useState<string | undefined>(drafter?.deptId);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [box, setBox] = useState<Box>('결재');
  const [line, setLine] = useState<LineEntry[]>(() => defaultLine(db, drafterId).map((empId) => ({ empId, role: '결재' as const })));
  const [receivers, setReceivers] = useState<string[]>(() => defaultReceivers(kind));
  const [refs, setRefs] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [favName, setFavName] = useState('');

  const emp = (id: string) => db.employees.find((e) => e.id === id);
  const company = (e?: Employee) => db.companies.find((c) => c.id === e?.companyId)?.name ?? '';

  const members = useMemo(() => {
    const q = query.trim();
    const base = q
      ? db.employees.filter((e) => [e.name, e.dept, e.rank, company(e)].some((v) => v.includes(q)))
      : deptId
        ? db.employees.filter((e) => subtreeIds(db.depts, deptId).includes(e.deptId))
        : [];
    return base.filter((e) => e.id !== drafterId).sort((a, b) => a.dept.localeCompare(b.dept) || rankIdx(a.rank) - rankIdx(b.rank) || a.name.localeCompare(b.name));
  }, [db.employees, db.depts, query, deptId, drafterId]);

  const inUse = new Set([...line.map((l) => l.empId), ...receivers, ...refs]);
  const add = (target: '결재' | '합의' | '수신' | '참조') => {
    const ids = members.filter((m) => checked.has(m.id)).map((m) => m.id);
    if (!ids.length) return toast('위 목록에서 사람을 체크하세요.');
    const fresh = ids.filter((id) => !inUse.has(id));
    if (fresh.length < ids.length) toast('이미 결재선에 있는 사람은 건너뛰었습니다.');
    if (target === '결재' || target === '합의') {
      setLine([...line, ...fresh.map((empId) => ({ empId, role: target }))]);
      setBox('결재');
    } else if (target === '수신') {
      setReceivers([...receivers, ...fresh]);
      setBox('수신');
    } else {
      setRefs([...refs, ...fresh]);
      setBox('참조');
    }
    setChecked(new Set());
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...line];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setLine(next);
  };

  const favorites = db.lineFavorites.filter((f) => f.owner === drafterId);
  const saveFavorite = () => {
    if (!favName.trim()) return toast('개인결재라인 이름을 입력하세요.');
    if (!line.length) return toast('결재자가 한 명 이상 있어야 합니다.');
    update((d) => void d.lineFavorites.push({ id: `lf-${uid()}`, owner: drafterId, name: favName.trim(), line, receivers, refs }));
    toast('개인결재라인으로 저장했습니다.');
    setFavName('');
  };

  const roots = (companyId: string) => db.depts.filter((d) => d.companyId === companyId && !d.parentId);
  const lineRows = box === '결재' ? line.map((l) => ({ id: l.empId, role: l.role as string })) : (box === '수신' ? receivers : refs).map((id) => ({ id, role: box as string }));

  return (
    <Modal
      open={open}
      title={`결재라인 지정 · ${kind}`}
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-xs text-yuyu-fg-subtle">
            전결 한도(예시) ·{' '}
            {Object.entries(DELEGATION_LIMIT)
              .filter(([, v]) => v > 0)
              .map(([rank, v]) => `${rank} ${Number.isFinite(v) ? `${won(v / 10000)}만` : '무제한'}`)
              .join(' · ')}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button icon={Send} disabled={!line.length} onClick={() => onSubmit(line, receivers, refs, comment)}>
              상신
            </Button>
          </div>
        </div>
      }
    >
      <Tabs
        tabs={[
          { value: 'org', label: '조직도' },
          { value: 'fav', label: '개인결재라인', count: favorites.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'org' && (
        <div className="mt-3 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-yuyu-fg-subtle" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 · 부서 · 직급 검색" className="pl-8" />
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-yuyu-md border border-yuyu-line p-2">
              {db.companies.map((c) => (
                <div key={c.id} className="mb-1">
                  <div className="flex items-center gap-1.5 px-1 py-1 text-sm font-semibold text-yuyu-fg">
                    <Building2 size={14} className="text-yuyu-brand" /> {c.name}
                  </div>
                  <ul>
                    {roots(c.id).map((d) => (
                      <DeptNode key={d.id} db={db} dept={d} depth={1} selected={query ? undefined : deptId} onSelect={(id) => (setDeptId(id), setQuery(''), setChecked(new Set()))} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-yuyu-fg-muted">
                {query ? `검색 결과 ${members.length}명` : `${db.depts.find((d) => d.id === deptId)?.name ?? '부서를 고르세요'} · ${members.length}명`}
              </span>
              <div className="flex gap-1.5">
                {(['결재', '합의', '수신', '참조'] as const).map((t) => (
                  <Button key={t} size="sm" variant={t === '결재' ? 'solid' : 'outline'} onClick={() => add(t)}>
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-yuyu-md border border-yuyu-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-yuyu-raised text-xs text-yuyu-fg-muted">
                  <tr>
                    <th className="w-8 px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label="모두 고르기"
                        checked={members.length > 0 && members.every((m) => checked.has(m.id))}
                        onChange={(e) => setChecked(new Set(e.target.checked ? members.map((m) => m.id) : []))}
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left">회사</th>
                    <th className="px-2 py-1.5 text-left">부서</th>
                    <th className="px-2 py-1.5 text-left">직급</th>
                    <th className="px-2 py-1.5 text-left">사용자</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => {
                        const n = new Set(checked);
                        n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                        setChecked(n);
                      }}
                      className={cx('cursor-pointer border-t border-yuyu-line/60', checked.has(m.id) ? 'bg-yuyu-brand/10' : 'hover:bg-yuyu-raised', inUse.has(m.id) && 'text-yuyu-fg-subtle')}
                    >
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" aria-label={`${m.name} 고르기`} checked={checked.has(m.id)} readOnly />
                      </td>
                      <td className="px-2 py-1.5 text-xs">{company(m)}</td>
                      <td className="px-2 py-1.5">{m.dept}</td>
                      <td className="px-2 py-1.5">{m.rank}</td>
                      <td className="px-2 py-1.5 font-medium">
                        {m.name}
                        {inUse.has(m.id) && <span className="ml-1 text-[10px]">(지정됨)</span>}
                      </td>
                    </tr>
                  ))}
                  {!members.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-xs text-yuyu-fg-subtle">
                        조직도에서 부서를 고르거나 이름을 검색하세요
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Tabs
              tabs={[
                { value: '결재' as Box, label: '결재 · 합의', count: line.length },
                { value: '수신' as Box, label: '수신', count: receivers.length },
                { value: '참조' as Box, label: '참조', count: refs.length },
              ]}
              value={box}
              onChange={setBox}
            />
            <div className="max-h-[200px] overflow-y-auto rounded-yuyu-md border border-yuyu-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-yuyu-raised text-xs text-yuyu-fg-muted">
                  <tr>
                    <th className="w-16 px-2 py-1.5">이동</th>
                    <th className="w-10 px-2 py-1.5">NO</th>
                    <th className="px-2 py-1.5 text-left">종류</th>
                    <th className="px-2 py-1.5 text-left">회사</th>
                    <th className="px-2 py-1.5 text-left">부서</th>
                    <th className="px-2 py-1.5 text-left">사용자</th>
                    <th className="w-10 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-yuyu-line/60 text-yuyu-fg-muted">
                    <td />
                    <td className="px-2 py-1.5 text-center font-mono text-xs">-</td>
                    <td className="px-2 py-1.5">
                      <Badge tone="neutral">기안</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-xs">{company(drafter)}</td>
                    <td className="px-2 py-1.5">{drafter?.dept}</td>
                    <td className="px-2 py-1.5">
                      {drafter?.name} {drafter?.rank}
                    </td>
                    <td />
                  </tr>
                  {lineRows.map((r, i) => {
                    const e = emp(r.id);
                    return (
                      <tr key={r.id} className="border-t border-yuyu-line/60">
                        <td className="px-2 py-1.5 text-center">
                          {box === '결재' && (
                            <span className="inline-flex">
                              <button type="button" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)} className="p-0.5 text-yuyu-fg-muted disabled:opacity-30">
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" aria-label="아래로" disabled={i === lineRows.length - 1} onClick={() => move(i, 1)} className="p-0.5 text-yuyu-fg-muted disabled:opacity-30">
                                <ArrowDown size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-xs">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          {box === '결재' ? (
                            <button type="button" title="눌러서 결재 ↔ 합의" onClick={() => setLine(line.map((l, j) => (j === i ? { ...l, role: l.role === '결재' ? '합의' : '결재' } : l)))}>
                              <Badge tone={r.role === '합의' ? 'infra' : 'brand'}>{r.role}</Badge>
                            </button>
                          ) : (
                            <Badge tone={box === '수신' ? 'infra' : 'neutral'}>{box}</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{company(e)}</td>
                        <td className="px-2 py-1.5">{e?.dept}</td>
                        <td className="px-2 py-1.5">
                          {e?.name} <span className="text-xs text-yuyu-fg-subtle">{e?.rank}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            aria-label="빼기"
                            onClick={() => (box === '결재' ? setLine(line.filter((l) => l.empId !== r.id)) : box === '수신' ? setReceivers(receivers.filter((x) => x !== r.id)) : setRefs(refs.filter((x) => x !== r.id)))}
                            className="p-0.5 text-yuyu-fg-muted hover:text-yuyu-danger"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="상신 의견 (결재자에게 남길 말)" />
              <div className="flex flex-col gap-1.5 sm:w-56">
                <Input value={favName} onChange={(e) => setFavName(e.target.value)} placeholder="개인결재라인 이름" />
                <Button size="sm" variant="outline" icon={Star} onClick={saveFavorite}>
                  지금 결재선 저장
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'fav' && (
        <div className="mt-3 space-y-2">
          {favorites.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-yuyu-md border border-yuyu-line p-3">
              <Star size={14} className="text-yuyu-warning" />
              <span className="font-medium text-yuyu-fg">{f.name}</span>
              <span className="text-xs text-yuyu-fg-muted">
                {f.line.map((l) => `${emp(l.empId)?.name}${l.role === '합의' ? '(합의)' : ''}`).join(' › ')}
                {f.receivers.length ? ` · 수신 ${f.receivers.map((r) => emp(r)?.name).join(', ')}` : ''}
                {f.refs.length ? ` · 참조 ${f.refs.map((r) => emp(r)?.name).join(', ')}` : ''}
              </span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" onClick={() => (setLine(f.line), setReceivers(f.receivers), setRefs(f.refs), setTab('org'), toast(`'${f.name}' 결재선을 불러왔습니다.`))}>
                  불러오기
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => update((d) => void (d.lineFavorites = d.lineFavorites.filter((x) => x.id !== f.id)))}>
                  삭제
                </Button>
              </div>
            </div>
          ))}
          {!favorites.length && <p className="py-10 text-center text-sm text-yuyu-fg-subtle">저장한 개인결재라인이 없습니다. 조직도 탭에서 결재선을 만든 뒤 「지금 결재선 저장」을 누르세요.</p>}
        </div>
      )}
    </Modal>
  );
}

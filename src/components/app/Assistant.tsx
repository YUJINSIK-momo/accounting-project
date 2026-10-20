// AI 어시스턴트 패널 — 버튼 길잡이 + 글 입력. 쓰기는 확인 카드에서 사용자가 눌러야 실행된다.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bot, Check, FileSpreadsheet, KeyRound, Send, Settings2, Sparkles, X } from 'lucide-react';
import { Badge, Button, cx } from '../yuyu';
import { Input, MoneyInput, Select, TextArea, toast } from './ui';
import { SubmitDocModal } from './approval';
import { getDB, update, useDB } from '../../data/store';
import { addManualExpense, checkManualExpense, createProposal } from '../../lib/actions';
import { HOME, continueStep, freeText, runAction, welcome, type Action, type BotReply, type Chip, type Part } from '../../lib/assistantFlow';
import type { CardIntent } from '../../lib/assistant';
import { MODELS, llmIntent } from '../../lib/assistantLlm';
import { downloadXlsx } from '../../lib/xlsx';
import { monthLabel, today, won } from '../../lib/format';
import type { PayMethod } from '../../types';

interface Msg {
  id: number;
  role: 'user' | 'bot';
  text?: string;
  reply?: BotReply;
}

const KEY_STORE = 'assistant-claude-key';
const MODEL_STORE = 'assistant-model';
const safe = <T,>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function ConfirmCard({ intent, onDone, onSubmit }: { intent: CardIntent; onDone: (text: string) => void; onSubmit: (kind: '품의서' | '경비청구', id: string) => void }) {
  const db = useDB();
  const me = db.currentEmpId;
  const [done, setDone] = useState<string>();
  const [p, setP] = useState(intent.kind === 'proposal' ? intent : { kind: 'proposal' as const, title: '', amount: 0, body: '' });
  const [e, setE] = useState(intent.kind === 'expense' ? intent : { kind: 'expense' as const, date: today(), merchant: '', amount: 0, usageCode: '', memo: '', payMethod: '현금' as PayMethod });
  const box = 'mt-2 space-y-2 rounded-yuyu-md border border-yuyu-brand/40 bg-yuyu-brand/5 p-3';

  if (done) return <p className="mt-2 flex items-center gap-1.5 rounded-yuyu-sm bg-yuyu-success/10 px-3 py-2 text-xs text-yuyu-success"><Check size={14} /> {done}</p>;

  if (intent.kind === 'proposal') {
    const create = (submit: boolean) => {
      if (!p.title.trim() || p.amount <= 0) return toast('제목과 금액을 넣어 주세요.');
      let id = '';
      update((d) => void (id = createProposal(d, me, p)));
      const doc = getDB().proposals.find((x) => x.id === id)!;
      setDone(submit ? `${doc.docNo} 를 만들고 결재선 창을 열었어요.` : `${doc.docNo} 를 임시저장했어요.`);
      if (submit) onSubmit('품의서', id);
      else onDone(`${doc.docNo} 「${doc.title}」 를 임시저장했어요. 품의서 메뉴에서 이어서 상신할 수 있어요.`);
    };
    return (
      <div className={box}>
        <p className="text-xs font-semibold text-yuyu-brand">품의서 만들기 · 확인</p>
        <Input value={p.title} onChange={(ev) => setP({ ...p, title: ev.target.value })} placeholder="제목" />
        <MoneyInput value={p.amount} onChange={(n) => setP({ ...p, amount: n })} />
        <TextArea value={p.body} onChange={(ev) => setP({ ...p, body: ev.target.value })} placeholder="내용 · 목적 (선택)" />
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => create(false)}>임시저장</Button>
          <Button size="sm" icon={Send} onClick={() => create(true)}>결재선 지정하고 상신</Button>
        </div>
      </div>
    );
  }

  if (intent.kind === 'expense') {
    const add = () => {
      const problem = checkManualExpense(db, me, e);
      if (problem) return toast(problem);
      update((d) => void addManualExpense(d, me, e));
      const msg = `${monthLabel(today().slice(0, 7))} 경비청구서에 ${e.merchant} ${won(e.amount)}원을 넣었어요.`;
      setDone(msg);
      onDone(msg);
    };
    return (
      <div className={box}>
        <p className="text-xs font-semibold text-yuyu-brand">경비 한 건 넣기 · 확인</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} />
          <Select value={e.payMethod} onChange={(ev) => setE({ ...e, payMethod: ev.target.value as PayMethod })}>
            <option>현금</option>
            <option>개인카드</option>
          </Select>
          <Input value={e.merchant} onChange={(ev) => setE({ ...e, merchant: ev.target.value })} placeholder="사용처" />
          <MoneyInput value={e.amount} onChange={(n) => setE({ ...e, amount: n })} />
          <Select value={e.usageCode} invalid={!e.usageCode} onChange={(ev) => setE({ ...e, usageCode: ev.target.value })}>
            <option value="">용도 선택</option>
            {db.usages.map((u) => (
              <option key={u.code} value={u.code}>{u.name}</option>
            ))}
          </Select>
          <Input value={e.memo} onChange={(ev) => setE({ ...e, memo: ev.target.value })} placeholder="내용" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" icon={Check} onClick={add}>이번 달 청구서에 넣기</Button>
        </div>
      </div>
    );
  }

  const claim = db.claims.find((c) => c.empId === me && c.period === today().slice(0, 7));
  return (
    <div className={box}>
      <p className="text-xs font-semibold text-yuyu-brand">이번 달 경비 상신 · 확인</p>
      <div className="flex justify-end">
        <Button size="sm" icon={Send} disabled={!claim} onClick={() => claim && (setDone(`${claim.docNo} 결재선 창을 열었어요.`), onSubmit('경비청구', claim.id))}>
          결재선 지정하고 상신
        </Button>
      </div>
    </div>
  );
}

function Bubble({ msg, onChip, onLink, onDone, onSubmit, last }: { msg: Msg; onChip: (c: Chip) => void; onLink: (to: string) => void; onDone: (t: string) => void; onSubmit: (kind: '품의서' | '경비청구', id: string) => void; last: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-yuyu-lg rounded-br-yuyu-sm bg-yuyu-brand-strong px-3 py-2 text-sm text-white">{msg.text}</p>
      </div>
    );
  }
  const r = msg.reply!;
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yuyu-brand/10 text-yuyu-brand">
        <Bot size={15} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {r.generatedBy === 'ai' && <Badge tone="ai">AI 가 이해한 요청</Badge>}
        {r.parts.map((part: Part, i) => {
          if (part.kind === 'text') return <p key={i} className="whitespace-pre-line rounded-yuyu-lg rounded-tl-yuyu-sm bg-yuyu-raised px-3 py-2 text-sm leading-relaxed text-yuyu-fg">{part.text}</p>;
          if (part.kind === 'notice') return <p key={i} className={cx('rounded-yuyu-sm px-3 py-1.5 text-xs', part.tone === 'warning' ? 'bg-yuyu-warning/10 text-yuyu-warning' : 'bg-yuyu-infra/10 text-yuyu-infra')}>{part.text}</p>;
          if (part.kind === 'confirm') return <ConfirmCard key={i} intent={part.intent} onDone={onDone} onSubmit={onSubmit} />;
          if (part.kind === 'card')
            return (
              <div key={i} className="overflow-hidden rounded-yuyu-md border border-yuyu-line bg-yuyu-surface">
                <div className="flex items-center justify-between border-b border-yuyu-line px-3 py-2">
                  <span className="text-xs font-semibold text-yuyu-fg">{part.title}</span>
                  {part.rows && part.columns && (
                    <button type="button" onClick={() => downloadXlsx(`어시스턴트_${part.title}_${today()}`, [part.columns!, ...part.rows!])} className="flex items-center gap-1 text-[11px] text-yuyu-fg-muted hover:text-yuyu-fg">
                      <FileSpreadsheet size={12} className="text-yuyu-success" /> 엑셀로 받기
                    </button>
                  )}
                </div>
                {part.rows && part.columns && (
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-yuyu-raised text-yuyu-fg-muted">
                        <tr>{part.columns.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-medium">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {part.rows.slice(0, 30).map((row, ri) => (
                          <tr key={ri} className="border-t border-yuyu-line/60">
                            {row.map((v, ci) => <td key={ci} className={cx('whitespace-nowrap px-2 py-1', typeof v === 'number' && 'text-right font-mono')}>{typeof v === 'number' ? won(v) : v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {part.buttons?.length ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-yuyu-line p-2">
                    {part.buttons.map((b) => (
                      <button key={b.label} type="button" onClick={() => b.to && onLink(b.to)} className="flex items-center gap-1 rounded-yuyu-sm border border-yuyu-line px-2 py-1 text-[11px] text-yuyu-fg hover:bg-yuyu-raised">
                        {b.label} <ArrowUpRight size={11} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          // 칩은 마지막 답에서만 누를 수 있다 — 지난 단계의 칩을 눌러 흐름이 꼬이지 않게
          return (
            <div key={i} className="flex flex-wrap gap-1.5">
              {part.items.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  disabled={!last}
                  onClick={() => onChip(c)}
                  className={cx('rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40', c.label === '처음으로' ? 'border-yuyu-line text-yuyu-fg-muted' : 'border-yuyu-brand/40 text-yuyu-brand hover:bg-yuyu-brand/10', c.type === 'message' && 'border-dashed')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Assistant() {
  const db = useDB();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 1, role: 'bot', reply: welcome(db) }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => safe(() => sessionStorage.getItem(KEY_STORE) ?? '', ''));
  const [model, setModel] = useState(() => safe(() => localStorage.getItem(MODEL_STORE) ?? MODELS[0].id, MODELS[0].id));
  const [submitRef, setSubmitRef] = useState<{ kind: '품의서' | '경비청구'; id: string }>();
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(2);
  const lastEmp = useRef(db.currentEmpId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs, open]);
  // 사용자를 바꾸면 그 사람 입장의 첫 인사로 새로 시작한다
  useEffect(() => {
    if (lastEmp.current === db.currentEmpId) return;
    lastEmp.current = db.currentEmpId;
    setMsgs([{ id: seq.current++, role: 'bot', reply: welcome(getDB()) }]);
  }, [db.currentEmpId]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((list) => [...list, { ...m, id: seq.current++ }]);
  const lastBot = [...msgs].reverse().find((m) => m.role === 'bot')?.reply;

  const pressChip = (c: Chip) => {
    if (c.type === 'message') return send(c.text);
    push({ role: 'user', text: c.label });
    push({ role: 'bot', reply: runAction(getDB(), c.action as Action) });
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    push({ role: 'user', text });
    const d = getDB();
    const step = continueStep(d, text, lastBot);
    if (step) return push({ role: 'bot', reply: step });
    if (apiKey) {
      setBusy(true);
      try {
        const history = msgs.filter((m) => m.role === 'user').map((m) => m.text ?? '');
        const intent = await llmIntent(d, apiKey, model, text, history);
        push({ role: 'bot', reply: freeText(getDB(), text, intent) });
      } catch (err) {
        const r = freeText(getDB(), text);
        push({ role: 'bot', reply: { ...r, parts: [{ kind: 'notice', tone: 'warning', text: `AI 모델을 부르지 못해 규칙으로 답했어요 (${(err as Error).message}).` }, ...r.parts] } });
      } finally {
        setBusy(false);
      }
      return;
    }
    push({ role: 'bot', reply: freeText(d, text) });
  };

  const saveKey = (k: string) => {
    setApiKey(k);
    safe(() => (k ? sessionStorage.setItem(KEY_STORE, k) : sessionStorage.removeItem(KEY_STORE)), undefined);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-yuyu-brand-strong px-4 py-3 text-sm font-semibold text-white shadow-yuyu-raised hover:bg-yuyu-brand"
          aria-label="AI 어시스턴트 열기"
        >
          <Sparkles size={18} /> AI 어시스턴트
        </button>
      )}
      {open && (
        <aside className="fixed bottom-0 right-0 top-14 z-40 flex w-full flex-col border-l border-yuyu-line bg-yuyu-surface shadow-yuyu-raised sm:w-[440px]" aria-label="AI 어시스턴트">
          <header className="flex items-center gap-2 border-b border-yuyu-line px-4 py-3">
            <Sparkles size={18} className="text-yuyu-brand" />
            <span className="font-semibold text-yuyu-fg">AI 어시스턴트</span>
            <Badge tone={apiKey ? 'ai' : 'neutral'}>{apiKey ? MODELS.find((m) => m.id === model)?.label.split(' (')[0] : '규칙 모드'}</Badge>
            <div className="ml-auto flex gap-1">
              <button type="button" aria-label="설정" onClick={() => setSettings(!settings)} className="rounded-yuyu-sm p-1.5 text-yuyu-fg-muted hover:bg-yuyu-raised">
                <Settings2 size={16} />
              </button>
              <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="rounded-yuyu-sm p-1.5 text-yuyu-fg-muted hover:bg-yuyu-raised">
                <X size={16} />
              </button>
            </div>
          </header>

          {settings && (
            <div className="space-y-2 border-b border-yuyu-line bg-yuyu-raised/60 px-4 py-3 text-xs">
              <p className="font-semibold text-yuyu-fg">AI 모델 연결 (선택)</p>
              <p className="leading-relaxed text-yuyu-fg-muted">기본은 서버 없이 도는 규칙 모드입니다. 내 Claude API 키를 넣으면 글로 쓴 요청을 AI 모델이 이해합니다. 이때 입력한 문장과 부서 · 용도 이름이 Anthropic 으로 전송됩니다. 답의 숫자는 늘 이 앱 데이터로 계산합니다. 키는 이 탭에만 저장되고 탭을 닫으면 지워집니다.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-yuyu-fg-subtle" />
                  <Input type="password" value={apiKey} onChange={(ev) => saveKey(ev.target.value.trim())} placeholder="sk-ant-..." className="pl-8" autoComplete="off" />
                </div>
                <Select value={model} onChange={(ev) => (setModel(ev.target.value), safe(() => localStorage.setItem(MODEL_STORE, ev.target.value), undefined))} className="w-40">
                  {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </div>
              {apiKey && <Button size="sm" variant="ghost" onClick={() => saveKey('')}>키 지우고 규칙 모드로</Button>}
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <Bubble
                key={m.id}
                msg={m}
                last={i === msgs.length - 1}
                onChip={pressChip}
                onLink={(to) => navigate(to)}
                onDone={(t) =>
                  push({
                    role: 'bot',
                    reply: { generatedBy: 'template', parts: [{ kind: 'text', text: t }, { kind: 'suggestions', items: [{ type: 'action', label: '경비 넣기', action: { id: 'expense.start' } }, { type: 'action', label: '이번 달 경비 상신', action: { id: 'claim.submit' } }, HOME] }] },
                  })
                }
                onSubmit={(kind, id) => setSubmitRef({ kind, id })}
              />
            ))}
            {busy && <p className="pl-9 text-xs text-yuyu-fg-subtle">AI 모델에게 묻는 중…</p>}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t border-yuyu-line p-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent.isComposing) {
                  ev.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder={lastBot?.expects ? '여기에 답을 적거나 위 버튼을 누르세요' : '예: 11월 교육 강사료 120만원 품의 올려줘'}
              className="min-h-[44px] flex-1 resize-none rounded-yuyu-md border border-yuyu-line bg-yuyu-surface px-3 py-2 text-sm text-yuyu-fg placeholder:text-yuyu-fg-subtle focus:border-yuyu-brand/60 focus:outline-none"
            />
            <Button icon={Send} disabled={!input.trim() || busy} onClick={() => send(input)} className="self-end">
              보내기
            </Button>
          </form>
        </aside>
      )}
      <SubmitDocModal
        docRef={submitRef}
        drafterId={db.currentEmpId}
        onClose={() => setSubmitRef(undefined)}
        onDone={() => push({ role: 'bot', reply: { generatedBy: 'template', parts: [{ kind: 'text', text: '상신했어요. 첫 결재자에게 알림이 갔습니다.' }, { kind: 'suggestions', items: [{ type: 'action', label: '내 결재함', action: { id: 'inbox.start' } }, HOME] }] } })}
      />
    </>
  );
}

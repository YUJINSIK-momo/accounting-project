import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CreditCard, ExternalLink, FileSignature, FileText, Plus, Save, Send } from 'lucide-react';
import { Button, Callout, Card, PageHeader, SectionHeader, Stat } from '../components/yuyu';
import { Field, Input, MoneyInput, Select, TextArea, toast } from '../components/app/ui';
import { DocTable, SubmitDocModal } from '../components/app/approval';
import { update, useDB } from '../data/store';
import { addManualExpense, checkManualExpense, createProposal } from '../lib/actions';
import { docList, inbox } from '../lib/approval';
import { netPay } from '../lib/payroll';
import { monthLabel, sum, today, won } from '../lib/format';
import type { PayMethod } from '../types';

// 카드 · 현금영수증 · 세금계산서를 실제로 연동할 때 참고할 공개 문서
const INTEGRATIONS = [
  { title: '매입 전자세금계산서 수집', desc: '홈택스에 모인 매입 세금계산서를 API 로 가져온다. 회사 공동인증서나 홈택스 계정 등록이 필요하다.', label: '팝빌 홈택스 수집(전자세금계산서) 가이드', href: 'https://developers.popbill.com/guide/httaxinvoice/dotnet/getting-started/tutorial?fwn=asp' },
  { title: '현금영수증 매입내역 수집', desc: '홈택스 현금영수증 매입내역을 같은 방식으로 가져온다.', label: '팝빌 홈택스 수집(현금영수증) 레퍼런스', href: 'https://developers.popbill.com/reference/htcashbill/java/getting-started/tutorial' },
  { title: '법인카드 · 카드사 EDI', desc: '카드사와 계약해 승인 · 매입 데이터를 EDI 로 받는다. 카드사 직접 문의가 필요한 방식이다.', label: '비즈플레이 카드사 EDI 서비스', href: 'https://docs.bizplay.co.kr/undefined-5/basic-policy/edi' },
  { title: '법인카드 · 중계 API', desc: '카드사 기업 홈페이지 내역을 중계 API 로 수집한다. 카드사 계약 없이 쓸 수 있다.', label: 'CODEF API 소개', href: 'https://www.theteams.kr/teams/8383/post/70230' },
  { title: '수집 방식의 한계', desc: '비밀번호 변경 · 카드 재발급 때 연결이 끊길 수 있어 재연결 안내가 필요하다.', label: '스펜딧 카드 내역 연동 안내', href: 'https://intercom.help/spendit/ko/articles/9861840-%EB%93%B1%EB%A1%9D%EB%90%9C-%EC%B9%B4%EB%93%9C%EC%9D%98-%EB%82%B4%EC%97%AD%EC%9D%B4-%ED%99%95%EC%9D%B8%EB%90%98%EC%A7%80-%EC%95%8A%EC%95%84%EC%9A%94' },
];

const blankExpense = () => ({ date: today(), merchant: '', payMethod: '현금' as PayMethod, amount: 0, usageCode: '', memo: '' });

export default function Home() {
  const db = useDB();
  const navigate = useNavigate();
  const me = db.employees.find((e) => e.id === db.currentEmpId)!;
  const docs = docList(db);
  const boxes = inbox(docs, me.id);
  const ym = today().slice(0, 7);

  const myClaim = db.claims.find((c) => c.empId === me.id && c.period === ym);
  const myCardIds = db.cards.filter((c) => c.ownerId === me.id).map((c) => c.id);
  const unclaimed = db.cardTxns.filter((t) => myCardIds.includes(t.cardId) && !t.claimItemId && !t.blocked);
  const inProgress = boxes.상신문서.filter((d) => d.status === '결재중');
  const rejected = boxes.상신문서.filter((d) => d.status === '반려');
  const lastPay = [...db.payrolls].filter((r) => r.status === '확정').sort((a, b) => b.ym.localeCompare(a.ym))[0];
  const myPay = lastPay?.lines.find((l) => l.empId === me.id);
  const unread = db.notifications.filter((n) => n.to === me.id && !n.read).length;

  const [expense, setExpense] = useState(blankExpense);
  const [proposal, setProposal] = useState({ title: '', amount: 0, body: '' });
  const [submitId, setSubmitId] = useState<string>();

  const addExpense = () => {
    const problem = checkManualExpense(db, me.id, expense);
    if (problem) return toast(problem);
    update((d) => void addManualExpense(d, me.id, expense));
    toast(`${monthLabel(ym)} 경비청구서에 1건을 넣었습니다.`);
    setExpense(blankExpense());
  };

  const saveProposal = (submit: boolean) => {
    if (!proposal.title.trim() || proposal.amount <= 0) return toast('제목과 금액을 입력하세요.');
    let id = '';
    update((d) => void (id = createProposal(d, me.id, proposal)));
    setProposal({ title: '', amount: 0, body: '' });
    if (submit) setSubmitId(id);
    else toast('품의서를 임시저장했습니다. 품의서 메뉴에서 이어서 상신할 수 있습니다.');
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${me.dept} · ${me.rank}`} title={`${me.name}님, 안녕하세요`} lead={`오늘은 ${today()}입니다. 처리할 결재와 이번 달 경비를 먼저 확인하세요.`} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat value={`${boxes.미결문서.length}건`} label="내 미결문서" hint="내가 결재 · 수신할 차례" tone="warning" />
        <Stat value={`${inProgress.length}건`} label="진행 중인 상신" hint={rejected.length ? `반려 ${rejected.length}건 있음` : '반려 없음'} tone={rejected.length ? 'danger' : 'brand'} />
        <Stat value={`${won(sum(myClaim?.items ?? [], (i) => i.amount))}원`} label={`${monthLabel(ym)} 내 경비`} hint={myClaim ? `${myClaim.items.length}건 · ${myClaim.status}` : '아직 청구서 없음'} tone="infra" />
        <Stat value={`${unclaimed.length}건`} label="미청구 카드 내역" hint={`${won(sum(unclaimed, (t) => t.amount))}원`} tone="neutral" />
        <Stat value={myPay ? `${won(netPay(myPay))}원` : '-'} label="최근 실수령액" hint={lastPay ? `${monthLabel(lastPay.ym)} · 지급 ${lastPay.payDate}` : ''} tone="success" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-yuyu-fg">
              <CreditCard size={16} className="text-yuyu-brand" /> 빠른 경비 입력
            </h2>
            <Button size="sm" variant="ghost" trailingIcon={ArrowRight} to="/claims/new">
              카드 내역으로 청구
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="사용일">
              <Input type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} />
            </Field>
            <Field label="결제방법">
              <Select value={expense.payMethod} onChange={(e) => setExpense({ ...expense, payMethod: e.target.value as PayMethod })}>
                <option>현금</option>
                <option>개인카드</option>
              </Select>
            </Field>
            <Field label="사용처" required>
              <Input value={expense.merchant} onChange={(e) => setExpense({ ...expense, merchant: e.target.value })} placeholder="예: 시티 택시" />
            </Field>
            <Field label="금액" required>
              <MoneyInput value={expense.amount} onChange={(n) => setExpense({ ...expense, amount: n })} />
            </Field>
            <Field label="용도" required>
              <Select value={expense.usageCode} onChange={(e) => setExpense({ ...expense, usageCode: e.target.value })}>
                <option value="">선택</option>
                {db.usages.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="내용">
              <Input value={expense.memo} onChange={(e) => setExpense({ ...expense, memo: e.target.value })} placeholder="예: 외근 이동" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button icon={Plus} onClick={addExpense}>
              이번 달 청구서에 넣기
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-yuyu-fg">
              <FileSignature size={16} className="text-yuyu-brand" /> 빠른 품의
            </h2>
            <Button size="sm" variant="ghost" trailingIcon={ArrowRight} icon={FileText} to="/disbursements/new">
              지출결의서 작성
            </Button>
          </div>
          <div className="grid gap-3">
            <Field label="제목" required>
              <Input value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} placeholder="예: 11월 팀 교육비" />
            </Field>
            <Field label="품의금액 (부가세 포함)" required>
              <MoneyInput value={proposal.amount} onChange={(n) => setProposal({ ...proposal, amount: n })} />
            </Field>
            <Field label="내용">
              <TextArea value={proposal.body} onChange={(e) => setProposal({ ...proposal, body: e.target.value })} placeholder="목적, 일정, 산출 근거" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" icon={Save} onClick={() => saveProposal(false)}>
              임시저장
            </Button>
            <Button icon={Send} onClick={() => saveProposal(true)}>
              결재상신
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="내 미결문서"
          description="내가 결재하거나 수신할 차례인 문서입니다."
          action={
            <Button size="sm" variant="outline" trailingIcon={ArrowRight} to="/approvals">
              결재함 · 알림 {unread}건
            </Button>
          }
        />
        <DocTable rows={boxes.미결문서} onOpen={(d) => navigate(`/approvals?doc=${encodeURIComponent(`${d.kind}:${d.id}`)}`)} />
      </div>

      <div className="space-y-3">
        <SectionHeader title="카드 · 현금영수증 · 세금계산서 연동 안내" description="지금 화면의 카드 내역과 세금계산서는 예시 데이터입니다. 실제로 연동할 때 참고할 방식과 문서입니다." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((x) => (
            <Card key={x.href} href={x.href} padding="sm">
              <h3 className="text-sm font-semibold text-yuyu-fg">{x.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-yuyu-fg-muted">{x.desc}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-yuyu-brand">
                {x.label} <ExternalLink size={12} aria-hidden />
              </p>
            </Card>
          ))}
        </div>
        <Callout tone="warning" title="실제 연동에는 서버가 필요합니다">
          인증서 · 계정을 안전하게 보관하고 정기 수집을 돌릴 백엔드가 있어야 합니다. 이 데모는 브라우저에만 저장하는 정적 페이지라 외부 서비스를 직접 부르지 않습니다.
        </Callout>
      </div>

      <SubmitDocModal docRef={submitId ? { kind: '품의서', id: submitId } : undefined} drafterId={me.id} onClose={() => setSubmitId(undefined)} />
    </div>
  );
}

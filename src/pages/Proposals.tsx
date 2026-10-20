import { useState } from 'react';
import { FileText, Plus, Send } from 'lucide-react';
import { Button, PageHeader } from '../components/yuyu';
import { Amount, DataTable, Field, Input, Modal, MoneyInput, StatusBadge, TextArea, Toolbar, toast } from '../components/app/ui';
import { empName, nextDocNo, update, useDB } from '../data/store';
import { nowStamp, sum, today, uid } from '../lib/format';

export default function Proposals() {
  const db = useDB();
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', amount: 0, body: '' });

  const spent = (pid: string) => sum(db.disbursements.filter((d) => d.proposalId === pid && d.status !== '반려').flatMap((d) => d.lines), (l) => l.supply + l.vat);
  const rows = db.proposals.filter((p) => !keyword || p.title.includes(keyword)).sort((a, b) => b.draftDate.localeCompare(a.draftDate));

  const save = (submit: boolean) => {
    if (!form.title.trim() || form.amount <= 0) return toast('제목과 금액을 입력하세요.');
    update((d) => {
      d.proposals.push({
        id: `p-${uid()}`,
        docNo: nextDocNo(d, 'PRO'),
        title: form.title.trim(),
        amount: form.amount,
        body: form.body,
        draftDate: today(),
        empId: d.currentEmpId,
        status: submit ? '결재중' : '작성중',
        submittedAt: submit ? nowStamp() : undefined,
      });
    });
    toast(submit ? '품의서를 상신했습니다.' : '품의서를 저장했습니다.');
    setOpen(false);
    setForm({ title: '', amount: 0, body: '' });
  };

  const submit = (id: string) =>
    update((d) => {
      const p = d.proposals.find((x) => x.id === id);
      if (p) Object.assign(p, { status: '결재중', submittedAt: nowStamp(), decidedAt: undefined });
    });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="품의 · 지출결의" title="품의서" lead="지출 전에 금액과 목적을 승인받습니다. 승인된 품의서는 지출결의서에 연결해 집행액을 따라갑니다." />
      <Toolbar>
        <Field label="제목" className="w-60">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="제목 검색" />
        </Field>
        <div className="ml-auto">
          <Button icon={Plus} onClick={() => setOpen(true)}>
            신규작성
          </Button>
        </div>
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        showFooter
        columns={[
          { key: 'no', header: '문서번호', render: (p) => <span className="font-mono text-xs">{p.docNo}</span>, footer: `${rows.length}건` },
          { key: 't', header: '제목', render: (p) => p.title },
          { key: 'emp', header: '기안자', render: (p) => empName(db, p.empId) },
          { key: 'date', header: '기안일자', render: (p) => <span className="font-mono text-xs">{p.draftDate}</span> },
          { key: 'amt', header: '품의금액', align: 'right', render: (p) => <Amount value={p.amount} />, footer: <Amount value={sum(rows, (p) => p.amount)} /> },
          { key: 'spent', header: '집행액', align: 'right', render: (p) => <Amount value={spent(p.id)} /> },
          { key: 'left', header: '잔액', align: 'right', render: (p) => <Amount value={p.amount - spent(p.id)} tone={p.amount - spent(p.id) < 0 ? 'danger' : undefined} /> },
          { key: 'st', header: '결재상태', align: 'center', render: (p) => <StatusBadge status={p.status} /> },
          {
            key: 'act',
            header: '',
            align: 'right',
            render: (p) =>
              p.status === '작성중' || p.status === '반려' ? (
                <Button size="sm" variant="outline" icon={Send} onClick={() => submit(p.id)}>
                  상신
                </Button>
              ) : p.status === '결재완료' ? (
                <Button size="sm" variant="ghost" icon={FileText} to={`/disbursements/new?proposal=${p.id}`}>
                  지출결의
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={open}
        title="품의서 작성"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="outline" onClick={() => save(false)}>
              임시저장
            </Button>
            <Button icon={Send} onClick={() => save(true)}>
              결재상신
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="제목" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 11월 사내 교육 강사료" />
          </Field>
          <Field label="품의금액 (부가세 포함)" required>
            <MoneyInput value={form.amount} onChange={(n) => setForm({ ...form, amount: n })} />
          </Field>
          <Field label="내용">
            <TextArea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="목적, 일정, 산출 근거" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

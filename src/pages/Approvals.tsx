import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Pipeline } from '../components/yuyu';
import { Tabs } from '../components/app/ui';
import { DocTable, DocumentModal } from '../components/app/approval';
import { useDB } from '../data/store';
import { docList, inbox, type DocKind } from '../lib/approval';

type Tab = '미결문서' | '상신문서' | '기결문서' | '수신참조문서' | '전체';
const TABS: Tab[] = ['미결문서', '상신문서', '기결문서', '수신참조문서', '전체'];

export default function Approvals() {
  const db = useDB();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('미결문서');
  const boxes = inbox(docList(db), db.currentEmpId);
  const rows = [...boxes[tab]].sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  // 알림에서 넘어오면 ?doc=종류:id 로 문서를 바로 연다
  const open = params.get('doc');
  const [kind, id] = open ? (open.split(':') as [DocKind, string]) : [];
  const me = db.employees.find((e) => e.id === db.currentEmpId);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="결재" title="결재함" lead={`${me?.name} ${me?.rank} 기준입니다. 오른쪽 위에서 사용자를 바꾸면 결재자 · 수신자 입장에서 볼 수 있습니다.`}>
        <Pipeline
          nodes={[
            { label: '기안 · 상신', sub: '결재선 지정', tone: 'brand' },
            { label: '발신결재', sub: '결재자 순서대로', tone: 'warning', human: true },
            { label: '종결', sub: '반려 시 기안자에게', tone: 'success' },
            { label: '수신결재', sub: '수신 부서가 접수', tone: 'infra', human: true },
            { label: '참조 열람', sub: '알림 · 메일 공유', tone: 'neutral' },
          ]}
        />
      </PageHeader>
      <Tabs<Tab> tabs={TABS.map((t) => ({ value: t, label: t, count: boxes[t].length }))} value={tab} onChange={setTab} />
      <DocTable rows={rows} onOpen={(d) => setParams({ doc: `${d.kind}:${d.id}` })} />
      <DocumentModal docRef={kind && id ? { kind, id } : undefined} onClose={() => setParams({})} />
    </div>
  );
}

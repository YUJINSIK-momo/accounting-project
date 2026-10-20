import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, PageHeader } from '../components/yuyu';
import { Amount, DataTable, StatusBadge, Toolbar } from '../components/app/ui';
import { empName, useDB } from '../data/store';
import { checkDisbLine, worst } from '../lib/journal';
import { sum } from '../lib/format';

export default function DisbursementList() {
  const db = useDB();
  const navigate = useNavigate();
  const rows = [...db.disbursements].sort((a, b) => b.acctDate.localeCompare(a.acctDate));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="품의 · 지출결의" title="지출결의서" lead="거래처에 지급할 비용을 증빙과 함께 결재받습니다. 행을 누르면 문서가 열립니다." />
      <Toolbar>
        <span className="self-center text-sm text-yuyu-fg-muted">{rows.length}건</span>
        <div className="ml-auto">
          <Button icon={Plus} to="/disbursements/new">
            지출결의서 작성
          </Button>
        </div>
      </Toolbar>
      <DataTable
        exportName="지출결의서"
        rows={rows}
        rowKey={(d) => d.id}
        onRowClick={(d) => navigate(`/disbursements/${d.id}`)}
        showFooter
        columns={[
          { key: 'no', header: '문서번호', render: (d) => <span className="font-mono text-xs">{d.docNo}</span>, footer: '합계' },
          { key: 'date', header: '회계처리일자', render: (d) => <span className="font-mono text-xs">{d.acctDate}</span> },
          { key: 't', header: '제목', render: (d) => d.title },
          { key: 'emp', header: '기안자', render: (d) => empName(db, d.empId) },
          { key: 'p', header: '품의서', render: (d) => <span className="font-mono text-xs text-yuyu-fg-muted">{db.proposals.find((p) => p.id === d.proposalId)?.docNo ?? '-'}</span> },
          { key: 'amt', header: '합계액', align: 'right', render: (d) => <Amount value={sum(d.lines, (l) => l.supply + l.vat)} />, footer: <Amount value={sum(rows.flatMap((d) => d.lines), (l) => l.supply + l.vat)} /> },
          { key: 'chk', header: '검증', align: 'center', render: (d) => <span className="text-xs text-yuyu-fg-muted">{worst(d.lines.map(checkDisbLine))}</span> },
          { key: 'st', header: '결재상태', align: 'center', render: (d) => <StatusBadge status={d.status} /> },
          {
            key: 'v',
            header: '전표 · 지급',
            align: 'center',
            render: (d) => (
              <span className="text-xs">
                {d.voucherId ? <span className="text-yuyu-success">발행</span> : <span className="text-yuyu-fg-subtle">미발행</span>}
                {' · '}
                {d.paidVoucherId ? <span className="text-yuyu-success">지급</span> : <span className="text-yuyu-fg-subtle">미지급</span>}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

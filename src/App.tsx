import { useState, type ElementType } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowRightLeft, BarChart3, BookOpen, BookOpenText, Building2, Calculator, CheckSquare, ClipboardList, CreditCard, FileSignature, FileText,
  FileBarChart2, HandCoins, Home as HomeIcon, Landmark, Layers, PiggyBank, ListChecks, Menu, Receipt, ReceiptText, RotateCcw, Scale, ShieldAlert, Table2, Wallet, X,
} from 'lucide-react';
import { Badge, cx } from './components/yuyu';
import { resetDB, update, useDB } from './data/store';
import { NotificationBell } from './components/app/NotificationBell';
import { Assistant } from './components/app/Assistant';
import { inbox, docList } from './lib/approval';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ExpenseClaim from './pages/ExpenseClaim';
import ClaimList from './pages/ClaimList';
import Approvals from './pages/Approvals';
import Proposals from './pages/Proposals';
import DisbursementList from './pages/DisbursementList';
import DisbursementForm from './pages/DisbursementForm';
import VoucherProcessing from './pages/VoucherProcessing';
import JournalBook from './pages/JournalBook';
import GeneralLedger from './pages/GeneralLedger';
import TrialBalance from './pages/TrialBalance';
import DeptSummary from './pages/DeptSummary';
import UsageCheck from './pages/UsageCheck';
import MasterData from './pages/MasterData';
import Payroll from './pages/Payroll';
import Payslips from './pages/Payslips';
import Severance from './pages/Severance';
import YearEnd from './pages/YearEnd';
import TaxInvoices from './pages/TaxInvoices';
import Budget from './pages/Budget';
import Statements from './pages/Statements';
import Manual from './pages/Manual';
import Payments from './pages/Payments';

interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '현황',
    items: [
      { to: '/', label: '홈', icon: HomeIcon },
      { to: '/approvals', label: '결재함', icon: CheckSquare },
      { to: '/analytics', label: '경비현황분석', icon: BarChart3 },
    ],
  },
  {
    group: '경비청구',
    items: [
      { to: '/claims/new', label: '경비청구작성', icon: CreditCard },
      { to: '/claims', label: '청구내역', icon: ClipboardList },
      { to: '/reports/dept', label: '경비부서집계표', icon: Table2 },
      { to: '/reports/check', label: '사용 점검', icon: ShieldAlert },
    ],
  },
  {
    group: '품의 · 지출결의',
    items: [
      { to: '/proposals', label: '품의서', icon: FileSignature },
      { to: '/disbursements', label: '지출결의서', icon: FileText },
    ],
  },
  {
    group: '회계',
    items: [
      { to: '/vouchers', label: '전표처리', icon: Receipt },
      { to: '/payments', label: '지급 · 이체', icon: ArrowRightLeft },
      { to: '/journal', label: '분개장', icon: ListChecks },
      { to: '/ledger', label: '총계정원장', icon: BookOpen },
      { to: '/trial-balance', label: '합계잔액시산표', icon: Scale },
      { to: '/statements', label: '재무제표', icon: FileBarChart2 },
      { to: '/budget', label: '예산 대비 집행', icon: PiggyBank },
    ],
  },
  {
    group: '급여 · 세무',
    items: [
      { to: '/payroll', label: '급여대장', icon: Wallet },
      { to: '/payslips', label: '급여명세서', icon: HandCoins },
      { to: '/severance', label: '퇴직금 시뮬레이션', icon: Calculator },
      { to: '/year-end', label: '연말정산', icon: Landmark },
      { to: '/tax-invoices', label: '세금계산서 · 부가세', icon: ReceiptText },
    ],
  },
  { group: '기초정보', items: [{ to: '/master', label: '기초정보관리', icon: Layers }] },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="메뉴" className="space-y-5 px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-yuyu-fg-subtle">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-yuyu-sm px-2 py-1.5 text-sm transition-colors',
                      isActive ? 'bg-yuyu-brand/15 font-medium text-yuyu-fg' : 'text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg',
                    )
                  }
                >
                  <it.icon size={16} aria-hidden />
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function App() {
  const db = useDB();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const me = db.employees.find((e) => e.id === db.currentEmpId)!;
  const pending = inbox(docList(db), db.currentEmpId).미결문서.length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-yuyu-line/60 bg-yuyu-surface/95 px-4 backdrop-blur">
        <button type="button" className="rounded-yuyu-sm p-1.5 text-yuyu-fg-muted hover:bg-yuyu-raised lg:hidden" aria-label="메뉴 열기" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <NavLink to="/" aria-label="홈으로" className="flex items-center gap-2 rounded-yuyu-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-yuyu-sm bg-yuyu-brand-strong text-sm font-bold text-white">₩</span>
          <span className="font-semibold text-yuyu-fg">경비 · 지출 회계</span>
          <Badge tone="brand" className="hidden sm:inline-flex">데모</Badge>
        </NavLink>
        <div className="ml-auto flex items-center gap-2">
          <NavLink
            to="/manual"
            className={({ isActive }) =>
              cx(
                'flex h-8 items-center gap-1.5 rounded-yuyu-sm border px-2.5 text-xs transition-colors',
                isActive ? 'border-yuyu-brand/50 bg-yuyu-brand/10 text-yuyu-fg' : 'border-yuyu-line text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg',
              )
            }
          >
            <BookOpenText size={14} aria-hidden />
            <span>매뉴얼</span>
          </NavLink>
          <span className="hidden items-center gap-1.5 text-xs text-yuyu-fg-muted md:flex">
            <Building2 size={14} aria-hidden />
            {db.company}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-yuyu-fg-muted">
            <span className="hidden sm:inline">사용자</span>
            <select
              value={db.currentEmpId}
              onChange={(e) => update((d) => void (d.currentEmpId = e.target.value))}
              className="h-8 rounded-yuyu-sm border border-yuyu-line bg-yuyu-surface px-2 text-xs text-yuyu-fg"
            >
              {db.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.dept}
                </option>
              ))}
            </select>
          </label>
          <NotificationBell />
          <button
            type="button"
            onClick={() => {
              if (window.confirm('데모 데이터를 처음 상태로 되돌릴까요? 직접 입력한 내용은 지워집니다.')) resetDB();
            }}
            className="flex h-8 items-center gap-1.5 rounded-yuyu-sm border border-yuyu-line/70 px-2.5 text-xs text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg"
          >
            <RotateCcw size={14} aria-hidden />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-yuyu-line/60 bg-yuyu-surface lg:block">
          <Sidebar />
          <div className="mx-3 mb-4 rounded-yuyu-md border border-yuyu-line/50 p-3 text-xs text-yuyu-fg-subtle">
            {me.name} {me.rank} · 내 미결 <span className="font-mono text-yuyu-warning">{pending}</span>건
          </div>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-yuyu-fg/40" />
            <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-yuyu-line/60 bg-yuyu-surface" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end p-2">
                <button type="button" aria-label="메뉴 닫기" className="rounded-yuyu-sm p-1.5 text-yuyu-fg-muted hover:bg-yuyu-raised" onClick={() => setMenuOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main key={location.pathname} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analytics" element={<Dashboard />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/claims/new" element={<ExpenseClaim />} />
            <Route path="/claims" element={<ClaimList />} />
            <Route path="/reports/dept" element={<DeptSummary />} />
            <Route path="/reports/check" element={<UsageCheck />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/disbursements" element={<DisbursementList />} />
            <Route path="/disbursements/new" element={<DisbursementForm />} />
            <Route path="/disbursements/:id" element={<DisbursementForm />} />
            <Route path="/vouchers" element={<VoucherProcessing />} />
            <Route path="/journal" element={<JournalBook />} />
            <Route path="/ledger" element={<GeneralLedger />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/payslips" element={<Payslips />} />
            <Route path="/severance" element={<Severance />} />
            <Route path="/year-end" element={<YearEnd />} />
            <Route path="/tax-invoices" element={<TaxInvoices />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/master" element={<MasterData />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/manual/:id" element={<Manual />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Assistant />
    </div>
  );
}

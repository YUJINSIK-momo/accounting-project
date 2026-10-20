export type AccountType = '자산' | '부채' | '자본' | '수익' | '비용';

export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

/** 용도: 사용자가 고르는 지출 분류. 전표를 만들 때 계정과목으로 바뀐다. */
export interface Usage {
  code: string;
  name: string;
  accountCode: string;
}

export interface Vendor {
  id: string;
  name: string;
  bizNo: string;
}

export interface Employee {
  id: string;
  name: string;
  dept: string;
  rank: string;
  bank: string;
  accountNo: string;
}

export interface Card {
  id: string;
  name: string;
  last4: string;
  ownerId: string;
  kind: '법인카드' | '개인카드';
}

export interface CardTxn {
  id: string;
  cardId: string;
  usedAt: string; // YYYY-MM-DD HH:mm
  merchant: string;
  bizNo: string;
  amount: number;
  blocked: boolean; // 청구불가
  claimItemId?: string;
}

export type ApprovalStatus = '작성중' | '결재중' | '결재완료' | '반려';

export type PayMethod = '법인카드' | '개인카드' | '현금';

export interface ClaimItem {
  id: string;
  usedAt: string;
  merchant: string;
  payMethod: PayMethod;
  amount: number;
  usageCode: string;
  memo: string;
  txnId?: string;
}

export interface Claim {
  id: string;
  docNo: string;
  empId: string;
  period: string; // YYYY-MM
  items: ClaimItem[];
  status: ApprovalStatus;
  submittedAt?: string;
  decidedAt?: string;
  voucherId?: string;
}

export interface Proposal {
  id: string;
  docNo: string;
  title: string;
  amount: number;
  draftDate: string;
  empId: string;
  body: string;
  status: ApprovalStatus;
  submittedAt?: string;
  decidedAt?: string;
}

export type Evidence = '세금계산서' | '계산서' | '카드' | '현금영수증' | '기타';

export interface DisbLine {
  id: string;
  usageCode: string;
  memo: string;
  vendorId: string;
  supply: number;
  vat: number;
  evidence: Evidence;
  evidenceNo: string;
}

export interface Disbursement {
  id: string;
  docNo: string;
  title: string;
  acctDate: string;
  proposalId?: string;
  project: string;
  splitMode: '지출결의별' | '지출내역별';
  lines: DisbLine[];
  evidenceDate: string;
  payDate: string;
  empId: string;
  dept: string;
  bank: string;
  accountNo: string;
  holder: string;
  status: ApprovalStatus;
  submittedAt?: string;
  decidedAt?: string;
  voucherId?: string;
  paidVoucherId?: string;
}

export interface VoucherLine {
  side: '차변' | '대변';
  accountCode: string;
  amount: number;
  vendor: string;
  memo: string;
}

export interface Voucher {
  id: string;
  no: string;
  date: string;
  kind: '경비' | '지출결의' | '지급';
  sourceId: string;
  memo: string;
  lines: VoucherLine[];
  status: '미발행' | '발행';
}

export interface DB {
  version: number;
  company: string;
  currentEmpId: string;
  accounts: Account[];
  usages: Usage[];
  vendors: Vendor[];
  employees: Employee[];
  cards: Card[];
  cardTxns: CardTxn[];
  claims: Claim[];
  proposals: Proposal[];
  disbursements: Disbursement[];
  vouchers: Voucher[];
  seq: Record<string, number>;
}

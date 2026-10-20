import type { TransferColumn } from '../types';

// 금융기관 표준 3자리 코드. 가상은행 · 예시은행은 데모 데이터용이라 실제 코드가 아니다.
export const BANKS: Array<{ name: string; code: string }> = [
  { name: 'KDB산업은행', code: '002' },
  { name: 'IBK기업은행', code: '003' },
  { name: 'KB국민은행', code: '004' },
  { name: '수협은행', code: '007' },
  { name: 'NH농협은행', code: '011' },
  { name: '우리은행', code: '020' },
  { name: 'SC제일은행', code: '023' },
  { name: '한국씨티은행', code: '027' },
  { name: 'iM뱅크', code: '031' },
  { name: '부산은행', code: '032' },
  { name: '광주은행', code: '034' },
  { name: '제주은행', code: '035' },
  { name: '전북은행', code: '037' },
  { name: '경남은행', code: '039' },
  { name: '새마을금고', code: '045' },
  { name: '신협', code: '048' },
  { name: '우체국', code: '071' },
  { name: '하나은행', code: '081' },
  { name: '신한은행', code: '088' },
  { name: '케이뱅크', code: '089' },
  { name: '카카오뱅크', code: '090' },
  { name: '토스뱅크', code: '092' },
  { name: '가상은행', code: '901' },
  { name: '예시은행', code: '902' },
];

const norm = (s: string) => s.replace(/\s|은행|\(.*?\)/g, '').replace(/^(KB|IBK|NH|KDB|SC)/i, '');

/** 은행 이름으로 코드를 찾는다 — "국민" "신한은행" "KB국민은행" 처럼 써도 찾는다 */
export function bankCode(name: string): string {
  const n = norm(name);
  if (!n) return '';
  return BANKS.find((b) => norm(b.name) === n)?.code ?? BANKS.find((b) => norm(b.name).includes(n) || n.includes(norm(b.name)))?.code ?? '';
}

/** 이체 파일 기본 양식 — 기초정보에서 은행 양식에 맞게 열 이름 · 순서를 바꾼다 */
export const DEFAULT_COLUMNS: TransferColumn[] = [
  { key: 'seq', header: '순번', include: true },
  { key: 'bankCode', header: '입금은행코드', include: true },
  { key: 'bankName', header: '입금은행', include: false },
  { key: 'accountNo', header: '입금계좌번호', include: true },
  { key: 'holder', header: '예금주', include: true },
  { key: 'amount', header: '이체금액', include: true },
  { key: 'payeeMemo', header: '받는분통장표시', include: true },
  { key: 'myMemo', header: '내통장표시', include: true },
  { key: 'scheduledDate', header: '이체예정일', include: false },
  { key: 'docNo', header: '메모(문서번호)', include: false },
];

export const digits = (s: string) => s.replace(/\D/g, '');

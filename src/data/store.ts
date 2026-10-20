import { useSyncExternalStore } from 'react';
import type { DB, Voucher, VoucherLine } from '../types';
import { DB_VERSION, seed } from './seed';

const KEY = 'accounting-demo-db';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리로만 돈다
  }
  return seed();
}

let db: DB = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // 위와 같은 이유로 무시한다
  }
}

export const getDB = () => db;

export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => db,
  );
}

export function update(fn: (draft: DB) => void) {
  const draft = structuredClone(db);
  fn(draft);
  db = draft;
  persist();
  listeners.forEach((l) => l());
}

export function resetDB() {
  db = seed();
  persist();
  listeners.forEach((l) => l());
}

export function nextSeq(d: DB, key: string) {
  d.seq[key] = (d.seq[key] ?? 0) + 1;
  return d.seq[key];
}

export const nextDocNo = (d: DB, prefix: string, year = new Date().getFullYear()) =>
  `${prefix}-${year}-${String(nextSeq(d, prefix)).padStart(4, '0')}`;

export function addVoucher(d: DB, v: Omit<Voucher, 'id' | 'no'>) {
  const id = `vc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const no = `${v.date.replaceAll('-', '')}-${String(nextSeq(d, `V${v.date}`)).padStart(4, '0')}`;
  d.vouchers.push({ ...v, id, no });
  return id;
}

export const accountName = (d: DB, code: string) => d.accounts.find((a) => a.code === code)?.name ?? code;
export const usageName = (d: DB, code: string) => d.usages.find((u) => u.code === code)?.name ?? '-';
export const empName = (d: DB, id: string) => d.employees.find((e) => e.id === id)?.name ?? '-';
export const vendorName = (d: DB, id: string) => d.vendors.find((v) => v.id === id)?.name ?? '-';

/** 발행된 전표의 분개만 장부에 반영한다 */
export function postedLines(d: DB): Array<VoucherLine & { voucher: Voucher }> {
  return d.vouchers
    .filter((v) => v.status === '발행')
    .sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no))
    .flatMap((v) => v.lines.map((l) => ({ ...l, voucher: v })));
}

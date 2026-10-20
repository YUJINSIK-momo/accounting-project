export const won = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '0');

export const today = () => toDate(new Date());

export function toDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${toDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const monthOf = (date: string) => date.slice(0, 7);

export function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${y}년 ${Number(m)}월`;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);

export function parseAmount(v: string) {
  const n = Number(v.replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

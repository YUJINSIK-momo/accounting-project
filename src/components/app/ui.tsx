// 회계 화면용 부품 — yuyu 에 없는 표 · 입력 · 모달을 yuyu 토큰만으로 만든다.
import { useEffect, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { Badge, cx, type Tone } from '../yuyu';
import type { ApprovalStatus } from '../../types';
import type { Check } from '../../lib/journal';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  footer?: ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  showFooter?: boolean;
  dense?: boolean;
  maxHeight?: string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function DataTable<T>({ columns, rows, rowKey, empty = '데이터가 존재하지 않습니다', onRowClick, selectedKey, showFooter, dense, maxHeight }: DataTableProps<T>) {
  const cell = dense ? 'px-3 py-1.5' : 'px-3 py-2.5';
  return (
    <div className="overflow-auto rounded-yuyu-md border border-yuyu-line/60 bg-yuyu-surface" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-yuyu-raised">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cx(cell, 'whitespace-nowrap border-b border-yuyu-line/70 text-xs font-semibold text-yuyu-fg-muted', alignClass[c.align ?? 'left'])}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-yuyu-fg-subtle">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-yuyu-line/40 last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-yuyu-raised/70',
                  selectedKey === key && 'bg-yuyu-brand/10',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(cell, 'align-middle text-yuyu-fg', alignClass[c.align ?? 'left'])}>
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {showFooter && rows.length > 0 && (
          <tfoot className="sticky bottom-0 bg-yuyu-warning/10">
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={cx(cell, 'border-t border-yuyu-warning/30 font-semibold text-yuyu-fg', alignClass[c.align ?? 'left'])}>
                  {c.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const controlClass =
  'h-9 w-full rounded-yuyu-sm border border-yuyu-line bg-yuyu-surface px-2.5 text-sm text-yuyu-fg placeholder:text-yuyu-fg-subtle focus:border-yuyu-brand/70 focus:outline-none disabled:opacity-50';

export function Field({ label, required, children, hint, className }: { label: string; required?: boolean; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-yuyu-fg-muted">
        {label}
        {required && <span className="ml-0.5 text-yuyu-danger">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-yuyu-fg-subtle">{hint}</span>}
    </label>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { invalid?: boolean; className?: string };
export function Input({ invalid, className, ...rest }: InputProps) {
  return <input {...rest} className={cx(controlClass, invalid && 'border-yuyu-danger/70', className)} />;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { invalid?: boolean; className?: string };
export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select {...rest} className={cx(controlClass, 'pr-7', invalid && 'border-yuyu-danger/70', className)}>
      {children}
    </select>
  );
}

export function TextArea(props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>) {
  return <textarea {...props} className={cx(controlClass, 'h-24 py-2')} />;
}

export function MoneyInput({ value, onChange, invalid, disabled }: { value: number; onChange: (n: number) => void; invalid?: boolean; disabled?: boolean }) {
  return (
    <Input
      inputMode="numeric"
      value={value ? value.toLocaleString('ko-KR') : ''}
      placeholder="0"
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
      className="text-right font-mono"
    />
  );
}

export function Modal({ open, title, onClose, children, footer, width = 'max-w-2xl' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-yuyu-fg/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('w-full rounded-yuyu-lg border border-yuyu-line/70 bg-yuyu-surface shadow-yuyu-raised', width)}
      >
        <div className="flex items-center justify-between border-b border-yuyu-line/60 px-5 py-3">
          <h2 className="text-base font-semibold text-yuyu-fg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-yuyu-sm p-1 text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-yuyu-line/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const statusTone: Record<ApprovalStatus, Tone> = { 작성중: 'neutral', 결재중: 'warning', 결재완료: 'success', 반려: 'danger' };
export const StatusBadge = ({ status }: { status: ApprovalStatus }) => <Badge tone={statusTone[status]}>{status}</Badge>;

const checkTone: Record<Check['level'], Tone> = { 적합: 'success', 확인필요: 'warning', 부적합: 'danger' };
export function CheckBadge({ check }: { check: Check }) {
  return (
    <span title={check.reasons.join(', ')}>
      <Badge tone={checkTone[check.level]}>{check.level}</Badge>
    </span>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-end gap-3 rounded-yuyu-md border border-yuyu-line/60 bg-yuyu-surface p-3', className)}>{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-yuyu-line/60">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            t.value === value ? 'border-yuyu-brand text-yuyu-fg' : 'border-transparent text-yuyu-fg-muted hover:text-yuyu-fg',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 font-mono text-xs text-yuyu-fg-subtle">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StepNav({ steps, current, onSelect }: { steps: readonly string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onSelect(i)}
            className={cx(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              i === current ? 'border-yuyu-brand/60 bg-yuyu-brand/15 text-yuyu-fg' : 'border-yuyu-line/60 text-yuyu-fg-muted hover:text-yuyu-fg',
            )}
          >
            <span className={cx('font-mono', i === current ? 'text-yuyu-brand' : 'text-yuyu-fg-subtle')}>STEP {i + 1}</span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function BarList({ items, format }: { items: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-yuyu-fg-subtle">데이터가 존재하지 않습니다</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-yuyu-fg">
              {i.label}
              {i.sub && <span className="ml-1.5 text-yuyu-fg-subtle">{i.sub}</span>}
            </span>
            <span className="font-mono text-yuyu-fg-muted">{format(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-yuyu-raised">
            <div className="h-full rounded-full bg-yuyu-brand" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Amount({ value, tone }: { value: number; tone?: 'danger' | 'success' }) {
  return (
    <span className={cx('font-mono tabular-nums', tone === 'danger' && 'text-yuyu-danger', tone === 'success' && 'text-yuyu-success')}>
      {Math.round(value).toLocaleString('ko-KR')}
    </span>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-yuyu-fg">{title}</h2>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function toast(message: string) {
  const el = document.createElement('div');
  el.textContent = message;
  el.className =
    'fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-yuyu-md border border-yuyu-brand/40 bg-yuyu-fg px-4 py-2 text-sm text-yuyu-surface shadow-yuyu-raised';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

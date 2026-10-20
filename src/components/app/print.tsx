import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button, cx } from '../yuyu';

/** 화면에서는 숨기고 인쇄할 때만 보이는 사본. #root 를 숨기고 이것만 인쇄한다. */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="print-only">{children}</div>, document.body);
}

/** 브라우저 인쇄 창을 연다. 대상에서 「PDF로 저장」을 고르면 PDF 가 된다. */
export function PrintButton({ label = '인쇄 · PDF 저장', size = 'sm' }: { label?: string; size?: 'sm' | 'md' }) {
  return (
    <Button size={size} variant="outline" icon={Printer} onClick={() => window.print()}>
      {label}
    </Button>
  );
}

/** A4 문서 모양 — 화면 미리보기와 인쇄본이 같은 마크업을 쓴다 */
export function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('paper mx-auto w-full max-w-[794px] bg-yuyu-surface p-8 text-[13px] leading-relaxed text-yuyu-fg', className)}>{children}</div>;
}

export function PaperTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-center text-2xl font-bold tracking-[0.3em] text-yuyu-fg">{children}</h1>;
}

/** 문서용 표 — 테두리가 인쇄에서도 보이도록 실선으로 그린다 */
export function PaperTable({ head, rows, foot }: { head: ReactNode[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  const cell = 'border border-yuyu-line-strong px-2 py-1.5';
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} className={cx(cell, 'bg-yuyu-raised font-semibold')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={cell}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>
            {foot.map((c, j) => (
              <td key={j} className={cx(cell, 'bg-yuyu-raised font-semibold')}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <table className="mb-4 w-full border-collapse text-[12px]">
      <tbody>
        {Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2)).map((pair, i) => (
          <tr key={i}>
            {pair.map(([k, v]) => [
              <th key={`${k}-k`} className="w-24 border border-yuyu-line-strong bg-yuyu-raised px-2 py-1.5 text-left font-semibold">
                {k}
              </th>,
              <td key={`${k}-v`} className="border border-yuyu-line-strong px-2 py-1.5">
                {v}
              </td>,
            ])}
            {pair.length === 1 && <td colSpan={2} className="border border-yuyu-line-strong" />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

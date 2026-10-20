import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, FileCheck2, FileX2, Inbox, Undo2, Wallet } from 'lucide-react';
import { cx } from '../yuyu';
import { update, useDB } from '../../data/store';
import type { AppNotification } from '../../types';

const ICON: Record<AppNotification['kind'], typeof Bell> = {
  결재요청: Bell,
  합의요청: Bell,
  결재완료: FileCheck2,
  반려: FileX2,
  수신: Inbox,
  참조: Inbox,
  회수: Undo2,
  급여: Wallet,
};
const TONE: Record<AppNotification['kind'], string> = {
  결재요청: 'text-yuyu-warning',
  합의요청: 'text-yuyu-infra',
  결재완료: 'text-yuyu-success',
  반려: 'text-yuyu-danger',
  수신: 'text-yuyu-infra',
  참조: 'text-yuyu-fg-muted',
  회수: 'text-yuyu-fg-muted',
  급여: 'text-yuyu-brand',
};

/** 헤더 알림 — 현재 사용자에게 온 결재 · 수신 · 급여 알림 */
export function NotificationBell() {
  const db = useDB();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mine = db.notifications.filter((n) => n.to === db.currentEmpId).sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (n: AppNotification) => {
    update((d) => void (d.notifications.find((x) => x.id === n.id)!.read = true));
    setOpen(false);
    navigate(n.link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`알림 ${unread}건`}
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-yuyu-sm border border-yuyu-line text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-yuyu-danger px-1 text-center text-[10px] font-semibold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[min(92vw,380px)] overflow-hidden rounded-yuyu-md border border-yuyu-line bg-yuyu-surface shadow-yuyu-raised">
          <div className="flex items-center justify-between border-b border-yuyu-line px-4 py-2.5">
            <span className="text-sm font-semibold text-yuyu-fg">알림</span>
            <button
              type="button"
              disabled={!unread}
              onClick={() => update((d) => d.notifications.forEach((n) => n.to === d.currentEmpId && (n.read = true)))}
              className="flex items-center gap-1 text-xs text-yuyu-fg-muted hover:text-yuyu-fg disabled:opacity-40"
            >
              <CheckCheck size={14} /> 모두 읽음
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {mine.length === 0 && <li className="px-4 py-10 text-center text-sm text-yuyu-fg-subtle">새 알림이 없습니다</li>}
            {mine.slice(0, 30).map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => go(n)} className={cx('flex w-full gap-3 border-b border-yuyu-line/60 px-4 py-3 text-left hover:bg-yuyu-raised', !n.read && 'bg-yuyu-brand/5')}>
                    <Icon size={16} className={cx('mt-0.5 shrink-0', TONE[n.kind])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-yuyu-fg">
                        {n.title}
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-yuyu-danger" aria-label="안 읽음" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-yuyu-fg-muted">{n.body}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-yuyu-fg-subtle">{n.at}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

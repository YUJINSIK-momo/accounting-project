import { useRef } from 'react';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '../yuyu';
import { toast } from './ui';
import { MAX_FILE_BYTES, deleteFile, formatSize, getFile, putFile } from '../../lib/files';
import { nowStamp, uid } from '../../lib/format';
import type { Attachment } from '../../types';

async function download(a: Attachment) {
  try {
    const blob = await getFile(a.id);
    if (!blob) return toast('이 브라우저에 파일이 없습니다. 다른 브라우저에서 첨부한 파일일 수 있습니다.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast('파일을 열지 못했습니다.');
  }
}

/** 읽기 전용 첨부 목록 */
export function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <button type="button" onClick={() => download(a)} className="flex items-center gap-1.5 rounded-yuyu-sm border border-yuyu-line px-2.5 py-1 text-xs text-yuyu-fg hover:bg-yuyu-raised">
            <Paperclip size={12} className="text-yuyu-fg-muted" />
            {a.name}
            <span className="text-yuyu-fg-subtle">{formatSize(a.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** 첨부 편집 — 목록은 부모가 들고, 파일 본문은 IndexedDB 에 넣는다 */
export function AttachmentEditor({ items, onChange, by, editable = true }: { items: Attachment[]; onChange: (next: Attachment[]) => void; by: string; editable?: boolean }) {
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE_BYTES) {
        toast(`${f.name}: 5MB 를 넘는 파일은 첨부할 수 없습니다.`);
        continue;
      }
      const a: Attachment = { id: `f-${uid()}${uid()}`, name: f.name, size: f.size, type: f.type, addedAt: nowStamp(), by };
      try {
        await putFile(a.id, f);
        added.push(a);
      } catch {
        toast('이 브라우저에서는 파일을 저장할 수 없습니다.');
        break;
      }
    }
    if (added.length) onChange([...items, ...added]);
    if (input.current) input.current.value = '';
  };

  const remove = (a: Attachment) => {
    deleteFile(a.id).catch(() => undefined);
    onChange(items.filter((x) => x.id !== a.id));
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-yuyu-sm border border-yuyu-line px-3 py-1.5 text-sm">
            <Paperclip size={14} className="text-yuyu-fg-muted" />
            <span className="min-w-0 flex-1 truncate text-yuyu-fg">{a.name}</span>
            <span className="text-xs text-yuyu-fg-subtle">{formatSize(a.size)}</span>
            <button type="button" aria-label={`${a.name} 받기`} onClick={() => download(a)} className="rounded-yuyu-sm p-1 text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg">
              <Download size={14} />
            </button>
            {editable && (
              <button type="button" aria-label={`${a.name} 지우기`} onClick={() => remove(a)} className="rounded-yuyu-sm p-1 text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-danger">
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="text-xs text-yuyu-fg-subtle">첨부한 파일이 없습니다.</li>}
      </ul>
      {editable && (
        <>
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} accept="image/*,.pdf,.xlsx,.xls,.csv,.hwp,.doc,.docx" />
          <Button size="sm" variant="outline" icon={Paperclip} onClick={() => input.current?.click()}>
            파일 첨부
          </Button>
          <p className="text-[11px] text-yuyu-fg-subtle">영수증 · 견적서 등 파일당 5MB 까지. 파일은 이 브라우저에만 저장됩니다.</p>
        </>
      )}
    </div>
  );
}

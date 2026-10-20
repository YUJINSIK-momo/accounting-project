// 첨부파일 본문은 IndexedDB 에, 목록(이름 · 크기)은 문서 데이터에 둔다. 브라우저 밖으로 나가지 않는다.
const DB_NAME = 'accounting-demo-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id));
export const getFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => run('readwrite', (s) => s.delete(id));

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function formatSize(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

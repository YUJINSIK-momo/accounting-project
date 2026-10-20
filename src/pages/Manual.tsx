// 매뉴얼 — 노션 문서처럼 왼쪽 페이지 목록, 가운데 문서(아이콘 · 제목 · 속성 · 흐름 · 단계 · 스크린샷)
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink, Lightbulb, Search, Users, X } from 'lucide-react';
import { Button, Pipeline, cx } from '../components/yuyu';
import { MANUAL, MANUAL_GROUPS, type ManualPage, type ManualShot } from '../data/manual';

const img = (src: string) => `${import.meta.env.BASE_URL}manual/${src}`;

function Shot({ shot, onOpen }: { shot: ManualShot; onOpen: (s: ManualShot) => void }) {
  return (
    <figure className="my-4">
      <button type="button" onClick={() => onOpen(shot)} className="block w-full overflow-hidden rounded-yuyu-md border border-yuyu-line bg-yuyu-raised shadow-yuyu-raised transition hover:border-yuyu-brand/50" aria-label={`${shot.caption} 크게 보기`}>
        <img src={img(shot.src)} alt={shot.caption} loading="lazy" className="block w-full" />
      </button>
      <figcaption className="mt-2 text-center text-xs text-yuyu-fg-subtle">{shot.caption}</figcaption>
    </figure>
  );
}

function Sidebar({ current, query, setQuery }: { current?: string; query: string; setQuery: (q: string) => void }) {
  const q = query.trim();
  const match = (p: ManualPage) => !q || [p.title, p.summary, ...p.steps.map((s) => s.title + s.body)].some((t) => t.includes(q));
  return (
    <nav aria-label="매뉴얼 목차" className="space-y-4">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-yuyu-fg-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="매뉴얼 검색"
          className="h-8 w-full rounded-yuyu-sm border border-yuyu-line bg-yuyu-surface pl-8 pr-2 text-sm text-yuyu-fg placeholder:text-yuyu-fg-subtle focus:border-yuyu-brand/60 focus:outline-none"
        />
      </div>
      <Link to="/manual" className={cx('flex items-center gap-2 rounded-yuyu-sm px-2 py-1 text-sm', !current ? 'bg-yuyu-raised font-medium text-yuyu-fg' : 'text-yuyu-fg-muted hover:bg-yuyu-raised')}>
        📘 <span>매뉴얼 홈</span>
      </Link>
      {MANUAL_GROUPS.map((g) => {
        const pages = MANUAL.filter((p) => p.group === g && match(p));
        if (!pages.length) return null;
        return (
          <div key={g}>
            <p className="mb-1 px-2 text-[11px] font-semibold text-yuyu-fg-subtle">{g}</p>
            <ul className="space-y-0.5">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link to={`/manual/${p.id}`} className={cx('flex items-center gap-2 rounded-yuyu-sm px-2 py-1 text-sm', current === p.id ? 'bg-yuyu-raised font-medium text-yuyu-fg' : 'text-yuyu-fg-muted hover:bg-yuyu-raised hover:text-yuyu-fg')}>
                    <p.icon size={15} aria-hidden className="shrink-0" />
                    <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Callout({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-yuyu-md bg-yuyu-raised px-4 py-3 text-[15px] leading-relaxed text-yuyu-fg">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function PageView({ page, onOpen }: { page: ManualPage; onOpen: (s: ManualShot) => void }) {
  const idx = MANUAL.findIndex((p) => p.id === page.id);
  const prev = MANUAL[idx - 1];
  const next = MANUAL[idx + 1];
  return (
    <article className="pb-16">
      <div className="h-28 rounded-yuyu-lg bg-gradient-to-r from-yuyu-brand/15 via-yuyu-ai/10 to-yuyu-infra/15" />
      <div className="px-1 sm:px-6">
        <div className="-mt-9 mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-yuyu-lg border border-yuyu-line bg-yuyu-surface shadow-yuyu-raised">
          <page.icon size={36} className="text-yuyu-brand" aria-hidden />
        </div>
        <p className="text-xs text-yuyu-fg-subtle">
          매뉴얼 / {page.group}
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight text-yuyu-fg sm:text-4xl">{page.title}</h1>

        <dl className="mt-5 grid grid-cols-[96px_1fr] gap-y-2 text-sm">
          <dt className="flex items-center gap-1.5 text-yuyu-fg-subtle">
            <Users size={14} /> 대상
          </dt>
          <dd className="text-yuyu-fg">{page.who}</dd>
          {page.route && (
            <>
              <dt className="flex items-center gap-1.5 text-yuyu-fg-subtle">
                <ExternalLink size={14} /> 바로가기
              </dt>
              <dd>
                <Link to={page.route} className="text-yuyu-brand underline-offset-2 hover:underline">
                  {page.route === '/' ? '홈' : page.title} 화면 열기
                </Link>
              </dd>
            </>
          )}
        </dl>

        <hr className="my-6 border-yuyu-line" />

        <Callout icon={<Lightbulb size={18} className="text-yuyu-warning" />}>{page.summary}</Callout>

        {page.flow && (
          <section className="my-6">
            <h2 className="mb-3 text-xl font-semibold text-yuyu-fg">흐름</h2>
            <Pipeline nodes={page.flow} />
            <p className="mt-2 text-xs text-yuyu-fg-subtle">점선 상자는 사람이 결정하는 단계입니다.</p>
          </section>
        )}

        {page.hero && <Shot shot={page.hero} onOpen={onOpen} />}

        <section className="mt-8">
          <h2 className="mb-2 text-xl font-semibold text-yuyu-fg">하는 법</h2>
          <ol className="space-y-6">
            {page.steps.map((s, i) => (
              <li key={s.title} className="relative pl-10">
                <span className="absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-yuyu-brand/10 font-mono text-sm font-semibold text-yuyu-brand">{i + 1}</span>
                <h3 className="text-base font-semibold text-yuyu-fg">{s.title}</h3>
                <p className="mt-1 text-[15px] leading-7 text-yuyu-fg-muted">{s.body}</p>
                {s.shot && <Shot shot={s.shot} onOpen={onOpen} />}
              </li>
            ))}
          </ol>
        </section>

        {page.tips?.length ? (
          <section className="mt-8">
            <h2 className="mb-2 text-xl font-semibold text-yuyu-fg">알아 두기</h2>
            {page.tips.map((t) => (
              <Callout key={t} icon={<span aria-hidden>📌</span>}>
                {t}
              </Callout>
            ))}
          </section>
        ) : null}

        <div className="mt-12 grid gap-3 border-t border-yuyu-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link to={`/manual/${prev.id}`} className="rounded-yuyu-md border border-yuyu-line p-3 hover:bg-yuyu-raised">
              <span className="flex items-center gap-1 text-xs text-yuyu-fg-subtle">
                <ArrowLeft size={12} /> 이전
              </span>
              <span className="mt-1 block text-sm font-medium text-yuyu-fg">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/manual/${next.id}`} className="rounded-yuyu-md border border-yuyu-line p-3 text-right hover:bg-yuyu-raised">
              <span className="flex items-center justify-end gap-1 text-xs text-yuyu-fg-subtle">
                다음 <ArrowRight size={12} />
              </span>
              <span className="mt-1 block text-sm font-medium text-yuyu-fg">{next.title}</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function ManualHome() {
  return (
    <article className="pb-16">
      <div className="h-28 rounded-yuyu-lg bg-gradient-to-r from-yuyu-brand/15 via-yuyu-ai/10 to-yuyu-infra/15" />
      <div className="px-1 sm:px-6">
        <div className="-mt-9 mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-yuyu-lg border border-yuyu-line bg-yuyu-surface text-4xl shadow-yuyu-raised">📘</div>
        <h1 className="text-3xl font-bold text-yuyu-fg sm:text-4xl">경비 · 지출 회계 매뉴얼</h1>
        <p className="mt-3 text-[15px] leading-7 text-yuyu-fg-muted">메뉴마다 무엇을 하는 화면인지, 어떤 순서로 쓰는지 스크린샷과 함께 정리했습니다. 처음이라면 「처음 쓰는 분께」 → 「전체 업무 흐름」 순서로 읽어 보세요.</p>
        {MANUAL_GROUPS.map((g) => (
          <section key={g} className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-yuyu-fg">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MANUAL.filter((p) => p.group === g).map((p) => (
                <Link key={p.id} to={`/manual/${p.id}`} className="group overflow-hidden rounded-yuyu-md border border-yuyu-line bg-yuyu-surface transition hover:border-yuyu-brand/50 hover:shadow-yuyu-raised">
                  {p.hero ? <img src={img(p.hero.src)} alt="" loading="lazy" className="h-32 w-full border-b border-yuyu-line object-cover object-left-top" /> : <div className="h-32 border-b border-yuyu-line bg-gradient-to-br from-yuyu-raised to-yuyu-brand/10" />}
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-yuyu-fg">
                      <p.icon size={16} className="text-yuyu-brand" aria-hidden /> {p.title}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-yuyu-fg-muted">{p.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export default function Manual() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState<ManualShot>();
  const page = MANUAL.find((p) => p.id === id);
  if (id && !page) navigate('/manual', { replace: true });

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100vh-3.5rem)] bg-yuyu-surface sm:-mx-6 lg:-mx-8 lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-yuyu-line bg-yuyu-bg/60 px-3 py-5 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Sidebar current={page?.id} query={query} setQuery={setQuery} />
      </aside>
      <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8">{page ? <PageView page={page} onOpen={setZoom} /> : <ManualHome />}</div>
      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-yuyu-fg/70 p-4" onClick={() => setZoom(undefined)}>
          <div className="mb-2 flex w-full max-w-6xl items-center justify-between text-sm text-yuyu-surface">
            <span>{zoom.caption}</span>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setZoom(undefined)} className="text-yuyu-surface hover:bg-transparent">
              닫기
            </Button>
          </div>
          <img src={img(zoom.src)} alt={zoom.caption} className="max-h-[85vh] w-auto max-w-6xl rounded-yuyu-md shadow-yuyu-raised" />
        </div>
      )}
    </div>
  );
}

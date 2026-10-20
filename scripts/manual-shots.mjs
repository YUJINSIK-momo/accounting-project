// 매뉴얼 스크린샷을 다시 찍는다. 개발 서버를 띄운 뒤 실행한다.
//   npm run dev
//   npm run manual:shots            (BASE_URL · CHROME_PATH 로 바꿀 수 있다)
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/accounting-project/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../public/manual/', import.meta.url).pathname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--lang=ko-KR'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await mkdir(OUT, { recursive: true });

const go = async (hash, wait = 600) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await sleep(wait);
};
// 버튼 · 탭을 글자로 찾아 누른다
const click = (text, scope = 'body') =>
  page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(`${s} button, ${s} [role=tab]`)].find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(t));
      el?.click();
      return Boolean(el);
    },
    text,
    scope,
  );
const shot = async (name) => {
  await sleep(2400); // 토스트가 사라질 때까지 기다린다
  await page.screenshot({ path: `${OUT}${name}.webp`, type: 'webp', quality: 82 });
  console.log('✓', name);
};
const scrollTo = (selectorText) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('main h2, [role=dialog] .paper')].find((e) => e.textContent.includes(t) || t === '.paper');
    el?.scrollIntoView({ block: 'start' });
  }, selectorText);
const type = async (selector, text) => {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, text);
};

// 처음 상태(예시 데이터)에서 시작한다
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  indexedDB.deleteDatabase('accounting-demo-files');
});
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);

await go('#/');
await shot('home');
await page.click('button[aria-label^="알림"]');
await shot('header-bell');
await page.keyboard.press('Escape');
await page.mouse.click(700, 400);

// AI 어시스턴트
const assistantClick = (label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('aside[aria-label="AI 어시스턴트"] button')].filter((x) => !x.disabled).reverse().find((x) => x.textContent.trim().startsWith(t));
    b?.click();
    return Boolean(b);
  }, label);
await go('#/');
await page.click('button[aria-label="AI 어시스턴트 열기"]');
await sleep(300);
await shot('assistant-home');
await page.type('aside[aria-label="AI 어시스턴트"] textarea', '11월 교육 강사료 120만원 품의 올려줘');
await page.keyboard.press('Enter');
await sleep(400);
await shot('assistant-proposal');
await assistantClick('처음으로');
await assistantClick('예산 보기');
await sleep(200);
await assistantClick('개발팀');
await sleep(300);
await shot('assistant-budget');
await page.click('aside[aria-label="AI 어시스턴트"] button[aria-label="닫기"]');

// 경비청구 3단계와 결재라인 지정
await go('#/claims/new');
await shot('claim-step1');
await page.click('main thead input[type=checkbox]');
await click('선택 내역 가져오기', 'main');
await sleep(400);
await shot('claim-step2');
await click('청구내역 확인', 'main');
await sleep(400);
await shot('claim-step3');
await click('결재상신', 'main');
await sleep(600);
await shot('approval-line');
await click('취소', '[role=dialog]');

// 결재함 · 문서 보기
await go('#/approvals');
await shot('approvals');
await go(`#/approvals?doc=${encodeURIComponent('경비청구:cl-c4-2026-10')}`);
await shot('doc-view');
await go(`#/approvals?doc=${encodeURIComponent('지출결의서:d1')}`);
await scrollTo('.paper');
await shot('doc-stamps');

// 품의서
await go('#/proposals');
await shot('proposals');
await click('신규작성', 'main');
await sleep(300);
await type('[role=dialog] input[placeholder^="예: 11월"]', '11월 사내 교육 강사료');
await type('[role=dialog] input[inputmode=numeric]', '1200000');
await type('[role=dialog] textarea', '11월 정보보호 교육 2시간, 외부 강사 1명');
await shot('proposal-new');
await click('취소', '[role=dialog]');

// 지출결의서
await go('#/disbursements/d2');
await shot('disb-form');
await scrollTo('예산 확인');
await shot('disb-budget');
await go('#/disbursements/new');
await click('계산서내역', 'main');
await sleep(400);
await shot('disb-invoices');
await page.keyboard.press('Escape');

// 청구내역 · 집계 · 점검 · 분석
await go('#/claims');
await page.evaluate(() => document.querySelector('main tbody tr')?.click());
await shot('claims');
await go('#/reports/dept');
await shot('dept-summary');
await go('#/reports/check');
await shot('usage-check');
await go('#/analytics');
await shot('analytics');

// 회계
await go('#/vouchers');
await shot('vouchers');
await go('#/payments');
await shot('payments');
await click('이체 양식', 'main');
await shot('payments-format');
await go('#/journal');
await shot('journal');
await go('#/ledger');
await shot('ledger');
await go('#/trial-balance');
await shot('trial-balance');
await go('#/statements');
await shot('statements-pl');
await click('재무상태표', 'main');
await shot('statements-bs');
await go('#/budget');
await shot('budget');

// 급여 · 세무
await go('#/payroll');
await shot('payroll');
await go('#/payslips');
await page.evaluate(() => document.querySelector('main tbody tr')?.click());
await shot('payslip');
await page.keyboard.press('Escape');
await go('#/severance');
await click('퇴직금 계산', 'main');
await shot('severance');
await go('#/year-end');
await click('연말정산 모의계산', 'main');
await shot('year-end');
await go('#/tax-invoices');
await shot('tax-buy');
await click('부가세 신고 집계', 'main');
await shot('tax-vat');

// 기초정보
await go('#/master');
await click('조직', 'main');
await shot('master-org');
await click('요율', 'main');
await shot('master-rates');

await browser.close();

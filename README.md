# 경비 · 지출 회계 데모

그룹웨어 회계 모듈(경비청구 · 품의 · 지출결의 · 전표처리)의 화면 흐름을 참고해 만든 정적 웹 앱입니다. 서버 없이 브라우저 `localStorage` 에 데이터를 저장하고, 들어 있는 회사 · 사람 · 금액은 모두 가상의 예시입니다.

**배포 주소: https://yujinsik-momo.github.io/accounting-project/**

## 기능

| 메뉴 | 내용 |
|---|---|
| 경비현황분석 | 월 청구액, 전월 대비, 결재 대기, 미지급 잔액. 용도 · 조직 · 기간별 막대 |
| 결재함 | 경비청구 · 품의서 · 지출결의서 승인 / 반려 |
| 경비청구작성 | STEP1 카드 내역 조회 → STEP2 용도 · 내용 입력과 검증 → STEP3 결재상신 |
| 청구내역 · 경비부서집계표 | 사원별 청구서, 부서 · 사원별 소계와 직전 청구 대비 증감 |
| 사용 점검 | 제한시간(23~06시 · 주말) 사용, 같은 날 같은 가맹점 중복 사용 |
| 품의서 · 지출결의서 | 품의 금액 대비 집행액, 증빙별 부가세 처리, 분개 미리보기 |
| 전표처리 | 경비전표 · 지출결의전표 발행 / 취소, 지급처리 |
| 분개장 · 총계정원장 · 합계잔액시산표 | 발행된 전표만 반영, 대차 일치 확인 |
| 기초정보관리 | 용도 → 계정과목 연결, 계정과목 · 거래처 · 카드 · 사원 |

검증 규칙은 `src/lib/journal.ts` 에 모여 있습니다. 부적합(용도 · 내용 · 금액 누락 등)은 상신을 막고, 확인필요(심야 · 주말 · 중복 · 부가세 10% 불일치)는 표시만 합니다.

## 디자인 시스템

화면은 yuyu UI 를 씁니다. `src/components/yuyu/` 와 `src/styles/yuyu-tokens.css` 는 [Backend-Developer-Portfolio](https://github.com/YUJINSIK-momo/Backend-Developer-Portfolio) 의 yuyu 컴포넌트를 그대로 가져온 것이고, 토큰 이름 규칙은 [Design-Dev-Infra-Pipeline](https://github.com/YUJINSIK-momo/Design-Dev-Infra-Pipeline) 을 따릅니다. 표 · 입력 · 모달처럼 yuyu 에 없는 부품은 `src/components/app/ui.tsx` 에 yuyu 토큰만으로 만들었습니다.

## 실행

```bash
npm ci
npm run dev      # http://localhost:5173/accounting-project/
npm run build
```

`main` 에 push 하면 GitHub Actions 가 빌드해 GitHub Pages 로 배포합니다. 화면 오른쪽 위 「초기화」를 누르면 예시 데이터로 돌아갑니다.

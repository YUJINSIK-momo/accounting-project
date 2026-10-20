import type { Employee, PayrollLine, Rates } from '../types';

// 세법 · 보험 요율은 예시 기본값이다. 기초정보관리 > 요율에서 바꿀 수 있고, 실제 지급 전에는 고시값을 확인해야 한다.
export const DEFAULT_RATES: Rates = {
  pension: 4.75, // 국민연금 근로자 부담(%)
  pensionFloor: 400000,
  pensionCap: 6370000,
  health: 3.595, // 건강보험 근로자 부담(%)
  care: 13.14, // 장기요양 = 건강보험료 × %
  employment: 0.9, // 고용보험 근로자 부담(%)
  localTax: 10, // 지방소득세 = 소득세 × %
  mealExempt: 200000, // 식대 비과세 한도(월)
  carExempt: 200000, // 자가운전보조금 비과세 한도(월)
};

const floor10 = (n: number) => Math.max(0, Math.floor(n / 10) * 10);

/** 근로소득공제(한도 2천만 원) */
export function earnedIncomeDeduction(total: number) {
  let v: number;
  if (total <= 5_000_000) v = total * 0.7;
  else if (total <= 15_000_000) v = 3_500_000 + (total - 5_000_000) * 0.4;
  else if (total <= 45_000_000) v = 7_500_000 + (total - 15_000_000) * 0.15;
  else if (total <= 100_000_000) v = 12_000_000 + (total - 45_000_000) * 0.05;
  else v = 14_750_000 + (total - 100_000_000) * 0.02;
  return Math.min(Math.floor(v), 20_000_000);
}

const BRACKETS: Array<[number, number, number]> = [
  // [과세표준 상한, 세율, 누진공제]
  [14_000_000, 0.06, 0],
  [50_000_000, 0.15, 1_260_000],
  [88_000_000, 0.24, 5_760_000],
  [150_000_000, 0.35, 15_440_000],
  [300_000_000, 0.38, 19_940_000],
  [500_000_000, 0.4, 25_940_000],
  [1_000_000_000, 0.42, 35_940_000],
  [Infinity, 0.45, 65_940_000],
];

export function computedTax(base: number) {
  const [, rate, deduction] = BRACKETS.find(([cap]) => base <= cap)!;
  return Math.max(0, Math.floor(base * rate - deduction));
}

/** 근로소득세액공제와 총급여별 한도 */
export function earnedIncomeTaxCredit(tax: number, total: number) {
  const credit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.3;
  let limit: number;
  if (total <= 33_000_000) limit = 740_000;
  else if (total <= 70_000_000) limit = Math.max(660_000, 740_000 - (total - 33_000_000) * 0.008);
  else if (total <= 120_000_000) limit = Math.max(500_000, 660_000 - (total - 70_000_000) / 2);
  else limit = Math.max(200_000, 500_000 - (total - 120_000_000) / 2);
  return Math.floor(Math.min(credit, limit));
}

export interface YearEndInput {
  totalSalary: number; // 과세 총급여
  dependents: number;
  pension: number; // 국민연금 연간
  insurance: number; // 건강 · 장기요양 · 고용 연간
  cardSpend?: number;
  lifeInsurance?: number; // 보장성 보험료
  medical?: number;
  education?: number;
  donation?: number;
}

export function yearEnd(i: YearEndInput) {
  const earnedDeduction = earnedIncomeDeduction(i.totalSalary);
  const earnedIncome = i.totalSalary - earnedDeduction;
  const personal = 1_500_000 * Math.max(1, i.dependents);
  const cardLimit = i.totalSalary <= 70_000_000 ? 3_000_000 : 2_500_000;
  const card = Math.min(cardLimit, Math.max(0, ((i.cardSpend ?? 0) - i.totalSalary * 0.25) * 0.15));
  const taxBase = Math.max(0, Math.floor(earnedIncome - personal - i.pension - i.insurance - card));
  const tax = computedTax(taxBase);
  const earnedCredit = earnedIncomeTaxCredit(tax, i.totalSalary);
  const lifeIns = Math.min(1_000_000, i.lifeInsurance ?? 0) * 0.12;
  const medical = Math.max(0, (i.medical ?? 0) - i.totalSalary * 0.03) * 0.15;
  const education = (i.education ?? 0) * 0.15;
  const donation = Math.min(10_000_000, i.donation ?? 0) * 0.15;
  const special = Math.floor(lifeIns + medical + education + donation);
  const standard = special > 0 ? 0 : 130_000;
  const determined = Math.max(0, tax - earnedCredit - special - standard);
  return {
    earnedDeduction,
    earnedIncome,
    personal,
    card: Math.floor(card),
    taxBase,
    tax,
    earnedCredit,
    special,
    standard,
    determined,
    local: Math.floor(determined * 0.1),
  };
}

/** 월 원천징수 소득세 — 간이세액표 대신 연간 환산으로 근사한다 */
export function monthlyIncomeTax(taxableMonthly: number, dependents: number, pensionMonthly: number, insuranceMonthly: number) {
  const r = yearEnd({ totalSalary: taxableMonthly * 12, dependents, pension: pensionMonthly * 12, insurance: insuranceMonthly * 12 });
  return floor10(r.determined / 12);
}

export function calcLine(rates: Rates, emp: Employee, input: { base: number; overtime: number; bonus: number; meal: number; car: number }): PayrollLine {
  const taxable = input.base + input.overtime + input.bonus + Math.max(0, input.meal - rates.mealExempt) + Math.max(0, input.car - rates.carExempt);
  const pensionBase = Math.min(rates.pensionCap, Math.max(rates.pensionFloor, input.base + input.overtime));
  const pension = floor10((pensionBase * rates.pension) / 100);
  const health = floor10((taxable * rates.health) / 100);
  const care = floor10((health * rates.care) / 100);
  const employment = floor10((taxable * rates.employment) / 100);
  const incomeTax = monthlyIncomeTax(taxable, emp.dependents, pension, health + care + employment);
  const localTax = floor10((incomeTax * rates.localTax) / 100);
  return { empId: emp.id, ...input, pension, health, care, employment, incomeTax, localTax };
}

export const grossPay = (l: PayrollLine) => l.base + l.overtime + l.bonus + l.meal + l.car;
export const taxablePay = (l: PayrollLine, r: Rates) => l.base + l.overtime + l.bonus + Math.max(0, l.meal - r.mealExempt) + Math.max(0, l.car - r.carExempt);
export const deductionTotal = (l: PayrollLine) => l.pension + l.health + l.care + l.employment + l.incomeTax + l.localTax;
export const netPay = (l: PayrollLine) => grossPay(l) - deductionTotal(l);

/** 퇴직금 = 1일 평균임금 × 30일 × 재직일수 / 365 */
export function severance(input: { joinDate: string; leaveDate: string; last3Months: number; annualBonus: number; annualLeavePay: number }) {
  const join = new Date(input.joinDate);
  const leave = new Date(input.leaveDate);
  const days = Math.max(0, Math.round((leave.getTime() - join.getTime()) / 86_400_000));
  const start = new Date(leave);
  start.setMonth(start.getMonth() - 3);
  const periodDays = Math.max(1, Math.round((leave.getTime() - start.getTime()) / 86_400_000));
  const wageTotal = input.last3Months + (input.annualBonus * 3) / 12 + (input.annualLeavePay * 3) / 12;
  const dailyAvg = wageTotal / periodDays;
  const amount = days >= 365 ? Math.floor((dailyAvg * 30 * days) / 365) : 0;
  return { days, periodDays, wageTotal: Math.floor(wageTotal), dailyAvg: Math.floor(dailyAvg * 100) / 100, amount, eligible: days >= 365 };
}

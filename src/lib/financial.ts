export interface ScenarioInput {
  rate: number;   // annual interest rate as percent (e.g. 7.5)
  ltv: number;    // loan-to-value as percent (e.g. 75)
}

export interface ScenarioResult {
  rate: number;
  ltv: number;
  loanAmount: number;
  annualDebtService: number;
  dscr: number | null;
  coc: number | null;
  isIO: boolean;
}

export interface FinancialSummary {
  askingPrice: number;
  noi: number | null;
  brokerCapRate: number | null;
  scenarios: ScenarioResult[];
}

function parseDollar(s: string): number | null {
  const n = parseFloat(s.replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

function parsePercent(s: string): number | null {
  const n = parseFloat(s.replace(/%\s*/g, ""));
  return isNaN(n) ? null : n;
}

function monthlyPayment(principal: number, annualRatePercent: number, months: number): number {
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function runFinancialModel(params: {
  askingPriceStr: string;
  brokerCapRateStr: string;
  rates: string[];
  ltvs: string[];
  amortYears: string;
  ioPeriod: string;
  closingCostRate?: number;
}): FinancialSummary {
  const {
    askingPriceStr,
    brokerCapRateStr,
    rates,
    ltvs,
    amortYears,
    ioPeriod,
    closingCostRate = 0.015,
  } = params;

  const askingPrice = parseDollar(askingPriceStr) ?? 0;
  const brokerCapRate = parsePercent(brokerCapRateStr);
  const amortMonths = Math.max(1, (parseFloat(amortYears) || 30) * 12);
  const ioYears = parseFloat(ioPeriod) || 0;
  const isIO = ioYears > 0;

  const noi = askingPrice > 0 && brokerCapRate !== null
    ? askingPrice * (brokerCapRate / 100)
    : null;

  const scenarios: ScenarioResult[] = [];

  for (const rStr of rates) {
    for (const lStr of ltvs) {
      const rate = parseFloat(rStr);
      const ltv = parseFloat(lStr);
      if (isNaN(rate) || isNaN(ltv)) continue;

      const loanAmount = askingPrice * (ltv / 100);
      const equity = askingPrice * (1 - ltv / 100) * (1 + closingCostRate);

      // Year 1 payment: IO if ioYears > 0, otherwise full amort
      const monthlyPmt = isIO
        ? loanAmount * (rate / 100 / 12)
        : monthlyPayment(loanAmount, rate, amortMonths);

      const annualDebtService = monthlyPmt * 12;
      const dscr = noi !== null && annualDebtService > 0 ? noi / annualDebtService : null;
      const coc = noi !== null && equity > 0
        ? (noi - annualDebtService) / equity
        : null;

      scenarios.push({ rate, ltv, loanAmount, annualDebtService, dscr, coc, isIO });
    }
  }

  return { askingPrice, noi, brokerCapRate, scenarios };
}

export function fmt$( n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(n: number, decimals = 1): string {
  return n.toFixed(decimals) + "%";
}

export function fmtX(n: number): string {
  return n.toFixed(2) + "x";
}

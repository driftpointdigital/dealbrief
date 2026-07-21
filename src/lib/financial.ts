// Acquisition closing costs as a fraction of PURCHASE PRICE (title, lender,
// legal, third-party DD). Single-sourced here so the debt model and the PDF
// (which recomputes CoC for its dual-NOI tables) use the identical rate.
export const CLOSING_COST_RATE = 0.02;

export interface ScenarioInput {
  rate: number;   // annual interest rate as percent (e.g. 7.5)
  ltv: number;    // loan-to-value as percent (e.g. 75)
}

export interface ScenarioResult {
  rate: number;
  ltv: number;
  loanAmount: number;
  equity: number;   // down payment + closing costs (the CoC denominator)
  annualDebtService: number;
  cashFlow: number | null;   // levered cash flow = NOI − annual debt service
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
  // Strip %, commas, and whitespace. Input is always assumed to be in percent form
  // (e.g. "10.362" or "10.362%" → 10.362). Never treated as a decimal fraction.
  const n = parseFloat(s.replace(/%/g, "").replace(/,/g, "").trim());
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
  // Bottom-up NOI (from computeBoe). When provided, DSCR / CoC are computed
  // against it rather than the broker-cap-derived NOI — which is essential now
  // that Broker Cap Rate is no longer an input.
  noiOverride?: number | null;
}): FinancialSummary {
  const {
    askingPriceStr,
    brokerCapRateStr,
    rates,
    ltvs,
    amortYears,
    ioPeriod,
    closingCostRate = CLOSING_COST_RATE,
    noiOverride,
  } = params;

  const askingPrice = parseDollar(askingPriceStr) ?? 0;
  const brokerCapRate = parsePercent(brokerCapRateStr);
  const amortMonths = Math.max(1, (parseFloat(amortYears) || 30) * 12);
  const ioYears = parseFloat(ioPeriod) || 0;
  const isIO = ioYears > 0;

  const noi = (noiOverride != null && noiOverride > 0)
    ? noiOverride
    : (askingPrice > 0 && brokerCapRate !== null
      ? askingPrice * (brokerCapRate / 100)
      : null);

  const scenarios: ScenarioResult[] = [];

  for (const rStr of rates) {
    for (const lStr of ltvs) {
      const rate = parseFloat(rStr);
      const ltv = parseFloat(lStr);
      if (isNaN(rate) || isNaN(ltv)) continue;

      const loanAmount = askingPrice * (ltv / 100);
      // Equity = down payment + closing costs, where closing costs are a % of the
      // PURCHASE PRICE (title, lender, legal, third-party DD), not of the down payment.
      const equity = askingPrice * (1 - ltv / 100) + askingPrice * closingCostRate;

      // Year 1 payment: IO if ioYears > 0, otherwise full amort
      const monthlyPmt = isIO
        ? loanAmount * (rate / 100 / 12)
        : monthlyPayment(loanAmount, rate, amortMonths);

      const annualDebtService = monthlyPmt * 12;
      const cashFlow = noi !== null ? noi - annualDebtService : null;
      const dscr = noi !== null && annualDebtService > 0 ? noi / annualDebtService : null;
      const coc = noi !== null && equity > 0
        ? (noi - annualDebtService) / equity
        : null;

      scenarios.push({ rate, ltv, loanAmount, equity, annualDebtService, cashFlow, dscr, coc, isIO });
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

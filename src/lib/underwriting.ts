// Shared underwriting math — the single source of truth for the bottom-up
// NOI / operating-expense model. Extracted verbatim from pdf-template.tsx so
// that the live Review & Adjust page and the generated PDF compute IDENTICAL
// numbers. Any change here flows to both surfaces.
//
// Pure functions only — no React, no rendering. Inputs are the raw string
// fields the user edits (askingPrice, brokerCapRate, opexOverrides, …); output
// is a fully-computed BoeEst the caller renders however it likes.

import { runFinancialModel, fmt$ } from "./financial";

// ── input contract ─────────────────────────────────────────────────────────
// The subset of report fields the underwriting model reads. ReportData (in
// pdf-template.tsx) is a structural superset, so it is assignable to this.
export interface UnderwritingData {
  askingPrice: string;
  brokerCapRate: string;
  buyerCapRate: string;
  occupancy: string;
  inPlaceRents: string;
  vacancyPct: string;
  badDebtPct: string;
  otherIncomePct: string;
  opexOverrides: string;
  units: string;
  yearBuilt: string;
  address: string;
  annualTaxes: string;
  assessedValue: string;
  taxRate: string;
  censusRent: string;
}

// ── parse helpers ──────────────────────────────────────────────────────────
export function parseDol(str: string): number {
  return parseFloat(str.replace(/[$,]/g, "")) || 0;
}

// Parse a user-entered cap rate / percentage string into a numeric percent value.
// Input is always assumed to be in percent form (e.g. "10.362" or "10.362%" → 10.362).
// Never treats the value as a decimal fraction — "7.5" means 7.5%, not 0.75%.
export function parseCapRateInput(str: string): number | null {
  if (!str) return null;
  // Strip %, commas (accidental thousands separators), and whitespace
  const cleaned = str.replace(/%/g, "").replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Parse a rent-per-unit from user input like "$1,975" or "1975"
// Returns null if the string has multiple rent tiers (e.g. "3BR: $1,100 / 4BR: $1,300")
export function parseRentPerUnit(str: string): number | null {
  if (!str) return null;
  // Reject multi-tier strings
  if (str.includes("/") && str.toLowerCase().includes("br")) return null;
  const match = str.replace(/,/g, "").match(/\$?([\d]+(?:\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (val > 100 && val < 50000) return val;
  }
  return null;
}

// ── types ──────────────────────────────────────────────────────────────────
export interface BoeInputs {
  insurancePerUnit: number;
  maintenancePerUnit: number;
  utilitiesPerUnit: number;
  managementPct: number;
  marketingPerUnit: number;
  adminPerUnit: number;
  reservesPerUnit: number;
  payrollPerUnit: number;
}

export interface BoeEst {
  brokerNoi: number;
  taxes: number; taxesSource: string; taxesIsEstimate: boolean;
  insurance: number; maintenance: number;
  utilities: number; management: number; totalOpEx: number;
  marketing: number; admin: number; reserves: number; payroll: number;
  opexInputs: BoeInputs;
  egi: number; gpr: number; gprPerUnitPerMonth: number;
  occupancyRate: number;
  estNoi: number;
  // Revenue breakdown
  vacancyAmt: number; badDebtAmt: number; otherIncomeAmt: number;
  vacancyPct: number; badDebtPct: number; otherIncomePct: number;
  // Breakeven
  breakevenOcc: number;   // physical occupancy % at which EGI = OpEx (no debt)
}

export function parseOpexOverrides(str: string, yr: number): BoeInputs {
  const parts = (str || "").split(",");
  const maintDefault    = yr >= 2000 ? 500 : yr >= 1980 ? 750 : yr > 0 ? 1000 : 750;
  const reservesDefault = yr >= 2000 ? 250 : yr >= 1980 ? 400 : yr > 0 ?  500 :  400;
  // Use NaN-safe helper so user-entered 0 is respected (|| would silently swap to default)
  const p = (i: number, def: number) => { const v = parseFloat(parts[i]); return isNaN(v) ? def : v; };
  return {
    insurancePerUnit:   p(0, 800),
    maintenancePerUnit: p(1, maintDefault),
    utilitiesPerUnit:   p(2, 250),
    managementPct:      p(3, 3.0),
    marketingPerUnit:   p(4, 150),
    adminPerUnit:       p(5, 100),
    reservesPerUnit:    p(6, reservesDefault),
    payrollPerUnit:     p(7, 1000),
  };
}

// State avg effective tax rates — fallback when no parcel data at all.
// These multiply asking/implied price (≈ FMV) to estimate annual taxes,
// so they MUST be FMV-relative (tax/FMV), regardless of how each state's
// assessor reports values internally. PA stays at 0.015 (~1.5% of FMV is
// PA's statewide effective burden) even though PA's `tax_rate` field is
// raw-relative ~3.5%; multiplying raw-relative × price would over-estimate
// PA taxes by ~2.3× because price ≈ FMV ≈ raw_assessed / CLR (~0.494 to
// 0.0586 depending on county).
const _STATE_TAX_RATES: Record<string, number> = {
  TX: 0.022, GA: 0.010, NC: 0.009, FL: 0.009, SC: 0.006, AZ: 0.006,
  CA: 0.008, CO: 0.006, TN: 0.007, OH: 0.016, PA: 0.015, IL: 0.021,
  NY: 0.016, NJ: 0.022, VA: 0.008, MD: 0.010, WA: 0.009, OR: 0.010,
  MI: 0.016, MN: 0.011, WI: 0.016, IN: 0.009, MO: 0.010, KY: 0.009,
  AL: 0.004, MS: 0.007, LA: 0.006, AR: 0.006, OK: 0.009, KS: 0.013,
  NE: 0.015, IA: 0.015, ND: 0.009, SD: 0.011, MT: 0.007, ID: 0.007,
  WY: 0.006, UT: 0.006, NV: 0.006, NM: 0.007, AK: 0.010, HI: 0.003,
};

function _stateFromAddr(addr: string): string {
  // Match state abbreviation (2 uppercase letters) followed by an optional
  // separator and a 5-digit ZIP — handles both "City, TX, 76114" and "City TX 76114"
  const m = addr.match(/(?:,\s*|\s+)([A-Z]{2})\s*,?\s*\d{5}/);
  return m ? m[1] : "";
}

// ── bottom-up NOI model ────────────────────────────────────────────────────
export function computeBoe(data: UnderwritingData): BoeEst | null {
  const ask     = parseDol(data.askingPrice);
  const cap     = parseCapRateInput(data.brokerCapRate) ?? 0;
  const buyerCap = parseCapRateInput(data.buyerCapRate) ?? 0;
  const units = parseInt(data.units) || 0;
  const yr    = parseInt(data.yearBuilt) || 0;
  // Need asking price OR buyer cap rate — buyer cap allows implied-price mode
  if (!ask && !buyerCap) return null;
  // Broker cap rate is a comparison point only — analysis runs from rents or census median
  const hasRevenue = cap > 0
    || !!parseRentPerUnit(data.inPlaceRents)
    || parseDol(data.censusRent) > 0;
  if (!hasRevenue) return null;
  // Without a unit count and without any cap rate there is no way to derive GPR or
  // work backwards from NOI — return null so we don't render a section full of $0s.
  if (units === 0 && !cap && !buyerCap) return null;
  const brokerNoi = ask * (cap / 100);

  // Taxes: tier 1 — actual from county assessor or user input
  let taxes = parseDol(data.annualTaxes);
  const hasAssessorData = parseDol(data.assessedValue) > 0;
  let taxesSource = taxes > 0 ? (hasAssessorData ? "from county assessor" : "user input") : "from county assessor";
  let taxesIsEstimate = false;
  // Tier 2 — computed from assessed value × tax rate
  if (!taxes && data.assessedValue && data.taxRate) {
    const av = parseDol(data.assessedValue);
    const rate = parseFloat(data.taxRate.replace(/%/g, "")) / 100;
    if (av && rate) { taxes = Math.round(av * rate); taxesSource = "est. from assessment × tax rate"; }
  }
  // Tier 3 — state avg tax rate × price (shown in red as rough estimate)
  // When no asking price, derive a rough implied price from rents + buyer cap to estimate taxes.
  if (!taxes) {
    const priceForTax = ask > 0 ? ask : (() => {
      if (!buyerCap) return 0;
      const rentPU = parseRentPerUnit(data.inPlaceRents) || parseDol(data.censusRent) || 0;
      if (!rentPU || !units) return 0;
      // Rough NOI ≈ 42% of GPR (conservative pre-tax multifamily margin)
      return Math.round((rentPU * units * 12 * 0.42) / (buyerCap / 100));
    })();
    if (priceForTax > 0) {
      const stateRate = _STATE_TAX_RATES[_stateFromAddr(data.address || "")];
      if (stateRate) {
        taxes = Math.round(priceForTax * stateRate);
        taxesSource = ask > 0 ? "county avg rate × asking price" : "county avg rate × est. price";
        taxesIsEstimate = true;
      }
    }
  }

  const opexInputs = parseOpexOverrides(data.opexOverrides || "", yr);
  const mgmtPct = opexInputs.managementPct / 100;
  // Guard: management 100%+ means EGI denominator hits zero — not a valid input
  if (mgmtPct >= 1) return null;

  const insurance  = units > 0 ? units * opexInputs.insurancePerUnit   : Math.round(brokerNoi * 0.08);
  const maintenance= units > 0 ? units * opexInputs.maintenancePerUnit  : Math.round(brokerNoi * 0.10);
  const utilities  = units > 0 ? units * opexInputs.utilitiesPerUnit    : Math.round(brokerNoi * 0.04);
  const marketing  = units > 0 ? units * opexInputs.marketingPerUnit    : Math.round(brokerNoi * 0.02);
  const admin      = units > 0 ? units * opexInputs.adminPerUnit        : Math.round(brokerNoi * 0.02);
  const reserves   = units > 0 ? units * opexInputs.reservesPerUnit     : Math.round(brokerNoi * 0.04);
  const payroll    = units > 0 ? units * opexInputs.payrollPerUnit      : Math.round(brokerNoi * 0.05);
  const opExExMgmt = taxes + insurance + maintenance + utilities + marketing + admin + reserves + payroll;

  // Revenue assumptions — use NaN-safe parse so user-entered 0 is respected
  const parseRate = (s: string, def: number) => { const n = parseFloat(s); return isNaN(n) ? def : n; };
  const vacPct  = parseRate(data.vacancyPct,      5.0);
  const bdPct   = parseRate(data.badDebtPct,      1.0);
  const othPct  = parseRate(data.otherIncomePct,  50);

  // GPR: use in-place rents if provided, fall back to ZIP median rent, then derive from broker NOI
  let gpr: number, egi: number, management: number, totalOpEx: number;
  const rentPerUnit = parseRentPerUnit(data.inPlaceRents)
    || (units > 0 && parseDol(data.censusRent) > 0 ? parseDol(data.censusRent) : null);
  if (rentPerUnit && units > 0) {
    gpr = rentPerUnit * units * 12;
    const vacancyAmt  = gpr * (vacPct / 100);
    const badDebtAmt  = gpr * (bdPct / 100);
    const otherIncome = gpr / 12 * (othPct / 100);
    egi = gpr - vacancyAmt - badDebtAmt + otherIncome;
    management = egi * mgmtPct;
    totalOpEx = opExExMgmt + management;
  } else {
    // Backward from broker NOI: EGI = (brokerNoi + opExExMgmt) / (1 - mgmtPct)
    egi = (brokerNoi + opExExMgmt) / (1 - mgmtPct);
    management = egi * mgmtPct;
    totalOpEx = opExExMgmt + management;
    const revenueMultiplier = 1 - vacPct / 100 - bdPct / 100 + othPct / 1200;
    gpr = revenueMultiplier > 0 ? egi / revenueMultiplier : egi / 0.94;
  }

  const vacancyAmt     = gpr * (vacPct / 100);
  const badDebtAmt     = gpr * (bdPct / 100);
  const otherIncomeAmt = gpr / 12 * (othPct / 100);
  const gprPerUnitPerMonth = units > 0 ? gpr / 12 / units : 0;

  const occupancyRaw = parseFloat((data.occupancy || "").replace(/%/g, ""));
  const occupancyRate = occupancyRaw > 0 ? occupancyRaw / 100 : Math.max(0, 1 - vacPct / 100);

  const estNoi = egi - totalOpEx;

  const breakevenOcc = (gpr + otherIncomeAmt) > 0
    ? (totalOpEx / (gpr + otherIncomeAmt)) * 100
    : 0;

  return {
    brokerNoi, taxes, taxesSource, taxesIsEstimate, insurance, maintenance, utilities,
    marketing, admin, reserves, payroll, opexInputs,
    management, totalOpEx, egi, gpr, gprPerUnitPerMonth, occupancyRate, estNoi,
    vacancyAmt, badDebtAmt, otherIncomeAmt,
    vacancyPct: vacPct, badDebtPct: bdPct, otherIncomePct: othPct,
    breakevenOcc,
  };
}

// ── report derivations ─────────────────────────────────────────────────────
// State-specific tax treatment, effective tax rate, implied acquisition price,
// tax-adjusted (post-reassessment) NOI, debt-service model, and price ratios.
// Extracted verbatim from the DealBriefPDF component so the live Review & Adjust
// page and the PDF derive IDENTICAL numbers. Pure — no React, no rendering.

// Superset of fields the derivation reads. ReportData is structurally assignable.
export interface DerivationData {
  address: string;
  askingPrice: string;
  brokerCapRate: string;
  buyerCapRate: string;
  annualTaxes: string;
  assessedValue: string;
  taxRate: string;
  proFormaTaxRate?: string;
  assessmentRatio?: string;
  marketValue?: string;
  reappraisalYear?: string;
  abatementFlag?: boolean;
  capPct?: string;
  units: string;
  buildingArea: string;
  rates: string[];
  ltvs: string[];
  amortYears: string;
  ioPeriod: string;
}

// Local replica of pdf-template's fmtDol so askFmt is byte-identical.
function _fmtDol(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/[$,]/g, ""));
  if (isNaN(n)) return str;
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function computeDerivations(data: DerivationData, boe: BoeEst | null) {
  const buyerCR = (parseCapRateInput(data.buyerCapRate) ?? 0) / 100;

  // Effective tax rate — computed before impliedPrice so the closed-form can use it.
  const effTaxRate = (() => {
    if (!boe) return 0;
    const stateM = (data.address || "").match(/(?:,\s*|\s+)([A-Z]{2})\s*,?\s*\d{5}/);
    const _stateAbbr = stateM?.[1] || "";
    // AZ uses Limited Property Value — tax base capped 5%/yr, does NOT reset on sale.
    if (_stateAbbr === "AZ") return 0;
    // Tier 1: the reassessment scenario uses the pro-forma rate when the user
    // provides one, else the current rate. Lets an investor model a
    // post-purchase rate change on top of the base reset to purchase price.
    const tr = parseFloat((data.proFormaTaxRate || data.taxRate || "").replace(/%/g, ""));
    if (!isNaN(tr) && tr > 0) return tr / 100;
    // Tier 2: back into a rate from taxes ÷ assessed value.
    const taxes = parseDol(data.annualTaxes);
    const av    = parseDol(data.assessedValue);
    if (taxes > 0 && av > 0) return taxes / av;
    // Tier 3: state average effective rate for investor-owned multifamily.
    const _STATE_RATES: Record<string, number> = {
      TX: 0.022, GA: 0.013, NC: 0.010, FL: 0.018, SC: 0.025, AZ: 0.008,
      CA: 0.008, CO: 0.006, TN: 0.007, OH: 0.016, PA: 0.035, IL: 0.021,
      NY: 0.016, NJ: 0.022, VA: 0.008, MD: 0.010, WA: 0.009, OR: 0.010,
      MI: 0.016, MN: 0.011, WI: 0.016, IN: 0.009, MO: 0.010,
    };
    return stateM ? (_STATE_RATES[_stateAbbr] || 0) : 0;
  })();

  // State-specific tax treatment flags.
  const isLpvState = /(?:,\s*|\s+)AZ\s*,?\s*\d{5}/.test(data.address || "");
  const isFLState  = /(?:,\s*|\s+)FL\s*,?\s*\d{5}/.test(data.address || "");
  const isNCState  = /(?:,\s*|\s+)NC\s*,?\s*\d{5}/.test(data.address || "");
  const isPAState  = /(?:,\s*|\s+)PA\s*,?\s*\d{5}/.test(data.address || "");
  const isCOState  = /(?:,\s*|\s+)CO\s*,?\s*\d{5}/.test(data.address || "");
  const isNVCappedState = (() => {
    const isNV = /(?:,\s*|\s+)NV\s*,?\s*\d{5}/.test(data.address || "");
    if (!isNV) return false;
    return Boolean(data.abatementFlag) && Boolean(data.capPct);
  })();
  const nvCapMultiplier = isNVCappedState
    ? 1 + (parseFloat(data.capPct || "0.08") || 0.08)
    : 1.08;

  // Split-assessment-ratio states (OH/TN/MS/MO/KS).
  const splitRatioStateMatch = /(?:,\s*|\s+)(OH|TN|MS|MO|KS)\s*,?\s*\d{5}/.exec(data.address || "");
  const splitRatioState = splitRatioStateMatch ? splitRatioStateMatch[1] : "";
  const _splitRatioUnits = (() => {
    const n = parseInt(data.units) || 0;
    return n > 0 ? n : 5;  // default to 5+ (MF) when unset
  })();
  const splitRatioMap: Record<string, number> = {
    OH: 0.35,
    TN: _splitRatioUnits <= 4 ? 0.25 : 0.40,
    MS: 0.15, MO: 0.19, KS: 0.115,
  };
  const splitRatioPct = (() => {
    const raw = (data.assessmentRatio || "").toString().replace(/%/g, "").trim();
    const parsed = parseFloat(raw);
    if (isFinite(parsed) && parsed > 0 && parsed < 1) return parsed;
    if (isFinite(parsed) && parsed >= 1 && parsed <= 100) return parsed / 100;
    return splitRatioState ? splitRatioMap[splitRatioState] : 0;
  })();
  const isSplitRatioState = Boolean(splitRatioState) && splitRatioPct > 0;
  const splitRatioLabel = splitRatioPct > 0
    ? `${(splitRatioPct * 100).toFixed(splitRatioPct * 100 < 20 ? 1 : 0)}%`
    : "";
  const splitRatioTaxableStr = (() => {
    if (!isSplitRatioState) return "";
    const raw = (data.assessedValue || "").replace(/[$,]/g, "");
    const n = parseFloat(raw);
    if (!isFinite(n) || n <= 0) return "";
    return "$" + Math.round(n * splitRatioPct).toLocaleString();
  })();

  // Implied acquisition price — closed-form so tax-adj NOI ÷ price = buyer cap exactly.
  const impliedPrice = (() => {
    if (!boe || boe.estNoi <= 0 || !buyerCR) return 0;
    if (isPAState) return Math.round(boe.estNoi / buyerCR);
    if (effTaxRate > 0) {
      const taxMult = isFLState ? 0.95 : 1.0;
      return Math.round((boe.estNoi + boe.taxes) / (buyerCR + taxMult * effTaxRate));
    }
    return Math.round(boe.estNoi / buyerCR);
  })();

  const effectiveAskStr = data.askingPrice || (impliedPrice > 0 ? String(impliedPrice) : "");
  const effectiveAskNum = parseDol(effectiveAskStr);       // used for financial calcs

  // ── Tax-adjusted (post-reassessment) taxes + NOI ──
  // Computed BEFORE the debt model so DSCR / CoC run against the reassessed NOI
  // an investor actually inherits, not the seller's in-place tax basis.
  const taxAdjTaxes = (() => {
    if (!boe) return 0;
    if (isLpvState && boe.taxes > 0) return Math.round(boe.taxes * 1.05);
    if (isNVCappedState && boe.taxes > 0) return Math.round(boe.taxes * nvCapMultiplier);
    if (isPAState) return 0;
    if (isCOState) return 0;
    if (effTaxRate > 0 && effectiveAskNum > 0) {
      const basis = isFLState ? effectiveAskNum * 0.95 : effectiveAskNum;
      return Math.round(basis * effTaxRate);
    }
    return 0;
  })();
  const taxAdjNoi   = boe && taxAdjTaxes > 0 ? boe.estNoi + boe.taxes - taxAdjTaxes : 0;
  const taxAdjThreshold = boe ? Math.max(200, boe.taxes * 0.05) : 500;
  const showTaxAdj  = boe !== null && taxAdjTaxes > 0 && (
    isLpvState ? boe.taxes > 0 : Math.abs(taxAdjTaxes - boe.taxes) > taxAdjThreshold
  );
  // NOI the debt model runs against: the reassessed line when a material swing
  // exists, otherwise in-place. Labelled in the UI so the basis is explicit.
  const debtNoi      = boe ? (showTaxAdj ? taxAdjNoi : boe.estNoi) : null;
  const debtNoiLabel = showTaxAdj ? "Tax-Adjusted NOI" : "In-Place NOI";

  const model = runFinancialModel({
    askingPriceStr: effectiveAskStr,
    brokerCapRateStr: data.brokerCapRate,
    rates: data.rates,
    ltvs: data.ltvs,
    amortYears: data.amortYears,
    ioPeriod: data.ioPeriod,
    // DSCR / CoC run against the tax-adjusted NOI (falls back to in-place when
    // there is no reassessment swing).
    noiOverride: debtNoi,
  });

  const ioYears     = parseFloat(data.ioPeriod) || 0;
  const amortYrsNum = parseFloat(data.amortYears) || 30;
  const isIO        = ioYears > 0;
  const ioLabel     = isIO
    ? ioYears >= amortYrsNum
      ? `${ioYears}-yr I/O (exceeds ${data.amortYears}-yr loan term — verify inputs)`
      : `${ioYears}-yr I/O, then ${data.amortYears}-yr amort`
    : `${data.amortYears}-yr amortization`;
  const askFmt        = _fmtDol(data.askingPrice);        // user's stated price only
  const askNum        = parseDol(data.askingPrice);        // user's stated price only
  const unitsNum      = parseInt(data.units) || 0;

  const taxAdjDesc = isLpvState
    ? "AZ 5% LPV cap"
    : isNCState
      ? `${(effTaxRate * 100).toFixed(2)}% × price upon ${data.reappraisalYear || "next"} reappraisal`
      : isFLState
        ? `${(effTaxRate * 100).toFixed(2)}% × 95% of price (FL JV reset)`
        : `${(effTaxRate * 100).toFixed(2)}% × price`;
  const taxAdjBreakevenOcc = showTaxAdj && boe && (boe.gpr + boe.otherIncomeAmt) > 0
    ? (boe.totalOpEx - boe.taxes + taxAdjTaxes) / (boe.gpr + boe.otherIncomeAmt) * 100
    : boe?.breakevenOcc ?? 0;

  const bldgSF       = parseDol(data.buildingArea.replace(/SF/gi, "").replace(/,/g, ""));
  const pricePerUnit = unitsNum > 0 && effectiveAskNum > 0 ? fmt$(effectiveAskNum / unitsNum) + " / unit" : "";
  const pricePerSF   = bldgSF > 0  && effectiveAskNum > 0 ? fmt$(effectiveAskNum / bldgSF)   + " / SF"   : "";

  return {
    buyerCR, effTaxRate,
    isLpvState, isFLState, isNCState, isPAState, isCOState, isNVCappedState, nvCapMultiplier,
    splitRatioState, splitRatioPct, isSplitRatioState, splitRatioLabel, splitRatioTaxableStr,
    impliedPrice, effectiveAskStr, effectiveAskNum, askNum, askFmt,
    model,
    ioYears, amortYrsNum, isIO, ioLabel, debtNoiLabel,
    unitsNum,
    taxAdjTaxes, taxAdjNoi, taxAdjThreshold, showTaxAdj, taxAdjDesc, taxAdjBreakevenOcc,
    bldgSF, pricePerUnit, pricePerSF,
  };
}

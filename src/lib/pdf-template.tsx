import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { runFinancialModel, FinancialSummary, fmt$, fmtPct, fmtX } from "./financial";

export interface ReportData {
  // Property
  address: string; propertyType: string; yearBuilt: string;
  buildingArea: string; lotSize: string; units: string; unitMix: string;
  zoning: string;
  // Assessor
  assessedValue: string; landValue: string; improvements: string;
  taxRate: string; annualTaxes: string; parcelId: string; assessorSource: string;
  // Deal inputs
  askingPrice: string; brokerCapRate: string; occupancy: string;
  inPlaceRents: string; brokerClaims: string;
  // Assumptions
  rates: string[]; ltvs: string[]; amortYears: string; ioPeriod: string;
  // Revenue assumptions
  vacancyPct: string; badDebtPct: string; otherIncomePct: string;
  // Sale history
  salePrice: string; saleYear: string;
  // FEMA
  femaZone: string;
  // Walk Score
  walkScore: string; bikeScore: string; transitScore: string; walkDesc: string;
  // Crime — new compact JSON (crimeData) or legacy individual fields
  crimeData?: string;
  crimeOverall: string; crimeViolent: string; crimeProp: string;
  crimeRate: string; crimeViolentRate: string; crimePct: string;
  // Census
  censusIncome: string; censusPop: string; censusAge: string;
  censusRent: string; censusHomeVal: string; censusPoverty: string;
  censusRenterPct: string; censusPctBlack: string; censusPctHispanic: string; censusPctWhite: string;
  // Permits
  permitCount: string; permitSource: string; permitDetails: string;
  // Schools
  schoolsData: string;
  // Proximity
  proximityMiles: string; proximityMinutes: string; proximityCity: string;
  // MSA comparison
  msaName: string; msaIncome: string; msaHomeVal: string; msaRent: string; msaPoverty: string;
  // Census household composition
  censusHouseholds: string; censusAvgHHSize: string; censusAvgRenterSize: string;
  // HUD subsidized housing
  hudNearbyProps: string; hudNearbyUnits: string; hudSection8Count: string; hudPropNames: string;
  // BLS employment
  blsData: string;
  opexOverrides: string;
}

// ── color palette ─────────────────────────────────────────────────────────────
const NAVY  = "#1D3557";
const SLATE = "#457B9D";
const GRAY  = "#6B7280";
const GREEN = "#2D8C4E";
const RED   = "#C0392B";
const AMBER = "#B7791F";
const LIGHT = "#F8FAFC";
const RULE  = "#E2E8F0";
const GREEN_BG = "#F0FBF4";
const AMBER_BG = "#FFFBEB";
const RED_BG   = "#FEF2F2";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1F2937", paddingTop: 40, paddingBottom: 52, paddingHorizontal: 44, backgroundColor: "#FFFFFF" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: NAVY },
  logo: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: -0.5 },
  logoAccent: { color: SLATE },
  headerSub: { fontSize: 8, color: GRAY },
  sectionHead: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 16, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: NAVY },
  tableWrap: { marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: RULE },
  rowAlt: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: LIGHT },
  lbl: { width: 168, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, paddingRight: 8 },
  val: { flex: 1, fontSize: 8.5, color: "#374151" },
  note: { fontSize: 7.5, color: GRAY, fontStyle: "italic", marginTop: 3, marginBottom: 2 },
  // Scenarios table
  tHead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 3, marginBottom: 2 },
  tHCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: RULE },
  tRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: LIGHT },
  tCell: { fontSize: 8.5, color: "#1F2937" },
  // Bullets
  bullet: { flexDirection: "row", marginBottom: 5, paddingRight: 4 },
  bulletDot: { width: 8, fontSize: 9, color: NAVY, marginTop: 0.5 },
  bulletText: { flex: 1, fontSize: 8.5, color: "#374151", lineHeight: 1.5 },
  bulletBold: { fontFamily: "Helvetica-Bold" },
  // Verdict box
  verdictBox: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 4, marginBottom: 10, borderWidth: 1 },
  verdictLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  verdictDesc: { fontSize: 8, marginTop: 2 },
  // Flag items
  flagItem: { flexDirection: "row", marginBottom: 6, paddingLeft: 4 },
  flagDot: { width: 10, fontSize: 11, marginTop: -1 },
  flagContent: { flex: 1 },
  flagTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  flagBody: { fontSize: 8, color: "#374151", lineHeight: 1.45 },
  // Disclaimer
  disclaimer: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 3, backgroundColor: LIGHT },
  disclaimerTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  disclaimerText: { fontSize: 7, color: GRAY, lineHeight: 1.55 },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 5 },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

// ── helper: parse ─────────────────────────────────────────────────────────────
function parseDol(str: string): number {
  return parseFloat(str.replace(/[$,]/g, "")) || 0;
}

// Format any dollar string (user input or pipeline) as $X,XXX,XXX
function fmtDol(str: string): string {
  const n = parseDol(str);
  if (!n) return str;
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Format a string containing an SF number as "32,765 SF"
function fmtSFStr(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (!n) return str;
  return Math.round(n).toLocaleString("en-US") + " SF";
}

// Format a percentage string to "X.XX%"
function fmtPctDisplay(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/%/g, ""));
  if (isNaN(n)) return str;
  return n.toFixed(2) + "%";
}

// Parse a rent-per-unit from user input like "$1,975" or "1975"
// Returns null if the string has multiple rent tiers (e.g. "3BR: $1,100 / 4BR: $1,300")
function parseRentPerUnit(str: string): number | null {
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

// Alias kept for existing usage
const fmtAskingPrice = fmtDol;

function dscrColor(v: number | null) { return v === null ? "#1F2937" : v >= 1.10 ? GREEN : v >= 0.95 ? AMBER : RED; }
function cocColor(v: number | null)  { return v === null ? "#1F2937" : v >= 0.06 ? GREEN : v >= 0.03 ? AMBER : RED; }

// ── BOE estimate ──────────────────────────────────────────────────────────────
interface BoeEst {
  brokerNoi: number;
  taxes: number; taxesSource: string;
  insurance: number; maintenance: number;
  utilities: number; management: number; totalOpEx: number;
  marketing: number; admin: number; reserves: number;
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

interface BoeInputs {
  insurancePerUnit: number;
  maintenancePerUnit: number;
  utilitiesPerUnit: number;
  managementPct: number;
  marketingPerUnit: number;
  adminPerUnit: number;
  reservesPerUnit: number;
}

function parseOpexOverrides(str: string, yr: number): BoeInputs {
  const parts = (str || "").split(",");
  const maintDefault = yr >= 2000 ? 500 : yr >= 1980 ? 750 : 1000;
  return {
    insurancePerUnit:   parseFloat(parts[0]) || 800,
    maintenancePerUnit: parseFloat(parts[1]) || maintDefault,
    utilitiesPerUnit:   parseFloat(parts[2]) || 250,
    managementPct:      parseFloat(parts[3]) || 8.0,
    marketingPerUnit:   parseFloat(parts[4]) || 150,
    adminPerUnit:       parseFloat(parts[5]) || 100,
    reservesPerUnit:    parseFloat(parts[6]) || 250,
  };
}

function computeBoe(data: ReportData): BoeEst | null {
  const ask  = parseDol(data.askingPrice);
  const cap  = parseFloat(data.brokerCapRate) || 0;
  const units = parseInt(data.units) || 0;
  const yr    = parseInt(data.yearBuilt) || 0;
  if (!ask) return null;
  // Broker cap rate is a comparison point only — analysis runs from rents or census median
  const hasRevenue = cap > 0
    || !!parseRentPerUnit(data.inPlaceRents)
    || parseDol(data.censusRent) > 0;
  if (!hasRevenue) return null;
  const brokerNoi = ask * (cap / 100);

  // Taxes: use actual if available, compute from assessment × rate as fallback
  let taxes = parseDol(data.annualTaxes);
  let taxesSource = "from county assessor";
  if (!taxes && data.assessedValue && data.taxRate) {
    const av = parseDol(data.assessedValue);
    const rate = parseFloat(data.taxRate.replace(/%/g, "")) / 100;
    if (av && rate) { taxes = Math.round(av * rate); taxesSource = "est. from assessment × tax rate"; }
  }

  const opexInputs = parseOpexOverrides(data.opexOverrides || "", yr);
  const mgmtPct = opexInputs.managementPct / 100;

  const insurance  = units > 0 ? units * opexInputs.insurancePerUnit   : Math.round(brokerNoi * 0.08);
  const maintenance= units > 0 ? units * opexInputs.maintenancePerUnit  : Math.round(brokerNoi * 0.10);
  const utilities  = units > 0 ? units * opexInputs.utilitiesPerUnit    : Math.round(brokerNoi * 0.04);
  const marketing  = units > 0 ? units * opexInputs.marketingPerUnit    : Math.round(brokerNoi * 0.02);
  const admin      = units > 0 ? units * opexInputs.adminPerUnit        : Math.round(brokerNoi * 0.02);
  const reserves   = units > 0 ? units * opexInputs.reservesPerUnit     : Math.round(brokerNoi * 0.04);
  const opExExMgmt = taxes + insurance + maintenance + utilities + marketing + admin + reserves;

  // Revenue assumptions
  const vacPct  = parseFloat(data.vacancyPct  || "5.0")  || 5.0;
  const bdPct   = parseFloat(data.badDebtPct  || "1.0")  || 1.0;
  const othPct  = parseFloat(data.otherIncomePct || "50") || 50;

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
    brokerNoi, taxes, taxesSource, insurance, maintenance, utilities,
    marketing, admin, reserves, opexInputs,
    management, totalOpEx, egi, gpr, gprPerUnitPerMonth, occupancyRate, estNoi,
    vacancyAmt, badDebtAmt, otherIncomeAmt,
    vacancyPct: vacPct, badDebtPct: bdPct, otherIncomePct: othPct,
    breakevenOcc,
  };
}

// ── flags ─────────────────────────────────────────────────────────────────────
interface Flag { level: "red" | "amber" | "green"; title: string; body: string; }

function computeFlags(data: ReportData, model: FinancialSummary): Flag[] {
  const flags: Flag[] = [];
  const yr = parseInt(data.yearBuilt) || 0;
  const age = yr > 0 ? new Date().getFullYear() - yr : 0;
  const permitNum = parseInt(data.permitCount) || 0;
  const av  = parseDol(data.assessedValue);
  const ask = parseDol(data.askingPrice);

  // Crime
  const _crimeGrade = parseCrimeData(data.crimeData ?? "")?.overallGrade || data.crimeOverall || "";
  if (_crimeGrade) {
    if (["F","D-","D"].includes(_crimeGrade)) {
      flags.push({ level: "red", title: `High Crime — Grade ${_crimeGrade}`,
        body: `Crime grade ${_crimeGrade}${data.crimeRate ? " (" + data.crimeRate + " per 1,000 residents)" : ""}${data.crimePct ? "; safer than only " + data.crimePct + "% of U.S. ZIP codes" : ""}. Expect higher insurance premiums, lender scrutiny, and ongoing tenant quality challenges.` });
    } else if (["D+","C-","C"].includes(_crimeGrade)) {
      flags.push({ level: "amber", title: `Elevated Crime — Grade ${_crimeGrade}`,
        body: `Crime index is ${_crimeGrade}. Factor into tenant screening, insurance budget, and exit cap assumptions.` });
    }
  }

  // Flood zone
  if (data.femaZone && !data.femaZone.includes("Zone X") && !data.femaZone.includes("X")) {
    flags.push({ level: "red", title: `Flood Zone — ${data.femaZone} — Insurance Required`,
      body: `Property falls in FEMA ${data.femaZone}. Flood insurance is required by lenders and will cost $1,500–$5,000+/yr depending on coverage, adding directly to operating expenses.` });
  }

  // No permits on old building
  if (permitNum === 0 && age > 30) {
    flags.push({ level: "red", title: `No Permit History on ${age}-Year-Old Building`,
      body: `Zero building permits on record suggests major systems (roof, HVAC, plumbing, electrical) may be original or replaced without documentation. Budget aggressively for systems replacement and do not rely on broker representations about capital improvements.` });
  } else if (permitNum === 0 && age > 15) {
    flags.push({ level: "amber", title: "No Permit History — Verify Improvements",
      body: `No building permits found. Verify any broker claims about capital improvements during due diligence. Request receipts and warranties.` });
  }

  // Cash flow / DSCR
  const hiLtvScenarios = model.scenarios.filter(sc => sc.ltv === Math.max(...model.scenarios.map(s => s.ltv)));
  if (hiLtvScenarios.length > 0) {
    const allNegative = hiLtvScenarios.every(sc => sc.dscr !== null && sc.dscr < 1.0);
    const someBelow110 = hiLtvScenarios.some(sc => sc.dscr !== null && sc.dscr < 1.10);
    if (allNegative) {
      flags.push({ level: "red", title: "Negative Cash Flow at Broker-Stated NOI",
        body: `At the highest LTV scenario, DSCR is below 1.0x using the broker's cap rate. The deal does not cover debt service at face value — verify NOI with T-12 actuals before proceeding.` });
    } else if (someBelow110) {
      flags.push({ level: "amber", title: "Thin Coverage — DSCR Below 1.10x",
        body: `Cash flow coverage is marginal at current rate scenarios. Any NOI shortfall from broker representations could push the deal into negative territory. Stress-test with actual operating statements.` });
    }
  }

  // Assessment vs. ask
  if (av > 0 && ask > 0) {
    const ratio = av / ask;
    const pct = Math.round(ratio * 100);
    if (ratio > 1.0) {
      flags.push({ level: "amber", title: `Assessment Exceeds Ask — ${pct}% of Ask Price`,
        body: `County appraised at ${fmtDol(data.assessedValue)} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). You are purchasing below the assessed value. The current tax burden is based on this higher assessment — a property tax consultant may be able to challenge it downward after purchase. Do not assume taxes will increase; they may decrease.` });
    } else if (ratio > 0.90) {
      flags.push({ level: "amber", title: `Assessment Near Ask — ${pct}% of Ask Price`,
        body: `County appraised at ${fmtDol(data.assessedValue)} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). Minimal reassessment risk — assessment is already close to purchase price, so the tax burden is unlikely to change materially at next cycle.` });
    } else if (ratio > 0.75) {
      flags.push({ level: "amber", title: `Reassessment Risk — Assessed at ${pct}% of Ask`,
        body: `County appraised at ${fmtDol(data.assessedValue)} vs. ${fmtDol(data.askingPrice)} asking. A purchase at ask will likely trigger reassessment upward at next cycle, increasing annual taxes. Model the delta in your pro forma.` });
    } else {
      flags.push({ level: "amber", title: `Significant Reassessment Risk — Assessed at Only ${pct}% of Ask`,
        body: `County appraised at ${fmtDol(data.assessedValue)} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). A purchase at ask will almost certainly trigger a substantial upward reassessment — model a meaningful tax increase in your pro forma before LOI.` });
    }
  }

  // Aging infrastructure (if no permit flag already covers it)
  if (age > 45 && !flags.some(f => f.title.includes("Permit"))) {
    flags.push({ level: "amber", title: `Aging Asset — Built ${yr}`,
      body: `${age}-year-old property likely has original cast iron drain lines, pre-modern electrical panels, and aging HVAC. Confirm scope of prior capital work during inspection and reserve accordingly.` });
  }

  return flags;
}

// ── value-add thesis (rule-based) ─────────────────────────────────────────────
function buildThesis(data: ReportData, flags: Flag[]): string {
  const parts: string[] = [];
  const yr   = parseInt(data.yearBuilt) || 0;
  const age  = yr > 0 ? new Date().getFullYear() - yr : 0;
  const units = parseInt(data.units) || 0;
  const permitNum = parseInt(data.permitCount) || 0;
  const av  = parseDol(data.assessedValue);
  const ask = parseDol(data.askingPrice);

  if (units > 0 && age > 0) {
    parts.push(`${age}-year-old, ${units}-unit${data.propertyType ? " " + data.propertyType.toLowerCase() : " multifamily asset"}${data.unitMix ? " (" + data.unitMix + ")" : ""}.`);
  }
  if (data.brokerClaims) {
    parts.push(`Broker represents: "${data.brokerClaims}." These claims require independent verification during due diligence.`);
  }
  if (permitNum === 0 && age > 25) {
    parts.push(`Zero permits on record for a ${age}-year-old building. Verify condition of all major systems during inspection and cross-reference against any broker capital improvement claims.`);
  } else if (permitNum > 0) {
    parts.push(`${permitNum} permit record${permitNum > 1 ? "s" : ""} found — verify scope and quality of documented improvements during inspection.`);
  }
  if (av > 0 && ask > 0) {
    const ratio = av / ask;
    const pct = Math.round(ratio * 100);
    if (ratio > 1.0) {
      parts.push(`County assessment (${fmtDol(data.assessedValue)}) exceeds the asking price by ${pct - 100}% — buyer is purchasing below assessed value. Current taxes reflect the higher assessment; a tax consultant review is worthwhile.`);
    } else if (pct < 80) {
      parts.push(`County assessment (${fmtDol(data.assessedValue)}) is ${pct}% of ask, suggesting the seller is pricing in upside. A purchase at or near ask will likely trigger reassessment at the higher price at next cycle.`);
    }
  }
  const _thesisCrimeGrade = parseCrimeData(data.crimeData ?? "")?.overallGrade || data.crimeOverall || "";
  if (_thesisCrimeGrade && ["F","D-","D","D+"].includes(_thesisCrimeGrade)) {
    parts.push(`Crime profile (grade ${_thesisCrimeGrade}) positions this as a workforce / C-class housing play. Operators with experience in challenged submarkets may find value; institutional capital will largely pass.`);
  }
  if (data.censusIncome && data.censusRent) {
    const inc = parseDol(data.censusIncome);
    const rent = parseDol(data.censusRent);
    if (inc > 0 && rent > 0) {
      const rentToIncome = Math.round((rent * 12 / inc) * 100);
      parts.push(`Area median HH income of ${data.censusIncome} vs. median gross rent of ${data.censusRent}/mo implies a rent-to-income ratio of ~${rentToIncome}% for the median resident.`);
    }
  }
  return parts.join(" ") || "Insufficient data to generate analysis. Enter deal inputs and rerun.";
}

// ── deal verdict ──────────────────────────────────────────────────────────────
function dealVerdict(flags: Flag[]) {
  const reds = flags.filter(f => f.level === "red").length;
  const ambers = flags.filter(f => f.level === "amber").length;
  if (reds >= 2) return { color: RED, bg: RED_BG, label: "SIGNIFICANT RISK — PROCEED WITH CAUTION", desc: "Multiple material risk factors identified. Do not move forward without resolving these issues through due diligence." };
  if (reds === 1 || ambers >= 3) return { color: RED, bg: RED_BG, label: "ELEVATED RISK — CAREFUL DUE DILIGENCE REQUIRED", desc: "Material risk factor(s) present. Verify independently and stress-test assumptions before committing to LOI." };
  if (ambers >= 1) return { color: AMBER, bg: AMBER_BG, label: "MODERATE RISK — STANDARD DUE DILIGENCE APPLIES", desc: "Some risk factors noted. Review flagged items carefully. No automatic deal-killers identified." };
  return { color: GREEN, bg: GREEN_BG, label: "ACCEPTABLE RISK PROFILE", desc: "No major red flags identified based on available data. Standard due diligence applies." };
}

// ── permit detail parser ──────────────────────────────────────────────────────
interface PermitDetail { t: string; d: string; dt: string; v: number | null; }

function parsePermits(raw: string): PermitDetail[] {
  try { return JSON.parse(raw) as PermitDetail[]; } catch { return []; }
}

// ── school parser ─────────────────────────────────────────────────────────────
interface SchoolDetail { n: string; l: string; r: string; d: string | null; }

function parseSchools(raw: string): SchoolDetail[] {
  try { return JSON.parse(raw) as SchoolDetail[]; } catch { return []; }
}

function schoolRatingColor(band: string): string {
  const b = band.toLowerCase();
  if (b.includes("above")) return GREEN;
  if (b.includes("below")) return RED;
  if (b === "average") return AMBER;
  return GRAY;
}

// ── BLS employment parser ─────────────────────────────────────────────────────
interface ParsedBLS {
  ur: number | null; nat: number | null;
  emp: number | null; lf: number | null;
  per: string; co: string;
}

function parseBLS(raw: string): ParsedBLS | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return {
      ur:  d.ur  ?? null,
      nat: d.nat ?? null,
      emp: d.emp ?? null,
      lf:  d.lf  ?? null,
      per: d.per || "",
      co:  d.co  || "",
    };
  } catch { return null; }
}

// ── crime data parser ─────────────────────────────────────────────────────────
// National FBI UCR 2022 rates per 1,000 (hardcoded; matches Python constants)
const NAT_RATES = {
  violent: 3.80, murder: 0.063, robbery: 0.609, assault: 2.743,
  property: 19.54, burglary: 3.14, larceny: 13.46, vehicleTheft: 2.94,
};

interface ParsedCrime {
  source: string; yearRange: string; population: number; agencyName: string;
  overallGrade: string; violentGrade: string; propertyGrade: string; pct: number | null;
  // CrimeGrade / FBI CDE path
  crateTotal: number | null; crateViolent: number | null;
  // Dallas Open Data path — local rates per 1,000 (annual avg)
  vr: number | null; mr: number | null; rr: number | null; ar: number | null;
  pr: number | null; br: number | null; lr: number | null; vtr: number | null;
}

function parseCrimeData(raw: string): ParsedCrime | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return {
      source: d.src || "",
      yearRange: d.yr || "",
      population: d.pop || 0,
      agencyName: d.ag || "",
      overallGrade: d.og || "",
      violentGrade: d.vg || "",
      propertyGrade: d.pg || "",
      pct: d.pct ?? null,
      crateTotal: d.cr ?? null,
      crateViolent: d.vr1k ?? null,
      vr: d.vr ?? null, mr: d.mr ?? null, rr: d.rr ?? null, ar: d.ar ?? null,
      pr: d.pr ?? null, br: d.br ?? null, lr: d.lr ?? null, vtr: d.vtr ?? null,
    };
  } catch { return null; }
}

function crimeGradeColor(grade: string): string {
  if (!grade) return GRAY;
  const g = grade.toUpperCase();
  if (g === "A" || g === "A+") return GREEN;
  if (g === "B+" || g === "B" || g === "B-") return GREEN;
  if (g === "C+" || g === "C" || g === "C-") return AMBER;
  return RED;
}

function vsNat(local: number, nat: number): string {
  if (!nat) return "";
  const pct = Math.round((local - nat) / nat * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function vsNatColor(local: number, nat: number): string {
  if (!nat) return GRAY;
  const ratio = local / nat;
  if (ratio <= 0.9) return GREEN;
  if (ratio <= 1.25) return "#374151";
  if (ratio <= 1.75) return AMBER;
  return RED;
}

// ── sub-components ────────────────────────────────────────────────────────────
function PageHeader({ address, page }: { address: string; page: number }) {
  return (
    <View style={s.headerRow}>
      <Text style={s.logo}>DEAL<Text style={s.logoAccent}>BRIEF</Text></Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.headerSub}>
          Pre-Offer Property Research Brief | {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </Text>
        <Text style={[s.headerSub, { marginTop: 1 }]}>{address} | Page {page}</Text>
      </View>
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  return <Text style={s.sectionHead}>{title}</Text>;
}

function Row({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? s.rowAlt : s.row}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={s.val}>{value}</Text>
    </View>
  );
}

function Bullet({ bold, rest }: { bold: string; rest: string }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}><Text style={s.bulletBold}>{bold}</Text>{rest}</Text>
    </View>
  );
}

function SubtotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 5, paddingHorizontal: 0, borderTopWidth: 1.5, borderTopColor: NAVY, backgroundColor: LIGHT }}>
      <Text style={{ width: 168, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, paddingRight: 8 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY }}>{value}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>DEALBRIEF · getdealbrief.com</Text>
      <Text style={s.footerText}>For informational purposes only. Not investment advice. See disclaimer on final page.</Text>
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function DealBriefPDF({ data }: { data: ReportData }) {
  const model = runFinancialModel({
    askingPriceStr: data.askingPrice,
    brokerCapRateStr: data.brokerCapRate,
    rates: data.rates,
    ltvs: data.ltvs,
    amortYears: data.amortYears,
    ioPeriod: data.ioPeriod,
  });

  const ioYears    = parseFloat(data.ioPeriod) || 0;
  const isIO       = ioYears > 0;
  const ioLabel    = isIO ? `${ioYears}-yr I/O, then ${data.amortYears}-yr amort` : `${data.amortYears}-yr amortization`;
  const askFmt     = fmtAskingPrice(data.askingPrice);
  const askNum     = parseDol(data.askingPrice);
  const unitsNum   = parseInt(data.units) || 0;
  const bldgSF     = parseDol(data.buildingArea.replace(/SF/gi, "").replace(/,/g, ""));
  const pricePerUnit = unitsNum > 0 && askNum > 0 ? fmt$(askNum / unitsNum) + " / unit" : "";
  const pricePerSF   = bldgSF > 0 && askNum > 0 ? fmt$(askNum / bldgSF) + " / SF" : "";
  const yrBuilt    = parseInt(data.yearBuilt) || 0;
  const age        = yrBuilt > 0 ? new Date().getFullYear() - yrBuilt : 0;
  const permitNum  = parseInt(data.permitCount) || 0;
  const permits    = parsePermits(data.permitDetails || "[]");

  const hasAssessor = !!(data.assessedValue || data.annualTaxes);
  const hasFema     = !!data.femaZone;
  const hasWalk     = !!(data.walkScore || data.transitScore || data.bikeScore);
  const parsedCrime = parseCrimeData(data.crimeData ?? "");
  const crimeGrade  = parsedCrime?.overallGrade || data.crimeOverall || "";
  const hasCrime    = !!(parsedCrime?.overallGrade || data.crimeOverall);
  const hasCensus   = !!data.censusIncome;
  const schoolsList = parseSchools(data.schoolsData || "[]");
  const hasSchools  = schoolsList.length > 0;
  const parsedBLS   = parseBLS(data.blsData ?? "");
  const hasBLS      = parsedBLS !== null && parsedBLS.ur !== null;

  const raceArr: string[] = [];
  if (data.censusPctBlack)    raceArr.push(`Black/African American ${data.censusPctBlack}%`);
  if (data.censusPctHispanic) raceArr.push(`Hispanic/Latino ${data.censusPctHispanic}%`);
  if (data.censusPctWhite)    raceArr.push(`White ${data.censusPctWhite}%`);
  const raceStr = raceArr.join(", ");

  const zipMatch = data.address.match(/\b\d{5}\b/);
  const zip = zipMatch ? zipMatch[0] : "";

  const flags  = computeFlags(data, model);
  const thesis = buildThesis(data, flags);
  const verdict = dealVerdict(flags);
  const boe    = computeBoe(data);

  return (
    <Document>

      {/* ════════ PAGE 1: PROPERTY + PRICING + TAX + LOCATION ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={1} />

        {/* PROPERTY OVERVIEW */}
        <SectionHead title="PROPERTY OVERVIEW" />
        <View style={s.tableWrap}>
          <Row label="Address"          value={data.address} />
          <Row label="Property Type"    value={data.propertyType} alt />
          <Row label="Year Built"       value={data.yearBuilt + (age > 0 ? ` (${age} years old)` : "")} />
          <Row label="Building Area"    value={data.buildingArea && data.buildingArea.toUpperCase().includes("SF") ? fmtSFStr(data.buildingArea) : data.buildingArea} alt />
          <Row label="Lot Size"         value={data.lotSize} />
          <Row label="Units"            value={data.units + (data.unitMix ? ": " + data.unitMix : "")} alt />
          {data.zoning        && <Row label="Zoning"          value={data.zoning} />}
          {data.parcelId      && <Row label="Parcel ID"        value={data.parcelId} />}
          {(data.salePrice || data.saleYear) && (
            <Row label="Last Recorded Sale"
              value={[data.salePrice, data.saleYear].filter(Boolean).join("  —  ")}
              alt />
          )}
        </View>

        {/* PRICING & MARKET CONTEXT */}
        {!!data.askingPrice && (
          <>
            <SectionHead title="PRICING & MARKET CONTEXT" />
            <View style={s.tableWrap}>
              <Row label="Asking Price"         value={askFmt} />
              {pricePerUnit && <Row label="Price per Unit"      value={pricePerUnit} alt />}
              {pricePerSF   && <Row label="Price per SF"        value={pricePerSF} />}
              {data.brokerCapRate && <Row label="Broker Cap Rate"  value={fmtPctDisplay(data.brokerCapRate)} alt />}
              {model.noi !== null && <Row label="Implied Gross NOI" value={fmt$(model.noi) + "/yr (broker cap × ask)"} />}
              {data.occupancy     && <Row label="Current Occupancy" value={fmtPctDisplay(data.occupancy)} alt />}
              {data.inPlaceRents  && <Row label="In-Place Rents"    value={data.inPlaceRents} />}
              {data.censusRent && (
                <Row label={"Area Median Rent" + (zip ? " (ZIP " + zip + ")" : "")}
                  value={data.censusRent + "/mo  (Census ACS 5-yr)"} alt />
              )}
            </View>
            {data.brokerClaims && (
              <Text style={s.note}>Broker claims: {data.brokerClaims}</Text>
            )}
          </>
        )}

        {/* TAX PROFILE */}
        {hasAssessor && (
          <>
            <SectionHead title="TAX PROFILE" />
            <View style={s.tableWrap}>
              {data.assessedValue && (
                <Row label="Appraised Value (County)" value={fmtDol(data.assessedValue)} />
              )}
              {data.landValue && data.improvements && (
                <Row label="Land / Improvements" value={fmtDol(data.landValue) + " land + " + fmtDol(data.improvements) + " improvements"} alt />
              )}
              {data.annualTaxes && (
                <Row label="Current Annual Taxes" value={fmtDol(data.annualTaxes) + "/yr"} />
              )}
              {!data.annualTaxes && data.assessedValue && data.taxRate && (
                <Row label="Est. Annual Taxes" value={(() => {
                  const av = parseDol(data.assessedValue);
                  const rate = parseFloat(data.taxRate.replace(/%/g, "")) / 100;
                  return av && rate ? fmt$(Math.round(av * rate)) + "/yr  (assessment × tax rate)" : "";
                })()} />
              )}
              {data.taxRate && (
                <Row label="Effective Tax Rate" value={data.taxRate} alt />
              )}
              {data.assessedValue && data.askingPrice && (
                <>
                  <Row label="Assessment vs. Ask"
                    value={(() => {
                      const av = parseDol(data.assessedValue);
                      const ask = parseDol(data.askingPrice);
                      if (!av || !ask) return "";
                      const ratio = av / ask;
                      const pct = Math.round(ratio * 100);
                      const flag = ratio > 1.0
                        ? ` — assessed ABOVE asking; buyer may be able to appeal taxes downward`
                        : ratio >= 0.90 ? ` — near asking price, minimal reassessment exposure`
                        : ratio >= 0.80 ? ` — expect upward reassessment at next cycle`
                        : ` — significant upward reassessment risk`;
                      return `${fmtDol(data.assessedValue)} / ${askFmt} = ${pct}% assessment ratio${flag}`;
                    })()} />
                  {unitsNum > 0 && (data.annualTaxes || (data.assessedValue && data.taxRate)) && (
                    <Row label="Taxes per Unit per Year"
                      value={(() => {
                        let taxes = parseDol(data.annualTaxes);
                        if (!taxes && data.assessedValue && data.taxRate) {
                          const av = parseDol(data.assessedValue);
                          const rate = parseFloat(data.taxRate.replace(/%/g, "")) / 100;
                          taxes = av * rate;
                        }
                        return taxes ? fmt$(taxes / unitsNum) + "/unit/yr" : "";
                      })()} alt />
                  )}
                </>
              )}
            </View>
            <Text style={s.note}>
              {(() => {
                const av2 = parseDol(data.assessedValue);
                const ask2 = parseDol(data.askingPrice);
                const src = data.assessorSource ? `Source: ${data.assessorSource}.` : "Source: County appraisal district.";
                if (av2 > 0 && ask2 > 0 && av2 > ask2) {
                  return `${src} Assessment exceeds asking price — purchasing below assessed value may provide grounds to appeal taxes downward. Consult a property tax consultant.`;
                }
                return `${src} Tax amounts reflect current assessment; upon sale, county may reassess to the purchase price.`;
              })()}
            </Text>
          </>
        )}

        {/* LOCATION & RISK */}
        {(hasFema || hasWalk || !!data.proximityMiles) && (
          <>
            <SectionHead title="LOCATION & RISK" />
            <View style={s.tableWrap}>
              {hasFema && (
                <Row label="FEMA Flood Zone"
                  value={data.femaZone + (data.femaZone.includes("X") ? " — minimal hazard, no mandatory flood insurance" : " — flood insurance likely required by lender")} />
              )}
              {data.walkScore && (
                <Row label="Walk Score"
                  value={data.walkScore + "/100" + (data.walkDesc ? " — " + data.walkDesc : "")} alt />
              )}
              {data.bikeScore && (
                <Row label="Bike Score" value={data.bikeScore + "/100"} />
              )}
              {data.transitScore && (
                <Row label="Transit Score" value={data.transitScore + "/100"} alt />
              )}
              {!hasWalk && hasFema && (
                <Row label="Walk / Transit Scores" value="Not retrieved — will populate on next run" />
              )}
              {data.proximityMiles && (
                <Row label={`Drive to Downtown ${data.proximityCity || ""}`}
                  value={`${data.proximityMiles} mi — ${data.proximityMinutes} min drive`}
                  alt />
              )}
            </View>
            {hasSchools && (
              <>
                <Text style={[s.note, { marginTop: 4, marginBottom: 3, fontFamily: "Helvetica-Bold", color: NAVY, fontStyle: "normal" }]}>
                  GreatSchools Rating Bands
                </Text>
                <View style={s.tableWrap}>
                  {schoolsList.map((sc, i) => (
                    <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt}>
                      <Text style={s.lbl}>{sc.l}</Text>
                      <Text style={s.val}>
                        <Text style={{ fontFamily: "Helvetica-Bold" }}>{sc.n}</Text>
                        {sc.d ? `  (${sc.d} mi)` : ""}
                        {"   "}
                        <Text style={{ color: schoolRatingColor(sc.r), fontFamily: "Helvetica-Bold" }}>
                          {sc.r}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {!hasSchools && (
              <Text style={s.note}>School ratings temporarily unavailable — verify at greatschools.org using the property ZIP code.</Text>
            )}
            <Text style={s.note}>School data provided by GreatSchools.org © 2025. All rights reserved.</Text>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 2: FLAGS + THESIS + CRIME + DEMOGRAPHICS ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={2} />

        {/* KEY FLAGS & OBSERVATIONS */}
        <SectionHead title="KEY FLAGS & OBSERVATIONS" />

        {/* Verdict box */}
        <View style={[s.verdictBox, { backgroundColor: verdict.bg, borderColor: verdict.color }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.verdictLabel, { color: verdict.color }]}>{verdict.label}</Text>
            <Text style={[s.verdictDesc, { color: verdict.color }]}>{verdict.desc}</Text>
          </View>
        </View>

        {flags.length === 0 ? (
          <Text style={s.note}>No significant flags identified from available data. Standard due diligence applies.</Text>
        ) : (
          flags.map((f, i) => (
            <View key={i} style={s.flagItem}>
              <Text style={[s.flagDot, { color: f.level === "red" ? RED : f.level === "amber" ? AMBER : GREEN }]}>
                {f.level === "red" ? "!" : f.level === "amber" ? "~" : "o"}
              </Text>
              <View style={s.flagContent}>
                <Text style={[s.flagTitle, { color: f.level === "red" ? RED : f.level === "amber" ? AMBER : NAVY }]}>
                  {f.title}
                </Text>
                <Text style={s.flagBody}>{f.body}</Text>
              </View>
            </View>
          ))
        )}

        {/* DEAL CONTEXT & ANALYSIS */}
        <SectionHead title="DEAL CONTEXT & ANALYSIS" />
        <Text style={[s.val, { lineHeight: 1.6, marginBottom: 6, fontSize: 8.5 }]}>{thesis}</Text>

        {/* CRIME & SAFETY */}
        <SectionHead title="CRIME & SAFETY" />
        {parsedCrime && parsedCrime.source === "dallas_opendata" && parsedCrime.vr !== null ? (
          <>
            {/* Dallas Open Data — per-offense comparison table */}
            <View style={{ marginBottom: 3 }}>
              <View style={{ flexDirection: "row", backgroundColor: NAVY, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 2, marginBottom: 1 }}>
                <Text style={{ flex: 5, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFF" }}>Crime Category</Text>
                <Text style={{ flex: 2.5, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFF", textAlign: "right" }}>Local /1K</Text>
                <Text style={{ flex: 2.5, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFF", textAlign: "right" }}>Natl /1K</Text>
                <Text style={{ flex: 2, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFF", textAlign: "right" }}>vs. Avg</Text>
              </View>
              {/* Violent */}
              {[
                { label: "Violent Crime (total)", local: parsedCrime.vr ?? 0, nat: NAT_RATES.violent, bold: true },
                { label: "  Murder / Homicide",   local: parsedCrime.mr ?? 0, nat: NAT_RATES.murder,  bold: false },
                { label: "  Robbery",             local: parsedCrime.rr ?? 0, nat: NAT_RATES.robbery, bold: false },
                { label: "  Aggravated Assault",  local: parsedCrime.ar ?? 0, nat: NAT_RATES.assault, bold: false },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: i % 2 === 0 ? LIGHT : "#FFF" }}>
                  <Text style={{ flex: 5, fontSize: 8, fontFamily: row.bold ? "Helvetica-Bold" : "Helvetica", color: row.bold ? NAVY : "#374151" }}>{row.label}</Text>
                  <Text style={{ flex: 2.5, fontSize: 8, color: "#374151", textAlign: "right" }}>{row.local.toFixed(2)}</Text>
                  <Text style={{ flex: 2.5, fontSize: 8, color: GRAY, textAlign: "right" }}>{row.nat.toFixed(2)}</Text>
                  <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: vsNatColor(row.local, row.nat), textAlign: "right" }}>{vsNat(row.local, row.nat)}</Text>
                </View>
              ))}
              {/* Property */}
              {[
                { label: "Property Crime (total)", local: parsedCrime.pr  ?? 0, nat: NAT_RATES.property,     bold: true },
                { label: "  Burglary",             local: parsedCrime.br  ?? 0, nat: NAT_RATES.burglary,     bold: false },
                { label: "  Larceny / Theft",      local: parsedCrime.lr  ?? 0, nat: NAT_RATES.larceny,      bold: false },
                { label: "  Motor Vehicle Theft",  local: parsedCrime.vtr ?? 0, nat: NAT_RATES.vehicleTheft, bold: false },
              ].map((row, i) => (
                <View key={i + 4} style={{ flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: i % 2 === 0 ? "#FFF" : LIGHT }}>
                  <Text style={{ flex: 5, fontSize: 8, fontFamily: row.bold ? "Helvetica-Bold" : "Helvetica", color: row.bold ? NAVY : "#374151" }}>{row.label}</Text>
                  <Text style={{ flex: 2.5, fontSize: 8, color: "#374151", textAlign: "right" }}>{row.local.toFixed(2)}</Text>
                  <Text style={{ flex: 2.5, fontSize: 8, color: GRAY, textAlign: "right" }}>{row.nat.toFixed(2)}</Text>
                  <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: vsNatColor(row.local, row.nat), textAlign: "right" }}>{vsNat(row.local, row.nat)}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", marginBottom: 3 }}>
              {[
                { label: "Overall Grade", grade: parsedCrime.overallGrade },
                { label: "Violent Grade", grade: parsedCrime.violentGrade },
                { label: "Property Grade", grade: parsedCrime.propertyGrade },
              ].filter(g => g.grade).map((g, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                  <Text style={{ fontSize: 8, color: GRAY }}>{g.label}:</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: crimeGradeColor(g.grade) }}>{g.grade}</Text>
                </View>
              ))}
            </View>
            <Text style={s.note}>
              Source: Dallas Open Data (NIBRS-coded incidents), {parsedCrime.yearRange} annual average. National comparison: FBI UCR 2022.
            </Text>
          </>
        ) : hasCrime ? (
          <>
            <View style={s.tableWrap}>
              <Row label="Overall Crime Grade"
                value={crimeGrade
                  + (data.crimeRate ? " — " + data.crimeRate + " per 1,000 residents" : "")
                  + (data.crimePct ? " (safer than " + data.crimePct + "% of U.S. ZIPs)" : "")} />
              {(parsedCrime?.violentGrade || data.crimeViolent) && (
                <Row label="Violent Crime Grade"
                  value={(parsedCrime?.violentGrade || data.crimeViolent)
                    + (data.crimeViolentRate ? " — " + data.crimeViolentRate + " per 1,000" : "")} alt />
              )}
              {(parsedCrime?.propertyGrade || data.crimeProp) && (
                <Row label="Property Crime Grade" value={parsedCrime?.propertyGrade || data.crimeProp} />
              )}
            </View>
            <Text style={s.note}>
              {parsedCrime?.source === "fbi_cde"
                ? `Source: FBI Crime Data Explorer (NIBRS)${parsedCrime.yearRange ? ", " + parsedCrime.yearRange + " avg" : ""}${parsedCrime.agencyName ? " — " + parsedCrime.agencyName : ""}. Grades computed vs. FBI UCR 2022 national averages.`
                : "Source: CrimeGrade.org (ZIP-level aggregates)."}
              {" "}High crime may limit lender options, increase insurance premiums, and affect tenant quality.
            </Text>
          </>
        ) : (
          <Text style={[s.note, { marginBottom: 6 }]}>
            Crime data not retrieved — look up crimegrade.org manually using the property ZIP code.
          </Text>
        )}

        {/* DEMOGRAPHIC SNAPSHOT */}
        {hasCensus && (
          <>
            <SectionHead title={"DEMOGRAPHIC SNAPSHOT" + (zip ? " — ZIP " + zip : "")} />
            <View style={s.tableWrap}>
              {data.censusPop       && <Row label="Total Population"        value={parseInt(data.censusPop).toLocaleString("en-US")} />}
              {data.censusHouseholds && <Row label="Total Households"       value={parseInt(data.censusHouseholds).toLocaleString("en-US")} alt />}
              {data.censusAge       && <Row label="Median Age"              value={data.censusAge + " yrs"} />}
              {data.censusAvgHHSize && <Row label="Avg Household Size"      value={parseFloat(data.censusAvgHHSize).toFixed(2) + " persons/household"} alt />}
              {data.censusAvgRenterSize && <Row label="Avg Renter HH Size"  value={parseFloat(data.censusAvgRenterSize).toFixed(2) + " persons/household"} />}
              {data.censusIncome && (
                <Row label="Median HH Income (ZIP)"
                  value={data.censusIncome + "/yr"
                    + (data.msaIncome ? "  |  MSA: " + data.msaIncome + "/yr" : "")} alt />
              )}
              {data.censusRent && (
                <Row label="Median Gross Rent (ZIP)"
                  value={data.censusRent + "/mo"
                    + (data.msaRent ? "  |  MSA: " + data.msaRent + "/mo" : "")} />
              )}
              {data.censusHomeVal && (
                <Row label="Median Home Value (ZIP)"
                  value={data.censusHomeVal
                    + (data.msaHomeVal ? "  |  MSA: " + data.msaHomeVal : "")} alt />
              )}
              {data.censusPoverty && (
                <Row label="Poverty Rate (ZIP)"
                  value={data.censusPoverty
                    + (data.msaPoverty ? "  |  MSA: " + data.msaPoverty : "")} />
              )}
              {data.censusRenterPct && <Row label="Renter-Occupied"         value={data.censusRenterPct + " of housing units"} alt />}
              {raceStr              && <Row label="Racial/Ethnic Composition" value={raceStr} />}
            </View>
            {data.msaName && (
              <Text style={s.note}>MSA comparison: {data.msaName}.</Text>
            )}

            {/* HUD subsidized housing */}
            {data.hudNearbyProps && (
              <View style={{ marginTop: 6 }}>
                <Text style={[s.note, { fontFamily: "Helvetica-Bold", fontStyle: "normal", color: NAVY, marginBottom: 2 }]}>
                  Subsidized Housing within 0.5 mi (HUD)
                </Text>
                <View style={s.tableWrap}>
                  <Row label="HUD-Assisted Properties"
                    value={data.hudNearbyProps + " propert" + (parseInt(data.hudNearbyProps) === 1 ? "y" : "ies")
                      + (data.hudNearbyUnits ? " (~" + data.hudNearbyUnits + " assisted units)" : "")} />
                  {data.hudSection8Count && parseInt(data.hudSection8Count) > 0 && (
                    <Row label="Section 8 / HAP Properties"
                      value={data.hudSection8Count + " identified within 0.5 mi"} alt />
                  )}
                  {data.hudPropNames && (
                    <Row label="Known Properties" value={data.hudPropNames} />
                  )}
                </View>
                <Text style={s.note}>
                  {parseInt(data.hudNearbyProps) === 0
                    ? "No HUD-assisted properties found within 0.5 miles."
                    : parseInt(data.hudNearbyProps) >= 3
                      ? "Elevated subsidized housing concentration. Factor into tenant mix assumptions and exit cap rate."
                      : "Low subsidized housing presence nearby."}
                  {" "}Source: HUD Multifamily Housing database.
                </Text>
              </View>
            )}

            <Text style={s.note}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (most recent vintage). ZIP-level figures compared to MSA medians where available.
            </Text>
          </>
        )}

        {/* LOCAL EMPLOYMENT MARKET */}
        {hasBLS && parsedBLS !== null && (
          <>
            <SectionHead title={"LOCAL EMPLOYMENT MARKET" + (parsedBLS.co ? " — " + parsedBLS.co + " County" : "")} />
            <View style={s.tableWrap}>
              {parsedBLS.ur !== null && (
                <Row
                  label={"Unemployment Rate" + (parsedBLS.per ? " (" + parsedBLS.per + ")" : "")}
                  value={
                    parsedBLS.ur.toFixed(1) + "%"
                    + (parsedBLS.nat !== null
                      ? "  |  U.S. National: " + parsedBLS.nat.toFixed(1) + "%"
                        + (parsedBLS.ur <= parsedBLS.nat
                          ? "  ✓ Below national average"
                          : parsedBLS.ur - parsedBLS.nat > 2
                            ? "  ⚠ Significantly above national average"
                            : "  Above national average")
                      : "")
                  }
                />
              )}
              {parsedBLS.lf !== null && (
                <Row
                  label="Labor Force"
                  value={parsedBLS.lf.toLocaleString("en-US") + " persons"}
                  alt
                />
              )}
              {parsedBLS.emp !== null && parsedBLS.lf !== null && (
                <Row
                  label="Employment Level"
                  value={
                    parsedBLS.emp.toLocaleString("en-US") + " employed"
                    + "  (" + (parsedBLS.lf - parsedBLS.emp).toLocaleString("en-US") + " unemployed)"
                  }
                />
              )}
            </View>
            <Text style={s.note}>
              Source: U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (LAUS).
              {parsedBLS.ur !== null && parsedBLS.nat !== null && parsedBLS.ur <= parsedBLS.nat
                ? " County unemployment is at or below the national rate — a positive indicator for rental demand stability."
                : parsedBLS.ur !== null && parsedBLS.nat !== null && parsedBLS.ur - parsedBLS.nat > 2
                  ? " County unemployment is significantly above the national rate — stress-test vacancy assumptions."
                  : ""}
            </Text>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 3: PERMITS + BOE + DEBT SERVICE ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={3} />

        {/* CITY PERMIT HISTORY */}
        <SectionHead title="CITY PERMIT HISTORY" />
        {permitNum === 0 ? (
          <View style={{ marginBottom: 8 }}>
            {age > 0 && age <= 5 ? (
              <>
                <Bullet
                  bold="No permits found in city records. "
                  rest={`On a ${age}-year-old building, original construction permits are typically filed under the developer or general contractor — not the current property address. This is normal for new construction. Contact the city building department directly if you need to verify CO issuance and punch-list completion.`}
                />
                <Bullet
                  bold="Verify certificates of occupancy and warranties. "
                  rest="Confirm all COs were issued for the units and common areas. Request builder warranties for structure, roof, mechanical systems, and appliances — many carry 1–10 year manufacturer coverage on a new asset."
                />
              </>
            ) : age > 30 ? (
              <>
                <Bullet
                  bold="No permits found at this address. "
                  rest={`On a ${age}-year-old building, zero permits suggests major systems — plumbing, electrical, HVAC, and roofing — may be original or replaced without documentation. Budget aggressively for systems replacement.`}
                />
                <Bullet
                  bold="Assume major systems are aging or original. "
                  rest="Cast iron drain lines, legacy electrical panels, aging HVAC, and unknown roofing vintage are common on pre-1990 stock. A thorough inspection is non-negotiable before committing to purchase."
                />
                {unitsNum > 0 && (
                  <Bullet
                    bold="Budget for capital expenditures. "
                    rest={`Systems replacement and deferred maintenance on a ${age}-year-old building can run $10K–$20K/unit = ${fmt$(10000 * unitsNum)}–${fmt$(20000 * unitsNum)} total. Reflect this in your acquisition pricing.`}
                  />
                )}
              </>
            ) : age > 10 ? (
              <>
                <Bullet
                  bold="No permits found. "
                  rest={`No building permits on record for this ${age}-year-old property. Verify any broker claims about capital improvements during due diligence — request receipts, warranties, and contractor invoices.`}
                />
              </>
            ) : (
              <Bullet
                bold="No permits found. "
                rest="No building permits on record. This may reflect permits filed under a prior owner, developer, or contractor. Verify with the city building department if you need a complete permit history."
              />
            )}
            <Text style={s.note}>Source: {data.permitSource || "City building permit portal"}. Absence of permits does not confirm no work was done — only that no permits were pulled.</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <Text style={[s.val, { marginBottom: 5 }]}>
              {permitNum} permit{permitNum !== 1 ? "s" : ""} found on record. Review scope and quality of documented improvements during inspection.
            </Text>
            {permits.length > 0 && (
              <>
                <View style={s.tHead}>
                  <Text style={[s.tHCell, { flex: 3 }]}>Type</Text>
                  <Text style={[s.tHCell, { flex: 5 }]}>Description</Text>
                  <Text style={[s.tHCell, { width: 68 }]}>Date</Text>
                  <Text style={[s.tHCell, { width: 58 }]}>Value</Text>
                </View>
                {permits.map((p, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                    <Text style={[s.tCell, { flex: 3 }]}>{p.t || "—"}</Text>
                    <Text style={[s.tCell, { flex: 5 }]}>{p.d || "—"}</Text>
                    <Text style={[s.tCell, { width: 68 }]}>{p.dt || "—"}</Text>
                    <Text style={[s.tCell, { width: 58 }]}>{p.v ? fmt$(p.v) : "—"}</Text>
                  </View>
                ))}
                <Text style={s.note}>Source: {data.permitSource || "City permit portal"}. Values shown are permitted job values, not actual cost.</Text>
              </>
            )}
          </View>
        )}

        {/* BACK-OF-ENVELOPE ANALYSIS */}
        {boe !== null && (
          <>
            <SectionHead title="BACK-OF-ENVELOPE ANALYSIS" />
            <Text style={[s.note, { marginBottom: 6 }]}>
              Uses broker-stated cap rate ({data.brokerCapRate}) on asking price ({askFmt}). Expense estimates are rule-of-thumb; verify with actual T-12 operating statement.
              {" "}Revenue assumptions: {boe.vacancyPct.toFixed(2)}% vacancy · {boe.badDebtPct.toFixed(2)}% bad debt · {boe.otherIncomePct}% of 1 mo. rent as other income.
            </Text>

            {/* Revenue sub-header */}
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2, marginTop: 4 }}>REVENUE</Text>
            <View style={s.tableWrap}>
              <Row label={"Gross Potential Revenue (GPR)" + (unitsNum > 0 ? "  (" + fmt$(boe.gprPerUnitPerMonth) + "/unit/mo" + (!data.inPlaceRents && data.censusRent ? ", area median est." : "") + ")" : "")}
                value={fmt$(boe.gpr) + "/yr"} />
              <Row label={"  Less Vacancy (" + boe.vacancyPct.toFixed(2) + "%)"}
                value={"– " + fmt$(boe.vacancyAmt) + "/yr"} alt />
              <Row label={"  Less Bad Debt / Collection Loss (" + boe.badDebtPct.toFixed(2) + "%)"}
                value={"– " + fmt$(boe.badDebtAmt) + "/yr"} />
              <Row label={"  Plus Other Income (" + boe.otherIncomePct + "% of 1 mo. rent)"}
                value={"+ " + fmt$(boe.otherIncomeAmt) + "/yr"} alt />
            </View>
            <SubtotalRow label="Effective Gross Income (EGI)" value={fmt$(boe.egi) + "/yr"} />

            {/* Expenses sub-header */}
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2, marginTop: 8 }}>OPERATING EXPENSES</Text>
            <View style={s.tableWrap}>
              <Row label="Est. Property Taxes"
                value={boe.taxes > 0 ? fmt$(boe.taxes) + "/yr  (" + boe.taxesSource + ")" : "Not available"} />
              <Row label={"Est. Insurance  (~$" + Math.round(boe.opexInputs.insurancePerUnit) + "/unit)"}
                value={fmt$(boe.insurance) + "/yr"} alt />
              <Row label={"Est. Maintenance  (~$" + Math.round(boe.opexInputs.maintenancePerUnit) + "/unit — " + (yrBuilt >= 2000 ? "post-2000" : yrBuilt >= 1980 ? "1980–2000" : "pre-1980") + " vintage)"}
                value={fmt$(boe.maintenance) + "/yr"} />
              <Row label={"Est. Utilities  (~$" + Math.round(boe.opexInputs.utilitiesPerUnit) + "/unit)"}
                value={fmt$(boe.utilities) + "/yr"} alt />
              <Row label={"Est. Marketing & Leasing  (~$" + Math.round(boe.opexInputs.marketingPerUnit) + "/unit)"}
                value={fmt$(boe.marketing) + "/yr"} />
              <Row label={"Est. Administrative  (~$" + Math.round(boe.opexInputs.adminPerUnit) + "/unit)"}
                value={fmt$(boe.admin) + "/yr"} alt />
              <Row label={"Est. Reserves / Other  (~$" + Math.round(boe.opexInputs.reservesPerUnit) + "/unit)"}
                value={fmt$(boe.reserves) + "/yr"} />
              <Row label={"Est. Property Management (" + boe.opexInputs.managementPct.toFixed(1) + "% of EGI)"}
                value={fmt$(boe.management) + "/yr"} alt />
            </View>
            <SubtotalRow label="Est. Total Operating Expenses" value={fmt$(boe.totalOpEx) + "/yr"} />

            {/* Bottom line */}
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2, marginTop: 8 }}>NET OPERATING INCOME</Text>
            <SubtotalRow label="Est. In-Place NOI  (EGI – OpEx)" value={fmt$(boe.estNoi) + "/yr"} />
            {boe.egi > 0 && (
              <View style={[s.tableWrap, { marginTop: 2, marginBottom: 0 }]}>
                <Row label="NOI Margin" value={(boe.estNoi / boe.egi * 100).toFixed(1) + "%"} alt />
              </View>
            )}
            <View style={[s.tableWrap, { marginTop: 4 }]}>
              <Row label="Broker-Implied NOI"
                value={fmt$(boe.brokerNoi) + "/yr  (at " + fmtPctDisplay(data.brokerCapRate) + " cap on " + askFmt + ")"} alt />
              <Row label="Breakeven Occupancy  (OpEx / Revenue)"
                value={boe.breakevenOcc.toFixed(1) + "%  — physical occ. at which EGI covers all operating expenses (pre-debt)"} />
            </View>

            <Text style={s.note}>
              Management fee may not be included in broker's stated NOI — verify with seller. Insurance, maintenance, and utility estimates are approximate; request actual trailing-12 from seller.
              {boe.breakevenOcc > 0 ? " Breakeven occupancy calculated as total OpEx divided by total revenue potential (GPR + other income)." : ""}
            </Text>
          </>
        )}

        {/* DEBT SERVICE SCENARIOS */}
        {model.scenarios.length > 0 && (
          <>
            <SectionHead title={"DEBT SERVICE SCENARIOS"} />
            <Text style={[s.note, { marginBottom: 6 }]}>
              {ioLabel.charAt(0).toUpperCase() + ioLabel.slice(1)}.
              {isIO ? ` Year 1 shown as I/O payment; amortizing payment begins year ${ioYears + 1}.` : ""}
              {" "}Color: green = DSCR 1.10x+ / CoC 7%+, amber = marginal, red = below threshold.
            </Text>

            {[...new Set(model.scenarios.map(sc => sc.ltv))].map(ltv => {
              const ltvScs = model.scenarios.filter(sc => sc.ltv === ltv);
              const loanAmt = ltvScs[0]?.loanAmount ?? 0;
              const equity  = askNum * (1 - ltv / 100);
              return (
                <View key={ltv} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                    {fmtPct(ltv, 0)} LTV — {fmt$(loanAmt)} loan | {fmt$(equity)} down | {ioLabel}
                  </Text>
                  <View style={s.tHead}>
                    <Text style={[s.tHCell, { width: 46 }]}>Rate</Text>
                    <Text style={[s.tHCell, { width: 88 }]}>Annual D/S{isIO ? " (I/O)" : ""}</Text>
                    <Text style={[s.tHCell, { width: 88 }]}>Cash Flow</Text>
                    <Text style={[s.tHCell, { width: 56 }]}>DSCR</Text>
                    <Text style={[s.tHCell, { flex: 1 }]}>Cash-on-Cash</Text>
                    <Text style={[s.tHCell, { width: 48 }]}>Signal</Text>
                  </View>
                  {ltvScs.map((sc, i) => {
                    // Broker cap rate is comparison only — always use BOE estimated NOI
                    const estNoi = boe && boe.estNoi > 0 ? boe.estNoi : null;
                    const cf = estNoi !== null ? estNoi - sc.annualDebtService : null;
                    const dscr = estNoi !== null && sc.annualDebtService > 0 ? estNoi / sc.annualDebtService : null;
                    const coc = cf !== null ? cf / (equity * 1.015) : null;
                    const sig = dscr === null ? "—"
                      : dscr >= 1.10 && coc !== null && coc >= 0.07 ? "GO"
                      : dscr >= 1.0 ? "WATCH"
                      : "STOP";
                    const sigColor = sig === "GO" ? GREEN : sig === "WATCH" ? AMBER : sig === "STOP" ? RED : GRAY;
                    return (
                      <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                        <Text style={[s.tCell, { width: 46 }]}>{fmtPct(sc.rate)}</Text>
                        <Text style={[s.tCell, { width: 88 }]}>{fmt$(sc.annualDebtService)}</Text>
                        <Text style={[s.tCell, { width: 88, color: cf !== null ? (cf >= 0 ? GREEN : RED) : "#1F2937" }]}>
                          {cf !== null ? (cf >= 0 ? "+" : "") + fmt$(cf) : "—"}
                        </Text>
                        <Text style={[s.tCell, { width: 56, color: dscrColor(dscr) }]}>
                          {dscr !== null ? fmtX(dscr) : "—"}
                        </Text>
                        <Text style={[s.tCell, { flex: 1, color: cocColor(coc) }]}>
                          {coc !== null ? fmtPct(coc * 100) : "—"}
                        </Text>
                        <Text style={[s.tCell, { width: 48, fontFamily: "Helvetica-Bold", color: sigColor }]}>{sig}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* All-cash */}
            {boe && boe.estNoi !== 0 && askNum > 0 && (
              <View style={{ marginTop: 4, marginBottom: 10 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                  All-Cash — {askFmt} equity | No debt | No I/O consideration
                </Text>
                <View style={s.tHead}>
                  <Text style={[s.tHCell, { width: 130 }]}>Scenario</Text>
                  <Text style={[s.tHCell, { width: 100 }]}>Cash Flow</Text>
                  <Text style={[s.tHCell, { flex: 1 }]}>Unleveraged CoC</Text>
                </View>
                <View style={s.tRow}>
                  <Text style={[s.tCell, { width: 130 }]}>Est. NOI (rent-based)</Text>
                  <Text style={[s.tCell, { width: 100, color: boe.estNoi >= 0 ? GREEN : RED }]}>
                    {(boe.estNoi >= 0 ? "+" : "") + fmt$(boe.estNoi)}
                  </Text>
                  <Text style={[s.tCell, { flex: 1, color: (boe.estNoi / askNum) >= 0 ? GREEN : RED }]}>
                    {fmtPct((boe.estNoi / askNum) * 100)}
                  </Text>
                </View>
              </View>
            )}
            <Text style={s.note}>
              DSCR and CoC calculated using estimated NOI (rents – operating expenses). Broker cap rate shown for reference only. GO = 1.10x+ DSCR and 7%+ CoC. WATCH = marginal coverage. STOP = negative or sub-1.0x DSCR. Closing costs assumed at 1.5%.
            </Text>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 4: NEXT STEPS + DISCLAIMER ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={4} />

        <SectionHead title="RECOMMENDED NEXT STEPS" />
        <Bullet bold="Request T-12 operating statement and current rent roll. "
          rest="The broker's cap rate is an assertion, not a fact. Verify every line of income and expenses against trailing-12-month actuals before underwriting." />
        <Bullet bold="Order a thorough property inspection. "
          rest={age > 0 && age <= 5
            ? `On a ${age}-year-old building, verify construction quality, confirm certificates of occupancy are in order, and check for any outstanding punch-list items. Request builder warranties for structural, mechanical, and appliance systems.`
            : `On a ${age > 0 ? age + "-year-old" : "older"} building${permitNum === 0 ? " with no permit history" : ""}, pay particular attention to: roof condition and remaining life, HVAC systems and ages, plumbing (including drain lines), electrical panels (load capacity and age), and foundation.`
          } />
        {hasCrime && ["F","D-","D","D+"].includes(crimeGrade) && (
          <Bullet bold="Speak with local portfolio lenders before making an offer. "
            rest={`The crime profile (${data.crimeOverall}) may limit conventional financing options. Regional banks and credit unions familiar with the submarket are more likely to lend here than national platforms.`} />
        )}
        <Bullet bold="Confirm the utility structure. "
          rest="Get actual utility bills for the trailing 12 months. Determine which utilities are landlord-paid vs. tenant-paid — this has a direct, significant impact on actual NOI vs. broker-stated NOI." />
        <Bullet bold="Verify occupancy, lease terms, and any concessions. "
          rest="Confirm the occupancy claim with a current rent roll. Note lease expiration dates — a property with all leases expiring at closing carries significant rollover risk." />
        {hasAssessor && data.assessedValue && data.askingPrice && (() => {
          const av3 = parseDol(data.assessedValue);
          const ask3 = parseDol(data.askingPrice);
          if (av3 > ask3) {
            return (
              <Bullet bold="Consider a property tax appeal. "
                rest={`Current county assessment (${fmtDol(data.assessedValue)}) exceeds the purchase price (${askFmt}). Purchasing below assessed value is a strong basis to challenge the assessment downward. Engage a property tax consultant after closing — a successful appeal could reduce annual taxes materially.`} />
            );
          }
          return (
            <Bullet bold="Model post-acquisition tax reassessment. "
              rest={`Current assessment is ${fmtDol(data.assessedValue)}. A purchase at ${askFmt} will likely trigger reassessment upward at next cycle. Model the additional tax burden in your pro forma before submitting an LOI.`} />
          );
        })()}
        <Bullet bold="Get quotes from local insurance brokers. "
          rest={`Insurance estimates in this report are rule-of-thumb. Actual premiums depend on building age, condition, claims history, crime data, and flood zone${hasFema && !data.femaZone.includes("X") ? ` (flood insurance will be required for this property)` : ""}. Get a real quote before LOI.`} />

        {/* DISCLAIMER */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerTitle}>IMPORTANT DISCLAIMER — READ BEFORE ACTING ON THIS REPORT</Text>
          <Text style={s.disclaimerText}>
            This report is generated by DealBrief (getdealbrief.com) and is provided for informational purposes only. It does not constitute investment advice, financial advice, legal advice, or a recommendation to buy, sell, or hold any real property or security. All data is sourced from publicly available databases including but not limited to: U.S. Census Bureau American Community Survey (ACS), FEMA National Flood Hazard Layer (NFHL), county appraisal district records, city building permit portals, and third-party aggregators. DealBrief makes no representations or warranties, express or implied, as to the accuracy, completeness, timeliness, or reliability of any data contained in this report. Public data may contain errors, omissions, or outdated information. Financial projections, cap rate analysis, debt service calculations, and operating expense estimates are illustrative only and are based on inputs provided by the user and/or broker-stated figures that have not been independently verified. Actual investment performance may differ materially from any estimates or projections herein. This report is not a substitute for professional due diligence. Before making any investment decision, consult qualified professionals including a licensed real estate broker, CPA, real estate attorney, lender, and property inspector. DealBrief and its operators shall not be liable for any damages, losses, or claims arising from reliance on this report. By using this report, you acknowledge that you have read this disclaimer and agree that DealBrief is not responsible for any investment outcomes.
          </Text>
        </View>

        <PageFooter />
      </Page>

    </Document>
  );
}

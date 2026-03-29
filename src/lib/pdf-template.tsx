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
  // FEMA
  femaZone: string;
  // Walk Score
  walkScore: string; bikeScore: string; transitScore: string; walkDesc: string;
  // Crime
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

function fmtAskingPrice(str: string): string {
  const n = parseDol(str);
  if (!n) return str;
  return "$" + Math.round(n).toLocaleString("en-US");
}

function dscrColor(v: number | null) { return v === null ? "#1F2937" : v >= 1.10 ? GREEN : v >= 0.95 ? AMBER : RED; }
function cocColor(v: number | null)  { return v === null ? "#1F2937" : v >= 0.07 ? GREEN : v >= 0.03 ? AMBER : RED; }

// ── BOE estimate ──────────────────────────────────────────────────────────────
interface BoeEst {
  noi: number; taxes: number; insurance: number; maintenance: number;
  utilities: number; management: number; totalOpEx: number;
  egi: number; gpr: number; gprPerUnitPerMonth: number;
}

function computeBoe(data: ReportData): BoeEst | null {
  const ask  = parseDol(data.askingPrice);
  const cap  = parseFloat(data.brokerCapRate) || 0;
  const units = parseInt(data.units) || 0;
  const yr    = parseInt(data.yearBuilt) || 0;
  if (!ask || !cap) return null;
  const noi = ask * (cap / 100);
  const taxes = parseDol(data.annualTaxes);
  const insurance = units > 0 ? units * 800 : Math.round(noi * 0.08);
  const maintPerUnit = yr >= 2000 ? 500 : yr >= 1980 ? 750 : 1000;
  const maintenance = units > 0 ? units * maintPerUnit : Math.round(noi * 0.10);
  const utilities = units > 0 ? units * 250 : Math.round(noi * 0.04);
  const opExExMgmt = taxes + insurance + maintenance + utilities;
  const egi = (noi + opExExMgmt) / 0.92;
  const management = egi * 0.08;
  const totalOpEx = opExExMgmt + management;
  const gpr = egi / 0.95;
  const gprPerUnitPerMonth = units > 0 ? gpr / 12 / units : 0;
  return { noi, taxes, insurance, maintenance, utilities, management, totalOpEx, egi, gpr, gprPerUnitPerMonth };
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
  if (data.crimeOverall) {
    if (["F","D-","D"].includes(data.crimeOverall)) {
      flags.push({ level: "red", title: `High Crime — Grade ${data.crimeOverall}`,
        body: `Crime grade ${data.crimeOverall}${data.crimeRate ? " (" + data.crimeRate + " per 1,000 residents)" : ""}${data.crimePct ? "; safer than only " + data.crimePct + "% of U.S. ZIP codes" : ""}. Expect higher insurance premiums, lender scrutiny, and ongoing tenant quality challenges.` });
    } else if (["D+","C-","C"].includes(data.crimeOverall)) {
      flags.push({ level: "amber", title: `Elevated Crime — Grade ${data.crimeOverall}`,
        body: `Crime index is ${data.crimeOverall}. Factor into tenant screening, insurance budget, and exit cap assumptions.` });
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
    if (ratio > 0.90) {
      flags.push({ level: "amber", title: `Reassessment Risk — Assessed at ${Math.round(ratio * 100)}% of Ask`,
        body: `County appraised at ${data.assessedValue} vs. ${fmtAskingPrice(data.askingPrice)} asking price. A purchase near ask will likely trigger reassessment at next cycle, increasing annual tax burden significantly.` });
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
    parts.push(`Zero permits on record for a ${age}-year-old building is consistent with a deferred-maintenance profile — a potential value-add play if a buyer can systematically renovate and push rents, but capex risk is asymmetric.`);
  } else if (permitNum > 0) {
    parts.push(`${permitNum} permit record${permitNum > 1 ? "s" : ""} found — verify scope and quality of documented improvements during inspection.`);
  }
  if (av > 0 && ask > 0) {
    const ratio = Math.round((av / ask) * 100);
    if (ratio < 80) {
      parts.push(`County assessment (${data.assessedValue}) is ${ratio}% of ask, suggesting the seller is pricing in upside. A purchase at or near ask will likely trigger full reassessment at next cycle.`);
    } else {
      parts.push(`Assessment-to-ask ratio of ${ratio}% is elevated — limited buffer before a tax reassessment materializes.`);
    }
  }
  if (data.crimeOverall && ["F","D-","D","D+"].includes(data.crimeOverall)) {
    parts.push(`Crime profile (grade ${data.crimeOverall}) positions this as a workforce / C-class housing play. Operators with experience in challenged submarkets may find value; institutional capital will largely pass.`);
  }
  if (data.censusIncome && data.censusRent) {
    const inc = parseDol(data.censusIncome);
    const rent = parseDol(data.censusRent);
    if (inc > 0 && rent > 0) {
      const rentToIncome = Math.round((rent * 12 / inc) * 100);
      parts.push(`Area median HH income of ${data.censusIncome} vs. median gross rent of ${data.censusRent}/mo implies a rent-to-income ratio of ~${rentToIncome}% for the median resident — a relevant stress indicator for collections.`);
    }
  }
  return parts.join(" ") || "Insufficient data to generate thesis. Enter deal inputs above and rerun.";
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
  const hasCrime    = !!data.crimeOverall;
  const hasCensus   = !!data.censusIncome;
  const schoolsList = parseSchools(data.schoolsData || "[]");
  const hasSchools  = schoolsList.length > 0;

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
          <Row label="Building Area"    value={data.buildingArea} alt />
          <Row label="Lot Size"         value={data.lotSize} />
          <Row label="Units"            value={data.units + (data.unitMix ? ": " + data.unitMix : "")} alt />
          {data.zoning        && <Row label="Zoning"          value={data.zoning} />}
          {data.assessorSource && <Row label="Assessor Source"  value={data.assessorSource} alt />}
          {data.parcelId      && <Row label="Parcel ID"        value={data.parcelId} />}
        </View>

        {/* PRICING & MARKET CONTEXT */}
        {!!data.askingPrice && (
          <>
            <SectionHead title="PRICING & MARKET CONTEXT" />
            <View style={s.tableWrap}>
              <Row label="Asking Price"         value={askFmt} />
              {pricePerUnit && <Row label="Price per Unit"      value={pricePerUnit} alt />}
              {pricePerSF   && <Row label="Price per SF"        value={pricePerSF} />}
              {data.brokerCapRate && <Row label="Broker Cap Rate"  value={data.brokerCapRate} alt />}
              {model.noi !== null && <Row label="Implied Gross NOI" value={fmt$(model.noi) + "/yr (broker cap × ask)"} />}
              {data.occupancy     && <Row label="Current Occupancy" value={data.occupancy} alt />}
              {data.inPlaceRents  && <Row label="In-Place Rents"    value={data.inPlaceRents} />}
              {hasCensus && data.censusRent && (
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
                <Row label="Appraised Value (County)" value={data.assessedValue} />
              )}
              {data.landValue && data.improvements && (
                <Row label="Land / Improvements" value={data.landValue + " land + " + data.improvements + " improvements"} alt />
              )}
              {data.annualTaxes && (
                <Row label="Current Annual Taxes" value={data.annualTaxes + "/yr"} />
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
                      const pct = Math.round((av / ask) * 100);
                      const flag = pct >= 90 ? " — reassessment risk at close" : pct < 70 ? " — expect upward reassessment" : "";
                      return `${data.assessedValue} / ${askFmt} = ${pct}% assessment ratio${flag}`;
                    })()} />
                  {unitsNum > 0 && data.annualTaxes && (
                    <Row label="Taxes per Unit per Year"
                      value={fmt$(parseDol(data.annualTaxes) / unitsNum) + "/unit/yr"} alt />
                  )}
                </>
              )}
            </View>
            <Text style={s.note}>Source: County appraisal district. Tax amounts reflect current assessment and may increase upon sale.</Text>
          </>
        )}

        {/* LOCATION & RISK */}
        {(hasFema || hasWalk) && (
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
              {!hasWalk && (
                <Row label="Walk / Transit Scores" value="Not retrieved — Walk Score API key not configured" />
              )}
            </View>
            {hasSchools && (
              <>
                <Text style={[s.note, { marginTop: 4, marginBottom: 3, fontFamily: "Helvetica-Bold", color: NAVY, fontStyle: "normal" }]}>
                  Nearby Public Schools (GreatSchools)
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
              <Text style={s.note}>School ratings not retrieved — GREATSCHOOLS_API_KEY not yet set on server.</Text>
            )}
            <Text style={s.note}>Source: GreatSchools NearbySchools API (School Quality plan). Rating bands: Above Average / Average / Below Average.</Text>
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

        {/* VALUE-ADD THESIS */}
        <SectionHead title="VALUE-ADD THESIS" />
        <Text style={[s.val, { lineHeight: 1.6, marginBottom: 6, fontSize: 8.5 }]}>{thesis}</Text>

        {/* CRIME & SAFETY */}
        <SectionHead title="CRIME & SAFETY" />
        {hasCrime ? (
          <>
            <View style={s.tableWrap}>
              <Row label="Overall Crime Grade"
                value={data.crimeOverall
                  + (data.crimeRate ? " — " + data.crimeRate + " per 1,000 residents" : "")
                  + (data.crimePct ? " (safer than " + data.crimePct + "% of U.S. ZIPs)" : "")} />
              {data.crimeViolent && (
                <Row label="Violent Crime Grade"
                  value={data.crimeViolent + (data.crimeViolentRate ? " — " + data.crimeViolentRate + " per 1,000" : "")} alt />
              )}
              {data.crimeProp && (
                <Row label="Property Crime Grade" value={data.crimeProp} />
              )}
            </View>
            <Text style={s.note}>Source: CrimeGrade.org (ZIP-level aggregates). High crime may limit lender options, increase insurance premiums, and affect tenant quality.</Text>
          </>
        ) : (
          <Text style={[s.note, { marginBottom: 6 }]}>
            Crime data not retrieved — CrimeGrade.org may have blocked the request from the server. Look up crimegrade.org manually using the property ZIP code.
          </Text>
        )}

        {/* DEMOGRAPHIC SNAPSHOT */}
        {hasCensus && (
          <>
            <SectionHead title={"DEMOGRAPHIC SNAPSHOT" + (zip ? " — ZIP " + zip : "")} />
            <View style={s.tableWrap}>
              {data.censusPop    && <Row label="Total Population"   value={parseInt(data.censusPop).toLocaleString("en-US")} />}
              {data.censusAge    && <Row label="Median Age"         value={data.censusAge + " yrs"} alt />}
              {data.censusIncome && <Row label="Median HH Income"   value={data.censusIncome + "/yr"} />}
              {data.censusRent   && <Row label="Median Gross Rent"  value={data.censusRent + "/mo"} alt />}
              {data.censusHomeVal && <Row label="Median Home Value" value={data.censusHomeVal} />}
              {data.censusPoverty && <Row label="Poverty Rate"      value={data.censusPoverty} alt />}
              {data.censusRenterPct && <Row label="Renter-Occupied" value={data.censusRenterPct + " of housing units"} />}
              {raceStr && <Row label="Racial/Ethnic Composition" value={raceStr} alt />}
            </View>
            <Text style={s.note}>
              Source: U.S. Census Bureau ACS 5-Year Estimates (most recent vintage). City/MSA comparisons and avg. household size not yet automated.
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
            <Bullet
              bold="No permits found at this address. "
              rest={age > 0
                ? `On a ${age}-year-old building marketed as value-add, this is consistent with deferred maintenance. Major systems — plumbing, electrical, HVAC, and roofing — may be original or replaced without documentation.`
                : "Major systems may be original or replaced without documentation."}
            />
            <Bullet
              bold="Assume all major systems as original or near end-of-life. "
              rest="Cast iron drain lines, legacy electrical panels, aging HVAC, and unknown roofing vintage. A thorough inspection is non-negotiable before committing to purchase."
            />
            {unitsNum > 0 && (
              <Bullet
                bold="Budget for renovation capex. "
                rest={`Interior value-add renovations typically run $8K–$15K/unit = ${fmt$(8000 * unitsNum)}–${fmt$(15000 * unitsNum)} total for ${unitsNum} units. This should be reflected in your acquisition pricing.`}
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
                  <Text style={[s.tHCell, { flex: 2 }]}>Type / Description</Text>
                  <Text style={[s.tHCell, { width: 70 }]}>Date</Text>
                  <Text style={[s.tHCell, { width: 70 }]}>Value</Text>
                </View>
                {permits.map((p, i) => (
                  <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                    <Text style={[s.tCell, { flex: 2 }]}>
                      {[p.t, p.d].filter(Boolean).join(" — ").slice(0, 70)}
                    </Text>
                    <Text style={[s.tCell, { width: 70 }]}>{p.dt || "—"}</Text>
                    <Text style={[s.tCell, { width: 70 }]}>{p.v ? fmt$(p.v) : "—"}</Text>
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
            <Text style={[s.note, { marginBottom: 4 }]}>
              Uses broker-stated cap rate ({data.brokerCapRate}) on asking price ({askFmt}). Expense estimates are rule-of-thumb; verify with actual T-12 operating statement.
            </Text>
            <View style={s.tableWrap}>
              <Row label="Broker-Implied Annual NOI"    value={fmt$(boe.noi) + "/yr"} />
              <Row label="Est. Property Taxes"         value={boe.taxes > 0 ? fmt$(boe.taxes) + "/yr  (from county assessor)" : "Not available — enter assessed value"} alt />
              <Row label={`Est. Insurance`}             value={fmt$(boe.insurance) + "/yr  (~$800/unit)"} />
              <Row label={`Est. Maintenance`}           value={fmt$(boe.maintenance) + "/yr  (~$" + (yrBuilt >= 2000 ? "500" : yrBuilt >= 1980 ? "750" : "1,000") + "/unit — " + (yrBuilt >= 2000 ? "post-2000" : yrBuilt >= 1980 ? "1980-2000" : "pre-1980") + " vintage)"} alt />
              <Row label="Est. Water/Sewer/Trash"      value={fmt$(boe.utilities) + "/yr  (~$250/unit)"} />
              <Row label="Est. Mgmt (8% of EGI)"       value={fmt$(boe.management) + "/yr"} />
              <Row label="Est. Total OpEx"             value={fmt$(boe.totalOpEx) + "/yr"} alt />
              <Row label="Implied EGI (NOI + OpEx)"    value={fmt$(boe.egi) + "/yr"} />
              <Row label="Implied GPR (at 5% vacancy)" value={fmt$(boe.gpr) + "/yr"} alt />
              {unitsNum > 0 && (
                <Row label="Implied GPR per Unit"      value={fmt$(boe.gprPerUnitPerMonth) + "/unit/mo — compare to in-place rents and area median rent above"} />
              )}
            </View>
            <Text style={s.note}>
              Management fee not included in broker's NOI if gross management is excluded from their pro forma — verify. Insurance, maintenance, and utility estimates are approximate; request actual trailing-12 from seller.
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
                    const cf = model.noi !== null ? model.noi - sc.annualDebtService : null;
                    const sig = sc.dscr === null ? "—"
                      : sc.dscr >= 1.10 && sc.coc !== null && sc.coc >= 0.07 ? "GO"
                      : sc.dscr >= 1.0 ? "WATCH"
                      : "STOP";
                    const sigColor = sig === "GO" ? GREEN : sig === "WATCH" ? AMBER : sig === "STOP" ? RED : GRAY;
                    return (
                      <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                        <Text style={[s.tCell, { width: 46 }]}>{fmtPct(sc.rate)}</Text>
                        <Text style={[s.tCell, { width: 88 }]}>{fmt$(sc.annualDebtService)}</Text>
                        <Text style={[s.tCell, { width: 88, color: cf !== null ? (cf >= 0 ? GREEN : RED) : "#1F2937" }]}>
                          {cf !== null ? (cf >= 0 ? "+" : "") + fmt$(cf) : "—"}
                        </Text>
                        <Text style={[s.tCell, { width: 56, color: dscrColor(sc.dscr) }]}>
                          {sc.dscr !== null ? fmtX(sc.dscr) : "—"}
                        </Text>
                        <Text style={[s.tCell, { flex: 1, color: cocColor(sc.coc) }]}>
                          {sc.coc !== null ? fmtPct(sc.coc * 100) : "—"}
                        </Text>
                        <Text style={[s.tCell, { width: 48, fontFamily: "Helvetica-Bold", color: sigColor }]}>{sig}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* All-cash */}
            {model.noi !== null && askNum > 0 && (
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
                  <Text style={[s.tCell, { width: 130 }]}>Broker-stated (in-place)</Text>
                  <Text style={[s.tCell, { width: 100, color: GREEN }]}>+{fmt$(model.noi)}</Text>
                  <Text style={[s.tCell, { flex: 1, color: GREEN }]}>{fmtPct((model.noi / askNum) * 100)}</Text>
                </View>
              </View>
            )}
            <Text style={s.note}>
              DSCR and CoC calculated using broker cap rate to derive NOI. GO = 1.10x+ DSCR and 7%+ CoC. WATCH = marginal coverage. STOP = negative or sub-1.0x DSCR. Closing costs assumed at 1.5%.
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
          rest={`On a ${age > 0 ? age + "-year-old" : "older"} building${permitNum === 0 ? " with no permit history" : ""}, pay particular attention to: roof condition and remaining life, HVAC systems and ages, plumbing (cast iron drain lines), electrical panels (load capacity and age), and foundation.`} />
        {hasCrime && ["F","D-","D","D+"].includes(data.crimeOverall) && (
          <Bullet bold="Speak with local portfolio lenders before making an offer. "
            rest={`The crime profile (${data.crimeOverall}) may limit conventional financing options. Regional banks and credit unions familiar with the submarket are more likely to lend here than national platforms.`} />
        )}
        <Bullet bold="Confirm the utility structure. "
          rest="Get actual utility bills for the trailing 12 months. Determine which utilities are landlord-paid vs. tenant-paid — this has a direct, significant impact on actual NOI vs. broker-stated NOI." />
        <Bullet bold="Verify occupancy, lease terms, and any concessions. "
          rest="Confirm the occupancy claim with a current rent roll. Note lease expiration dates — a property with all leases expiring at closing carries significant rollover risk." />
        {hasAssessor && data.assessedValue && data.askingPrice && (
          <Bullet bold="Model post-acquisition tax reassessment. "
            rest={`Current assessment is ${data.assessedValue}. A purchase at ${askFmt} will likely trigger reassessment to the purchase price at next cycle, increasing annual taxes materially. Factor this into your pro forma.`} />
        )}
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

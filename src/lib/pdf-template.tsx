import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { runFinancialModel, FinancialSummary, fmt$, fmtPct, fmtX, CLOSING_COST_RATE } from "./financial";
import {
  parseDol, parseCapRateInput, parseRentPerUnit,
  parseOpexOverrides, computeBoe, computeDerivations,
  type BoeInputs, type BoeEst,
} from "./underwriting";
import {
  NAT_RATES, vsNat,
  parsePermits, parseSchools, parseCrimeData, parseBLS,
  type PermitDetail, type SchoolDetail, type ParsedCrime,
} from "./reportParsers";
import { computeFlags, dealVerdictLevel, type Flag } from "./reportFlags";
import { DISCLAIMER_TITLE, DISCLAIMER_TEXT } from "./reportCopy";

export interface ReportData {
  // Property
  address: string; propertyType: string; yearBuilt: string;
  buildingArea: string; lotSize: string; units: string;
  zoning: string;
  // Assessor
  assessedValue: string; landValue: string; improvements: string;
  // Misc features bucket (NC outbuildings/paving, FL XFOB) — blank when absent.
  // When set, included in the breakdown row alongside land + improvements.
  otherValue?: string;
  // PA-only: STEB-CLR-rescaled fair-market value. PA `assessedValue` is the
  // raw base-year value (matches broker / tax bill / public record) and
  // this surfaces the market-value equivalent for cross-state comparison.
  // Empty string for non-PA states.
  marketValue?: string;
  lpv: string;  // AZ Limited Property Value (actual tax base); empty for non-AZ
  adjustedLpv?: string;      // AZ: LPV × assessment ratio = NAV (actual tax base)
  assessmentRatio?: string;  // AZ: 0.10 (Class 4), 0.18 (Class 1), etc.
  reappraisalYear?: string;  // NC: year of next scheduled countywide reappraisal
  taxRate: string; proFormaTaxRate?: string; annualTaxes: string; parcelId: string; assessorSource: string;
  // Deeded owner name — used to detect condo common-element / master-file
  // parcels (owner contains "CONDOMINIUM ASSOCIATION" / "HOA" / etc.) so the
  // report can warn the address resolved to the wrong parcel.
  owner?: string;
  taxFeePerUnit?: string;  // Per-unit municipal fee (Charlotte multifamily solid waste, etc.)
  // TX MUD / WCID / drainage / special-district breakdown — each entry is a
  // detected taxing district at the parcel via TCEQ spatial join. Summed
  // rates are already folded into `taxRate`; this list is for display only.
  txDistricts?: Array<{ name: string; type: string; ratePct: number | null }>;
  // NV abatement growth cap (3% / 8%) or OH CRA/TIF active — when true the
  // report renders a banner explaining the actual tax may differ from the
  // rate × value estimate. `capPct` is the statutory growth limit (e.g.
  // "0.08" for NV non-owner-occupied) for completeness.
  abatementFlag?: boolean;
  capPct?: string;
  // FIPS state code (e.g. "20", "47", "29", "18"). Used to apply class-
  // threshold rate adjustments for KS/TN/MO/IN where 5+ unit MF is
  // commercial and 1-4 unit residential gets a lower assessment ratio.
  fipsState?: string;
  // Deal inputs
  askingPrice: string; brokerCapRate: string; occupancy: string;
  inPlaceRents: string; brokerClaims: string; buyerCapRate: string;
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
  censusBachPlus: string;
  // Permits
  permitCount: string; permitSource: string; permitDetails: string;
  // Schools
  schoolsData: string;
  // Proximity
  proximityMiles: string; proximityMinutes: string; proximityCity: string;
  // MSA comparison
  msaName: string; msaIncome: string; msaHomeVal: string; msaRent: string; msaPoverty: string; msaBachPlus: string;
  msaPop?: string; msaAge?: string; msaRenterPct?: string;
  msaHouseholds?: string; msaAvgHHSize?: string; msaAvgRenterSize?: string;
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
  sectionHead: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: NAVY },
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
  disclaimer: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 3, backgroundColor: LIGHT },
  disclaimerTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  disclaimerText: { fontSize: 7, color: GRAY, lineHeight: 1.55 },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 5 },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

// ── helper: parse ─────────────────────────────────────────────────────────────
// Format any dollar string (user input or pipeline) as $X,XXX,XXX
function fmtDol(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/[$,]/g, ""));
  if (isNaN(n)) return str;
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Format a string containing an SF number as "32,765 SF"
function fmtSFStr(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return str;
  return Math.round(n).toLocaleString("en-US") + " SF";
}

// Format a percentage string to "X.XX%"
function fmtPctDisplay(str: string): string {
  if (!str) return str;
  const n = parseCapRateInput(str);
  if (n === null) return str;
  return n.toFixed(2) + "%";
}

// Alias kept for existing usage
const fmtAskingPrice = fmtDol;

function dscrColor(v: number | null) { return v === null ? "#1F2937" : v >= 1.10 ? GREEN : v >= 0.95 ? AMBER : RED; }
function cocColor(v: number | null)  { return v === null ? "#1F2937" : v >= 0.06 ? GREEN : v >= 0.03 ? AMBER : RED; }

// ── BOE estimate ──────────────────────────────────────────────────────────────
// The bottom-up NOI model (computeBoe), operating-expense parser
// (parseOpexOverrides), and BoeEst / BoeInputs types now live in ./underwriting
// so the live Review & Adjust page and this PDF compute IDENTICAL numbers.
// They are imported at the top of this file.

// ── flags + deal verdict ──────────────────────────────────
// computeFlags + dealVerdictLevel are shared with the live HTML mirror and live
// in ./reportFlags. The verdict colours below are PDF-specific presentation.
function dealVerdict(flags: Flag[]) {
  const v = dealVerdictLevel(flags);
  const map = {
    red:   { color: RED,   bg: RED_BG },
    amber: { color: AMBER, bg: AMBER_BG },
    green: { color: GREEN, bg: GREEN_BG },
  } as const;
  return { ...map[v.level], label: v.label, desc: v.desc };
}

// Parsers for permits / schools / crime + NAT_RATES + vsNat now live in
// ./reportParsers (shared with the live HTML mirror). Colour helpers stay here
// because the PDF palette differs from the on-screen palette.

function schoolRatingColor(band: string): string {
  const b = band.toLowerCase();
  if (b.includes("above")) return GREEN;
  if (b.includes("below")) return RED;
  if (b === "average") return AMBER;
  return GRAY;
}

function crimeGradeColor(grade: string): string {
  if (!grade) return GRAY;
  const g = grade.toUpperCase();
  if (g === "A" || g === "A+") return GREEN;
  if (g === "B+" || g === "B" || g === "B-") return GREEN;
  if (g === "C+" || g === "C" || g === "C-") return AMBER;
  return RED;
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

function SubtotalRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 5, paddingHorizontal: 0, borderTopWidth: 1.5, borderTopColor: NAVY, backgroundColor: LIGHT }}>
      <Text style={{ width: 240, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, paddingRight: 8 }}>{label}</Text>
      <Text style={{ width: 92, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY }}>{value}</Text>
      {unit ? <Text style={{ flex: 1, fontSize: 8, color: GRAY }}>{unit}</Text> : null}
    </View>
  );
}

function BoeRow({ label, total, unit, alt, warn }: { label: string; total: string; unit?: string; alt?: boolean; warn?: boolean }) {
  return (
    <View style={alt ? s.rowAlt : s.row}>
      <Text style={{ width: 240, fontSize: 8, fontFamily: "Helvetica-Bold", color: warn ? "#b91c1c" : NAVY, paddingRight: 8 }}>{label}</Text>
      <Text style={{ width: 92, fontSize: 8.5, color: warn ? "#b91c1c" : "#374151" }}>{total}</Text>
      {unit ? <Text style={{ flex: 1, fontSize: 8, color: warn ? "#b91c1c" : GRAY }}>{unit}</Text> : null}
    </View>
  );
}

function CrimeGradeBox({ grades }: { grades: Array<{ label: string; grade: string }> }) {
  const visible = grades.filter(g => g.grade);
  if (!visible.length) return null;
  return (
    <View style={{ flexDirection: "row", borderWidth: 1.5, borderColor: NAVY, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 6, justifyContent: "space-around", backgroundColor: LIGHT }}>
      {visible.map((g, i) => (
        <View key={i} style={{ alignItems: "center", flex: 1 }}>
          <Text style={{ fontSize: 7.5, color: GRAY, marginBottom: 3 }}>{g.label}</Text>
          <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: crimeGradeColor(g.grade) }}>{g.grade}</Text>
        </View>
      ))}
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
  // BOE computed first so buyer cap rate can back-calculate an implied acquisition price
  const boe     = computeBoe(data);
  // All tax/state/price derivations now live in ./underwriting (shared with the
  // live Review & Adjust page) so both surfaces compute IDENTICAL numbers.
  const {
    buyerCR, effTaxRate,
    isLpvState, isFLState, isNCState, isPAState, isCOState, isNVCappedState, nvCapMultiplier,
    splitRatioState, splitRatioPct, isSplitRatioState, splitRatioLabel, splitRatioTaxableStr,
    impliedPrice, effectiveAskStr, effectiveAskNum, askNum, askFmt,
    model,
    ioYears, amortYrsNum, isIO, ioLabel,
    unitsNum,
    taxAdjTaxes, taxAdjNoi, taxAdjThreshold, showTaxAdj, taxAdjDesc, taxAdjBreakevenOcc,
    bldgSF, pricePerUnit, pricePerSF,
  } = computeDerivations(data, boe);
  const yrBuilt    = parseInt(data.yearBuilt) || 0;
  const age        = yrBuilt > 0 ? new Date().getFullYear() - yrBuilt : 0;
  const permitNum  = parseInt(data.permitCount) || 0;
  const permits    = parsePermits(data.permitDetails || "[]");
  const isSFR      = !!(data.propertyType?.toLowerCase().includes("single"));

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

  const flags  = computeFlags(data, boe);
  const verdict = dealVerdict(flags);

  return (
    <Document>

      {/* ════════ PAGE 1: PROPERTY + PRICING + TAX + LOCATION ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={1} />

        {/* PROPERTY OVERVIEW */}
        <SectionHead title="PROPERTY OVERVIEW" />
        <View style={s.tableWrap}>
          <Row label="Address"          value={data.address} />
          <Row label="Property Type"    value={data.propertyType || "Not available"} alt />
          <Row label="Year Built"       value={data.yearBuilt ? data.yearBuilt + (age > 0 ? ` (${age} years old)` : "") : "Not available"} />
          <Row label="Building Area"    value={data.buildingArea ? fmtSFStr(data.buildingArea) : "Not available"} alt />
          <Row label="Lot Size"         value={(() => {
            if (!data.lotSize) return "Not available";
            // api.py sends "0.91 AC" (acres) or "12,500 SF" (sqft) — detect and normalise to sqft
            const acMatch = data.lotSize.match(/([\d.]+)\s*[Aa][Cc]/);
            const sfMatch = data.lotSize.match(/([\d,]+)\s*[Ss][Ff]/);
            let sqft: number;
            if (acMatch) {
              sqft = parseFloat(acMatch[1]) * 43560;
            } else if (sfMatch) {
              sqft = parseFloat(sfMatch[1].replace(/,/g, ""));
            } else {
              sqft = parseFloat(data.lotSize.replace(/[^0-9.]/g, ""));
            }
            if (isNaN(sqft) || sqft <= 0) return data.lotSize;
            const acres = (sqft / 43560).toFixed(2);
            return `${Math.round(sqft).toLocaleString("en-US")} SF | ${acres} acres`;
          })()} />
          <Row label="Units"            value={data.units || "Not available"} alt />
          {data.zoning        && <Row label="Zoning"          value={data.zoning} />}
          {data.parcelId      && <Row label="Parcel ID"        value={data.parcelId} />}
          {(data.salePrice || data.saleYear) && (
            <Row label="Last Recorded Sale"
              value={[data.salePrice, data.saleYear].filter(Boolean).join("  —  ")}
              alt />
          )}
        </View>

        {/* PRICING & MARKET CONTEXT */}
        {(!!data.askingPrice || impliedPrice > 0) && (
          <>
            <SectionHead title="PRICING & MARKET CONTEXT" />
            <View style={s.tableWrap}>
              {data.askingPrice
                ? <Row label="Asking Price" value={askFmt} />
                : <Row label="Implied Acquisition Price"
                    value={fmt$(impliedPrice) + "  (" + (effTaxRate > 0 ? "on Tax Adj. NOI" : "on BOE NOI") + ")"} />
              }
              {pricePerUnit && <Row label="Price per Unit" value={pricePerUnit} alt />}
              {pricePerSF   && <Row label="Price per SF"   value={pricePerSF} />}
              {data.brokerCapRate && <Row label="Broker Cap Rate" value={fmtPctDisplay(data.brokerCapRate)} alt />}
              {data.askingPrice && model.noi !== null && <Row label="Implied Gross NOI" value={fmt$(model.noi) + "/yr (broker cap × ask)"} />}
              {data.buyerCapRate && impliedPrice > 0 && (() => {
                // When reassessment is material, split into two rows:
                //   (1) in-place taxes — naive cap: NOI ÷ buyerCR.
                //       Answers "what price gives buyerCR on year-1 NOI
                //       assuming taxes stay at current level."
                //   (2) reassessed taxes — closed-form impliedPrice
                //       = (NOI_inplace + taxes_current) / (buyerCR + effTaxRate).
                //       Answers "what price gives buyerCR on the long-term
                //       NOI where new taxes scale with that price." This
                //       correctly handles the circular dependency: taxes
                //       depend on price, price depends on NOI, NOI depends
                //       on taxes.
                //
                // Counterintuitive case: in cycle-locked states (NC), when
                // the current assessed value exceeds the closed-form
                // implied price, reassessment would LOWER taxes at the new
                // price → year-N NOI > year-1 NOI → Reassessed max > In-Place
                // max. The math is correct; it's flagging that the parcel
                // is currently over-assessed relative to its underwritable
                // value.
                const inPlacePrice = boe && boe.estNoi > 0 && buyerCR > 0
                  ? Math.round(boe.estNoi / buyerCR)
                  : 0;
                const showTwoPrices = showTaxAdj && inPlacePrice > 0 && Math.abs(inPlacePrice - impliedPrice) > 5000;
                const capLbl = fmtPctDisplay(data.buyerCapRate) + " Cap";
                if (!showTwoPrices) {
                  return (
                    <Row label={"Buyer's Max Price at " + capLbl}
                      value={fmt$(impliedPrice) + "  (" + (effTaxRate > 0 ? "on Tax Adj. NOI" : "on BOE NOI") + ")"}
                      alt />
                  );
                }
                const reassessNote = isLpvState
                  ? "after 5% LPV growth"
                  : isNCState
                    ? (data.reappraisalYear ? `post-${data.reappraisalYear} reappraisal` : "post-reappraisal")
                    : isFLState
                      ? "reassessed at 95% of sale price"
                      : "taxes reassessed at sale";
                return (
                  <>
                    <Row label={"Buyer's Max Price (In-Place Taxes) at " + capLbl}
                      value={fmt$(inPlacePrice)} alt />
                    <Row label={"Buyer's Max Price (Reassessed Taxes) at " + capLbl}
                      value={fmt$(impliedPrice) + "  (" + reassessNote + ")"} />
                  </>
                );
              })()}
              {data.occupancy    && <Row label="Current Occupancy" value={fmtPctDisplay(data.occupancy)} alt />}
              {data.inPlaceRents && <Row label="Average Monthly In-Place Rent" value={fmtDol(data.inPlaceRents) + "/mo"} />}
              {data.censusRent && (
                <Row label={"Area Median Rent" + (zip ? " (ZIP " + zip + ")" : "")}
                  value={data.censusRent + "/mo  (Census ACS 5-yr)"} alt />
              )}
            </View>
            {data.brokerClaims && (
              <Text style={s.note}>Broker claims: {data.brokerClaims}</Text>
            )}
            {(() => {
              // Conditional explainer for the counterintuitive case where the
              // Reassessed Taxes max price EXCEEDS the In-Place Taxes max price.
              // Happens when current assessed value > implied price at buyerCR
              // — typical for over-assessed parcels in cycle-locked states
              // (most commonly NC, but possible anywhere reassessment isn't
              // immediate). At the lower implied price, reassessment would
              // reduce taxes, raising year-N NOI, which raises the max price
              // that achieves the target cap rate on year-N NOI.
              if (!data.buyerCapRate || !boe || boe.estNoi <= 0 || !buyerCR) return null;
              if (!showTaxAdj || impliedPrice <= 0) return null;
              const inPlacePriceForNote = Math.round(boe.estNoi / buyerCR);
              if (impliedPrice <= inPlacePriceForNote + 5000) return null;
              const currentAssessedDol = parseDol(data.assessedValue);
              if (currentAssessedDol <= 0) return null;
              return (
                <Text style={s.note}>
                  Note: Reassessed Taxes max ({fmt$(impliedPrice)}) exceeds In-Place Taxes max ({fmt$(inPlacePriceForNote)}) because the current county assessment ({fmtDol(data.assessedValue)}) is higher than the implied price at your target cap. At a lower purchase price, reassessment would likely reduce taxes, raising year-N NOI. The closed-form Reassessed price solves for the price where year-N cap = buyer cap, accounting for the tax change.
                </Text>
              );
            })()}
          </>
        )}

        {/* TAX PROFILE — kept concise on page 1 to prevent overflow */}
        {hasAssessor && (
          <>
            <SectionHead title="TAX PROFILE" />
            <View style={s.tableWrap}>
              {data.assessedValue && (
                <Row label={
                  isLpvState ? "Full Cash Value / FCV (County)"
                  : isPAState ? "Assessed Value (1998 Base Year)"
                  : "Appraised Value (County)"
                } value={fmtDol(data.assessedValue)} />
              )}
              {isPAState && data.marketValue && (
                <Row label="Est. Market Value (STEB CLR)"
                  value={fmtDol(data.marketValue) + "  (raw assessed ÷ Common-Level Ratio)"} alt />
              )}
              {isSplitRatioState && splitRatioTaxableStr && (
                <Row label={`Taxable Value (${splitRatioLabel})`}
                  value={splitRatioTaxableStr + `  (${splitRatioState} statutory ratio; broker / Assessor call this 'Assessed Value')`} alt />
              )}
              {isLpvState ? (
                <>
                  {data.lpv && (
                    <Row label="Limited Property Value (LPV)" value={fmtDol(data.lpv) + "  (capped 5%/yr growth)"} alt />
                  )}
                  {data.adjustedLpv && (
                    <Row label="Adj. LPV (Net Assessed Value)" value={
                      fmtDol(data.adjustedLpv) +
                      (data.assessmentRatio
                        ? `  (LPV × ${(parseFloat(data.assessmentRatio) * 100).toFixed(0)}% assessment ratio)`
                        : "  (actual tax base)")
                    } />
                  )}
                </>
              ) : (
                data.landValue && data.improvements && (
                  (() => {
                    const hasOther = parseDol(data.otherValue || "") > 0;
                    return (
                      <Row
                        label={hasOther ? "Land / Imp / Misc" : "Land / Improvements"}
                        value={
                          hasOther
                            ? fmtDol(data.landValue) + " land  +  " + fmtDol(data.improvements) + " imp  +  " + fmtDol(data.otherValue || "") + " misc"
                            : fmtDol(data.landValue) + " land  +  " + fmtDol(data.improvements) + " improvements"
                        }
                        alt
                      />
                    );
                  })()
                )
              )}
              {data.annualTaxes && (
                <Row label="Current Annual Taxes" value={(() => {
                  const fee = data.taxFeePerUnit ? parseFloat(data.taxFeePerUnit) : 0;
                  const feeNote = fee > 0
                    ? `  (incl. $${fee.toFixed(0)}/unit municipal fee)`
                    : "";
                  return fmtDol(data.annualTaxes) + "/yr" + feeNote;
                })()} />
              )}
              {!data.annualTaxes && data.assessedValue && data.taxRate && (
                <Row label="Est. Annual Taxes" value={(() => {
                  const av = parseDol(data.assessedValue);
                  const rate = parseFloat(data.taxRate.replace(/%/g, "")) / 100;
                  return av && rate ? fmt$(Math.round(av * rate)) + "/yr  (assessment × tax rate)" : "";
                })()} />
              )}
              {data.taxRate && (
                <Row label={isLpvState ? "Effective Tax Rate (on Adj. LPV)" : "Effective Tax Rate"} value={data.taxRate} alt />
              )}
              {data.assessedValue && data.askingPrice && (
                <>
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
              {/* TX special taxing districts — MUD / WCID / drainage / etc.
                  Detected via TCEQ iwud spatial join. Each district's rate
                  is already folded into Effective Tax Rate above; this block
                  shows the breakdown so the user can see what's in the
                  rate stack (vs the MUD-free in-city baseline). */}
              {Array.isArray(data.txDistricts) && data.txDistricts.length > 0 && (
                <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: RULE }}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 }}>
                    Special Taxing Districts (already in Effective Tax Rate)
                  </Text>
                  {data.txDistricts.map((d, i) => (
                    <View key={i} style={{ flexDirection: "row", paddingVertical: 1.5 }}>
                      <Text style={{ width: 168, fontSize: 8, color: "#374151", paddingLeft: 8 }}>
                        • {d.name}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 8, color: "#374151" }}>
                        {d.type}{d.ratePct != null ? `  +${d.ratePct.toFixed(3)}%` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* NV / OH abatement banner — actual tax may differ from
                  the rate × value estimate due to growth caps (NV NRS
                  361.4722, 3%/8% YoY) or active CRA/TIF (OH urban cores). */}
              {data.abatementFlag && (
                <View style={{
                  marginTop: 6, padding: 6, backgroundColor: AMBER_BG,
                  borderLeftWidth: 3, borderLeftColor: AMBER, borderRadius: 2,
                }}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: AMBER, marginBottom: 2 }}>
                    ⚠ Active abatement / growth cap detected
                  </Text>
                  <Text style={{ fontSize: 7.5, color: "#374151", lineHeight: 1.4 }}>
                    Actual annual tax may be {data.capPct ? `lower than rate × value due to a ${(parseFloat(data.capPct) * 100).toFixed(0)}% year-over-year assessed-value growth cap` : "different from the estimate above"}.
                    Verify the current bill with the county treasurer/auditor before relying on the modeled figure.
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.note}>
              {(() => {
                const av2 = parseDol(data.assessedValue);
                const ask2 = parseDol(data.askingPrice);
                const userInputTaxes = !av2 && parseDol(data.annualTaxes) > 0;
                const taxDisclaimer = " Tax amounts are estimates based on available data; confirm actual amounts with the county and consult a tax advisor.";

                const ncNote = isNCState
                  ? ` North Carolina locks assessed value flat between countywide reappraisals (N.C.G.S. § 105-287) — there is no mid-cycle reset on sale. The reassessed-tax scenario in this report applies at the next scheduled reappraisal${data.reappraisalYear ? ` (${data.reappraisalYear})` : ""} at the purchase price.`
                  : "";
                const flNote = isFLState
                  ? ` Florida rentals fully reset to Just Value at change of ownership (F.S. 193.1554/193.1555); Save Our Homes does NOT apply. JV is assumed at 95% of sale price per F.S. 193.011(8) cost-of-sale deduction. Ad-valorem rate shown does NOT include non-ad-valorem assessments (CDDs, MSBUs, fire MSTUs, solid-waste fees) — verify on the county TRIM notice.`
                  : "";
                const paNote = isPAState
                  ? ` Pennsylvania assessments are locked to the 1998 base year — there is NO reassessment at change of ownership. The "Assessed Value" shown matches the broker / tax bill / public record (raw base-year value), and "Est. Market Value" is the STEB Common-Level Ratio rescaling to current FMV (assessed ÷ CLR). The effective tax rate shown is raw-relative — i.e., it applies to the raw 1998 assessed value, not FMV. Counties only reassess via countywide ordinance, which is irregular and multi-decade.`
                  : "";

                if (userInputTaxes) {
                  const srcNote = data.assessorSource
                    ? ` ${data.assessorSource} located the parcel but no assessed value is currently on record (appraisal may be pending for new construction).`
                    : "";
                  const reassessNote = isLpvState
                    ? " Arizona uses Limited Property Value (LPV) — the tax base is capped at 5%/yr and does not reset to purchase price at sale."
                    : isNCState
                      ? ncNote
                      : isPAState
                        ? paNote
                        : " Upon sale, county may reassess to the purchase price.";
                  return `Annual taxes submitted by user.${srcNote}${reassessNote}${flNote}${taxDisclaimer}`;
                }

                const src = data.assessorSource ? `Source: ${data.assessorSource}.` : "Source: County appraisal district.";
                if (isLpvState) {
                  return `${src} The value shown is the Full Cash Value (FCV) — Arizona's market-value estimate. The actual tax base is the Limited Property Value (LPV), which is capped at 5% annual growth and does not reset to purchase price on sale. Taxes are levied on the Adj. LPV (Net Assessed Value) — LPV × statutory assessment ratio (10% for residential rentals, 18% for commercial).${taxDisclaimer}`;
                }
                if (isNCState) {
                  return `${src}${ncNote}${taxDisclaimer}`;
                }
                if (isFLState) {
                  return `${src}${flNote}${taxDisclaimer}`;
                }
                if (isPAState) {
                  return `${src}${paNote}${taxDisclaimer}`;
                }
                if (av2 > 0 && ask2 > 0 && av2 > ask2) {
                  return `${src} Assessment exceeds asking price — purchasing below assessed value may provide grounds to appeal taxes downward. Consult a property tax consultant.${taxDisclaimer}`;
                }
                return `${src} Tax amounts reflect current assessment; upon sale, county may reassess to the purchase price.${taxDisclaimer}`;
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
                <Row label={data.proximityCity ? `Drive to Downtown ${data.proximityCity}` : "Drive to Downtown"}
                  value={data.proximityMinutes ? `${data.proximityMiles} mi — ${data.proximityMinutes} min drive` : `${data.proximityMiles} mi`}
                  alt />
              )}
            </View>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 2: SCHOOLS + CRIME + DEMOGRAPHICS + PERMITS ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={2} />

        {/* SCHOOLS */}
        {hasSchools && (
          <>
            <Text style={[s.note, { marginTop: 0, marginBottom: 3, fontFamily: "Helvetica-Bold", color: NAVY, fontStyle: "normal", fontSize: 9 }]}>
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
            <Text style={[s.note, { marginBottom: 4 }]}>School data provided by GreatSchools.org © 2025. All rights reserved.</Text>
          </>
        )}
        {!hasSchools && (
          <Text style={[s.note, { marginBottom: 4 }]}>School ratings temporarily unavailable — verify at greatschools.org using the property ZIP code.</Text>
        )}

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
            <CrimeGradeBox grades={[
              { label: "Overall Grade",  grade: parsedCrime.overallGrade  || "" },
              { label: "Violent Grade",  grade: parsedCrime.violentGrade  || "" },
              { label: "Property Grade", grade: parsedCrime.propertyGrade || "" },
            ]} />
            <Text style={s.note}>
              Source: Dallas Open Data (NIBRS-coded incidents), {parsedCrime.yearRange} annual average. National comparison: FBI UCR 2022.
            </Text>
          </>
        ) : hasCrime ? (
          <>
            <CrimeGradeBox grades={[
              { label: "Overall Grade",   grade: parsedCrime?.overallGrade  || data.crimeOverall  || "" },
              { label: "Violent Grade",   grade: parsedCrime?.violentGrade  || data.crimeViolent  || "" },
              { label: "Property Grade",  grade: parsedCrime?.propertyGrade || data.crimeProp     || "" },
            ]} />
            {(parsedCrime?.crateTotal != null || parsedCrime?.pct != null || data.crimeRate || data.crimePct) && (
              <View style={s.tableWrap}>
                <Row label="Overall Crime Grade"
                  value={crimeGrade
                    + (parsedCrime?.crateTotal != null
                        ? ` — ${parsedCrime.crateTotal.toFixed(2)} per 1,000 residents`
                        : data.crimeRate ? " — " + data.crimeRate + " per 1,000 residents" : "")
                    + (parsedCrime?.pct != null
                        ? ` (safer than ${parsedCrime.pct}% of U.S. ZIPs)`
                        : data.crimePct ? " (safer than " + data.crimePct + "% of U.S. ZIPs)" : "")} />
              </View>
            )}
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
              {data.censusBachPlus  && <Row label="Education (25+)"           value={data.censusBachPlus + "% bachelor's degree or higher"
                    + (data.msaBachPlus ? "  |  MSA: " + data.msaBachPlus + "%" : "")} />}
              {raceStr              && <Row label="Racial/Ethnic Composition" value={raceStr} alt />}
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
        {data.permitSource === "unavailable" ? (
          <View style={{ marginBottom: 8 }}>
            <Bullet
              bold="Permit data temporarily unavailable. "
              rest="Our permit data provider is offline for this address. Check the municipal building department directly for permit history before ordering an inspection."
            />
          </View>
        ) : permitNum === 0 ? (
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
            <Text style={s.note}>Source: {data.permitSource || "City building permit portal"}. Absence of permits does not confirm no work was done — only that no permits were pulled, permits were pulled under different names/addresses, or permits were not found in our source data.</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <View style={{ marginBottom: 10 }}>
              <Text style={s.val}>
                {permitNum} permit{permitNum !== 1 ? "s" : ""} found on record. Review scope and quality of documented improvements during inspection.
              </Text>
            </View>
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
                    <Text style={[s.tCell, { flex: 5 }]}>{p.d ? (p.d.length > 48 ? p.d.slice(0, 46) + "…" : p.d) : "—"}</Text>
                    <Text style={[s.tCell, { width: 68 }]}>{p.dt || "—"}</Text>
                    <Text style={[s.tCell, { width: 58 }]}>{p.v ? fmt$(p.v) : "—"}</Text>
                  </View>
                ))}
                {permitNum > permits.length && (
                  <Text style={[s.note, { marginTop: 4 }]}>
                    {permitNum - permits.length} additional permit{permitNum - permits.length !== 1 ? "s" : ""} not shown (report displays up to 20). Full history available through the city permit portal.
                  </Text>
                )}
                <Text style={s.note}>Source: {data.permitSource || "City permit portal"}. Values shown are permitted job values, not actual cost.</Text>
              </>
            )}
          </View>
        )}

        {/* BACK-OF-ENVELOPE ANALYSIS */}
        {boe !== null && (() => {
            // Per-unit helpers (only when units > 0)
            const pu    = (v: number) => unitsNum > 0 ? fmt$(Math.round(v / unitsNum)) + "/unit/yr" : "";
            const puMo  = (v: number) => unitsNum > 0 ? fmt$(Math.round(v / unitsNum / 12)) + "/unit/mo" : "";

            return (
              <>
                <SectionHead title="BACK-OF-ENVELOPE ANALYSIS" />
                <Text style={s.note}>Verify with actual T-12.</Text>

                {/* Column header */}
                <View style={{ flexDirection: "row", paddingVertical: 3, paddingHorizontal: 0, marginTop: 6 }}>
                  <Text style={{ width: 240, fontSize: 7, color: GRAY }} />
                  <Text style={{ width: 92, fontSize: 7, color: GRAY }}>Annual Total</Text>
                  <Text style={{ flex: 1, fontSize: 7, color: GRAY }}>Per Unit</Text>
                </View>

                {/* Revenue sub-header */}
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2 }}>REVENUE</Text>
                <View style={s.tableWrap}>
                  <BoeRow label={"Gross Potential Revenue (GPR)" + (
                    data.inPlaceRents
                      ? ""
                      : data.censusRent
                        ? "  (area median est.)"
                        // No in-place rents AND no census fallback → the
                        // GPR / per-unit rent is back-derived from the broker's
                        // stated cap rate × asking price. Label so the reader
                        // doesn't read the per-unit figure as an assumed rent.
                        : "  (implied from broker NOI)"
                  )}
                    total={fmt$(boe.gpr) + "/yr"}
                    unit={unitsNum > 0 ? fmt$(boe.gprPerUnitPerMonth) + (isSFR ? "/mo" : "/unit/mo") : ""} />
                  <BoeRow label={"  Less Vacancy (" + boe.vacancyPct.toFixed(1) + "%)"}
                    total={"– " + fmt$(boe.vacancyAmt) + "/yr"} alt />
                  <BoeRow label={"  Less Bad Debt (" + boe.badDebtPct.toFixed(1) + "%)"}
                    total={"– " + fmt$(boe.badDebtAmt) + "/yr"} />
                  <BoeRow label={"  Plus Other Income (" + boe.otherIncomePct + "% of 1 mo. rent)"}
                    total={"+ " + fmt$(boe.otherIncomeAmt) + "/yr"} alt />
                </View>
                <SubtotalRow label="Effective Gross Income (EGI)" value={fmt$(boe.egi) + "/yr"} unit={puMo(boe.egi)} />

                {/* Expenses sub-header */}
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2, marginTop: 8 }}>OPERATING EXPENSES</Text>
                <View style={s.tableWrap}>
                  <BoeRow
                    label={boe.taxesIsEstimate
                      ? "Est. Property Taxes  (county avg rate × asking price)"
                      : "Est. Property Taxes  (" + boe.taxesSource + ")"}
                    total={boe.taxes > 0 ? fmt$(boe.taxes) + "/yr" : "Not available"}
                    unit={boe.taxes > 0 ? pu(boe.taxes) : ""}
                    warn={boe.taxesIsEstimate} />
                  <BoeRow label={"Est. Insurance  (~$" + Math.round(boe.opexInputs.insurancePerUnit) + "/unit)"}
                    total={fmt$(boe.insurance) + "/yr"} unit={pu(boe.insurance)} alt />
                  <BoeRow label={"Est. Maintenance  (~$" + Math.round(boe.opexInputs.maintenancePerUnit) + "/unit — " + (yrBuilt >= 2000 ? "post-2000" : yrBuilt >= 1980 ? "1980–2000" : yrBuilt > 0 ? "pre-1980" : "unknown") + " vintage)"}
                    total={fmt$(boe.maintenance) + "/yr"} unit={pu(boe.maintenance)} />
                  <BoeRow label={"Est. Utilities  (~$" + Math.round(boe.opexInputs.utilitiesPerUnit) + "/unit)"}
                    total={fmt$(boe.utilities) + "/yr"} unit={pu(boe.utilities)} alt />
                  <BoeRow label={"Est. Payroll  (~$" + Math.round(boe.opexInputs.payrollPerUnit) + "/unit)"}
                    total={fmt$(boe.payroll) + "/yr"} unit={pu(boe.payroll)} />
                  <BoeRow label={"Est. Marketing & Leasing  (~$" + Math.round(boe.opexInputs.marketingPerUnit) + "/unit)"}
                    total={fmt$(boe.marketing) + "/yr"} unit={pu(boe.marketing)} />
                  <BoeRow label={"Est. Administrative  (~$" + Math.round(boe.opexInputs.adminPerUnit) + "/unit)"}
                    total={fmt$(boe.admin) + "/yr"} unit={pu(boe.admin)} alt />
                  <BoeRow label={"Est. Reserves / Other  (~$" + Math.round(boe.opexInputs.reservesPerUnit) + "/unit)"}
                    total={fmt$(boe.reserves) + "/yr"} unit={pu(boe.reserves)} />
                  <BoeRow label={"Est. Property Management (" + boe.opexInputs.managementPct.toFixed(1) + "% of EGI)"}
                    total={fmt$(boe.management) + "/yr"} unit={pu(boe.management)} alt />
                </View>
                <SubtotalRow label="Est. Total Operating Expenses" value={fmt$(boe.totalOpEx) + "/yr"} unit={pu(boe.totalOpEx)} />

                {/* Bottom line */}
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2, marginTop: 8 }}>NET OPERATING INCOME</Text>
                <SubtotalRow label={"Est. In-Place NOI  (" + (boe.taxesIsEstimate ? "est. taxes" : "current taxes") + ")"} value={fmt$(boe.estNoi) + "/yr"} unit={pu(boe.estNoi)} />
                {showTaxAdj && (
                  <SubtotalRow
                    label={"Est. Tax-Adjusted NOI  (" + taxAdjDesc + ")"}
                    value={fmt$(taxAdjNoi) + "/yr"}
                    unit={pu(taxAdjNoi)} />
                )}
                {boe.egi > 0 && (
                  <View style={[s.tableWrap, { marginTop: 2, marginBottom: 0 }]}>
                    <BoeRow
                      label={showTaxAdj ? "NOI Margin (in-place / tax adj.)" : "NOI Margin (in-place)"}
                      total={showTaxAdj
                        ? (boe.estNoi / boe.egi * 100).toFixed(1) + "% / " + (taxAdjNoi / boe.egi * 100).toFixed(1) + "%"
                        : (boe.estNoi / boe.egi * 100).toFixed(1) + "%"}
                      alt />
                  </View>
                )}
                <View style={[s.tableWrap, { marginTop: 4 }]}>
                  {data.brokerCapRate && (
                    <BoeRow
                      label={"Broker-Implied NOI  (at " + fmtPctDisplay(data.brokerCapRate) + " cap on " + askFmt + ")"}
                      total={fmt$(boe.brokerNoi) + "/yr"} alt />
                  )}
                  <BoeRow
                    label={showTaxAdj
                      ? "Breakeven Occupancy  (occ. where EGI covers tax-adj. OpEx)"
                      : "Breakeven Occupancy  (occ. where EGI covers total OpEx)"}
                    total={taxAdjBreakevenOcc.toFixed(1) + "%"}
                    alt={!data.brokerCapRate} />
                </View>

                <Text style={s.note}>
                  Carefully review and verify broker&apos;s/seller&apos;s stated NOI/cap rate.  Request T12 and rent roll from seller.  Revenue and operating expense assumptions are approximate.
                  {showTaxAdj ? (isLpvState
                    ? ` Tax-adjusted NOI assumes Arizona LPV grows at the 5%/yr cap (${fmt$(taxAdjTaxes)}/yr vs. current ${fmt$(boe.taxes)}/yr). AZ taxes do not reset to purchase price on sale.`
                    : isNCState
                      ? ` Tax-adjusted NOI models the ${data.reappraisalYear || "next"} countywide reappraisal at ${(effTaxRate * 100).toFixed(2)}% × purchase price (${fmt$(taxAdjTaxes)}/yr vs. current ${fmt$(boe.taxes)}/yr). NC holds values flat between reappraisal cycles — no mid-cycle reset on sale.`
                      : isFLState
                        ? ` Tax-adjusted NOI assumes full reset to Just Value at ${(effTaxRate * 100).toFixed(2)}% × 95% of purchase price per F.S. 193.011(8) (${fmt$(taxAdjTaxes)}/yr vs. current ${fmt$(boe.taxes)}/yr). Excludes non-ad-valorem assessments (CDDs, MSBUs, fire fees) — verify on TRIM notice.`
                        : ` Tax-adjusted NOI assumes taxes reassess to ${(effTaxRate * 100).toFixed(2)}% × purchase price (${fmt$(taxAdjTaxes)}/yr vs. current ${fmt$(boe.taxes)}/yr).`) : ""}
                </Text>
              </>
            );
          })()}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 4: PRICE SENSITIVITY + DEBT SERVICE + ALL-CASH ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={4} />

        {/* PRICE SENSITIVITY */}
        {boe !== null && boe.estNoi > 0 && (askNum > 0 || impliedPrice > 0) && (() => {
          const basePrice = askNum > 0 ? askNum : impliedPrice;
          const baseLabel = askNum > 0 ? "Ask" : "Implied";
          const steps     = [-5, -2.5, 0, 2.5, 5] as const;
          const prices    = steps.map(pct => Math.round(basePrice * (1 + pct / 100)));
          const capColor  = (cr: number) => cr >= 7 ? GREEN : cr >= 5.5 ? AMBER : RED;
          return (
            <>
              <SectionHead title="PRICE SENSITIVITY" />
              <Text style={[s.note, { marginBottom: 5 }]}>
                In-place cap rate{showTaxAdj ? " and tax-adjusted cap rate" : ""} at prices ±5% around {baseLabel.toLowerCase()} ({fmtDol(String(basePrice))}). NOI held constant; tax-adjusted NOI recalculated per price.
              </Text>
              {/* Header row */}
              <View style={s.tHead}>
                <Text style={[s.tHCell, { flex: 1.4 }]}>Metric</Text>
                {steps.map((pct, i) => (
                  <Text key={i} style={[s.tHCell, { flex: 1, textAlign: "right" }]}>
                    {pct === 0 ? baseLabel : (pct > 0 ? "+" : "") + pct + "%"}
                  </Text>
                ))}
              </View>
              {/* Price row */}
              <View style={s.tRow}>
                <Text style={[s.tCell, { flex: 1.4, fontFamily: "Helvetica-Bold" }]}>Price</Text>
                {prices.map((p, i) => (
                  <Text key={i} style={[s.tCell, { flex: 1, textAlign: "right", fontFamily: i === 2 ? "Helvetica-Bold" : "Helvetica" }]}>
                    {fmtDol(String(p))}
                  </Text>
                ))}
              </View>
              {/* In-place cap rate row */}
              <View style={s.tRowAlt}>
                <Text style={[s.tCell, { flex: 1.4 }]}>In-Place Cap Rate</Text>
                {prices.map((p, i) => {
                  const cr = boe.estNoi / p * 100;
                  return (
                    <Text key={i} style={[s.tCell, { flex: 1, textAlign: "right", fontFamily: i === 2 ? "Helvetica-Bold" : "Helvetica" }]}>
                      {fmtPct(cr, 2)}
                    </Text>
                  );
                })}
              </View>
              {/* Tax-adjusted cap rate row — only when reassessment/LPV scenario is active */}
              {showTaxAdj && (
                <View style={s.tRow}>
                  <Text style={[s.tCell, { flex: 1.4 }]}>Tax-Adj. Cap Rate</Text>
                  {prices.map((p, i) => {
                    // AZ: taxes fixed at LPV cap (don't vary with price)
                    // FL: JV = 95% of purchase price, so adjTaxes = effRate × 0.95 × p
                    // Default (incl. NC post-reappraisal): adjTaxes = effRate × p
                    const adjTaxes = isLpvState
                      ? taxAdjTaxes
                      : Math.round(p * effTaxRate * (isFLState ? 0.95 : 1));
                    const adjNoi   = boe.estNoi + boe.taxes - adjTaxes;
                    const cr = adjNoi / p * 100;
                    return (
                      <Text key={i} style={[s.tCell, { flex: 1, textAlign: "right", fontFamily: i === 2 ? "Helvetica-Bold" : "Helvetica" }]}>
                        {fmtPct(cr, 2)}
                      </Text>
                    );
                  })}
                </View>
              )}
            </>
          );
        })()}

        {/* DEBT SERVICE SCENARIOS */}
        {model.scenarios.length > 0 && (
          <>
            <SectionHead title={"DEBT SERVICE SCENARIOS"} />
            <Text style={[s.note, { marginBottom: 6 }]}>
              {ioLabel.charAt(0).toUpperCase() + ioLabel.slice(1)}.
              {isIO ? ` Year 1 shown as I/O payment; amortizing payment begins year ${ioYears + 1}.` : ""}
              {askNum === 0 && effectiveAskNum > 0 ? ` Loan sized on implied acquisition price of ${fmt$(effectiveAskNum)} (${effTaxRate > 0 ? "on Tax Adj. NOI" : "on BOE NOI"}).` : ""}
              {" "}Color: green = DSCR 1.10x+ / CoC 6%+, amber = marginal, red = below threshold.
            </Text>

            {[...new Set(model.scenarios.map(sc => sc.ltv))].map(ltv => {
              const ltvScs  = model.scenarios.filter(sc => sc.ltv === ltv);
              const loanAmt = ltvScs[0]?.loanAmount ?? 0;
              // Equity = down payment + closing costs (% of PURCHASE PRICE),
              // matching runFinancialModel so CoC ties out across surfaces.
              const equity  = effectiveAskNum * (1 - ltv / 100) + effectiveAskNum * CLOSING_COST_RATE;

              // Helper: render one rate table given a base NOI value
              // Tighter padding for DSCR tables to keep everything on one page
              const dscrTHead   = [s.tHead,   { paddingVertical: 3 }];
              const dscrTRow    = [s.tRow,    { paddingVertical: 3 }];
              const dscrTRowAlt = [s.tRowAlt, { paddingVertical: 3 }];

              const renderRateTable = (noiForCalc: number | null) => (
                <>
                  <View style={dscrTHead}>
                    <Text style={[s.tHCell, { width: 46 }]}>Rate</Text>
                    <Text style={[s.tHCell, { width: 88 }]}>Annual D/S{isIO ? " (I/O)" : ""}</Text>
                    <Text style={[s.tHCell, { width: 88 }]}>Cash Flow</Text>
                    <Text style={[s.tHCell, { width: 56 }]}>DSCR</Text>
                    <Text style={[s.tHCell, { flex: 1 }]}>Cash-on-Cash</Text>
                    <Text style={[s.tHCell, { width: 48 }]}>Signal</Text>
                  </View>
                  {ltvScs.map((sc, i) => {
                    const cf   = noiForCalc !== null ? noiForCalc - sc.annualDebtService : null;
                    const dscr = noiForCalc !== null && sc.annualDebtService > 0 ? noiForCalc / sc.annualDebtService : null;
                    const coc  = cf !== null && equity > 0 ? cf / equity : null;
                    const sig  = dscr === null ? "—"
                      : dscr >= 1.10 && coc !== null && coc >= 0.06 ? "GO"
                      : dscr >= 1.0 ? "WATCH"
                      : "STOP";
                    const sigColor = sig === "GO" ? GREEN : sig === "WATCH" ? AMBER : sig === "STOP" ? RED : GRAY;
                    return (
                      <View key={i} style={i % 2 === 0 ? dscrTRow : dscrTRowAlt}>
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
                </>
              );

              const inPlaceNoi = boe && boe.estNoi > 0 ? boe.estNoi : null;
              const adjNoi     = showTaxAdj && taxAdjNoi > 0 ? taxAdjNoi : null;

              return (
                <View key={ltv} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 3 }}>
                    {fmtPct(ltv, 0)} LTV — {fmt$(loanAmt)} loan | {fmt$(equity)} equity in | {ioLabel}
                  </Text>

                  {/* In-place taxes sub-table */}
                  {showTaxAdj && (
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: SLATE, marginBottom: 2 }}>
                      In-Place Taxes — NOI: {inPlaceNoi !== null ? fmt$(inPlaceNoi) + "/yr" : "—"}
                    </Text>
                  )}
                  {renderRateTable(inPlaceNoi)}

                  {/* Tax-adjusted sub-table */}
                  {showTaxAdj && adjNoi !== null && (
                    <>
                      <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: SLATE, marginTop: 3, marginBottom: 2 }}>
                        Tax-Adjusted — NOI: {fmt$(adjNoi)}/yr  ({
                          isLpvState
                            ? "AZ: taxes +5%/yr LPV cap"
                            : isNCState
                              ? `${(effTaxRate * 100).toFixed(2)}% × purchase price upon ${data.reappraisalYear || "next"} reappraisal`
                              : isFLState
                                ? `${(effTaxRate * 100).toFixed(2)}% × 95% of purchase price (FL JV reset)`
                                : `${(effTaxRate * 100).toFixed(2)}% × ask, taxes reassessed at purchase price`
                        })
                      </Text>
                      {renderRateTable(adjNoi)}
                    </>
                  )}
                </View>
              );
            })}

            {/* All-cash */}
            {boe && boe.estNoi !== 0 && effectiveAskNum > 0 && (
              <View style={{ marginTop: 3, marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                  All-Cash — {askNum > 0 ? askFmt : fmt$(effectiveAskNum) + " (implied)"} equity | No debt | No I/O consideration
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
                  <Text style={[s.tCell, { flex: 1, color: (boe.estNoi / effectiveAskNum) >= 0 ? GREEN : RED }]}>
                    {fmtPct((boe.estNoi / effectiveAskNum) * 100)}
                  </Text>
                </View>
              </View>
            )}
            <Text style={s.note}>GO = DSCR 1.10x+ / CoC 6%+. WATCH = marginal. STOP = negative or sub-1.0x DSCR. Equity = down payment + 2% of purchase price (closing costs).</Text>
          </>
        )}

        <PageFooter />
      </Page>

      {/* ════════ PAGE 5: FLAGS + NEXT STEPS + DISCLAIMER ════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader address={data.address} page={5} />

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

        {/* DISCLAIMER */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerTitle}>{DISCLAIMER_TITLE}</Text>
          <Text style={s.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </View>

        <PageFooter />
      </Page>

    </Document>
  );
}

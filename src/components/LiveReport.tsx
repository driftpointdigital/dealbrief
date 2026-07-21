"use client";
// Live HTML mirror of the DealBrief report — the right-hand pane of Review &
// Adjust. Renders the SAME computed view model the PDF renders (computeBoe +
// computeDerivations), so on-screen numbers are identical to the delivered PDF.
// Only the markup differs (HTML here, @react-pdf primitives in pdf-template).
//
// Financial core (deal snapshot, operating statement, tax-adjusted analysis,
// debt-service grid) plus the info sections (tax assessment, location/flood,
// demographics, schools, crime, permits). Crime/schools/permits are parsed via
// the SAME reportParsers the PDF uses. Curated risk flags land next (Slice 3).
import React from "react";
import type { ReportData } from "@/lib/pdf-template";
import type { BoeEst } from "@/lib/underwriting";
import { computeDerivations } from "@/lib/underwriting";
import { fmt$, fmtPct, fmtX } from "@/lib/financial";
import { parseSchools, parsePermits, parseCrimeData, parseBLS, NAT_RATES, vsNat } from "@/lib/reportParsers";
import { computeFlags, dealVerdictLevel } from "@/lib/reportFlags";
import { DISCLAIMER_TITLE, DISCLAIMER_TEXT } from "@/lib/reportCopy";

type Deriv = ReturnType<typeof computeDerivations>;

const NAVY = "#1D3557", SLATE = "#457B9D", INK = "#111827", MUTE = "#6B7280";
const GREEN = "#2D8C4E", AMBER = "#B7791F", RED = "#C0392B", RULE = "#E5E7EB";
const MONO = "'IBM Plex Mono', monospace";
const COL_TOTAL = 108, COL_UNIT = 92;

function dscrColor(v: number | null) { return v == null ? INK : v >= 1.10 ? GREEN : v >= 0.95 ? AMBER : RED; }
function cocColor(v: number | null) { return v == null ? INK : v >= 0.06 ? GREEN : v >= 0.03 ? AMBER : RED; }
// Info-section colour helpers (panel palette; PDF keeps its own equivalents).
function crimeGradeColor(grade: string) { const g = (grade || "").toUpperCase(); if (!g) return MUTE; if (g.startsWith("A") || g.startsWith("B")) return GREEN; if (g.startsWith("C")) return AMBER; return RED; }
function schoolRatingColor(band: string) { const b = (band || "").toLowerCase(); if (b.includes("above")) return GREEN; if (b.includes("below")) return RED; if (b === "average") return AMBER; return MUTE; }
function vsNatColor(local: number, nat: number) { if (!nat) return MUTE; const r = local / nat; if (r <= 0.9) return GREEN; if (r <= 1.25) return INK; if (r <= 1.75) return AMBER; return RED; }
// Expenses / deductions render as parenthesised negatives, e.g. ($12,000).
const neg = (n: number) => "(" + fmt$(n) + ")";
// ACS education comes through as a bare number (e.g. "34") — render as "34%".
const withPct = (s: string) => { const t = (s || "").trim(); return t ? (t.endsWith("%") ? t : t + "%") : ""; };
// Population comes through as a raw integer string — render as "1,234,567".
const fmtPop = (s: string) => { const n = parseInt((s || "").replace(/[^0-9]/g, ""), 10); return n > 0 ? n.toLocaleString("en-US") : (s || "—"); };
// Tax rate — always in percent form (e.g. "2.05" or "2.05%") → "2.05%".
const fmtRate = (s: string) => { const n = parseFloat((s || "").replace(/[%,\s]/g, "")); return isNaN(n) ? (s || "—") : n.toFixed(2) + "%"; };

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 5, marginBottom: 10, marginTop: 22 }}>
      {children}
    </div>
  );
}

// Three columns: line item · total · per unit.
function Line({ label, total, perUnit, alt, bold, warn }: { label: string; total: string; perUnit?: string; alt?: boolean; bold?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", padding: "5px 8px", background: alt ? "#F8FAFC" : "transparent", borderRadius: 3 }}>
      <span style={{ flex: 1, fontSize: 12.5, color: warn ? RED : MUTE, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ width: COL_TOTAL, textAlign: "right", fontFamily: MONO, fontSize: 12.5, color: warn ? RED : INK, fontWeight: bold ? 600 : 500, whiteSpace: "nowrap" }}>{total}</span>
      <span style={{ width: COL_UNIT, textAlign: "right", fontFamily: MONO, fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>{perUnit ?? ""}</span>
    </div>
  );
}

function ColHeader() {
  return (
    <div style={{ display: "flex", padding: "0 8px 4px", fontSize: 9, letterSpacing: "0.3px", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 600 }}>
      <span style={{ flex: 1 }} />
      <span style={{ width: COL_TOTAL, textAlign: "right" }}>Total</span>
      <span style={{ width: COL_UNIT, textAlign: "right" }}>Per Unit</span>
    </div>
  );
}

// Two-column row (label · value) for the non-per-unit info sections.
function Row({ label, value, alt, bold }: { label: string; value: string; alt?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 8px", background: alt ? "#F8FAFC" : "transparent", borderRadius: 3 }}>
      <span style={{ fontSize: 12.5, color: MUTE, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 12.5, color: INK, fontWeight: bold ? 600 : 500, whiteSpace: "nowrap", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// Crime letter-grade tiles (Overall / Violent / Property).
function CrimeGrades({ grades }: { grades: Array<{ label: string; grade: string }> }) {
  if (!grades.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, border: `1.5px solid ${NAVY}`, borderRadius: 6, padding: "8px 12px", margin: "8px 0", justifyContent: "space-around", background: "#F8FAFC" }}>
      {grades.map((g, i) => (
        <div key={i} style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 9, color: MUTE, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.3px" }}>{g.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: crimeGradeColor(g.grade) }}>{g.grade}</div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: "1 1 128px", minWidth: 124, padding: "10px 12px", background: "white", border: `1px solid ${RULE}`, borderRadius: 8 }}>
      <div style={{ fontSize: 9.5, letterSpacing: "0.4px", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: color || INK, lineHeight: 1.1, whiteSpace: "nowrap" }}>{value}</div>
      {sub ? <div style={{ fontSize: 9.5, color: "#9CA3AF", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export default function LiveReport({ rd, boe, deriv }: { rd: ReportData; boe: BoeEst | null; deriv: Deriv }) {
  const units = parseInt(rd.units) || 0;
  const bldgArea = (() => {
    const n = parseInt((rd.buildingArea || "").replace(/[^0-9]/g, ""), 10);
    return n > 0 ? n.toLocaleString("en-US") + " SF" : "";
  })();
  // Per-unit column helpers.
  const pu = (n: number) => units > 0 ? fmt$(n / units) : "";
  const puNeg = (n: number) => units > 0 ? "(" + fmt$(n / units) + ")" : "";
  // Cap rate WE compute: our estimated NOI ÷ the price the user entered.
  const capRate = boe && deriv.effectiveAskNum > 0 ? (boe.estNoi / deriv.effectiveAskNum) * 100 : null;
  const buyerCapPct = deriv.buyerCR > 0 ? deriv.buyerCR * 100 : null;
  // Tax-adjusted NOI / cap — fall back to in-place when there's no reassessment swing.
  const taxAdjNoiDisplay = deriv.showTaxAdj ? deriv.taxAdjNoi : (boe ? boe.estNoi : 0);
  const taxAdjCap = boe && deriv.effectiveAskNum > 0 && taxAdjNoiDisplay > 0 ? (taxAdjNoiDisplay / deriv.effectiveAskNum) * 100 : null;
  const priceValue = deriv.askNum > 0 ? (deriv.askFmt || "—") : (deriv.impliedPrice > 0 ? fmt$(deriv.impliedPrice) : "—");
  const priceSub = deriv.askNum > 0 ? "" : buyerCapPct != null ? `implied @ ${fmtPct(buyerCapPct, 2)}` : "";
  const scenarios = [...deriv.model.scenarios].sort((a, b) => (a.ltv - b.ltv) || (a.rate - b.rate));

  // Info sections — parsed with the SAME parsers the PDF uses (reportParsers).
  const schools    = parseSchools(rd.schoolsData || "[]");
  const permits    = parsePermits(rd.permitDetails || "[]");
  const permitNum  = parseInt(rd.permitCount) || 0;
  const crime      = parseCrimeData(rd.crimeData ?? "");
  const crimeGrade = crime?.overallGrade || rd.crimeOverall || "";
  const hasCrime   = !!(crime?.overallGrade || rd.crimeOverall);
  const crimeGrades = [
    { label: "Overall",  grade: crime?.overallGrade  || rd.crimeOverall || "" },
    { label: "Violent",  grade: crime?.violentGrade  || rd.crimeViolent || "" },
    { label: "Property", grade: crime?.propertyGrade || rd.crimeProp    || "" },
  ].filter(g => g.grade);
  const isDallasCrime = crime?.source === "dallas_opendata" && crime?.vr != null;
  const bls = parseBLS(rd.blsData || "");
  const raceParts: { label: string; pct: number; raw: string }[] = [];
  if (rd.censusPctBlack)    raceParts.push({ label: "Black",    pct: parseFloat(rd.censusPctBlack),    raw: rd.censusPctBlack });
  if (rd.censusPctHispanic) raceParts.push({ label: "Hispanic", pct: parseFloat(rd.censusPctHispanic), raw: rd.censusPctHispanic });
  if (rd.censusPctWhite)    raceParts.push({ label: "White",    pct: parseFloat(rd.censusPctWhite),    raw: rd.censusPctWhite });
  const raceStr = raceParts
    .sort((a, b) => b.pct - a.pct)   // highest share first
    .map((p) => `${p.label} ${p.raw}%`)
    .join(", ");
  // Curated risk flags — same computeFlags the PDF uses.
  const flags = computeFlags(rd, boe);
  const verdict = flags.length ? dealVerdictLevel(flags) : null;
  const flagColor = (lvl: string) => lvl === "red" ? RED : lvl === "amber" ? AMBER : GREEN;
  const crimeRows = crime ? [
    { label: "Violent Crime (total)", local: crime.vr ?? 0,  nat: NAT_RATES.violent,      bold: true },
    { label: "  Murder / Homicide",   local: crime.mr ?? 0,  nat: NAT_RATES.murder,       bold: false },
    { label: "  Robbery",             local: crime.rr ?? 0,  nat: NAT_RATES.robbery,      bold: false },
    { label: "  Aggravated Assault",  local: crime.ar ?? 0,  nat: NAT_RATES.assault,      bold: false },
    { label: "Property Crime (total)",local: crime.pr ?? 0,  nat: NAT_RATES.property,     bold: true },
    { label: "  Burglary",            local: crime.br ?? 0,  nat: NAT_RATES.burglary,     bold: false },
    { label: "  Larceny / Theft",     local: crime.lr ?? 0,  nat: NAT_RATES.larceny,      bold: false },
    { label: "  Motor Vehicle Theft", local: crime.vtr ?? 0, nat: NAT_RATES.vehicleTheft, bold: false },
  ] : [];

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: INK }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 12, marginBottom: 4 }}>
        <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: NAVY, letterSpacing: "-0.4px" }}>
          DEAL<span style={{ color: SLATE }}>BRIEF</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginTop: 6 }}>{rd.address || "—"}</div>
        <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>
          {[rd.propertyType, units > 0 ? `${units} units` : "", rd.yearBuilt ? `Built ${rd.yearBuilt}` : "", bldgArea].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* Deal snapshot */}
      <SectionHead>Deal Snapshot</SectionHead>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <Metric label="In-Place NOI" value={boe && boe.estNoi > 0 ? fmt$(boe.estNoi) : "—"} sub="annual" />
        <Metric label="Tax-Adj NOI" value={boe && taxAdjNoiDisplay > 0 ? fmt$(taxAdjNoiDisplay) : "—"} sub="tax adjusted" color={AMBER} />
        <Metric label="In-Place Cap" value={capRate != null ? fmtPct(capRate, 2) : "—"} sub="NOI ÷ price" color={NAVY} />
        <Metric label="Tax-Adj Cap" value={taxAdjCap != null ? fmtPct(taxAdjCap, 2) : "—"} sub="tax-adj NOI ÷ price" color={AMBER} />
        <Metric label="Price" value={priceValue} sub={priceSub} />
        <Metric label="Price / Unit" value={deriv.pricePerUnit ? deriv.pricePerUnit.replace(" / unit", "") : "—"} sub="per unit" />
        {deriv.pricePerSF ? <Metric label="Price / SF" value={deriv.pricePerSF.replace(" / SF", "")} sub="per sf" /> : null}
      </div>

      {/* Operating statement — 3 columns: line item · total · per unit */}
      {boe ? (
        <>
          <SectionHead>Operating Statement (Est.)</SectionHead>
          <ColHeader />
          <Line label={`Gross Potential Rent${units > 0 ? ` (${fmt$(boe.gprPerUnitPerMonth)}/mo)` : ""}`} total={fmt$(boe.gpr) + "/yr"} perUnit={pu(boe.gpr)} bold />
          <Line label={`  Less Vacancy (${boe.vacancyPct.toFixed(1)}%)`} total={neg(boe.vacancyAmt)} perUnit={puNeg(boe.vacancyAmt)} alt />
          <Line label={`  Less Bad Debt (${boe.badDebtPct.toFixed(1)}%)`} total={neg(boe.badDebtAmt)} perUnit={puNeg(boe.badDebtAmt)} />
          {boe.otherIncomeAmt > 0 ? <Line label={`  Plus Other Income (${boe.otherIncomePct.toFixed(0)}%)`} total={fmt$(boe.otherIncomeAmt)} perUnit={pu(boe.otherIncomeAmt)} alt /> : null}
          <Line label="Effective Gross Income" total={fmt$(boe.egi) + "/yr"} perUnit={pu(boe.egi)} bold />
          <div style={{ height: 6 }} />
          <Line label="Property Taxes" total={neg(boe.taxes)} perUnit={puNeg(boe.taxes)} warn={boe.taxesIsEstimate} alt />
          <Line label="Insurance" total={neg(boe.insurance)} perUnit={puNeg(boe.insurance)} />
          <Line label="Maintenance & Repairs" total={neg(boe.maintenance)} perUnit={puNeg(boe.maintenance)} alt />
          <Line label="Utilities" total={neg(boe.utilities)} perUnit={puNeg(boe.utilities)} />
          <Line label="Payroll" total={neg(boe.payroll)} perUnit={puNeg(boe.payroll)} alt />
          <Line label={`Management (${boe.opexInputs.managementPct.toFixed(1)}%)`} total={neg(boe.management)} perUnit={puNeg(boe.management)} />
          <Line label="Marketing & Leasing" total={neg(boe.marketing)} perUnit={puNeg(boe.marketing)} alt />
          <Line label="Administrative" total={neg(boe.admin)} perUnit={puNeg(boe.admin)} />
          <Line label="Reserves" total={neg(boe.reserves)} perUnit={puNeg(boe.reserves)} alt />
          <Line label="Total Operating Expenses" total={neg(boe.totalOpEx) + "/yr"} perUnit={puNeg(boe.totalOpEx)} bold />
          <div style={{ height: 6 }} />
          <Line label="Net Operating Income" total={fmt$(boe.estNoi) + "/yr"} perUnit={pu(boe.estNoi)} bold />
          <Line label="Breakeven Occupancy" total={boe.breakevenOcc.toFixed(1) + "%"} alt />
          {boe.taxesIsEstimate ? <div style={{ fontSize: 10.5, color: RED, marginTop: 6, fontStyle: "italic" }}>Taxes are a rough estimate ({boe.taxesSource}) — enter the actual annual tax bill on the left for accuracy.</div> : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 6, fontStyle: "italic" }}>Estimated bottom-up from area rents and rules-of-thumb. Verify every line against an actual T-12.</div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: MUTE, padding: "14px 0", lineHeight: 1.5 }}>
          Enter a <strong style={{ color: NAVY }}>Price</strong> and <strong style={{ color: NAVY }}>Average In-Place Rent</strong> (and unit count) on the left to build the live operating statement, tax analysis, and debt-service.
        </div>
      )}

      {/* Tax-adjusted — above debt service so reassessed NOI is visible first */}
      {deriv.showTaxAdj && boe ? (
        <>
          <SectionHead>Tax-Adjusted (Post-Reassessment)</SectionHead>
          <ColHeader />
          <Line label="Current Taxes (in-place)" total={neg(boe.taxes)} perUnit={puNeg(boe.taxes)} alt />
          <Line label={`Reassessed Taxes (${deriv.taxAdjDesc})`} total={neg(deriv.taxAdjTaxes)} perUnit={puNeg(deriv.taxAdjTaxes)} bold />
          <Line label="Tax-Adjusted NOI" total={fmt$(deriv.taxAdjNoi) + "/yr"} perUnit={pu(deriv.taxAdjNoi)} bold />
          <Line label="Tax-Adj Breakeven Occupancy" total={deriv.taxAdjBreakevenOcc.toFixed(1) + "%"} alt />
          <div style={{ fontSize: 10.5, color: MUTE, marginTop: 6, lineHeight: 1.5 }}>
            On a sale, this property is likely reassessed. Model year-1 NOI against the tax-adjusted line, not the seller&apos;s in-place bill.
          </div>
        </>
      ) : null}

      {/* Price sensitivity — cap rate at prices ±5% around base. Mirrors the PDF. */}
      {boe && boe.estNoi > 0 && (deriv.askNum > 0 || deriv.impliedPrice > 0) ? (() => {
        const basePrice = deriv.askNum > 0 ? deriv.askNum : deriv.impliedPrice;
        const baseLabel = deriv.askNum > 0 ? "Ask" : "Implied";
        const steps = [-5, -2.5, 0, 2.5, 5];
        const prices = steps.map((pct) => Math.round(basePrice * (1 + pct / 100)));
        return (
          <>
            <SectionHead>Price Sensitivity</SectionHead>
            <div style={{ fontSize: 10.5, color: MUTE, marginBottom: 6 }}>
              Cap rate{deriv.showTaxAdj ? " (in-place and tax-adjusted)" : ""} at prices ±5% around {baseLabel.toLowerCase()} ({fmt$(basePrice)}). NOI held constant; tax-adjusted NOI recalculated per price.
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 520, border: `1px solid ${RULE}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "flex", background: NAVY, color: "white", fontSize: 10, fontWeight: 600 }}>
                  <div style={{ flex: 1.4, padding: "6px 6px" }}>Metric</div>
                  {steps.map((pct, i) => (
                    <div key={i} style={{ flex: 1, padding: "6px 6px", textAlign: "right" }}>{pct === 0 ? baseLabel : (pct > 0 ? "+" : "") + pct + "%"}</div>
                  ))}
                </div>
                <div style={{ display: "flex", fontFamily: MONO, fontSize: 11, borderTop: `1px solid ${RULE}`, background: "white" }}>
                  <div style={{ flex: 1.4, padding: "6px 6px", fontWeight: 600, color: INK }}>Price</div>
                  {prices.map((p, i) => (
                    <div key={i} style={{ flex: 1, padding: "6px 6px", textAlign: "right", fontWeight: i === 2 ? 700 : 400, color: MUTE }}>{fmt$(p)}</div>
                  ))}
                </div>
                <div style={{ display: "flex", fontFamily: MONO, fontSize: 11, borderTop: `1px solid ${RULE}`, background: "#F8FAFC" }}>
                  <div style={{ flex: 1.4, padding: "6px 6px", color: MUTE }}>In-Place Cap</div>
                  {prices.map((p, i) => (
                    <div key={i} style={{ flex: 1, padding: "6px 6px", textAlign: "right", fontWeight: i === 2 ? 700 : 500, color: NAVY }}>{fmtPct((boe.estNoi / p) * 100, 2)}</div>
                  ))}
                </div>
                {deriv.showTaxAdj ? (
                  <div style={{ display: "flex", fontFamily: MONO, fontSize: 11, borderTop: `1px solid ${RULE}`, background: "white" }}>
                    <div style={{ flex: 1.4, padding: "6px 6px", color: MUTE }}>Tax-Adj. Cap</div>
                    {prices.map((p, i) => {
                      const adjTaxes = deriv.isLpvState ? deriv.taxAdjTaxes : Math.round(p * deriv.effTaxRate * (deriv.isFLState ? 0.95 : 1));
                      const adjNoi = boe.estNoi + boe.taxes - adjTaxes;
                      return <div key={i} style={{ flex: 1, padding: "6px 6px", textAlign: "right", fontWeight: i === 2 ? 700 : 500, color: AMBER }}>{fmtPct((adjNoi / p) * 100, 2)}</div>;
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        );
      })() : null}

      {/* Debt service scenarios — ordered by LTV, then rate. */}
      {boe && scenarios.length > 0 ? (
        <>
          <SectionHead>Debt Service — {deriv.ioLabel} · Using {deriv.debtNoiLabel}</SectionHead>
          <div style={{ fontSize: 11, color: MUTE, marginBottom: 6 }}>
            Underwritten NOI <strong style={{ color: INK, fontFamily: MONO }}>{deriv.model.noi != null ? fmt$(deriv.model.noi) + "/yr" : "—"}</strong> · DSCR = NOI ÷ debt service · CoC = (NOI − debt service) ÷ equity
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 660, border: `1px solid ${RULE}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", background: NAVY, color: "white", fontSize: 10, fontWeight: 600, letterSpacing: "0.2px" }}>
                <div style={{ flex: 1.5, padding: "6px 6px" }}>LTV / RATE</div>
                <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right" }}>LOAN</div>
                <div style={{ flex: 1.7, padding: "6px 6px", textAlign: "right" }}>ANN. DEBT SVC</div>
                <div style={{ flex: 1.1, padding: "6px 6px", textAlign: "right" }}>DSCR</div>
                <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right" }}>EQUITY INV.</div>
                <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right" }}>LEVERED CF</div>
                <div style={{ flex: 1.1, padding: "6px 6px", textAlign: "right" }}>CoC</div>
              </div>
              {scenarios.map((s, i) => (
                <div key={i} style={{ display: "flex", fontFamily: MONO, fontSize: 11, borderTop: `1px solid ${RULE}`, background: i % 2 ? "#F8FAFC" : "white" }}>
                  <div style={{ flex: 1.5, padding: "6px 6px", fontWeight: 600, color: INK }}>{s.ltv}% / {s.rate}%</div>
                  <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right", color: MUTE }}>{fmt$(s.loanAmount)}</div>
                  <div style={{ flex: 1.7, padding: "6px 6px", textAlign: "right", color: MUTE }}>{fmt$(s.annualDebtService)}</div>
                  <div style={{ flex: 1.1, padding: "6px 6px", textAlign: "right", fontWeight: 600, color: dscrColor(s.dscr) }}>{s.dscr != null ? fmtX(s.dscr) : "—"}</div>
                  <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right", color: MUTE }}>{fmt$(s.equity)}</div>
                  <div style={{ flex: 1.6, padding: "6px 6px", textAlign: "right", fontWeight: 600, color: s.cashFlow == null ? INK : s.cashFlow < 0 ? RED : GREEN }}>{s.cashFlow == null ? "—" : s.cashFlow < 0 ? neg(-s.cashFlow) : fmt$(s.cashFlow)}</div>
                  <div style={{ flex: 1.1, padding: "6px 6px", textAlign: "right", fontWeight: 600, color: cocColor(s.coc) }}>{s.coc != null ? fmtPct(s.coc * 100, 1) : "—"}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: MUTE, marginTop: 6 }}>Levered CF = NOI − debt service. DSCR / CoC on {deriv.debtNoiLabel.toLowerCase()}. Equity = down payment + 2% of price (closing costs). Green ≥ 1.10x / 6% · amber ≥ 0.95x / 3% · red below.</div>
        </>
      ) : null}

      {/* ── Tax Assessment ── */}
      <SectionHead>Tax Assessment</SectionHead>
      <Row label="Appraised / Assessed Value" value={rd.assessedValue || "—"} bold />
      {rd.landValue ? <Row label="  Land" value={rd.landValue} alt /> : null}
      {rd.improvements ? <Row label="  Improvements" value={rd.improvements} /> : null}
      {rd.otherValue ? <Row label="  Other / Misc Features" value={rd.otherValue} alt /> : null}
      {rd.marketValue ? <Row label="Est. Market Value" value={rd.marketValue} /> : null}
      <Row label="Current Tax Rate" value={rd.taxRate ? fmtRate(rd.taxRate) : "—"} alt />
      <Row label="Annual Taxes (current)" value={rd.annualTaxes || "—"} />
      {rd.parcelId ? <Row label="Parcel ID" value={rd.parcelId} alt /> : null}
      <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
        {rd.assessorSource ? `Source: ${rd.assessorSource}.` : "Source: County appraisal district."} Tax amounts reflect the current assessment; on sale the county may reassess to the purchase price.
      </div>

      {/* ── Location & Flood ── */}
      {(rd.femaZone || rd.walkScore || rd.bikeScore || rd.transitScore || rd.proximityMiles) ? (
        <>
          <SectionHead>Location & Flood</SectionHead>
          {rd.femaZone ? <Row label="FEMA Flood Zone" value={rd.femaZone} /> : null}
          {rd.walkScore ? <Row label="Walk Score" value={rd.walkScore + (rd.walkDesc ? ` · ${rd.walkDesc}` : "")} alt /> : null}
          {rd.bikeScore ? <Row label="Bike Score" value={rd.bikeScore} /> : null}
          {rd.transitScore ? <Row label="Transit Score" value={rd.transitScore} alt /> : null}
          {rd.proximityMiles ? <Row label={rd.proximityCity ? `Drive to Downtown ${rd.proximityCity}` : "Drive to Downtown"} value={rd.proximityMinutes ? `${rd.proximityMiles} mi · ${rd.proximityMinutes} min` : `${rd.proximityMiles} mi`} /> : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
            {[rd.femaZone ? "Flood data: FEMA National Flood Hazard Layer (NFHL)" : "", (rd.walkScore || rd.bikeScore || rd.transitScore) ? "Walk/Bike/Transit Scores by Walk Score" : ""].filter(Boolean).join(". ")}.
          </div>
        </>
      ) : null}

      {/* ── Demographics (tract vs metro) ── */}
      {(rd.censusIncome || rd.censusRent || rd.censusPop) ? (
        <>
          <SectionHead>Demographics</SectionHead>
          <div style={{ display: "flex", padding: "0 8px 4px", fontSize: 9, letterSpacing: "0.3px", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 600 }}>
            <span style={{ flex: 1 }} />
            <span style={{ width: COL_TOTAL, textAlign: "right" }}>Tract</span>
            <span style={{ width: COL_UNIT, textAlign: "right" }}>Metro</span>
          </div>
          <Line label="Median Household Income" total={rd.censusIncome || "—"} perUnit={rd.msaIncome || ""} />
          <Line label="Median Gross Rent" total={rd.censusRent || "—"} perUnit={rd.msaRent || ""} alt />
          <Line label="Median Home Value" total={rd.censusHomeVal || "—"} perUnit={rd.msaHomeVal || ""} />
          {rd.censusPoverty ? <Line label="Poverty Rate" total={rd.censusPoverty} perUnit={rd.msaPoverty || ""} alt /> : null}
          {rd.censusBachPlus ? <Line label="Bachelor's Degree +" total={withPct(rd.censusBachPlus)} perUnit={withPct(rd.msaBachPlus)} /> : null}
          {rd.censusRenterPct ? <Line label="Renter-Occupied" total={rd.censusRenterPct} perUnit={rd.msaRenterPct || ""} alt /> : null}
          {rd.censusPop ? <Line label="Population" total={fmtPop(rd.censusPop)} perUnit={rd.msaPop ? fmtPop(rd.msaPop) : ""} /> : null}
          {rd.censusAge ? <Line label="Median Age" total={rd.censusAge + " yrs"} perUnit={rd.msaAge ? rd.msaAge + " yrs" : ""} alt /> : null}
          {rd.censusHouseholds ? <Line label="Total Households" total={parseInt(rd.censusHouseholds).toLocaleString("en-US")} perUnit={rd.msaHouseholds ? parseInt(rd.msaHouseholds).toLocaleString("en-US") : ""} /> : null}
          {rd.censusAvgHHSize ? <Line label="Avg Household Size" total={parseFloat(rd.censusAvgHHSize).toFixed(2)} perUnit={rd.msaAvgHHSize ? parseFloat(rd.msaAvgHHSize).toFixed(2) : ""} alt /> : null}
          {rd.censusAvgRenterSize ? <Line label="Avg Renter HH Size" total={parseFloat(rd.censusAvgRenterSize).toFixed(2)} perUnit={rd.msaAvgRenterSize ? parseFloat(rd.msaAvgRenterSize).toFixed(2) : ""} /> : null}
          {raceStr ? <Row label="Racial/Ethnic Composition (Census tract)" value={raceStr} alt /> : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
            Source: U.S. Census Bureau ACS 5-Year Estimates (most recent vintage). Tract-level figures compared to metro medians where available.{rd.msaName ? ` Metro: ${rd.msaName}.` : ""}
          </div>

          {/* HUD subsidized housing within 0.5 mi */}
          {rd.hudNearbyProps ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, marginTop: 12, marginBottom: 2 }}>Subsidized Housing within 0.5 mi (HUD)</div>
              <Row label="HUD-Assisted Properties" value={rd.hudNearbyProps + " propert" + (parseInt(rd.hudNearbyProps) === 1 ? "y" : "ies") + (rd.hudNearbyUnits ? ` (~${rd.hudNearbyUnits} assisted units)` : "")} />
              {rd.hudSection8Count && parseInt(rd.hudSection8Count) > 0 ? <Row label="Section 8 / HAP Properties" value={rd.hudSection8Count + " identified within 0.5 mi"} alt /> : null}
              {rd.hudPropNames ? <Row label="Known Properties" value={rd.hudPropNames} /> : null}
              <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
                {parseInt(rd.hudNearbyProps) === 0
                  ? "No HUD-assisted properties within 0.5 miles."
                  : parseInt(rd.hudNearbyProps) >= 3
                    ? "Elevated subsidized-housing concentration — factor into tenant mix and exit cap."
                    : "Low subsidized-housing presence nearby."}{" "}Source: HUD Multifamily Housing database.
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {/* ── Local Employment Market (BLS) ── */}
      {bls && bls.ur !== null ? (
        <>
          <SectionHead>Local Employment Market{bls.co ? ` · ${bls.co} County` : ""}</SectionHead>
          <Row label={`Unemployment Rate${bls.per ? ` (${bls.per})` : ""}`} value={bls.ur.toFixed(1) + "%" + (bls.nat !== null ? ` · U.S. ${bls.nat.toFixed(1)}%` : "")} />
          {bls.lf !== null ? <Row label="Labor Force" value={bls.lf.toLocaleString("en-US") + " persons"} alt /> : null}
          {bls.emp !== null && bls.lf !== null ? <Row label="Employment Level" value={`${bls.emp.toLocaleString("en-US")} employed (${(bls.lf - bls.emp).toLocaleString("en-US")} unemployed)`} /> : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
            Source: U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (LAUS).{bls.nat !== null ? (bls.ur <= bls.nat ? " County unemployment is at or below the national rate — a positive for rental-demand stability." : bls.ur - bls.nat > 2 ? " County unemployment is well above national — stress-test vacancy." : "") : ""}
          </div>
        </>
      ) : null}

      {/* ── Schools (GreatSchools) ── */}
      {schools.length > 0 ? (
        <>
          <SectionHead>Schools · GreatSchools</SectionHead>
          {schools.map((sc, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 8px", background: i % 2 ? "#F8FAFC" : "transparent", borderRadius: 3 }}>
              <span style={{ fontSize: 12.5, color: MUTE }}>{sc.l}</span>
              <span style={{ fontSize: 12.5, color: INK, textAlign: "right" }}>
                <strong style={{ fontWeight: 600 }}>{sc.n}</strong>{sc.d ? `  (${sc.d} mi)` : ""}{"  "}
                <strong style={{ fontWeight: 700, color: schoolRatingColor(sc.r) }}>{sc.r}</strong>
              </span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>School data © GreatSchools.org.</div>
        </>
      ) : null}

      {/* ── Crime & Safety ── */}
      <SectionHead>Crime &amp; Safety</SectionHead>
      {isDallasCrime ? (
        <>
          <div style={{ border: `1px solid ${RULE}`, borderRadius: 6, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ display: "flex", background: NAVY, color: "white", fontSize: 10, fontWeight: 600, padding: "5px 8px" }}>
              <span style={{ flex: 5 }}>Crime Category</span>
              <span style={{ flex: 2.5, textAlign: "right" }}>Local /1K</span>
              <span style={{ flex: 2.5, textAlign: "right" }}>Natl /1K</span>
              <span style={{ flex: 2, textAlign: "right" }}>vs Avg</span>
            </div>
            {crimeRows.map((row, i) => (
              <div key={i} style={{ display: "flex", fontSize: 11.5, padding: "4px 8px", borderTop: `1px solid ${RULE}`, background: i % 2 ? "#F8FAFC" : "white" }}>
                <span style={{ flex: 5, fontWeight: row.bold ? 600 : 400, color: row.bold ? NAVY : "#374151" }}>{row.label}</span>
                <span style={{ flex: 2.5, textAlign: "right", fontFamily: MONO, color: "#374151" }}>{row.local.toFixed(2)}</span>
                <span style={{ flex: 2.5, textAlign: "right", fontFamily: MONO, color: MUTE }}>{row.nat.toFixed(2)}</span>
                <span style={{ flex: 2, textAlign: "right", fontFamily: MONO, fontWeight: 600, color: vsNatColor(row.local, row.nat) }}>{vsNat(row.local, row.nat)}</span>
              </div>
            ))}
          </div>
          <CrimeGrades grades={crimeGrades} />
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>Source: Dallas Open Data (NIBRS){crime?.yearRange ? `, ${crime.yearRange} avg` : ""}. National comparison: FBI UCR 2022.</div>
        </>
      ) : hasCrime ? (
        <>
          <CrimeGrades grades={crimeGrades} />
          {(crime?.crateTotal != null || crime?.pct != null || rd.crimeRate || rd.crimePct) ? (
            <Row label="Overall Crime Grade" value={
              crimeGrade
              + (crime?.crateTotal != null ? ` — ${crime.crateTotal.toFixed(2)} per 1,000` : rd.crimeRate ? ` — ${rd.crimeRate} per 1,000` : "")
              + (crime?.pct != null ? ` (safer than ${crime.pct}% of ZIPs)` : rd.crimePct ? ` (safer than ${rd.crimePct}% of ZIPs)` : "")
            } />
          ) : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>
            {crime?.source === "fbi_cde"
              ? `Source: FBI Crime Data Explorer (NIBRS)${crime.yearRange ? ", " + crime.yearRange + " avg" : ""}${crime.agencyName ? " — " + crime.agencyName : ""}.`
              : "Source: CrimeGrade.org (ZIP-level aggregates)."}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: MUTE, padding: "6px 0" }}>Crime data not retrieved — look up crimegrade.org using the property ZIP.</div>
      )}

      {/* ── City Permit History ── */}
      <SectionHead>City Permit History</SectionHead>
      {rd.permitSource === "unavailable" ? (
        <div style={{ fontSize: 12, color: MUTE, padding: "6px 0", lineHeight: 1.5 }}>Permit data provider is offline for this address. Check the municipal building department directly before ordering an inspection.</div>
      ) : permitNum === 0 ? (
        <div style={{ fontSize: 12, color: MUTE, padding: "6px 0", lineHeight: 1.5 }}>No permits found in city records{rd.permitSource ? ` (${rd.permitSource})` : ""}. Absence of permits does not confirm no work was done — only that none were pulled or found in our source.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: INK, padding: "2px 8px 6px" }}>{permitNum} permit{permitNum !== 1 ? "s" : ""} on record. Review scope and quality of documented improvements during inspection.</div>
          {permits.length > 0 ? (
            <div style={{ border: `1px solid ${RULE}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", background: NAVY, color: "white", fontSize: 10, fontWeight: 600, padding: "5px 8px" }}>
                <span style={{ flex: 3 }}>Type</span>
                <span style={{ flex: 5 }}>Description</span>
                <span style={{ width: 62 }}>Date</span>
                <span style={{ width: 58, textAlign: "right" }}>Value</span>
              </div>
              {permits.map((p, i) => (
                <div key={i} style={{ display: "flex", fontSize: 11, padding: "4px 8px", borderTop: `1px solid ${RULE}`, background: i % 2 ? "#F8FAFC" : "white" }}>
                  <span style={{ flex: 3, color: "#374151" }}>{p.t || "—"}</span>
                  <span style={{ flex: 5, color: "#374151" }}>{p.d ? (p.d.length > 48 ? p.d.slice(0, 46) + "…" : p.d) : "—"}</span>
                  <span style={{ width: 62, color: MUTE }}>{p.dt || "—"}</span>
                  <span style={{ width: 58, textAlign: "right", fontFamily: MONO, color: "#374151" }}>{p.v ? fmt$(p.v) : "—"}</span>
                </div>
              ))}
              {permitNum > permits.length ? (
                <div style={{ fontSize: 10, color: MUTE, padding: "4px 8px", fontStyle: "italic" }}>{permitNum - permits.length} additional permit{permitNum - permits.length !== 1 ? "s" : ""} not shown (up to 20 displayed).</div>
              ) : null}
            </div>
          ) : null}
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4, fontStyle: "italic" }}>Source: {rd.permitSource || "City permit portal"}. Values are permitted job values, not actual cost.</div>
        </>
      )}

      {/* ── Risk Flags (curated) — last section ── */}
      {flags.length > 0 ? (
        <>
          <SectionHead>Risk Flags</SectionHead>
          {verdict ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: flagColor(verdict.level) + "12", border: `1px solid ${flagColor(verdict.level)}40`, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: flagColor(verdict.level), flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: flagColor(verdict.level), letterSpacing: "0.2px" }}>{verdict.label}</div>
                <div style={{ fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.4 }}>{verdict.desc}</div>
              </div>
            </div>
          ) : null}
          {flags.map((f, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${flagColor(f.level)}`, padding: "6px 0 6px 10px", marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: flagColor(f.level) }}>{f.title}</div>
              <div style={{ fontSize: 11.5, color: "#4B5563", marginTop: 2, lineHeight: 1.5 }}>{f.body}</div>
            </div>
          ))}
        </>
      ) : null}

      {/* ── Disclaimer (same copy as the PDF) ── */}
      <div style={{ marginTop: 22, borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{DISCLAIMER_TITLE}</div>
        <div style={{ fontSize: 9.5, color: "#9CA3AF", lineHeight: 1.55 }}>{DISCLAIMER_TEXT}</div>
      </div>
    </div>
  );
}

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { runFinancialModel, fmt$, fmtPct, fmtX } from "./financial";

export interface ReportData {
  // Property
  address: string; propertyType: string; yearBuilt: string;
  buildingArea: string; lotSize: string; units: string; unitMix: string;
  // Assessor
  assessedValue: string; landValue: string; improvements: string; taxRate: string;
  // Deal inputs
  askingPrice: string; brokerCapRate: string; occupancy: string;
  inPlaceRents: string; brokerClaims: string;
  // Assumptions
  rates: string[]; ltvs: string[]; amortYears: string; ioPeriod: string;
  // Pipeline — FEMA
  femaZone: string;
  // Pipeline — Walk Score
  walkScore: string; bikeScore: string; transitScore: string; walkDesc: string;
  // Pipeline — Crime
  crimeOverall: string; crimeViolent: string; crimeProp: string;
  crimeRate: string; crimeViolentRate: string; crimePct: string;
  // Pipeline — Census
  censusIncome: string; censusPop: string; censusAge: string;
  censusRent: string; censusHomeVal: string; censusPoverty: string;
  censusRenterPct: string; censusPctBlack: string; censusPctHispanic: string; censusPctWhite: string;
  // Pipeline — Permits
  permitCount: string; permitSource: string;
}

const NAVY  = "#1D3557";
const SLATE = "#457B9D";
const GRAY  = "#6B7280";
const GREEN = "#2D8C4E";
const RED   = "#C0392B";
const AMBER = "#B7791F";
const LIGHT = "#F8FAFC";
const RULE  = "#E2E8F0";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1F2937", paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, backgroundColor: "#FFFFFF" },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: NAVY },
  logo: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: -0.5 },
  logoAccent: { color: SLATE },
  headerSub: { fontSize: 8, color: GRAY },
  // Section heading
  sectionHead: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 18, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: NAVY },
  // Data rows
  tableWrap: { marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: RULE },
  rowAlt: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: LIGHT },
  lbl: { width: 160, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY, paddingRight: 8 },
  val: { flex: 1, fontSize: 8.5, color: "#374151" },
  note: { fontSize: 7.5, color: GRAY, fontStyle: "italic", marginTop: 4, marginBottom: 2 },
  // Scenarios table
  tHead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 3, marginBottom: 2 },
  tHCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: RULE },
  tRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: RULE, backgroundColor: LIGHT },
  tCell: { fontSize: 8.5, color: "#1F2937" },
  // Bullet
  bullet: { flexDirection: "row", marginBottom: 5, paddingRight: 4 },
  bulletDot: { width: 8, fontSize: 9, color: NAVY, marginTop: 0.5 },
  bulletText: { flex: 1, fontSize: 8.5, color: "#374151", lineHeight: 1.5 },
  bulletBold: { fontFamily: "Helvetica-Bold" },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 5 },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtAskingPrice(s: string): string {
  const n = parseFloat(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return s;
  return "$" + Math.round(n).toLocaleString("en-US");
}

function dscrColor(v: number | null) { return v === null ? "#1F2937" : v >= 1.1 ? GREEN : v >= 0.95 ? AMBER : RED; }
function cocColor(v: number | null)  { return v === null ? "#1F2937" : v >= 0.07 ? GREEN : v >= 0.03 ? AMBER : RED; }
function gradeColor(g: string)       { return ["F","D-","D","D+"].includes(g) ? RED : ["C-","C","C+"].includes(g) ? AMBER : GREEN; }

function Row({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? s.rowAlt : s.row}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={s.val}>{value}</Text>
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  return <Text style={s.sectionHead}>{title}</Text>;
}

function Bullet({ bold, rest }: { bold: string; rest: string }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}><Text style={s.bulletBold}>{bold}</Text>{rest}</Text>
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

  const ioYears     = parseFloat(data.ioPeriod) || 0;
  const amortLabel  = ioYears > 0 ? `${data.amortYears}-yr amort, ${ioYears}-yr I/O` : `${data.amortYears}-yr amortization`;
  const askFmt      = fmtAskingPrice(data.askingPrice);
  const units       = parseInt(data.units) || 0;
  const askNum      = parseFloat(data.askingPrice.replace(/[$,]/g, "")) || 0;
  const bldgSF      = parseFloat((data.buildingArea || "").replace(/[^0-9.]/g, "")) || 0;
  const pricePerUnit = units > 0 && askNum > 0 ? fmt$(askNum / units) + " per unit" : "";
  const pricePerSF   = bldgSF > 0 && askNum > 0 ? "~" + fmt$(askNum / bldgSF) + "/SF" : "";

  const hasAssessor  = !!(data.assessedValue || data.landValue);
  const hasFema      = !!data.femaZone;
  const hasWalk      = !!data.walkScore;
  const hasCrime     = !!data.crimeOverall;
  const hasCensus    = !!data.censusIncome;
  const permitCount  = parseInt(data.permitCount) || 0;

  // Racial composition string
  const raceArr: string[] = [];
  if (data.censusPctBlack)    raceArr.push(`Black/African American ${data.censusPctBlack}%`);
  if (data.censusPctHispanic) raceArr.push(`Hispanic/Latino ${data.censusPctHispanic}%`);
  if (data.censusPctWhite)    raceArr.push(`White ${data.censusPctWhite}%`);
  const raceStr = raceArr.join(", ");

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.headerRow}>
          <Text style={s.logo}>DEAL<Text style={s.logoAccent}>BRIEF</Text></Text>
          <Text style={s.headerSub}>
            Pre-Offer Property Research Brief | Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        {/* ── PROPERTY OVERVIEW ── */}
        <SectionHead title="PROPERTY OVERVIEW" />
        <View style={s.tableWrap}>
          <Row label="Address"       value={data.address}      />
          <Row label="Property Type" value={data.propertyType} alt />
          <Row label="Year Built"    value={data.yearBuilt}    />
          <Row label="Building Area" value={data.buildingArea} alt />
          <Row label="Lot Size"      value={data.lotSize}      />
          <Row label="Unit Count"    value={data.units + (data.unitMix ? ": " + data.unitMix : "")} alt />
        </View>

        {/* ── PRICING & MARKET CONTEXT ── */}
        {!!data.askingPrice && (
          <>
            <SectionHead title="PRICING & MARKET CONTEXT" />
            <View style={s.tableWrap}>
              <Row label="Asking Price"     value={askFmt}             />
              {pricePerUnit && <Row label="Price / Unit" value={pricePerUnit} alt />}
              {pricePerSF   && <Row label="Price / SF"   value={pricePerSF}   />}
              {data.brokerCapRate && <Row label="Broker Cap Rate" value={data.brokerCapRate} alt />}
              {model.noi !== null && <Row label="Implied NOI" value={fmt$(model.noi) + "/yr"} />}
              {data.occupancy    && <Row label="Current Occupancy" value={data.occupancy} alt />}
              {data.inPlaceRents && <Row label="In-Place Rents" value={data.inPlaceRents} />}
              {hasCensus && data.censusRent && <Row label="Area Median Rent (ZIP)" value={data.censusRent + "/mo (Census ACS)"} alt />}
            </View>
            {data.brokerClaims && (
              <Text style={s.note}>Broker claims: {data.brokerClaims}</Text>
            )}
          </>
        )}

        {/* ── TAX PROFILE ── */}
        {hasAssessor && (
          <>
            <SectionHead title="TAX PROFILE" />
            <View style={s.tableWrap}>
              {data.assessedValue && <Row label="Appraised Value" value={data.assessedValue + (data.landValue ? " (land " + data.landValue + " | impr. " + data.improvements + ")" : "")} />}
              {data.taxRate       && <Row label="Effective Tax Rate" value={data.taxRate} alt />}
              {askFmt && data.assessedValue && (
                <Row label="Assessment vs. Ask" value={data.assessedValue + " assessment vs. " + askFmt + " asking"} />
              )}
            </View>
          </>
        )}

        {/* ── LOCATION & RISK ── */}
        {(hasFema || hasWalk) && (
          <>
            <SectionHead title="LOCATION & RISK" />
            <View style={s.tableWrap}>
              {hasFema && <Row label="FEMA Flood Zone" value={data.femaZone + (data.femaZone.includes("X") ? " (minimal flood hazard — no mandatory flood insurance)" : " — flood insurance may be required")} />}
              {hasWalk && data.walkScore && <Row label="Walk Score" value={data.walkScore + "/100" + (data.walkDesc ? " — " + data.walkDesc : "")} alt />}
              {hasWalk && data.bikeScore && <Row label="Bike Score" value={data.bikeScore + "/100"} />}
              {hasWalk && data.transitScore && <Row label="Transit Score" value={data.transitScore + "/100"} alt />}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEALBRIEF · dealbrief.com</Text>
          <Text style={s.footerText}>Public data for informational purposes only. Not investment advice.</Text>
        </View>
      </Page>

      {/* ── PAGE 2 ── */}
      <Page size="LETTER" style={s.page}>

        {/* ── CRIME & SAFETY ── */}
        {hasCrime && (
          <>
            <SectionHead title="CRIME & SAFETY" />
            <View style={s.tableWrap}>
              <Row label="Overall Crime Grade"
                value={data.crimeOverall + (data.crimeRate ? " — " + data.crimeRate + " per 1,000 residents" : "") + (data.crimePct ? " — " + data.crimePct + "th percentile for safety" : "")} />
              {data.crimeViolent && <Row label="Violent Crime Grade"   value={data.crimeViolent + (data.crimeViolentRate ? " — " + data.crimeViolentRate + " per 1,000" : "")} alt />}
              {data.crimeProp    && <Row label="Property Crime Grade"  value={data.crimeProp} />}
              {data.crimePct     && <Row label="Safety Percentile"     value={"Safer than " + data.crimePct + "% of U.S. ZIP codes"} alt />}
            </View>
            <Text style={s.note}>Source: CrimeGrade.org. High-crime areas increase insurance premiums and may affect lender underwriting.</Text>
          </>
        )}

        {/* ── DEMOGRAPHIC SNAPSHOT ── */}
        {hasCensus && (
          <>
            <SectionHead title={"DEMOGRAPHIC SNAPSHOT" + (data.address ? " (ZIP " + (data.address.match(/\b\d{5}\b/)?.[0] ?? "") + ")" : "")} />
            <View style={s.tableWrap}>
              {data.censusPop    && <Row label="Population"          value={parseInt(data.censusPop).toLocaleString("en-US")} />}
              {data.censusAge    && <Row label="Median Age"          value={data.censusAge + " years"} alt />}
              {data.censusIncome && <Row label="Median HH Income"    value={data.censusIncome} />}
              {data.censusRent   && <Row label="Median Gross Rent"   value={data.censusRent + "/mo"} alt />}
              {data.censusHomeVal && <Row label="Median Home Value"  value={data.censusHomeVal} />}
              {data.censusPoverty && <Row label="Poverty Rate"       value={data.censusPoverty} alt />}
              {data.censusRenterPct && <Row label="Renter-Occupied"  value={data.censusRenterPct} />}
              {raceStr && <Row label="Racial/Ethnic Composition" value={raceStr} alt />}
            </View>
            <Text style={s.note}>Source: U.S. Census Bureau, ACS 5-Year Estimates.</Text>
          </>
        )}

        {/* ── PERMIT HISTORY ── */}
        <SectionHead title="CITY PERMIT HISTORY" />
        {permitCount === 0 ? (
          <View style={{ marginBottom: 8 }}>
            <Bullet
              bold="No permits found at this address. "
              rest={"On a " + (data.yearBuilt ? (new Date().getFullYear() - parseInt(data.yearBuilt)) + "-year-old" : "older") + " building marketed as value-add, this is consistent with a deferred-maintenance property. Plumbing, electrical, HVAC, and roofing are potentially all original or replaced without permits."}
            />
            <Bullet
              bold="Budget for major systems as original or near end-of-life. "
              rest="A building with no permit history means the buyer should assume cast iron drain lines, original electrical panels, HVAC units of unknown age, and roofing with unknown replacement date. Get a thorough inspection before closing."
            />
            <Bullet
              bold="Renovation capex will likely be required. "
              rest={"Interior renovations to push rents will require building permits. Typical value-add renovation for this class: $8K-$15K/unit" + (parseInt(data.units) > 0 ? " ($" + (8 * parseInt(data.units)) + "K-$" + (15 * parseInt(data.units)) + "K total for " + data.units + " units)" : "") + "."}
            />
            <Text style={s.note}>Source: {data.permitSource || "City permit portal"}.</Text>
          </View>
        ) : (
          <Text style={[s.val, { marginBottom: 8 }]}>{permitCount} permit{permitCount !== 1 ? "s" : ""} found. Review permit history for scope of past work.</Text>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEALBRIEF · dealbrief.com</Text>
          <Text style={s.footerText}>Public data for informational purposes only. Not investment advice.</Text>
        </View>
      </Page>

      {/* ── PAGE 3: FINANCIAL ANALYSIS ── */}
      <Page size="LETTER" style={s.page}>

        {/* ── BACK-OF-ENVELOPE ── */}
        {model.noi !== null && (
          <>
            <SectionHead title="BACK-OF-ENVELOPE ANALYSIS" />
            <Text style={s.note}>Current scenario uses broker-implied NOI at {data.brokerCapRate} cap on {askFmt}.</Text>
            <View style={s.tableWrap}>
              <Row label="Broker-Implied NOI"    value={fmt$(model.noi) + "/yr (at " + data.brokerCapRate + " cap on " + askFmt + ")"} />
              <Row label="Cap Rate at Ask"        value={data.brokerCapRate} alt />
              {hasAssessor && data.taxRate && (
                <Row label="Effective Tax Rate"   value={data.taxRate} />
              )}
            </View>
          </>
        )}

        {/* ── DEBT SERVICE SCENARIOS ── */}
        {model.scenarios.length > 0 && (
          <>
            <SectionHead title={"DEBT SERVICE SCENARIOS — " + amortLabel.toUpperCase()} />

            {/* Group by LTV */}
            {[...new Set(model.scenarios.map(sc => sc.ltv))].map(ltv => {
              const ltvScenarios = model.scenarios.filter(sc => sc.ltv === ltv);
              const loanAmt = ltvScenarios[0]?.loanAmount ?? 0;
              const equity  = askNum * (1 - ltv / 100);
              return (
                <View key={ltv} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                    {fmtPct(ltv, 0)} LTV — {fmt$(loanAmt)} loan | {fmt$(equity)} down | {data.amortYears}-yr amortization
                  </Text>
                  <View style={s.tHead}>
                    <Text style={[s.tHCell, { width: 50 }]}>Rate</Text>
                    <Text style={[s.tHCell, { width: 90 }]}>Annual D/S</Text>
                    <Text style={[s.tHCell, { width: 90 }]}>Cash Flow</Text>
                    <Text style={[s.tHCell, { width: 60 }]}>DSCR</Text>
                    <Text style={[s.tHCell, { flex: 1 }]}>Cash-on-Cash</Text>
                  </View>
                  {ltvScenarios.map((sc, i) => {
                    const cf = model.noi !== null ? model.noi - sc.annualDebtService : null;
                    return (
                      <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                        <Text style={[s.tCell, { width: 50 }]}>{fmtPct(sc.rate)}</Text>
                        <Text style={[s.tCell, { width: 90 }]}>{fmt$(sc.annualDebtService)}{sc.isIO ? " (I/O)" : ""}</Text>
                        <Text style={[s.tCell, { width: 90, color: cf !== null ? (cf >= 0 ? GREEN : RED) : "#1F2937" }]}>
                          {cf !== null ? (cf >= 0 ? "+" : "") + fmt$(cf) : "—"}
                        </Text>
                        <Text style={[s.tCell, { width: 60, color: dscrColor(sc.dscr) }]}>{sc.dscr !== null ? fmtX(sc.dscr) : "—"}</Text>
                        <Text style={[s.tCell, { flex: 1, color: cocColor(sc.coc) }]}>{sc.coc !== null ? fmtPct(sc.coc * 100) : "—"}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* All-cash */}
            {model.noi !== null && askNum > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 }}>
                  All-Cash Purchase — {askFmt} equity | No debt
                </Text>
                <View style={s.tHead}>
                  <Text style={[s.tHCell, { width: 120 }]}>Scenario</Text>
                  <Text style={[s.tHCell, { width: 100 }]}>Cash Flow</Text>
                  <Text style={[s.tHCell, { flex: 1 }]}>CoC Return</Text>
                </View>
                <View style={s.tRow}>
                  <Text style={[s.tCell, { width: 120 }]}>Current (in-place)</Text>
                  <Text style={[s.tCell, { width: 100, color: GREEN }]}>+{fmt$(model.noi)}</Text>
                  <Text style={[s.tCell, { flex: 1, color: GREEN }]}>{fmtPct((model.noi / askNum) * 100)}</Text>
                </View>
              </View>
            )}

            <Text style={[s.note, { marginTop: 6 }]}>
              DSCR and CoC use broker-stated cap rate to derive NOI. Green = 1.10x+ DSCR / 7%+ CoC. Closing costs assumed 1.5%.
            </Text>
          </>
        )}

        {/* ── RECOMMENDED NEXT STEPS ── */}
        <SectionHead title="RECOMMENDED NEXT STEPS" />
        <Bullet bold="Request a current rent roll and T-12 operating statement. " rest="The broker's cap rate must be verified with actual income and expense data. Confirm individual unit rents, lease terms, and any concessions." />
        <Bullet bold="Get a thorough property inspection. " rest={"On a " + (data.yearBuilt ? (new Date().getFullYear() - parseInt(data.yearBuilt)) + "-year-old" : "older") + " building" + (permitCount === 0 ? " with no permit history" : "") + ", evaluate all major systems: roof, HVAC, plumbing, electrical, and foundation."} />
        {hasCrime && ["F","D-","D"].includes(data.crimeOverall) && (
          <Bullet bold="Evaluate lender appetite for this location. " rest={"The crime profile (grade: " + data.crimeOverall + ") may limit lender options or require higher rates. Talk to local portfolio lenders who know this submarket."} />
        )}
        <Bullet bold="Confirm utility structure. " rest="Which utilities does the landlord currently pay? Get actual utility bills for the trailing 12 months before underwriting OpEx." />
        <Bullet bold="Verify occupancy and lease expirations. " rest="Confirm that the occupancy claim is accurate and that no leases expire at or shortly after closing." />

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEALBRIEF · dealbrief.com</Text>
          <Text style={s.footerText}>Public data for informational purposes only. Not investment advice.</Text>
        </View>
      </Page>
    </Document>
  );
}

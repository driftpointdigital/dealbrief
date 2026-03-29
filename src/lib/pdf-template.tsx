import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { runFinancialModel, fmt$, fmtPct, fmtX } from "./financial";

export interface ReportData {
  address: string;
  propertyType: string;
  yearBuilt: string;
  buildingArea: string;
  lotSize: string;
  units: string;
  unitMix: string;
  assessedValue: string;
  landValue: string;
  improvements: string;
  taxRate: string;
  askingPrice: string;
  brokerCapRate: string;
  occupancy: string;
  inPlaceRents: string;
  brokerClaims: string;
  rates: string[];
  ltvs: string[];
  amortYears: string;
  ioPeriod: string;
}

const NAVY = "#1D3557";
const SLATE = "#457B9D";
const GRAY = "#6B7280";
const LIGHT = "#F3F4F6";
const GREEN = "#2D8C4E";
const RED = "#C0392B";
const YELLOW = "#B7791F";
const BLACK = "#111827";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BLACK,
    paddingTop: 44,
    paddingBottom: 44,
    paddingHorizontal: 44,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  logo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: -0.5 },
  logoAccent: { color: SLATE },
  headerSub: { fontSize: 8, color: GRAY },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 16,
  },
  card: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 10,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    alignItems: "center",
  },
  rowLast: {
    flexDirection: "row",
    paddingVertical: 4,
    alignItems: "center",
  },
  label: { width: 130, fontSize: 8.5, color: GRAY },
  value: { flex: 1, fontSize: 8.5, color: BLACK },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: LIGHT,
  },
  tableCell: { fontSize: 8.5, color: BLACK },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

function dscrColor(dscr: number | null): string {
  if (dscr === null) return BLACK;
  if (dscr >= 1.1) return GREEN;
  if (dscr >= 0.95) return YELLOW;
  return RED;
}

function cocColor(coc: number | null): string {
  if (coc === null) return BLACK;
  if (coc >= 0.07) return GREEN;
  if (coc >= 0.03) return YELLOW;
  return RED;
}

export function DealBriefPDF({ data }: { data: ReportData }) {
  const model = runFinancialModel({
    askingPriceStr: data.askingPrice,
    brokerCapRateStr: data.brokerCapRate,
    rates: data.rates,
    ltvs: data.ltvs,
    amortYears: data.amortYears,
    ioPeriod: data.ioPeriod,
  });

  const hasAssessor = data.assessedValue || data.landValue || data.improvements || data.taxRate;
  const ioYears = parseFloat(data.ioPeriod) || 0;
  const amortLabel = ioYears > 0
    ? `${data.amortYears}-yr amort, ${ioYears}-yr I/O`
    : `${data.amortYears}-yr amortization`;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>
            DEAL<Text style={s.logoAccent}>BRIEF</Text>
          </Text>
          <Text style={s.headerSub}>Pre-Offer Property Research · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
        </View>

        {/* Property */}
        <Text style={s.sectionTitle}>Property Overview</Text>
        <View style={s.card}>
          <View style={s.row}><Text style={s.label}>Address</Text><Text style={[s.value, { fontFamily: "Helvetica-Bold" }]}>{data.address}</Text></View>
          <View style={s.row}><Text style={s.label}>Type</Text><Text style={s.value}>{data.propertyType}</Text></View>
          <View style={s.row}><Text style={s.label}>Year Built</Text><Text style={s.value}>{data.yearBuilt}</Text></View>
          <View style={s.row}><Text style={s.label}>Building Area</Text><Text style={s.value}>{data.buildingArea}</Text></View>
          <View style={s.row}><Text style={s.label}>Lot Size</Text><Text style={s.value}>{data.lotSize}</Text></View>
          <View style={s.row}><Text style={s.label}>Units</Text><Text style={s.value}>{data.units}</Text></View>
          <View style={s.rowLast}><Text style={s.label}>Unit Mix</Text><Text style={s.value}>{data.unitMix}</Text></View>
        </View>

        {/* Tax Assessment */}
        {hasAssessor && (
          <>
            <Text style={s.sectionTitle}>Tax Assessment</Text>
            <View style={s.card}>
              {data.assessedValue && <View style={s.row}><Text style={s.label}>Assessed Value</Text><Text style={s.value}>{data.assessedValue}</Text></View>}
              {data.landValue && <View style={s.row}><Text style={s.label}>Land Value</Text><Text style={s.value}>{data.landValue}</Text></View>}
              {data.improvements && <View style={s.row}><Text style={s.label}>Improvements</Text><Text style={s.value}>{data.improvements}</Text></View>}
              {data.taxRate && <View style={s.rowLast}><Text style={s.label}>Effective Tax Rate</Text><Text style={s.value}>{data.taxRate}</Text></View>}
            </View>
          </>
        )}

        {/* Deal Summary */}
        <Text style={s.sectionTitle}>Deal Summary</Text>
        <View style={s.card}>
          {data.askingPrice && <View style={s.row}><Text style={s.label}>Asking Price</Text><Text style={[s.value, { fontFamily: "Helvetica-Bold" }]}>{data.askingPrice}</Text></View>}
          {data.brokerCapRate && <View style={s.row}><Text style={s.label}>Broker Cap Rate</Text><Text style={s.value}>{data.brokerCapRate}</Text></View>}
          {model.noi !== null && <View style={s.row}><Text style={s.label}>Implied NOI</Text><Text style={[s.value, { fontFamily: "Helvetica-Bold" }]}>{fmt$(model.noi)}</Text></View>}
          {data.occupancy && <View style={s.row}><Text style={s.label}>Occupancy</Text><Text style={s.value}>{data.occupancy}</Text></View>}
          {data.inPlaceRents && <View style={data.brokerClaims ? s.row : s.rowLast}><Text style={s.label}>In-Place Rents</Text><Text style={s.value}>{data.inPlaceRents}</Text></View>}
          {data.brokerClaims && <View style={s.rowLast}><Text style={s.label}>Broker Claims</Text><Text style={s.value}>{data.brokerClaims}</Text></View>}
        </View>

        {/* Debt Service Scenarios */}
        {model.scenarios.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Debt Service Scenarios · {amortLabel}</Text>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: 55 }]}>Rate</Text>
              <Text style={[s.tableHeaderCell, { width: 50 }]}>LTV</Text>
              <Text style={[s.tableHeaderCell, { width: 70 }]}>Loan</Text>
              <Text style={[s.tableHeaderCell, { width: 80 }]}>Debt Svc / yr</Text>
              <Text style={[s.tableHeaderCell, { width: 50 }]}>DSCR</Text>
              <Text style={[s.tableHeaderCell, { flex: 1 }]}>Cash-on-Cash</Text>
            </View>
            {model.scenarios.map((sc, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: 55 }]}>{fmtPct(sc.rate)}</Text>
                <Text style={[s.tableCell, { width: 50 }]}>{fmtPct(sc.ltv, 0)}</Text>
                <Text style={[s.tableCell, { width: 70 }]}>{fmt$(sc.loanAmount)}</Text>
                <Text style={[s.tableCell, { width: 80 }]}>{fmt$(sc.annualDebtService)}{sc.isIO ? " (I/O)" : ""}</Text>
                <Text style={[s.tableCell, { width: 50, color: dscrColor(sc.dscr) }]}>
                  {sc.dscr !== null ? fmtX(sc.dscr) : "—"}
                </Text>
                <Text style={[s.tableCell, { flex: 1, color: cocColor(sc.coc) }]}>
                  {sc.coc !== null ? fmtPct(sc.coc * 100) : "—"}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 7, color: GRAY, marginTop: 5 }}>
              DSCR and CoC use broker-stated cap rate to derive NOI. Green = 1.10x+ DSCR / 7%+ CoC. Closing costs assumed 1.5%.
            </Text>
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEALBRIEF · dealbrief.com</Text>
          <Text style={s.footerText}>Public data for informational purposes only. Not investment advice.</Text>
        </View>
      </Page>
    </Document>
  );
}

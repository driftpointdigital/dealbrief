import { ReportData } from "@/lib/pdf-template";

/**
 * Inverse of buildReportMetadata: unpacks the compact metadata blob
 * (Stripe session.metadata shape) into the ReportData object that the
 * PDF renderer expects. Used by /api/generate-pdf for both the paid
 * path (metadata from Stripe) and the free path (metadata from
 * Supabase).
 *
 * Accepts a loose record so it can take Stripe metadata (string-only)
 * or a Supabase JSONB blob (which may also be string-typed since
 * buildReportMetadata returns Record<string,string>).
 */
export function metadataToReportData(
  m: Record<string, string | undefined | null>
): ReportData {
  const get = (k: string): string => m[k] ?? "";
  return {
    // Property
    address:        get("address"),
    propertyType:   get("propertyType"),
    yearBuilt:      get("yearBuilt"),
    buildingArea:   get("buildingArea"),
    lotSize:        get("lotSize"),
    units:          get("units"),
    zoning:         get("zoning"),
    // Assessor
    assessedValue:  get("assessedValue"),
    marketValue:    get("marketValue"),
    landValue:      get("landValue"),
    improvements:   get("improvements"),
    otherValue:     get("otherValue"),
    lpv:            get("lpv"),
    adjustedLpv:    get("adjustedLpv"),
    assessmentRatio: get("assessmentRatio"),
    reappraisalYear: get("reappraisalYear"),
    taxRate:        get("taxRate"),
    annualTaxes:    get("annualTaxes"),
    taxFeePerUnit:  get("taxFeePerUnit"),
    parcelId:       get("parcelId"),
    assessorSource: get("assessorSource"),
    owner:          get("owner"),
    // TX special-district breakdown (MUD, drainage, WCID, etc.) — list of
    // { name, type, ratePct } parsed from the compact JSON blob.
    txDistricts: (() => {
      const raw = get("txDistricts");
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((d: { n?: string; t?: string; r?: number | null }) => ({
          name: String(d.n || ""),
          type: String(d.t || ""),
          ratePct: d.r != null ? Number(d.r) : null,
        }));
      } catch { return []; }
    })(),
    // NV abatement / OH CRA banner trigger + cap percentage (e.g. 0.08).
    abatementFlag: get("abatementFlag") === "1",
    capPct:        get("capPct"),
    // FIPS state — used by frontend to apply class-threshold rate logic
    // (KS / TN / MO / IN split residential 1-4 vs commercial 5+ ratios).
    fipsState:     get("fipsState"),
    // Deal inputs
    askingPrice:    get("askingPrice"),
    brokerCapRate:  get("brokerCapRate"),
    occupancy:      get("occupancy"),
    inPlaceRents:   get("inPlaceRents"),
    brokerClaims:   get("brokerClaims"),
    buyerCapRate:   get("buyerCapRate"),
    // Assumptions
    rates:       (() => { try { return get("rates") ? JSON.parse(get("rates")) : ["8.5","7.5","6.5","5.0"]; } catch { return ["8.5","7.5","6.5","5.0"]; } })(),
    ltvs:        (() => { try { return get("ltvs")  ? JSON.parse(get("ltvs"))  : ["75","50"]; } catch { return ["75","50"]; } })(),
    amortYears:  get("amortYears") || "30",
    ioPeriod:    get("ioPeriod")   || "0",
    // Revenue assumptions
    vacancyPct:     get("revAssumptions") ? (get("revAssumptions").split(",")[0] ?? "5.0") : "5.0",
    badDebtPct:     get("revAssumptions") ? (get("revAssumptions").split(",")[1] ?? "1.0") : "1.0",
    otherIncomePct: get("revAssumptions") ? (get("revAssumptions").split(",")[2] ?? "50")  : "50",
    // Sale history
    salePrice: get("saleInfo") ? (get("saleInfo").split("|")[0] ?? "") : "",
    saleYear:  get("saleInfo") ? (get("saleInfo").split("|")[1] ?? "") : "",
    // FEMA
    femaZone:    get("femaZone"),
    // Walk Score
    walkScore:    get("wsData") ? (get("wsData").split("|")[0] ?? "") : get("walkScore"),
    bikeScore:    get("wsData") ? (get("wsData").split("|")[1] ?? "") : get("bikeScore"),
    transitScore: get("wsData") ? (get("wsData").split("|")[2] ?? "") : get("transitScore"),
    walkDesc:     get("wsData") ? (get("wsData").split("|")[3] ?? "") : get("walkDesc"),
    // Crime
    crimeData:     get("crimeData"),
    crimeOverall:  get("crimeOverall"),
    crimeViolent:  get("crimeViolent"),
    crimeProp:     get("crimeProp"),
    crimeRate:     get("crimeRate"),
    crimeViolentRate: get("crimeViolentRate"),
    crimePct:      get("crimePct"),
    // Census
    censusIncome:  get("censusIncome"),
    censusPop:     get("censusPop"),
    censusAge:     get("censusAge"),
    censusRent:    get("censusRent"),
    censusHomeVal: get("censusHomeVal"),
    censusPoverty: get("censusPoverty"),
    censusRenterPct:   get("censusRenterPct"),
    // Race + education
    censusPctBlack:    (get("censusRace") ? get("censusRace").split(",")[0] : null) ?? get("censusPctBlack")    ?? "",
    censusPctHispanic: (get("censusRace") ? get("censusRace").split(",")[1] : null) ?? get("censusPctHispanic") ?? "",
    censusPctWhite:    (get("censusRace") ? get("censusRace").split(",")[2] : null) ?? get("censusPctWhite")    ?? "",
    censusBachPlus:    (get("censusRace") ? get("censusRace").split(",")[3] : null) ?? "",
    // Permits
    permitCount:   get("permitCount") || "0",
    permitSource:  get("permitSource"),
    permitDetails: get("permitDetails") + get("permitDetails2") + get("permitDetails3") + get("permitDetails4"),
    // Schools
    schoolsData:   get("schoolsData"),
    // Proximity
    proximityMiles:   get("proxData") ? (get("proxData").split("|")[0] ?? "") : get("proximityMiles"),
    proximityMinutes: get("proxData") ? (get("proxData").split("|")[1] ?? "") : get("proximityMinutes"),
    proximityCity:    get("proxData") ? (get("proxData").split("|")[2] ?? "") : get("proximityCity"),
    // MSA comparison
    ...(() => {
      const msa = get("msaJ") ? (() => { try { return JSON.parse(get("msaJ")); } catch { return {}; } })() : {};
      return {
        msaName:      msa.n ?? get("msaName"),
        msaIncome:    msa.i ?? get("msaIncome"),
        msaHomeVal:   msa.h ?? get("msaHomeVal"),
        msaRent:      msa.r ?? get("msaRent"),
        msaPoverty:   msa.p ?? get("msaPoverty"),
        msaBachPlus:  msa.b != null ? String(msa.b) : "",
      };
    })(),
    // Census HH
    censusHouseholds:    get("censusHH") ? (get("censusHH").split("|")[0] ?? "") : get("censusHouseholds"),
    censusAvgHHSize:     get("censusHH") ? (get("censusHH").split("|")[1] ?? "") : get("censusAvgHHSize"),
    censusAvgRenterSize: get("censusHH") ? (get("censusHH").split("|")[2] ?? "") : get("censusAvgRenterSize"),
    // HUD
    ...(() => {
      const hud = get("hudJ") ? (() => { try { return JSON.parse(get("hudJ")); } catch { return {}; } })() : {};
      return {
        hudNearbyProps:   hud.p  != null ? String(hud.p)  : get("hudNearbyProps"),
        hudNearbyUnits:   hud.u  != null ? String(hud.u)  : get("hudNearbyUnits"),
        hudSection8Count: hud.s8 != null ? String(hud.s8) : get("hudSection8Count"),
        hudPropNames:     hud.n  != null ? String(hud.n)  : get("hudPropNames"),
      };
    })(),
    // BLS
    blsData: get("blsData"),
    opexOverrides: get("opexOverrides"),
  };
}

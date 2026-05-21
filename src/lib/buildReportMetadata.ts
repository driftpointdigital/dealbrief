/**
 * Build the compact metadata blob that the report-rendering pipeline
 * expects (see /api/generate-pdf/route.ts for the consumer side).
 *
 * The shape is constrained by Stripe's 500-char-per-key / 50-key-per-session
 * metadata limits — pipeline data is packed into delimited strings or
 * compact JSON to fit. The free-report path stores the same shape in
 * Supabase JSONB so a single render path handles both.
 */

function pick(obj: Record<string, unknown>, key: string): string {
  const v = obj?.[key];
  return v != null ? String(v).slice(0, 500) : "";
}

export function buildReportMetadata(
  body: Record<string, unknown>
): Record<string, string> {
  const p = (body._pipeline ?? {}) as Record<string, unknown>;
  const fema    = (p.fema      ?? {}) as Record<string, unknown>;
  const ws      = (p.walkscore ?? {}) as Record<string, unknown>;
  const crime   = (p.crime     ?? {}) as Record<string, unknown>;
  const census  = (p.census    ?? {}) as Record<string, unknown>;
  const permits = (p.permits   ?? {}) as Record<string, unknown>;
  const assessor      = (p.assessor    ?? {}) as Record<string, unknown>;
  const schoolsData   = (p.schools     ?? {}) as Record<string, unknown>;
  const proximityData = (p.proximity   ?? {}) as Record<string, unknown>;
  const msaData       = (p.msa         ?? {}) as Record<string, unknown>;
  const hudData       = (p.hud         ?? {}) as Record<string, unknown>;
  const blsData       = (p.bls         ?? {}) as Record<string, unknown>;

  const metadata: Record<string, string> = {};

  // Form fields. `marketValue` is PA-only (STEB-CLR-rescaled FMV) and
  // was missing from the old checkout route — adding it here means the
  // PA market-value row finally surfaces in delivered reports.
  for (const f of [
    "address","propertyType","yearBuilt","buildingArea","lotSize",
    "units","zoning","assessedValue","marketValue","landValue","improvements","otherValue","lpv","adjustedLpv","assessmentRatio","reappraisalYear",
    "annualTaxes","askingPrice","brokerCapRate","buyerCapRate","occupancy","inPlaceRents",
    "brokerClaims","amortYears","ioPeriod",
  ]) {
    if (body[f]) metadata[f] = String(body[f]).slice(0, 500);
  }
  if (body.rates) metadata.rates = JSON.stringify(body.rates).slice(0, 500);
  if (body.ltvs)  metadata.ltvs  = JSON.stringify(body.ltvs).slice(0, 500);
  // Revenue assumptions — packed as "vacancy,badDebt,otherIncomePct"
  const vac = body.vacancyPct     ? String(body.vacancyPct)     : "5.0";
  const bd  = body.badDebtPct     ? String(body.badDebtPct)     : "1.0";
  const oth = body.otherIncomePct ? String(body.otherIncomePct) : "50";
  metadata.revAssumptions = `${vac},${bd},${oth}`.slice(0, 50);
  if (body.opexOverrides) metadata.opexOverrides = String(body.opexOverrides).slice(0, 100);

  // Geo — FIPS state for class-threshold rate logic (KS/TN/MO/IN)
  const geoData = (p.geo ?? {}) as Record<string, unknown>;
  if (geoData.fipsState) metadata.fipsState = String(geoData.fipsState).slice(0, 4);

  // Pipeline — Assessor extras
  if (assessor.parcelId)    metadata.parcelId       = String(assessor.parcelId).slice(0, 100);
  if (assessor.source)      metadata.assessorSource = String(assessor.source).slice(0, 100);
  if (assessor.taxRate != null)
    metadata.taxRate = String(assessor.taxRate).slice(0, 20);
  if (assessor.taxFeePerUnit)
    metadata.taxFeePerUnit = String(assessor.taxFeePerUnit).slice(0, 20);
  const saleP = assessor.salePrice ? String(assessor.salePrice) : "";
  const saleY = assessor.saleYear  ? String(assessor.saleYear)  : "";
  if (saleP || saleY) metadata.saleInfo = `${saleP}|${saleY}`.slice(0, 100);
  // TX special taxing districts (MUDs, drainage, WCID, etc.) — compact JSON.
  // Each entry: { n: name, t: type, r: ratePct }. Used by the PDF template
  // to render a per-district breakdown under the tax row.
  const txSDs = (assessor.txSpecialDistricts ?? []) as Array<Record<string, unknown>>;
  if (Array.isArray(txSDs) && txSDs.length > 0) {
    const compact = txSDs.slice(0, 8).map(d => ({
      n: String(d.name || "").slice(0, 60),
      t: String(d.type || "").slice(0, 20),
      r: d.ratePct != null ? Number(d.ratePct) : null,
    }));
    metadata.txDistricts = JSON.stringify(compact).slice(0, 490);
  }
  // NV / OH abatement flag — surface so the PDF can render a warning banner
  // about actual tax potentially differing from the rate × value estimate.
  if (assessor.abatementFlag) metadata.abatementFlag = "1";
  // Cap percentage for IN circuit-breaker or NV abatement growth cap (e.g.
  // 0.03 for NV non-owner-occupied). Surfaced for completeness; the
  // frontend renders an explanatory note when present.
  if (assessor.capPct != null)
    metadata.capPct = String(assessor.capPct).slice(0, 10);

  // Pipeline — FEMA
  if (fema.floodZone) metadata.femaZone = String(fema.floodZone).slice(0, 100);

  // Pipeline — Walk Score
  if (ws.walk != null || ws.bike != null || ws.transit != null) {
    metadata.wsData = [
      ws.walk    != null ? String(ws.walk)    : "",
      ws.bike    != null ? String(ws.bike)    : "",
      ws.transit != null ? String(ws.transit) : "",
      ws.walkDescription ? String(ws.walkDescription).slice(0, 80) : "",
    ].join("|");
  }

  // Pipeline — Crime
  if (crime.crimeDataJson) metadata.crimeData = String(crime.crimeDataJson).slice(0, 490);

  // Pipeline — Census
  if (census.medianIncome)    metadata.censusIncome    = pick(census, "medianIncome");
  if (census.population)      metadata.censusPop       = String(census.population);
  if (census.medianAge)       metadata.censusAge       = String(census.medianAge);
  if (census.medianRent)      metadata.censusRent      = pick(census, "medianRent");
  if (census.medianHomeValue) metadata.censusHomeVal   = pick(census, "medianHomeValue");
  if (census.povertyRate)     metadata.censusPoverty   = pick(census, "povertyRate");
  if (census.renterPct)       metadata.censusRenterPct = pick(census, "renterPct");
  if (census.pctBlack || census.pctHispanic || census.pctWhite || census.pctBachelorPlus)
    metadata.censusRace = [
      census.pctBlack        ? String(census.pctBlack)        : "",
      census.pctHispanic     ? String(census.pctHispanic)     : "",
      census.pctWhite        ? String(census.pctWhite)        : "",
      census.pctBachelorPlus ? String(census.pctBachelorPlus) : "",
    ].join(",");

  // Pipeline — Permits
  metadata.permitCount = String(permits.count ?? 0);
  if (permits.source) metadata.permitSource = String(permits.source).slice(0, 100);

  const permitList = (permits.permits ?? []) as Array<Record<string, unknown>>;
  if (permitList.length > 0) {
    const compact = permitList.slice(0, 20).map(pp => ({
      t: String(pp.type || "").slice(0, 25),
      d: String(pp.description || "").slice(0, 50),
      dt: String(pp.fileDate || pp.issueDate || "").slice(0, 10),
      v: pp.jobValue ? Math.round(Number(pp.jobValue)) : null,
    }));
    const fullJson = JSON.stringify(compact);
    metadata.permitDetails  = fullJson.slice(0, 490);
    if (fullJson.length >  490) metadata.permitDetails2 = fullJson.slice( 490,  980);
    if (fullJson.length >  980) metadata.permitDetails3 = fullJson.slice( 980, 1470);
    if (fullJson.length > 1470) metadata.permitDetails4 = fullJson.slice(1470, 1960);
  }

  // Proximity
  if (proximityData.distanceMiles != null || proximityData.driveMinutes != null || proximityData.downtownCity) {
    metadata.proxData = [
      proximityData.distanceMiles != null ? String(proximityData.distanceMiles) : "",
      proximityData.driveMinutes  != null ? String(proximityData.driveMinutes)  : "",
      proximityData.downtownCity  ? String(proximityData.downtownCity).slice(0, 50) : "",
    ].join("|");
  }

  // MSA comparison
  {
    const msaC: Record<string, unknown> = {};
    if (msaData.msaName)           msaC.n  = String(msaData.msaName).slice(0, 80);
    if (msaData.medianIncome)      msaC.i  = String(msaData.medianIncome).slice(0, 20);
    if (msaData.medianHomeValue)   msaC.h  = String(msaData.medianHomeValue).slice(0, 20);
    if (msaData.medianRent)        msaC.r  = String(msaData.medianRent).slice(0, 20);
    if (msaData.povertyRate)       msaC.p  = String(msaData.povertyRate).slice(0, 10);
    if (msaData.pctBachelorPlus != null) msaC.b = String(msaData.pctBachelorPlus).slice(0, 10);
    if (Object.keys(msaC).length > 0) metadata.msaJ = JSON.stringify(msaC).slice(0, 490);
  }

  // Census HH size
  if (census.totalHouseholds || census.avgHouseholdSize || census.avgRenterHouseholdSize) {
    metadata.censusHH = [
      census.totalHouseholds        ? String(census.totalHouseholds)        : "",
      census.avgHouseholdSize       ? String(census.avgHouseholdSize)       : "",
      census.avgRenterHouseholdSize ? String(census.avgRenterHouseholdSize) : "",
    ].join("|");
  }

  // HUD subsidized
  if (hudData.nearbyAssistedProperties != null || hudData.nearbyAssistedUnits != null) {
    const hudC: Record<string, unknown> = {};
    if (hudData.nearbyAssistedProperties != null) hudC.p  = hudData.nearbyAssistedProperties;
    if (hudData.nearbyAssistedUnits != null)      hudC.u  = hudData.nearbyAssistedUnits;
    if (hudData.section8Properties != null)       hudC.s8 = hudData.section8Properties;
    if (Array.isArray(hudData.propertyNames) && hudData.propertyNames.length > 0)
      hudC.n = (hudData.propertyNames as string[]).slice(0, 3).join("; ").slice(0, 150);
    metadata.hudJ = JSON.stringify(hudC).slice(0, 490);
  }

  // BLS employment
  if (blsData.ok) {
    const blsCompact: Record<string, unknown> = {};
    if (blsData.unemploymentRate != null)        blsCompact.ur  = blsData.unemploymentRate;
    if (blsData.nationalUnemploymentRate != null) blsCompact.nat = blsData.nationalUnemploymentRate;
    if (blsData.employment != null)              blsCompact.emp = blsData.employment;
    if (blsData.laborForce != null)              blsCompact.lf  = blsData.laborForce;
    if (blsData.periodLabel)                     blsCompact.per = String(blsData.periodLabel).slice(0, 20);
    if (blsData.countyName)                      blsCompact.co  = String(blsData.countyName).slice(0, 30);
    metadata.blsData = JSON.stringify(blsCompact).slice(0, 490);
  }

  // Schools
  const schoolList = (schoolsData.schools ?? []) as Array<Record<string, unknown>>;
  if (schoolList.length > 0) {
    const compact = schoolList.map(s => ({
      n: String(s.name || "").slice(0, 40),
      l: String(s.level || "").slice(0, 12),
      r: String(s.ratingBand || "").slice(0, 15),
      d: s.distanceMiles != null ? Number(s.distanceMiles).toFixed(1) : null,
    }));
    metadata.schoolsData = JSON.stringify(compact).slice(0, 490);
  }

  return metadata;
}

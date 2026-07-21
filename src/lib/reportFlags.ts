// Curated risk flags — domain-knowledge findings a spreadsheet wouldn't surface
// on its own: tax-reassessment mechanics, abatements, structural-inspection
// mandates, permit-vs-age gaps, flood, and data-quality traps (condo master
// files, missing improvements). Shared by the PDF template AND the live HTML
// mirror so both surfaces show the SAME flags.
//
// Deliberately EXCLUDED because they only restate numbers already visible on
// both surfaces:
//   • Crime letter-grade — shown in the Crime & Safety grade tiles.
//   • DSCR / cash-flow coverage — colour-coded in the debt-service table.
import type { ReportData } from "./pdf-template";
import type { BoeEst } from "./underwriting";
import { parseDol } from "./underwriting";

export interface Flag { level: "red" | "amber" | "green"; title: string; body: string; }

function fmtDol(str: string): string {
  if (!str) return str;
  const n = parseFloat(str.replace(/[$,]/g, ""));
  if (isNaN(n)) return str;
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function computeFlags(data: ReportData, boe: BoeEst | null): Flag[] {
  const flags: Flag[] = [];
  const yr = parseInt(data.yearBuilt) || 0;
  const age = yr > 0 ? new Date().getFullYear() - yr : 0;
  const permitNum = parseInt(data.permitCount) || 0;
  // PA reports raw 1998 base-year assessed (matches broker / tax bill) which is
  // structurally a fraction of FMV. For ratio-vs-ask flags use the STEB-CLR
  // -rescaled market_value when present so we don't trip "significant
  // reassessment risk" on every PA deal.
  const _isPAFlags = /(?:,\s*|\s+)PA\s*,?\s*\d{5}/.test(data.address || "");
  const _avForRatio = _isPAFlags && data.marketValue
    ? parseDol(data.marketValue)
    : parseDol(data.assessedValue);
  const av  = _avForRatio;
  const ask = parseDol(data.askingPrice);

  // Flood zone
  if (data.femaZone && !data.femaZone.includes("Zone X") && !data.femaZone.includes("X")) {
    flags.push({ level: "red", title: `Flood Zone — ${data.femaZone} — Insurance Required`,
      body: `Property falls in FEMA ${data.femaZone}. Flood insurance is required by lenders and will cost $1,500–$5,000+/yr depending on coverage, adding directly to operating expenses.` });
  }

  // Miami-Dade / Broward SB 4-D milestone structural inspection. Florida SB 4-D
  // (signed May 2022 after the Surfside collapse) plus county-level ordinances
  // require buildings to undergo a Milestone Structural Inspection at 30 years
  // from original CO, or 25 years if within 3 miles of the coast, with
  // subsequent inspections every 10 years. We trigger on ZIP prefixes 330-333
  // (Miami-Dade + most of Broward; substantially all of these areas are
  // coastal-adjacent enough that the 25-year threshold is the safe assumption).
  const _flZipMatchSB = (data.address || "").match(/(?:,\s*|\s+)FL\s*,?\s*(\d{5})/);
  const _flZip3SB = _flZipMatchSB?.[1]?.slice(0, 3);
  const _isMiamiBrowardSB = _flZip3SB === "330" || _flZip3SB === "331" || _flZip3SB === "332" || _flZip3SB === "333";
  if (_isMiamiBrowardSB && age >= 25) {
    flags.push({ level: "amber", title: `Milestone Structural Inspection Likely Required (SB 4-D)`,
      body: `Florida SB 4-D (signed May 2022 after the Surfside collapse) plus Miami-Dade and Broward county ordinances require a Milestone Structural Inspection by a Florida licensed engineer or architect at 30 years from original certificate of occupancy, or 25 years if within 3 miles of the coast. Subsequent inspections every 10 years. This ${age}-year-old building is at or past that threshold. Ask the seller for the most recent inspection report (and the Structural Integrity Reserve Study if it's a condominium-form property). Recertification can require $50,000–$500,000+ in concrete restoration, balcony rebuilds, and structural repairs on older coastal buildings.` });
  }

  // Philadelphia tax abatement detection. Philly OPA already nets the abatement
  // out of `annual_taxes`, so if the stated tax is materially below what a
  // full-rate calculation produces (assessed × 1.3998%), an abatement (or other
  // exemption) is almost certainly in effect. For non-homestead investment
  // property, the most common reason is the 10-year residential or commercial
  // abatement on new construction / major rehab. Post-Jan-2022 residential
  // applications phase down 10%/yr; pre-2022 are grandfathered at 100% for the
  // full 10 years; commercial is unaffected by the phase-down.
  const _isPhillyCity = /(?:,\s*)PHILADELPHIA(?:,\s*PA|\s+PA)/i.test(data.address || "");
  if (_isPhillyCity) {
    const _phillyRate = 0.013998;
    const _phillyAssessed = parseDol(data.assessedValue);
    const _phillyTaxes = parseDol(data.annualTaxes);
    if (_phillyAssessed > 0 && _phillyTaxes > 0) {
      const _expectedTax = _phillyAssessed * _phillyRate;
      if (_phillyTaxes < _expectedTax * 0.7) {
        const _exemptPct = Math.round((1 - _phillyTaxes / _expectedTax) * 100);
        const _annualSavings = Math.round(_expectedTax - _phillyTaxes);
        flags.push({
          level: "amber",
          title: `Philadelphia Tax Abatement Likely Active — Year-N Step-Up Risk`,
          body: `Reported annual taxes are roughly ${_exemptPct}% below what a full-rate calculation would produce (${fmtDol(String(Math.round(_expectedTax)))} expected vs. ${fmtDol(data.annualTaxes)} on file), implying an active exemption of ~${fmtDol(String(_annualSavings))}/yr. For non-homestead investment property, the most common cause is Philly's 10-year tax abatement. Abatements run from approval, and RESIDENTIAL applications filed on or after January 1, 2022 (Bill 200366 reform) phase down 10 percentage points per year (100% in year 1, declining to 10% by year 10). Pre-2022 residential applications are grandfathered at 100% for the full 10 years. Commercial applications are not affected by the phase-down. Ask the seller for the abatement type and application date, then model the year-by-year tax step-up across your hold period.`
        });
      }
    }
  }

  // Permit-based flags. Suppress entirely when the permit collector was
  // disabled (source="unavailable") — we didn't check, so we can't flag
  // "no permits = red." Age-based inspection recommendations elsewhere
  // in the report still cover the underlying due diligence guidance.
  const _permitsUnavailable = data.permitSource === "unavailable";
  if (!_permitsUnavailable) {
    if (permitNum === 0 && age === 0) {
      flags.push({ level: "amber", title: "No Permit History — Building Age Unknown",
        body: `Zero building permits on record and building age could not be determined from available data. Major system conditions are unknown. Budget conservatively and do not rely on broker representations about capital improvements without documentation.` });
    } else if (permitNum === 0 && age > 30) {
      flags.push({ level: "red", title: `No Permit History on ${age}-Year-Old Building`,
        body: `Zero building permits on record suggests major systems (roof, HVAC, plumbing, electrical) may be original or replaced without documentation. Budget aggressively for systems replacement and do not rely on broker representations about capital improvements.` });
    } else if (permitNum === 0 && age > 15) {
      flags.push({ level: "amber", title: "No Permit History — Verify Improvements",
        body: `No building permits found. Verify any broker claims about capital improvements during due diligence. Request receipts and warranties.` });
    }
  }

  // ── Condominium / data-lag detection ─────────────────────────────────────
  // The assessor record can be incomplete in two distinct cases that BOTH
  // make the assessed-vs-ask comparison misleading:
  //
  // (1) Condo common element / master file — owner is the HOA, the parcel
  //     carries land only ($0 improvements), and the actual unit being
  //     sold has its own parcel ID that the address didn't resolve to.
  // (2) Recently-built where the county hasn't pushed improvements to the
  //     public record yet — $0 improvements on a structure >1000 SF built
  //     in the last 10 years.
  //
  // In either case, the displayed assessed value is materially below the
  // property's true assessment, so the standard "reassessment risk = av/ask"
  // logic produces a false-alarm flag. We surface a dedicated warning and
  // suppress the reassessment-vs-ask flag below.
  const _ownerStr   = (data.owner || "").toUpperCase();
  const _isCondoMF  = /(?:CON|COM)DOMINIUM(?:\s+(?:ASSOCIATION|COMMUNITY|COMMONS|TRUST))?|MASTER FILE|COMMON ELEMENT|\bHOA\b/.test(_ownerStr);
  const _impVal     = parseDol(data.improvements);
  const _avForCheck = parseDol(data.assessedValue);
  const _baForCheck = parseInt((data.buildingArea || "").replace(/[^\d]/g, ""), 10) || 0;
  const _ybForCheck = parseInt((data.yearBuilt || "").replace(/[^\d]/g, ""), 10) || 0;
  const _curYear    = new Date().getFullYear();
  const _noImpOnExistingBuild =
    _impVal === 0 && _avForCheck > 0 && _baForCheck > 1000 && _ybForCheck >= _curYear - 10;
  const _taxDataIncomplete = _isCondoMF || _noImpOnExistingBuild;
  if (_isCondoMF) {
    flags.push({ level: "red", title: "Condominium Common Element — Wrong Parcel",
      body: `Owner record shows "${data.owner}" — this is the HOA's master / common element parcel, not the individual unit being sold. The assessed value (${fmtDol(data.assessedValue)}) and tax amount (${fmtDol(data.annualTaxes)}) shown reflect only the common area; the actual unit has its own parcel ID at the same street address. Pull the correct unit parcel from the county directly, or confirm the unit-level taxes with the broker, before underwriting.` });
  } else if (_noImpOnExistingBuild) {
    flags.push({ level: "amber", title: "Tax Data Appears Incomplete",
      body: `County record shows $0 improvements on a ${_ybForCheck}-built, ${data.buildingArea} structure. The public assessor record likely hasn't been updated with the building's appraised value yet (common for recent construction in TX). The displayed tax amount (${fmtDol(data.annualTaxes)}) and any tax-adjusted projections are likely materially low — confirm actual taxes with the broker's T-12 or by pulling the bill directly from the county before LOI.` });
  }

  // Assessment vs. ask — skip for LPV states (AZ) where taxes don't reset at purchase
  const _stateM = (data.address || "").match(/(?:,\s*|\s+)([A-Z]{2})\s*,?\s*\d{5}/);
  const _isLpvState = _stateM?.[1] === "AZ";
  const _isNCState  = _stateM?.[1] === "NC";
  const _isFLState  = _stateM?.[1] === "FL";
  const _isPAState  = _stateM?.[1] === "PA";
  // NV Clark investor MF — abatement cap survives the sale, so treat like
  // AZ LPV for the assessment-vs-ask reassessment flag (skip it).
  const _isNVCappedFlag = _stateM?.[1] === "NV" && Boolean(data.abatementFlag);
  // NC: values lock flat until next countywide reappraisal — no mid-cycle reset on sale.
  const _ncTiming   = _isNCState
    ? (data.reappraisalYear ? ` at the next countywide reappraisal (${data.reappraisalYear})` : " at the next countywide reappraisal")
    : " at next cycle";
  const _flJVNote   = _isFLState ? " (FL Just Value resets to ~95% of sale price)" : "";
  const _avForLabel = _isPAState && data.marketValue ? data.marketValue : data.assessedValue;
  const _avLeadIn   = _isPAState && data.marketValue
    ? `Estimated FMV (STEB CLR-rescaled from base-year assessment) is ${fmtDol(_avForLabel)}`
    : `County appraised at ${fmtDol(_avForLabel)}`;
  // PA does NOT reassess on sale — frame the FMV-vs-ask gap as an appeal
  // opportunity instead. Suppress entirely when tax data is incomplete.
  if (av > 0 && ask > 0 && !_isLpvState && !_isNVCappedFlag && !_taxDataIncomplete) {
    const ratio = av / ask;
    const pct = Math.round(ratio * 100);
    if (ratio > 1.0) {
      flags.push({ level: "amber", title: `Assessment Exceeds Ask — ${pct}% of Ask Price`,
        body: `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). You are purchasing below the assessed value. The current tax burden is based on this higher assessment — a property tax consultant may be able to challenge it downward after purchase. Do not assume taxes will increase; they may decrease.` });
    } else if (ratio > 0.90) {
      flags.push({ level: "amber", title: `Assessment Near Ask — ${pct}% of Ask Price`,
        body: _isPAState
          ? `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). PA does not reassess on sale — taxes track the 1998 base-year assessment, not the purchase price — so the tax burden is unlikely to change materially after closing.`
          : `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). Minimal reassessment risk — assessment is already close to purchase price, so the tax burden is unlikely to change materially${_ncTiming}.` });
    } else if (ratio > 0.75) {
      flags.push({ level: "amber", title: _isPAState ? `Tax Appeal Opportunity — Assessed FMV at ${pct}% of Ask` : `Reassessment Risk — Assessed at ${pct}% of Ask`,
        body: _isPAState
          ? `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking. PA does not reassess on sale, so the in-place tax burden is locked. The gap suggests assessment uniformity may be appealable post-closing under PA's "unequal assessment" doctrine — engage a PA property tax counsel.`
          : `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking. A purchase at ask will likely trigger reassessment upward${_ncTiming}${_flJVNote}, increasing annual taxes. Model the delta in your pro forma.` });
    } else {
      flags.push({ level: "amber", title: _isPAState ? `Tax Appeal Opportunity — Assessed FMV at Only ${pct}% of Ask` : `Significant Reassessment Risk — Assessed at Only ${pct}% of Ask`,
        body: _isPAState
          ? `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). PA does not reassess on sale, so taxes will not jump at closing — but the wide gap to ask is grounds to challenge the assessment under PA's uniformity clause. A successful appeal could materially reduce taxes.`
          : `${_avLeadIn} vs. ${fmtDol(data.askingPrice)} asking (${pct}%). A purchase at ask will almost certainly trigger a substantial upward reassessment${_ncTiming}${_flJVNote} — model a meaningful tax increase in your pro forma before LOI.` });
    }
  }

  // Aging infrastructure (if no permit flag already covers it)
  if (age > 45 && !flags.some(f => f.title.includes("Permit"))) {
    flags.push({ level: "amber", title: `Aging Asset — Built ${yr}`,
      body: `${age}-year-old property likely has original cast iron drain lines, pre-modern electrical panels, and aging HVAC. Confirm scope of prior capital work during inspection and reserve accordingly.` });
  }

  return flags;
}

// Palette-agnostic verdict classification. Each renderer maps `level` to its own
// colours (PDF hex vs. on-screen hex) so the thresholds stay single-sourced.
export function dealVerdictLevel(flags: Flag[]): { level: "red" | "amber" | "green"; label: string; desc: string } {
  const reds = flags.filter(f => f.level === "red").length;
  const ambers = flags.filter(f => f.level === "amber").length;
  if (reds >= 2) return { level: "red", label: "SIGNIFICANT RISK — PROCEED WITH CAUTION", desc: "Multiple material risk factors identified. Do not move forward without resolving these issues through due diligence." };
  if (reds === 1 || ambers >= 3) return { level: "red", label: "ELEVATED RISK — CAREFUL DUE DILIGENCE REQUIRED", desc: "Material risk factor(s) present. Verify independently and stress-test assumptions before committing to LOI." };
  if (ambers >= 1) return { level: "amber", label: "MODERATE RISK — STANDARD DUE DILIGENCE APPLIES", desc: "Some risk factors noted. Review flagged items carefully. No automatic deal-killers identified." };
  return { level: "green", label: "ACCEPTABLE RISK PROFILE", desc: "No major red flags identified based on available data. Standard due diligence applies." };
}

// Shared parsers + computed display values for the report's info sections
// (crime, schools, permits). Imported by BOTH the PDF template and the live
// HTML mirror so the two surfaces render IDENTICAL data — the same single-
// source-of-truth rule the financial engine (underwriting.ts) follows.
//
// Presentation (colours, layout) stays in each renderer, since the PDF and the
// HTML panel use different palettes and primitives. Only the parse + any value
// that must MATCH between surfaces (e.g. the vs-national percentage) lives here.

// ── National FBI UCR 2022 rates per 1,000 (hardcoded; matches Python constants) ──
export const NAT_RATES = {
  violent: 3.80, murder: 0.063, robbery: 0.609, assault: 2.743,
  property: 19.54, burglary: 3.14, larceny: 13.46, vehicleTheft: 2.94,
};

// ── permits ──
export interface PermitDetail { t: string; d: string; dt: string; v: number | null; }

export function parsePermits(raw: string): PermitDetail[] {
  try { return JSON.parse(raw) as PermitDetail[]; } catch { return []; }
}

// ── schools ──
export interface SchoolDetail { n: string; l: string; r: string; d: string | null; }

export function parseSchools(raw: string): SchoolDetail[] {
  try { return JSON.parse(raw) as SchoolDetail[]; } catch { return []; }
}

// ── crime ──
export interface ParsedCrime {
  source: string; yearRange: string; population: number; agencyName: string;
  overallGrade: string; violentGrade: string; propertyGrade: string; pct: number | null;
  // CrimeGrade / FBI CDE path
  crateTotal: number | null; crateViolent: number | null;
  // Dallas Open Data path — local rates per 1,000 (annual avg)
  vr: number | null; mr: number | null; rr: number | null; ar: number | null;
  pr: number | null; br: number | null; lr: number | null; vtr: number | null;
}

export function parseCrimeData(raw: string): ParsedCrime | null {
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

// ── BLS local employment ──
export interface ParsedBLS {
  ur: number | null; nat: number | null;
  emp: number | null; lf: number | null;
  per: string; co: string;
}

export function parseBLS(raw: string): ParsedBLS | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return {
      ur: d.ur ?? null,
      nat: d.nat ?? null,
      emp: d.emp ?? null,
      lf: d.lf ?? null,
      per: d.per || "",
      co: d.co || "",
    };
  } catch {
    return null;
  }
}

// Signed percentage vs. the national rate, e.g. "+42%" / "-18%". This is a
// computed value shown on both surfaces, so it lives here (not in a renderer).
export function vsNat(local: number, nat: number): string {
  if (!nat) return "";
  const pct = Math.round((local - nat) / nat * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

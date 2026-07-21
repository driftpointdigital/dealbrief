"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";
import { computeBoe, computeDerivations } from "@/lib/underwriting";
import { buildReportMetadata } from "@/lib/buildReportMetadata";
import { metadataToReportData } from "@/lib/metadataToReportData";
import LiveReport from "@/components/LiveReport";
import AuthGate from "@/components/AuthGate";
import AccountMenu from "@/components/AccountMenu";
import { DEMO_PIPELINE, DEMO_ADDRESS } from "@/lib/demoReport";

// Google Maps Places API key — exposed client-side because the API
// requires it for browser-side autocomplete. SHOULD be HTTP-referrer
// restricted in Google Cloud Console to getdealbrief.com (+ Vercel
// preview URLs + localhost) — otherwise anyone can scrape it from
// our JS bundle and run autocomplete calls on our bill. Different
// key from the server-side pipeline GOOGLE_MAPS_API_KEY.
const GOOGLE_MAPS_PUBLIC_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Maps a "Markets We Cover" label to its blog post slug. Markets with a post
// render as internal links (homepage → post) so Google crawls + values them;
// markets without a post yet stay plain text. Add entries as posts ship.
const MARKET_POST_SLUG: Record<string, string> = {
  "Dallas-Ft. Worth, TX": "buying-multifamily-dallas-fort-worth",
  "Houston, TX": "buying-multifamily-houston",
  "Phoenix, AZ": "buying-multifamily-phoenix",
  "Charlotte, NC": "buying-multifamily-charlotte",
  "Raleigh-Durham, NC": "buying-multifamily-raleigh",
  "Atlanta, GA": "buying-multifamily-atlanta",
  "Louisville / Lexington, KY": "buying-multifamily-louisville",
  "Tampa, FL": "buying-multifamily-tampa",
  "Orlando, FL": "buying-multifamily-orlando",
  "Jacksonville, FL": "buying-multifamily-jacksonville",
  "Miami – Fort Lauderdale – West Palm, FL": "buying-multifamily-miami",
  "Philadelphia, PA": "buying-multifamily-philadelphia",
  "San Antonio, TX": "buying-multifamily-san-antonio",
  "Austin, TX": "buying-multifamily-austin",
  "El Paso, TX": "buying-multifamily-el-paso",
  "Oklahoma City, OK": "buying-multifamily-oklahoma-city",
  "Tulsa, OK": "buying-multifamily-tulsa",
  "Denver, CO": "buying-multifamily-denver",
  "Las Vegas, NV": "buying-multifamily-las-vegas",
  "Nashville, TN": "buying-multifamily-nashville",
  "Memphis, TN-MS": "buying-multifamily-memphis",
  "Columbus, OH": "buying-multifamily-columbus",
  "Cleveland / Akron, OH": "buying-multifamily-cleveland",
  "Cincinnati, OH-KY": "buying-multifamily-cincinnati",
  "Toledo, OH": "buying-multifamily-toledo",
  "Dayton, OH": "buying-multifamily-dayton",
  "Kansas City, MO-KS": "buying-multifamily-kansas-city",
  "St. Louis, MO": "buying-multifamily-st-louis",
  "Indianapolis, IN": "buying-multifamily-indianapolis",
};

const MOCK_RETURN_DATA = {
  address: "2718 Cleveland St, Dallas, TX 75215",
  yearBuilt: "1961",
  buildingArea: "8,000 SF",
  lotSize: "0.29 AC",
  units: "8",
  unitMix: "4x 3BR/1BA, 4x 4BR/1BA",
  zoning: "MF-2",
  assessedValue: "$925,000",
  marketValue: "",
  landValue: "$125,000",
  improvementValue: "$800,000",
  otherValue: "",
  lpv: "",
  adjustedLpv: "",
  assessmentRatio: "",
  reappraisalYear: "",
  annualTaxes: "$21,000",
  taxRate: "2.20%",
  taxFeePerUnit: "",
  femaFloodZone: "Zone X",
  walkScore: "72",
  bikeScore: "54",
  crimeGrade: "D-",
  crimeRate: "48.82 per 1,000",
  medianHHIncome: "$41,388",
  population: "18,806",
  medianAge: "37.2",
  medianHomeValue: "$137,700",
  medianRent: "$1,276",
};

const LOADING_STEPS = [
  "Geocoding address",
  "Pulling tax assessment",
  "Checking FEMA flood zone",
  "Loading Census demographics",
  "Querying crime data",
  "Checking school ratings",
  "Pulling permit history",
  "Looking up HUD properties",
  "Estimating walk score",
  "Analyzing employment data",
  "Building your report",
];

function LoadingSequence() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "140px 24px 80px", textAlign: "left" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ height: 2, background: "#E5E7EB", borderRadius: 1, overflow: "hidden" }}>
          <div style={{
            height: 2, background: "#1D3557", borderRadius: 1,
            width: `${((step + 1) / LOADING_STEPS.length) * 100}%`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
      <div style={{ minHeight: 140 }}>
        {LOADING_STEPS.map((label, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "7px 0",
            opacity: i <= step ? 1 : 0.25,
            transition: "opacity 0.3s ease",
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
              background: i < step ? "#1D3557" : i === step ? "transparent" : "#E5E7EB",
              border: i === step ? "2px solid #1D3557" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.3s ease",
            }}>
              {i < step && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.2 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 14, color: i <= step ? "#1D3557" : "#A0A4AB", fontWeight: i === step ? 500 : 400, letterSpacing: "-0.1px" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({ top: r.top + window.scrollY, left: r.left + r.width / 2 });
    }
    setVisible(true);
  };

  const portal = visible && typeof document !== "undefined"
    ? createPortal(
        <span style={{
          position: "absolute",
          top: coords.top - 8,
          left: coords.left,
          transform: "translate(-50%, -100%)",
          background: "#1D3557",
          color: "white",
          fontSize: 12,
          lineHeight: 1.5,
          padding: "8px 12px",
          borderRadius: 6,
          width: 240,
          whiteSpace: "normal",
          pointerEvents: "none",
          zIndex: 9999,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {text}
          <span style={{
            position: "absolute",
            top: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderWidth: 5, borderStyle: "solid",
            borderColor: "#1D3557 transparent transparent transparent",
            display: "block", width: 0, height: 0,
          }} />
        </span>,
        document.body
      )
    : null;

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", marginLeft: 6, flexShrink: 0 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      <span ref={triggerRef} style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 15, height: 15, borderRadius: "50%",
        background: visible ? "#D1D5DB" : "#E5E7EB", color: "#6B7280",
        fontSize: 10, fontWeight: 700, cursor: "default",
        userSelect: "none", lineHeight: 1,
        transition: "background 0.12s",
      }}>
        ?
      </span>
      {portal}
    </span>
  );
}

function FieldRow({ label, name, value, placeholder, editable = true, tooltip, onChange, highlight }: { label: string; name?: string; value?: string; placeholder?: string; editable?: boolean; tooltip?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; highlight?: boolean }) {
  // Declarative focus state so a reactive `highlight` (required-but-empty) can
  // coexist with focus styling without imperative style conflicts.
  const [focused, setFocused] = useState(false);
  // When the label wraps to two lines (e.g. "Limited Property Value (LPV)"),
  // we want the tooltip "?" glyph to wrap along with the last word so it
  // stays attached to the label — otherwise it visually hangs off the right
  // edge of the label column next to the value. We split the label and wrap
  // {lastWord + Tooltip} in a nowrap span that breaks as a unit.
  const parts = label.split(" ");
  const lastWord = parts.length > 0 ? parts[parts.length - 1] : label;
  const leading  = parts.slice(0, -1).join(" ");
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "0 24px", height: 44,
      borderBottom: "1px solid #F3F4F6",
    }}>
      <span style={{ width: 180, fontSize: 13, color: "#6B7280", flexShrink: 0, letterSpacing: "-0.1px", lineHeight: 1.25 }}>
        {tooltip ? (
          <>
            {leading ? leading + " " : ""}
            <span style={{ whiteSpace: "nowrap" }}>
              {lastWord}
              <Tooltip text={tooltip} />
            </span>
          </>
        ) : label}
      </span>
      {editable ? (
        <input
          type="text"
          name={name}
          defaultValue={value || ""}
          placeholder={placeholder || ""}
          // "off" is the standard; Chrome ignores it for some fields it
          // heuristically classifies as address-like. "new-password" is
          // the most reliable Chrome bypass. The data-* attributes hint
          // password managers (Dashlane, LastPass, 1Password) to skip.
          autoComplete="new-password"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          aria-autocomplete="none"
          style={{
            flex: 1, padding: "0 8px", height: 32, fontSize: 14, color: "#111827",
            border: focused ? "1px solid #1D3557" : highlight ? "1.5px solid #F59E0B" : "1px solid transparent",
            borderRadius: 4,
            background: focused ? "#FAFAFA" : highlight ? "#FFFBEB" : "transparent",
            fontFamily: "inherit",
            transition: "all 0.12s",
            outline: "none",
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={onChange}
        />
      ) : (
        <span style={{ fontSize: 14, color: "#111827" }}>{value}</span>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", borderRadius: 8, border: "1px solid #E5E7EB",
      marginBottom: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "10px 24px", borderBottom: "1px solid #E5E7EB" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.8px", textTransform: "uppercase" }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ marginLeft: 10, fontSize: 11, fontStyle: "italic", color: "#9CA3AF", letterSpacing: "0" }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// Maps a raw /api/pipeline response into the form's `data` shape. Shared by the
// live run (go) and the pre-canned demo so both produce identical state.
function pipelineToData(pipeline: Record<string, unknown>, addr: string) {
  const a = (pipeline.assessor ?? {}) as Record<string, unknown>;
  const geo = (pipeline.geo ?? {}) as Record<string, unknown>;
  const geoAddr = (geo.formattedAddress as string) || addr;
  const userRangeMatch = addr.match(/^(\d+-\d+)\b/);
  const geoNumMatch = geoAddr.match(/^(\d+)\b/);
  const displayAddr = userRangeMatch && geoNumMatch
    ? geoAddr.replace(geoNumMatch[1], userRangeMatch[1])
    : geoAddr;
  const p = pipeline as Record<string, Record<string, unknown> | undefined>;
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    address: displayAddr,
    yearBuilt:    s(a.yearBuilt),
    buildingArea: s(a.buildingArea),
    lotSize:      s(a.lotSize),
    units:        s(a.units),
    unitMix:      "",
    zoning:       s(a.zoning),
    assessedValue:    s(a.assessedValue),
    marketValue:      s(a.marketValue),
    landValue:        s(a.landValue),
    improvementValue: s(a.improvements),
    otherValue:       s(a.otherValue),
    lpv:              s(a.lpv),
    adjustedLpv:      s(a.adjustedLpv),
    assessmentRatio:  typeof a.assessmentRatio === "number" ? String(a.assessmentRatio) : s(a.assessmentRatio),
    reappraisalYear:  s(a.reappraisalYear),
    annualTaxes:      s(a.annualTaxes),
    taxRate:          s(a.taxRate),
    taxFeePerUnit:    a.taxFeePerUnit != null ? String(a.taxFeePerUnit) : "",
    fipsState:        s(geo.fipsState),
    femaFloodZone:    s(p.fema?.floodZone),
    walkScore:        s(p.walkscore?.walk),
    bikeScore:        s(p.walkscore?.bike),
    crimeGrade:       s(p.crime?.overallGrade),
    crimeRate:        p.crime?.ratePerThousand ? `${p.crime.ratePerThousand} per 1,000` : "",
    medianHHIncome:   s(p.census?.medianIncome),
    population:       s(p.census?.population),
    medianAge:        s(p.census?.medianAge),
    medianHomeValue:  s(p.census?.medianHomeValue),
    medianRent:       s(p.census?.medianRent),
    _pipeline: pipeline,
  } as typeof MOCK_RETURN_DATA & { _pipeline?: unknown };
}

export default function DealBrief() {
  const [view, setView] = useState("landing");
  // True when we've just returned from Stripe subscription checkout (?subscribed=1)
  // — the gate then polls for the subscription to sync before unlocking.
  const [justSubscribed, setJustSubscribed] = useState(false);
  // Demo seed: the pre-canned sample pre-fills price (units handled via unitsEdit).
  const [priceSeed, setPriceSeed] = useState("");
  const [priceKey, setPriceKey] = useState(0);
  const [address, setAddress] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestVal, setSuggestVal] = useState("");
  const [suggestEmail, setSuggestEmail] = useState("");
  const [suggestDone, setSuggestDone] = useState(false);
  const [data, setData] = useState<typeof MOCK_RETURN_DATA & { _pipeline?: unknown } | null>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const [selectedRates, setSelectedRates] = useState(["8.5", "7.5", "6.5", "5.0"]);
  const [selectedLtvs, setSelectedLtvs] = useState(["75", "50"]);
  const [amortYears, setAmortYears] = useState("30");
  const [ioPeriod, setIoPeriod] = useState("0");
  const [vacancyPct, setVacancyPct] = useState("5.0");
  const [badDebtPct, setBadDebtPct] = useState("1.0");
  const [otherIncomePct, setOtherIncomePct] = useState("50");
  const [insurancePerUnit, setInsurancePerUnit] = useState("800");
  const [maintenancePerUnit, setMaintenancePerUnit] = useState("750");
  const [utilitiesPerUnit, setUtilitiesPerUnit] = useState("250");
  const [managementPct, setManagementPct] = useState("3.0");
  const [marketingPerUnit, setMarketingPerUnit] = useState("150");
  const [adminPerUnit, setAdminPerUnit] = useState("100");
  const [reservesPerUnit, setReservesPerUnit] = useState("400");
  const [payrollPerUnit, setPayrollPerUnit] = useState("1000");
  const [propertyType, setPropertyType] = useState("Multifamily");
  const [unitsKey, setUnitsKey] = useState(0);
  // Same remount trick as unitsKey — Tax Rate FieldRow uses `defaultValue`
  // (uncontrolled input), so programmatic changes to `taxRateEdit` from the
  // TN/KS/MO/IN class-scale useEffect below don't reach the DOM. Bump this
  // key whenever the class-scale flips the rate, forcing a remount so the
  // input re-reads its `value` prop.
  const [rateKey, setRateKey] = useState(0);
  const [pipelineError, setPipelineError] = useState("");
  const [assessorNote, setAssessorNote]   = useState("");

  // Mobile-detect for conditionally rendering a compact preview strip
  // above the address input on phone-sized screens. `mounted` guards
  // against SSR hydration mismatch — the mobile-only UI only paints
  // after first client render, so server-rendered HTML always matches
  // the initial client paint (desktop layout).
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Google Places autocomplete on the address input. Loaded lazily via
  // a <Script> tag below — when the API is ready, `placesReady` flips
  // to true and the useEffect below attaches the autocomplete widget
  // to the input ref. If the API key is missing or the script fails,
  // the input still works as a plain text field (graceful degradation).
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 50);
    // Read ?dev=KEY from URL — enables the dev bypass button
    if (typeof window !== "undefined") {
      // Returning from Stripe subscription checkout — restore the report we
      // stashed before the redirect and drop back onto the gate, which
      // auto-unlocks once the subscription webhook syncs.
      if (new URLSearchParams(window.location.search).get("subscribed") === "1") {
        sendGAEvent("event", "subscribe_complete", {});
        const w = window as unknown as { rdt?: (...args: unknown[]) => void };
        if (typeof w.rdt === "function") w.rdt("track", "Purchase");
        const saved = sessionStorage.getItem("db_pending_report");
        if (saved) {
          try {
            setData(JSON.parse(saved) as typeof MOCK_RETURN_DATA & { _pipeline?: unknown });
            setJustSubscribed(true);
            setView("gate");
          } catch { /* ignore malformed stash */ }
          sessionStorage.removeItem("db_pending_report");
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    // Mobile detection — 640px breakpoint matches typical "phone" cutoff
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    setMounted(true);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Attach Google Places Autocomplete to the address input once both
  // (a) the Maps JS API has loaded AND (b) the input element exists.
  // The widget mutates the input value as the user picks suggestions —
  // we listen for the `place_changed` event and sync that value back
  // into React's `address` state so the rest of the flow stays in sync.
  useEffect(() => {
    if (!placesReady) return;
    if (!addressInputRef.current) return;
    if (typeof window === "undefined") return;
    // Cast through unknown so we don't have to vendor @types/google.maps
    // for this single integration point. The shape we use is stable
    // across legacy Autocomplete and the current Places library.
    const g = (window as unknown as {
      google?: {
        maps?: {
          LatLng: new (lat: number, lng: number) => unknown;
          LatLngBounds: new (sw: unknown, ne: unknown) => unknown;
          places?: {
            Autocomplete: new (
              input: HTMLInputElement,
              opts: Record<string, unknown>,
            ) => {
              addListener: (event: string, callback: () => void) => void;
              getPlace: () => { formatted_address?: string };
            };
          };
        };
      };
    }).google;
    if (!g?.maps?.places?.Autocomplete) return;
    // Bias suggestions toward the continental US. Without this, Google
    // defaults to the user's geo-detected location — so a New York
    // visitor typing "2718" gets 5 Brooklyn suggestions, which is bad UX
    // for a tool whose audience is multi-market multifamily buyers. The
    // bounds cover ~all of continental US (Pacific NW to Florida); we
    // still keep `componentRestrictions: us` as a hard country filter.
    const usBounds = new g.maps.LatLngBounds(
      new g.maps.LatLng(24.5, -125.0),  // SW corner — southern Texas / Pacific
      new g.maps.LatLng(49.5, -66.5),   // NE corner — northern Maine
    );
    const autocomplete = new g.maps.places.Autocomplete(addressInputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address"],
      bounds: usBounds,
      // strictBounds: false (default) — bias toward inside the box but
      // still allow results outside if the user's typed query points
      // unambiguously elsewhere.
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        // Keep React's controlled-input state in sync with the DOM value
        // that Places just mutated. go() reads input.value directly so it
        // doesn't depend on this state update, but the controlled <input>
        // would snap back to typed text on next render without this.
        setAddress(place.formatted_address);
      }
    });
    // No standard cleanup on the listener handle from the legacy
    // Autocomplete API — letting it sit is harmless since the input
    // unmounts when the user leaves the landing view.
    return () => {
      // Suppress unused-listener warning while still satisfying React's
      // expectation that effects return a cleanup function.
      void listener;
    };
  }, [placesReady]);


  // Controlled state for land/improvement/other inputs so assessed value can be derived as their sum
  const [landEdit, setLandEdit] = useState("");
  const [imprEdit, setImprEdit] = useState("");
  const [otherEdit, setOtherEdit] = useState("");
  // Controlled state for units + tax rate so Annual Taxes reacts live when a
  // per-unit fee applies (e.g. Charlotte multifamily solid-waste fee).
  const [unitsEdit, setUnitsEdit] = useState("");
  // Bumped on every form edit to re-run the live results memo below.
  const [formTick, setFormTick] = useState(0);
  const [taxRateEdit, setTaxRateEdit] = useState("");
  // Pro-forma (reassessment) tax rate — drives the tax-adjusted scenario only.
  const [proFormaTaxRateEdit, setProFormaTaxRateEdit] = useState("");

  // Sync to pipeline data whenever a new address result arrives
  useEffect(() => {
    setLandEdit(data?.landValue || "");
    setImprEdit(data?.improvementValue || "");
    setOtherEdit(data?.otherValue || "");
  }, [data?.landValue, data?.improvementValue, data?.otherValue]);
  useEffect(() => {
    setUnitsEdit(data?.units || "");
    setTaxRateEdit(data?.taxRate || "");
  }, [data?.units, data?.taxRate]);

  // KS/TN/MO/IN class-threshold rate adjustment. These four states have
  // split assessment ratios where 5+ unit apartments are commercial and
  // 1-4 unit residential rentals get a materially lower effective rate:
  //   KS:  11.5% / 25%       (1-4 / 5+ ratio)  → 0.46× factor
  //   TN:  25% / 40%                            → 0.625×
  //   MO:  19% / 32%                            → 0.59375×
  //   IN:  2% / 3% circuit-breaker cap          → 0.6667×
  // Backend defaults `taxRate` to the COMMERCIAL MF rate (5+ unit). When
  // user edits units to 1-4, re-scale the displayed rate to residential.
  // When they edit back to 5+, restore the original commercial rate.
  const _CLASS_RATIO_FACTOR: Record<string, number> = {
    "20": 0.115 / 0.25,    // Kansas
    "47": 0.25 / 0.40,     // Tennessee
    "29": 0.19 / 0.32,     // Missouri
    "18": 2 / 3,           // Indiana circuit-breaker cap (2% / 3%)
  };
  useEffect(() => {
    // Type-cast since we're stitching a new field onto MOCK_RETURN_DATA.
    const fips = (data as unknown as { fipsState?: string })?.fipsState || "";
    const factor = _CLASS_RATIO_FACTOR[fips];
    const commercialRate = data?.taxRate || "";  // backend's commercial-MF default
    if (!factor || !commercialRate) return;
    const units = _parseInt(unitsEdit);
    if (!units) return;
    const commRateNum = _parsePct(commercialRate);
    if (!commRateNum) return;
    const targetRate =
      units < 5 ? commRateNum * factor : commRateNum;
    const targetStr = `${(targetRate * 100).toFixed(2)}%`;
    if (taxRateEdit !== targetStr) {
      setTaxRateEdit(targetStr);
      // Force the Tax Rate input to remount so its defaultValue reads the
      // new class-scaled rate. Without this the DOM value stays stuck on
      // the initial commercial-MF rate and downstream reassessed-tax calc
      // uses the wrong rate on submit.
      setRateKey(k => k + 1);
    }
    // Intentionally NOT depending on taxRateEdit — we want one-way
    // sync from units → rate, not the inverse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsEdit, data?.taxRate, data]);

  // Derive assessed value as sum of land + improvements + misc features.
  // Misc features only contributes when present; jurisdictions without a
  // misc bucket (TX, GA, AZ, etc.) leave otherEdit empty → no-op.
  function _parseDol(s: string): number {
    return parseFloat((s || "").replace(/[$,\s]/g, "")) || 0;
  }
  function _parsePct(s: string): number {
    return (parseFloat((s || "").replace(/[%\s]/g, "")) || 0) / 100;
  }
  function _parseInt(s: string): number {
    return parseInt((s || "").replace(/[,\s]/g, ""), 10) || 0;
  }
  const summedAssessed = (() => {
    const total = _parseDol(landEdit) + _parseDol(imprEdit) + _parseDol(otherEdit);
    return total > 0 ? `$${total.toLocaleString()}` : (data?.assessedValue || "");
  })();
  // Show the Misc Features row only when the pipeline surfaced a non-zero
  // value for this parcel (NC parcels, some FL XFOB cases).
  const showMiscFeatures = _parseDol(data?.otherValue || "") > 0;
  // Per-unit annual fee (e.g. Charlotte multifamily solid waste ~$130/unit).
  // When present, Annual Taxes is computed live:
  //   assessed × rate + units × feePerUnit
  const taxFeePerUnit = parseFloat(data?.taxFeePerUnit || "") || 0;
  const hasPerUnitFee = taxFeePerUnit > 0;
  // Annual Taxes: computed live from Appraised × Rate (+ per-unit fee where
  // applicable). Keeps the trio consistent when the user changes units on a
  // TN parcel (rate scales down 40% → 25% class, so taxes should scale too),
  // when Land / Improvements are edited, or when Tax Rate is edited directly.
  const computedAnnualTaxes = (() => {
    const assessed = _parseDol(summedAssessed);
    const rateStr = taxRateEdit || data?.taxRate || "";
    const rate = _parsePct(rateStr);
    if (!assessed || !rate) return "";
    const units = _parseInt(unitsEdit);
    const perUnit = hasPerUnitFee ? units * taxFeePerUnit : 0;
    const total = Math.round(assessed * rate + perUnit);
    return total > 0 ? `$${total.toLocaleString()}` : "";
  })();
  const formRef = useRef<HTMLFormElement>(null);
  // GA funnel: tracks whether `ra_first_edit` has been fired for the
  // current R&A session, so we only count the "user actually engaged
  // with the form" event ONCE per session (rather than once per
  // keystroke). Reset whenever the view leaves R&A (back to landing).
  const raFirstEditFiredRef = useRef(false);
  useEffect(() => {
    if (view !== "confirm") raFirstEditFiredRef.current = false;
  }, [view]);

  // Assemble the request body from the form + controlled assumption state.
  // Used by BOTH handleGenerate (server request) and the live results panel
  // (client-side preview) so the on-screen numbers match the generated PDF.
  const buildBody = (fd: FormData): Record<string, unknown> => {
    const body: Record<string, unknown> = {};
    fd.forEach((val, key) => { body[key] = val; });
    body.rates = selectedRates;
    body.ltvs = selectedLtvs;
    body.amortYears = amortYears;
    body.ioPeriod = ioPeriod;
    body.vacancyPct = vacancyPct;
    body.badDebtPct = badDebtPct;
    body.otherIncomePct = otherIncomePct;
    body.opexOverrides = [insurancePerUnit, maintenancePerUnit, utilitiesPerUnit, managementPct, marketingPerUnit, adminPerUnit, reservesPerUnit, payrollPerUnit].join(",");
    if (data?._pipeline) body._pipeline = data._pipeline;
    // In-place taxes track the reactive Appraised × Tax Rate computation when
    // available, so editing Tax Rate updates Current Taxes (not just the
    // reassessed line). Read the computed value directly rather than the hidden
    // input, which lags by one commit.
    if (computedAnnualTaxes) body.annualTaxes = computedAnnualTaxes;
    return body;
  };

  // Live results — recomputed on every form edit (formTick) and on any
  // controlled-assumption change. Routes through the SAME path as the
  // generated PDF (buildReportMetadata → metadataToReportData → computeBoe/
  // computeDerivations) so the on-screen numbers are guaranteed identical to
  // the delivered report. Returns null until the form + pipeline data exist.
  const liveResults = useMemo(() => {
    if (!formRef.current || !data) return null;
    try {
      const body = buildBody(new FormData(formRef.current));
      const rd   = metadataToReportData(buildReportMetadata(body));
      const boe  = computeBoe(rd);
      const deriv = computeDerivations(rd, boe);
      return { rd, boe, deriv };
    } catch {
      return null;
    }
    // formRef/buildBody are stable within a render; formTick + the assumption
    // states below are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formTick, data, summedAssessed, unitsEdit, propertyType,
    selectedRates, selectedLtvs, amortYears, ioPeriod,
    vacancyPct, badDebtPct, otherIncomePct,
    insurancePerUnit, maintenancePerUnit, utilitiesPerUnit, managementPct,
    marketingPerUnit, adminPerUnit, reservesPerUnit, payrollPerUnit,
  ]);

  // Seed the live memo once the form is actually mounted (refs populate after
  // commit) and whenever a fresh address loads — so the report pane renders
  // immediately instead of waiting for the user's first edit.
  useEffect(() => {
    if (view === "confirm" && data) setFormTick(t => t + 1);
    // propertyType is a controlled <select> — FormData lags its value by one
    // commit, so bump the tick post-commit to re-read it fresh into the panel.
  }, [view, data, propertyType, unitsEdit, taxRateEdit, proFormaTaxRateEdit]);

  // Required-but-empty highlight for the two must-fill inputs. Derived from the
  // live model so the amber cue clears the instant a valid value lands.
  const priceFilled = (liveResults?.deriv?.askNum ?? 0) > 0;
  const unitsFilled = (parseInt(liveResults?.rd?.units || "0", 10) || 0) > 0;


  const go = async (overrideAddress?: string) => {
    // Source-of-truth precedence for the address we submit:
    //   1. Explicit override (rarely used; place_changed listener path).
    //   2. Input element's current DOM value. Google Places mutates the
    //      input value SYNCHRONOUSLY in its own keydown handler when the
    //      user picks a suggestion via arrow+Enter or click. That handler
    //      runs before React's onKeyDown, so by the time we get here the
    //      DOM already reflects the resolved formatted_address. React's
    //      `address` state lags by one tick because setAddress hasn't
    //      flushed yet.
    //   3. React state, as a final fallback (e.g. SSR or programmatic).
    const addr = (
      overrideAddress
      ?? addressInputRef.current?.value
      ?? address
    ).trim();
    if (!addr) return;
    setPipelineError("");
    setAssessorNote("");
    // GA funnel — visitor intends to research this address. Fires regardless
    // of whether the pipeline ultimately succeeds, so the count = "how many
    // landing visitors submitted an address" (the top of our conversion
    // funnel). `address_length` is a coarse signal for whether they typed
    // something realistic vs a single word; never sends the address itself
    // (PII concerns).
    sendGAEvent("event", "run_brief_click", {
      address_length: addr.length,
    });
    setView("loading");
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const pipeline = await res.json();
      if (!res.ok || pipeline.error) {
        sendGAEvent("event", "pipeline_error", {
          status: res.status,
          error_kind: "api_error",
        });
        setPipelineError(pipeline.error || `Server error ${res.status}. Please try again.`);
        setView("landing");
        return;
      }
      const a = pipeline.assessor ?? {};
      const pipelineData = pipeline;
      // Surface assessor errors (e.g. "no buildable parcel found at this address
      // — may be new construction") as a notice on the Tax Assessment card so
      // the user understands why the fields are blank and knows to enter values
      // manually. Only show when the lookup actually failed (no assessed value).
      const aErrs: string[] = Array.isArray(a.errors) ? a.errors : [];
      // Show the yellow banner for either (a) a failed lookup with no values,
      // or (b) an informational advisory that fires even when values populate
      // — e.g. Jackson MO's "values reflect the 2024 tax roll" stale-data
      // note, TIF/abatement warnings, etc. Prefer the advisory over the raw
      // first error when values populated, so the user sees the "here's
      // what to double-check" message rather than a generic status line.
      const ADVISORY_PATTERNS = [
        /reflect the .* tax roll/i,
        /tyler iasworld/i,
        /may be outdated/i,
        /publicaccess\./i,
        /active exemption|abatement/i,
        /full ad-valorem/i,
        /TIF/i,
      ];
      const advisory = aErrs.find(e => ADVISORY_PATTERNS.some(p => p.test(String(e))));
      if (advisory) {
        setAssessorNote(String(advisory).replace(/^[A-Za-z]+:\s*/, ""));
      } else if (!a.assessedValue && aErrs.length > 0) {
        const msg = String(aErrs[0]).replace(/^[A-Za-z]+:\s*/, "");
        setAssessorNote(msg);
      } else {
        setAssessorNote("");
      }
      // Prefer the geocoded formatted address for proper commas/casing, but restore
      // hyphenated range prefixes (e.g. "2429-2431") that the geocoder drops.
      setData(pipelineToData(pipeline, addr));
      // Auto-set OpEx defaults from year built
      // Unknown/missing year defaults to conservative middle estimates
      const yrStr = a.yearBuilt || "";
      const yr = parseInt(yrStr) || 0;
      setMaintenancePerUnit(yr >= 2000 ? "500" : yr >= 1980 ? "750" : yr > 0 ? "1000" : "750");
      setReservesPerUnit(yr >= 2000 ? "250" : yr >= 1980 ? "400" : yr > 0 ? "500" : "400");
      // GA funnel — user successfully reached the R&A page. `state` is the
      // 2-letter geo state from the geocoder when known; helps see which
      // markets convert at the address-submit stage.
      sendGAEvent("event", "pipeline_success", {
        has_assessed_value: Boolean(a.assessedValue),
        state: pipelineData?.geo?.state || "",
      });
      // Reddit Ads pixel — fire Lead conversion at Pipeline Success. This is
      // mid-funnel (address submitted + valid parcel returned), NOT end of
      // funnel. We fire early to give Reddit's optimizer enough signal
      // volume to actually learn (~1-5 events/wk vs. 0 end-of-funnel today).
      // Once end-of-funnel conversions exceed ~30/wk we should move Lead
      // back to Stripe redirect and add Purchase on payment success.
      if (typeof window !== "undefined") {
        const w = window as unknown as { rdt?: (...args: unknown[]) => void };
        if (typeof w.rdt === "function") {
          w.rdt("track", "Lead");
        }
      }
      // Pipeline done → the gate (sign up for the free run / log in / subscribe).
      setView("gate");
    } catch (err) {
      sendGAEvent("event", "pipeline_error", {
        error_kind: "network",
        error_msg: err instanceof Error ? err.message.slice(0, 60) : "unknown",
      });
      setPipelineError(err instanceof Error ? err.message : "Unable to reach the server. Please try again.");
      setView("landing");
    }
  };

  // Live demo — loads a PRE-CANNED sample report instantly (no pipeline call,
  // no loading screen), pre-seeded with units + price, straight to R&A. Skips
  // the gate and the meter. Wired to the landing screenshots + "See a live
  // sample" button.
  const runDemo = () => {
    setAssessorNote("");
    setPipelineError("");
    setData({ ...pipelineToData(DEMO_PIPELINE, DEMO_ADDRESS), units: "12" });
    setPropertyType("Multifamily");
    setUnitsEdit("12");
    setUnitsKey((k) => k + 1);
    setPriceSeed("1,399,000");
    setPriceKey((k) => k + 1);
    // OpEx defaults from the 1956 build (mirrors the live-run logic).
    setMaintenancePerUnit("1000");
    setReservesPerUnit("500");
    sendGAEvent("event", "sample_demo_run", { address: "barnett_jacksonville" });
    setView("confirm");
  };

  const submitSuggest = () => {
    if (!suggestVal.trim()) return;
    const market = suggestVal.trim();
    const email  = suggestEmail.trim();
    setSuggestDone(true);
    setSuggestVal("");
    setSuggestEmail("");
    setTimeout(() => { setSuggestDone(false); setSuggestOpen(false); }, 2500);
    // Fire-and-forget — don't block UI on Airtable response
    fetch("/api/suggest-market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market, email }),
    }).catch(() => { /* silently ignore network errors */ });
  };

  if (view === "gate") return (
    <AuthGate
      address={data?.address || address}
      reportData={data}
      justSubscribed={justSubscribed}
      onUnlocked={() => setView("confirm")}
      onBack={() => { setView("landing"); setData(null); setJustSubscribed(false); }}
    />
  );

  if (view === "loading") return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <LoadingSequence />
    </div>
  );

  if (view === "confirm" && data) return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      
      {/* Top bar */}
      <div className="db-no-print" style={{ padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px", cursor: "pointer" }}
          onClick={() => { window.location.href = "/"; }}>
          DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <AccountMenu />
          <button onClick={() => { setView("landing"); setData(null); }}
            style={{ background: "none", border: "none", fontSize: 13, color: "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
            ← New search
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!liveResults}
            style={{
              padding: "9px 18px", fontSize: 13, fontWeight: 600,
              background: "#1D3557", color: "white",
              border: "none", borderRadius: 6, cursor: !liveResults ? "default" : "pointer",
              fontFamily: "inherit", letterSpacing: "-0.1px",
            }}>
            {"Generate PDF"}
          </button>
        </div>
      </div>

      <form
        key={data.address}
        ref={formRef}
        autoComplete="off"
        // GA funnel — fires ONCE per R&A session when the user first
        // edits any form field. Captures engagement intent (vs just
        // viewing R&A and bouncing). `field_name` records which field
        // they touched first so we can see which row is the typical
        // entry point. Reset by the view-change useEffect when they
        // leave R&A and come back.
        onInput={(e) => {
          // Recompute the live results panel on every keystroke.
          setFormTick(t => t + 1);
          if (raFirstEditFiredRef.current) return;
          raFirstEditFiredRef.current = true;
          const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          sendGAEvent("event", "ra_first_edit", {
            field_name: (target?.name || target?.id || "unknown").slice(0, 40),
          });
        }}
      >
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "36px 24px 64px", display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT — editable inputs (Review & Adjust) */}
        <div className="db-no-print" style={{ flex: "1 1 470px", minWidth: 0 }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.3px" }}>
            Review & Adjust
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
            Data found for <strong style={{ color: "#111827" }}>{data.address}</strong>.  Edit any field before generating.
          </p>
        </div>

        <input type="hidden" name="address" value={data.address} />

        <SectionCard title="Property">
          <div style={{ display: "flex", alignItems: "center", padding: "0 24px", height: 44, borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ width: 180, fontSize: 13, color: "#6B7280", flexShrink: 0, letterSpacing: "-0.1px" }}>Property Type</span>
            <select
              name="propertyType"
              // UNCONTROLLED (defaultValue, not value): a controlled <select>
              // was snapping back to the prior state value after the sibling
              // Units field remounted in the same commit. Uncontrolled, the DOM
              // holds the user's choice; onChange keeps propertyType state in
              // sync for the panel + Units-field derivation.
              defaultValue={propertyType}
              onChange={e => {
                const val = e.target.value;
                setPropertyType(val);
                setUnitsEdit(val === "Single Family Rental" ? "1" : "");
                setUnitsKey(k => k + 1);
              }}
              style={{ flex: 1, padding: "5px 8px", fontSize: 13, color: "#111827", border: "1.5px solid #D1D5DB", borderRadius: 4, fontFamily: "inherit", outline: "none", background: "white", cursor: "pointer" }}
            >
              <option value="Multifamily">Multifamily</option>
              <option value="Single Family Rental">Single Family Rental</option>
            </select>
          </div>
          <FieldRow label="Year Built" name="yearBuilt" value={data.yearBuilt || ""} placeholder="e.g. 1987" />
          <FieldRow label="Building Area" name="buildingArea" value={data.buildingArea || ""} placeholder="e.g. 8,400 SF" />
          <FieldRow label="Lot Size" name="lotSize" value={data.lotSize || ""} placeholder="e.g. 12,500 SF" />
          <FieldRow key={unitsKey} label="Units *" name="units"
            value={propertyType === "Single Family Rental" ? "1" : (data.units || "")}
            placeholder="Required — e.g. 8" highlight={!unitsFilled}
            onChange={(e) => setUnitsEdit(e.target.value)} />
          {data.zoning && (
            <input type="hidden" name="zoning" value={data.zoning} />
          )}
        </SectionCard>

        {/* Tax Assessment */}
        <input type="hidden" name="assessedValue" value={summedAssessed} />
        {data.lpv && <input type="hidden" name="lpv" value={data.lpv} />}
        {data.adjustedLpv && <input type="hidden" name="adjustedLpv" value={data.adjustedLpv} />}
        {data.assessmentRatio && <input type="hidden" name="assessmentRatio" value={data.assessmentRatio} />}
        {data.reappraisalYear && <input type="hidden" name="reappraisalYear" value={data.reappraisalYear} />}
        {data.marketValue && <input type="hidden" name="marketValue" value={data.marketValue} />}
        {(() => {
          // Detect Arizona by state in the address — robust even if the backend
          // hasn't populated LPV yet (e.g. Maricopa CAD miss falling back to Regrid).
          const isAZ = /(?:,\s*|\s+)AZ(?:\s|,|$|\s*\d{5})/.test(data.address || "");
          // PA: collectors return raw base-year `assessedValue` (matches broker
          // / tax bill / public record) AND a STEB-CLR-rescaled `marketValue`
          // for cross-state underwriting. Show the market value as a read-only
          // row so users see both numbers.
          const isPA = /(?:,\s*|\s+)PA(?:\s|,|$|\s*\d{5})/.test(data.address || "");
          // Split-assessment-ratio states: assessedValue here is the 100%
          // appraised (true) value, but brokers / tax bills quote the taxable
          // value at the state's statutory ratio. Show both so the terminology
          // matches whichever number the broker screenshot cited.
          //
          // Ratios reflect the DealBrief investor-MF (5+ unit) audience:
          //   OH: 35% (single statutory ratio, all classes)
          //   TN: 40% (Class C commercial + MF 5+ per T.C.A. §67-5-801)
          //   MS: 15% (Class II other real property incl. apartments)
          //   MO: 19% (Class 1 residential — 5+ unit MF per RSMo §137.115)
          //   KS: 11.5% (Class 1 residential — 5+ unit MF per §79-1439)
          //
          // Prefer the pipeline's `assessmentRatio` if the collector populated
          // it (Jackson MO does), otherwise fall back to the state default.
          const stateForRatio = (() => {
            const m = /(?:,\s*|\s+)(OH|TN|MS|MO|KS)(?:\s|,|$|\s*\d{5})/.exec(data.address || "");
            return m ? m[1] : "";
          })();
          // TN is the only split-ratio state that flips MF ratio based on
          // unit count: Class R (25%) for 1-4 unit, Class C (40%) for 5+.
          // MO/KS statutes treat residential rental as Class 1 residential
          // regardless of unit count; MS Class I is owner-occupied SFR only
          // (investor rentals are always Class II 15%); OH is a single flat
          // 35% across all classes. So we only vary TN.
          const unitCountForRatio = (() => {
            const raw = (unitsEdit || data.units || "").toString().trim();
            const n = parseInt(raw, 10);
            return isFinite(n) && n > 0 ? n : 5;  // default to 5+ (MF) if unset
          })();
          const stateDefaultRatio: Record<string, number> = {
            OH: 0.35,
            TN: unitCountForRatio <= 4 ? 0.25 : 0.40,
            MS: 0.15, MO: 0.19, KS: 0.115,
          };
          const splitRatio = (() => {
            const raw = (data.assessmentRatio || "").toString().replace(/%/g, "").trim();
            const parsed = parseFloat(raw);
            if (isFinite(parsed) && parsed > 0 && parsed < 1) return parsed;
            if (isFinite(parsed) && parsed >= 1 && parsed <= 100) return parsed / 100;
            return stateForRatio ? stateDefaultRatio[stateForRatio] : 0;
          })();
          const isSplitRatioState = Boolean(stateForRatio) && splitRatio > 0;
          const ratioTaxable = (() => {
            if (!isSplitRatioState) return "";
            // Use `summedAssessed` (reactive to Land / Improvement edits) not
            // `data.assessedValue` (initial pipeline value). Keeps the trio
            // consistent: Appraised = user-edited sum; Taxable = that sum ×
            // ratio; Annual Taxes = that sum × rate.
            const raw = ((summedAssessed || data.assessedValue) || "").toString().replace(/[$,]/g, "");
            const n = parseFloat(raw);
            if (!isFinite(n) || n <= 0) return "";
            return "$" + Math.round(n * splitRatio).toLocaleString();
          })();
          const ratioPctLabel = `${(splitRatio * 100).toFixed(splitRatio * 100 < 20 ? 1 : 0)}%`;
          return (
            <SectionCard title="Tax Assessment" subtitle="(based on available data, please confirm and adjust if necessary)">
              {assessorNote && (
                <div style={{
                  margin: "12px 24px 4px",
                  padding: "10px 12px",
                  background: "#FEF3C7",
                  border: "1px solid #FCD34D",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#92400E",
                  lineHeight: 1.45,
                }}>
                  {assessorNote}
                </div>
              )}
              {isAZ ? (
                /* AZ: FCV is assessedValue, LPV is the actual tax base — show both read-only */
                <>
                  <FieldRow label="Full Cash Value (FCV)" value={data.assessedValue || "—"} editable={false}
                    tooltip="Arizona Full Cash Value — the county's market value estimate. This is what DealBrief shows as 'Assessed Value' for comparison against ask price." />
                  <FieldRow label="Limited Property Value (LPV)" value={data.lpv || "—"} editable={false}
                    tooltip="The actual tax base in Arizona. LPV is capped at 5% annual growth and does not reset to purchase price at sale. Annual taxes are computed from LPV, not FCV." />
                  <FieldRow label="Adj. LPV" value={data.adjustedLpv || "—"} editable={false}
                    tooltip="LPV × statutory assessment ratio = Net Assessed Value (NAV). Arizona's levy rate is applied to this adjusted value, not raw LPV." />
                </>
              ) : (
                /* Non-AZ: editable land + improvements (+ misc features where applicable), derived assessed value */
                <>
                  <FieldRow label="Land Value" name="landValue" value={landEdit} placeholder="e.g. $125,000"
                    onChange={(e) => setLandEdit(e.target.value)} />
                  <FieldRow label="Improvements" name="improvements" value={imprEdit} placeholder="e.g. $800,000"
                    onChange={(e) => setImprEdit(e.target.value)} />
                  {showMiscFeatures && (
                    <FieldRow label="Misc Features" name="otherValue" value={otherEdit} placeholder="e.g. $10,100"
                      onChange={(e) => setOtherEdit(e.target.value)}
                      tooltip="Outbuildings, paving, and other yard items the assessor records in the parcel total but tracks separately from the main improvement value. Common in NC. Sums into Assessed Value." />
                  )}
                  <FieldRow
                    label={isPA ? "Assessed Value (Base Year)" : isSplitRatioState ? "Appraised Value" : "Assessed Value"}
                    value={summedAssessed || "—"}
                    editable={false}
                    tooltip={
                      isPA
                        ? "Pennsylvania assessments are anchored to the county's last reassessment year (e.g. 1972 in Bucks, 2013 in Lehigh). This raw base-year value is what brokers, tax bills, and public records cite — and what your annual tax bill is computed against."
                        : isSplitRatioState
                          ? `County Assessor's true (100%) fair-market value — sum of land + improvements. ${stateForRatio} taxes ${ratioPctLabel} of this figure as the taxable (assessed) value; the tax rate below is calibrated to apply directly to appraised value. Brokers and tax bills quote the ${ratioPctLabel} number as 'Assessed Value.'`
                          : undefined
                    }
                  />
                  {isSplitRatioState && ratioTaxable && (
                    <FieldRow
                      label={`Taxable Value (${ratioPctLabel})`}
                      value={ratioTaxable}
                      editable={false}
                      tooltip={`${stateForRatio}'s statutory ${ratioPctLabel} assessment ratio applied to the appraised value above. This is the number the county Assessor and most brokers refer to as 'Assessed Value.' The tax rate below is expressed as an effective rate on APPRAISED value, so it's applied to the row above — not this row.`}
                    />
                  )}
                  {isPA && data.marketValue && (
                    <FieldRow
                      label="Est. Market Value (STEB CLR)"
                      value={data.marketValue}
                      editable={false}
                      tooltip="Pennsylvania's State Tax Equalization Board publishes an annual Common-Level Ratio per county. Dividing the base-year assessed value by the CLR yields a current fair-market-value estimate — useful for comparing against asking price and checking the assessment's market alignment."
                    />
                  )}
                </>
              )}
              {(computedAnnualTaxes || hasPerUnitFee) ? (
                <>
                  <FieldRow label="Annual Taxes" value={computedAnnualTaxes || "—"} editable={false}
                    tooltip={
                      hasPerUnitFee
                        ? `Computed live as Appraised × Tax Rate + Units × $${taxFeePerUnit.toFixed(0)} per-unit fee. The per-unit fee is the Charlotte multifamily solid waste charge, billed on top of ad-valorem taxes. Edit Units, Land/Improvements, or Tax Rate to see this update.`
                        : "Computed live as Appraised × Tax Rate. Edit Units (rescales the rate in TN 5+/1-4 class), Land/Improvements, or Tax Rate directly to see this update."
                    } />
                  <input type="hidden" name="annualTaxes" value={computedAnnualTaxes} />
                </>
              ) : (
                <FieldRow label="Annual Taxes" name="annualTaxes" value={data.annualTaxes || ""} placeholder="e.g. $21,000"
                  tooltip={isAZ
                    ? "Estimated from LPV × assessment ratio × jurisdiction levy rate. Verify against actual tax bill."
                    : "Current owner's annual property tax bill. Used as Year-1 taxes in the in-place NOI."} />
              )}
              <FieldRow key={rateKey} label="Current Tax Rate" name="taxRate" value={taxRateEdit || data.taxRate || ""} placeholder="e.g. 2.20%"
                onChange={(e) => setTaxRateEdit(e.target.value)}
                tooltip={isAZ
                  ? "Effective rate applied to Adj. LPV (Net Assessed Value), not raw LPV. AZ taxes = LPV × assessment ratio × levy rate."
                  : "The seller's current effective rate — applied to Appraised Value to compute the in-place (current) annual taxes."} />
              <FieldRow label="Reassessment Tax Rate" name="proFormaTaxRate" value={proFormaTaxRateEdit || data.taxRate || ""} placeholder="e.g. 2.20%"
                onChange={(e) => setProFormaTaxRateEdit(e.target.value)}
                tooltip="Pro-forma rate applied to your Price in the post-reassessment (tax-adjusted) scenario. Defaults to the current rate — raise it to model a rate increase after purchase." />
            </SectionCard>
          );
        })()}

        <SectionCard title="Deal Inputs">
          <FieldRow key={priceKey} label="Price *" name="askingPrice" value={priceSeed} placeholder="$995,000" highlight={!priceFilled}
            tooltip="The price you're evaluating — what you'd pay for the property. Drives cap rate, DSCR, and the tax-adjusted analysis live." />
          <FieldRow label="Average Monthly In-Place Rent" name="inPlaceRents" value="" placeholder={data.medianRent ? `ZIP median ${data.medianRent}` : "$1,250"}
            tooltip="Leave blank to use the ZIP median rent (shown in the field) — NOI falls back to it automatically, and clearing an override returns to it. Enter the actual average in-place rent per unit to override. Drives Gross Potential Rent and therefore NOI." />
        </SectionCard>

        {/* Analysis Assumptions */}
        <div style={{
          background: "white", borderRadius: 8, border: "1px solid #E5E7EB",
          marginBottom: 12, overflow: "hidden",
        }}>
          <div style={{ padding: "10px 24px", borderBottom: "1px solid #E5E7EB" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Analysis Assumptions
            </span>
          </div>

          {/* NOI subsection */}
          <div style={{ padding: "4px 24px 4px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Net Operating Income
            </span>
          </div>
          <div style={{ padding: "16px 24px", display: "flex", gap: 32, flexWrap: "wrap", borderBottom: "1px solid #E5E7EB" }}>
            {/* Revenue Assumptions */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                Revenue Assumptions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    value={vacancyPct}
                    onChange={e => setVacancyPct(e.target.value)}
                    style={{
                      width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                      border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                    onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                  <span style={{ fontSize: 13, color: "#6B7280" }}>% vacancy</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    value={badDebtPct}
                    onChange={e => setBadDebtPct(e.target.value)}
                    style={{
                      width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                      border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                    onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                  <span style={{ fontSize: 13, color: "#6B7280" }}>% bad debt</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    value={otherIncomePct}
                    onChange={e => setOtherIncomePct(e.target.value)}
                    style={{
                      width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                      border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                    onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                  <span style={{ fontSize: 13, color: "#6B7280" }}>% other income<br/><span style={{ fontSize: 11, color: "#9CA3AF" }}>(% of 1 mo. rent)</span></span>
                </div>
              </div>
            </div>
            {/* OpEx Assumptions */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                OpEx Assumptions ($/unit/yr)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {([
                  ["Insurance", insurancePerUnit, setInsurancePerUnit, "$/unit"],
                  ["Maintenance", maintenancePerUnit, setMaintenancePerUnit, "$/unit"],
                  ["Utilities", utilitiesPerUnit, setUtilitiesPerUnit, "$/unit"],
                  ["Mgmt", managementPct, setManagementPct, "% EGI"],
                  ["Payroll", payrollPerUnit, setPayrollPerUnit, "$/unit"],
                  ["Marketing", marketingPerUnit, setMarketingPerUnit, "$/unit"],
                  ["Admin", adminPerUnit, setAdminPerUnit, "$/unit"],
                  ["Reserves", reservesPerUnit, setReservesPerUnit, "$/unit"],
                ] as [string, string, (v: string) => void, string][]).map(([lbl, val, setter, unit]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 72, fontSize: 12, color: "#6B7280", flexShrink: 0 }}>{lbl}</span>
                    <input
                      type="text"
                      value={val}
                      onChange={e => setter(e.target.value)}
                      style={{
                        width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                        border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                        fontFamily: "inherit", outline: "none",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                      onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                    />
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Debt Financing subsection */}
          <div style={{ padding: "4px 24px 4px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Debt Financing
            </span>
          </div>
          <div style={{ padding: "16px 24px", display: "flex", gap: 32, flexWrap: "wrap" }}>
            {/* Rates */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                Interest Rates
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {selectedRates.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="text"
                      value={r}
                      onChange={e => setSelectedRates(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      style={{
                        width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                        border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                        fontFamily: "inherit", outline: "none",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                      onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                    />
                    <span style={{ fontSize: 13, color: "#6B7280" }}>%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* LTVs */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                Loan-to-Value
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {selectedLtvs.map((ltv, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="text"
                      value={ltv}
                      onChange={e => setSelectedLtvs(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      style={{
                        width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                        border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                        fontFamily: "inherit", outline: "none",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                      onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                    />
                    <span style={{ fontSize: 13, color: "#6B7280" }}>% LTV</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Amortization */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10, letterSpacing: "0.3px" }}>
                Amortization
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <input
                  type="text"
                  value={amortYears}
                  onChange={e => setAmortYears(e.target.value)}
                  style={{
                    width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                    border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                    fontFamily: "inherit", outline: "none",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                  onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
                <span style={{ fontSize: 13, color: "#6B7280" }}>yr amort</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  value={ioPeriod}
                  onChange={e => setIoPeriod(e.target.value)}
                  style={{
                    width: 52, padding: "5px 8px", fontSize: 13, color: "#111827",
                    border: "1.5px solid #D1D5DB", borderRadius: 4, textAlign: "center",
                    fontFamily: "inherit", outline: "none",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                  onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
                <span style={{ fontSize: 13, color: "#6B7280" }}>yr I/O</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email + one-off generate removed — access is now gated before R&A;
            the report downloads via the Generate PDF button in the top bar. */}
        </div>{/* end LEFT column */}

        {/* RIGHT — live HTML mirror of the report, sticky alongside the inputs */}
        <div id="ra-report" style={{ flex: "1 1 600px", minWidth: 400, position: "sticky", top: 12, alignSelf: "flex-start", maxHeight: "calc(100vh - 24px)", overflowY: "auto", background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px", boxShadow: "0 6px 24px rgba(29,53,87,0.07)" }}>
          {liveResults
            ? <LiveReport rd={liveResults.rd} boe={liveResults.boe} deriv={liveResults.deriv} />
            : <div style={{ fontSize: 13, color: "#6B7280", padding: "20px 0", lineHeight: 1.5 }}>Live report preview will appear here as you enter deal terms.</div>}
        </div>
      </div>
      </form>
    </div>
  );

  // LANDING
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Google Maps JS API — loaded lazily for the address autocomplete
          widget. afterInteractive strategy means it doesn't block first
          paint. If NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing the script
          tag is omitted entirely and the input falls back to plain text
          behavior — the rest of the form still works fine. */}
      {GOOGLE_MAPS_PUBLIC_KEY && (
        <Script
          // NOTE: do NOT add `&loading=async` here. With async loading
          // enabled, Google's API expects callers to use
          // `await google.maps.importLibrary("places")` to load libraries
          // dynamically — the synchronous `new google.maps.places.Autocomplete()`
          // pattern below would never see places populated as a global.
          // The non-async query loads the places library directly via
          // `&libraries=places` and exposes Autocomplete on the global.
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_PUBLIC_KEY}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setPlacesReady(true)}
        />
      )}

      {/* HEADER */}
      <div style={{
        padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px" }}>
          DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: "0.2px" }}>Pre-Offer Research</span>
          <AccountMenu dark />
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "32px 24px 16px" }}>
        {/* HERO — calm/professional positioning. H1 leads with a concrete
            tax-reassessment number (defensible at 30%+ across most US
            multifamily markets; FL non-homestead resets and TX CAD spikes
            run much higher). Sub-head follows Pipedrive's "category +
            audience + scope" formula so a 5-second scroller knows what
            DealBrief is and who it's for. The "first report free" hook
            has been moved into the stat strip below + a friction-killer
            line under the input, where it's more decision-relevant. */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{
            fontSize: 32, fontWeight: 600, color: "#1F2937", lineHeight: 1.25,
            margin: "0 0 14px", letterSpacing: "-0.5px",
          }}>
            Catch the 30%+ post-sale tax hike before you submit an LOI.
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
            Pre-offer property research for multifamily buyers. Tax, permits, FEMA flood, crime, demographics, and debt service scenarios in a live report you can edit and export. Ready in 60 seconds.
          </p>
        </div>

        {/* STAT STRIP — deliverable-led, with "First report free" as
            the bolded credibility/friction-reducer at the end. Pattern
            borrowed from Shovels / PropertyRadar landing pages. Centered
            so it visually sits with the input box below rather than
            with the left-aligned hero text above. */}
        <p style={{
          fontSize: 12,
          color: "#6B7280",
          letterSpacing: "0.2px",
          margin: "0 0 18px",
          lineHeight: 1.6,
          textAlign: "center",
        }}>
          Tax{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Permits{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Flood{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Crime{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Demographics{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Debt service{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          <strong style={{ color: "#1D3557", fontWeight: 600 }}>First report free</strong>
        </p>

        {/* MOBILE-ONLY preview strip — small horizontal row of 3
            thumbnails above the input so phone visitors see "what
            you actually get" before they're asked to engage. Hidden
            on desktop (where the full 1100px preview band below the
            input still renders). Gated behind `mounted` to avoid SSR
            hydration mismatch — server renders the desktop layout,
            client adds this on first mount if viewport is < 640px. */}
        {mounted && isMobile && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 6,
            marginBottom: 16,
          }}>
            {[
              { src: "/new_ss_1.png", alt: "Sample: deal snapshot and operating statement" },
              { src: "/new_ss_2.png", alt: "Sample: tax-adjusted, price sensitivity, debt service" },
              { src: "/new_ss_3.png", alt: "Sample: demographics, schools, crime" },
            ].map((s) => (
              <div
                key={s.src}
                role="button"
                tabIndex={0}
                onClick={runDemo}
                style={{
                  display: "block",
                  cursor: "pointer",
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 2px 6px rgba(29, 53, 87, 0.08), 0 1px 2px rgba(0,0,0,0.04)",
                  border: "1px solid #E5E7EB",
                  background: "white",
                }}
              >
                <img
                  src={s.src}
                  alt={s.alt}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div style={{
          background: "white", borderRadius: 8, padding: "24px",
          // Softened from 1.5px solid navy to 1px solid light gray —
          // less corporate-form, more modern. Inner input still has
          // navy focus state for action feedback.
          border: "1px solid #E5E7EB",
          marginBottom: 12,
        }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Property Address
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={addressInputRef}
              type="text"
              placeholder="2718 Cleveland St, Dallas, TX 75215"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Always call go() — it reads addressInputRef.current.value,
                // which Places has already updated to the resolved
                // formatted_address if the user selected a suggestion.
                go();
              }}
              // Disable browser autofill — Google Places suggestions are
              // the only autocomplete experience we want on this input.
              autoComplete="off"
              style={{
                flex: 1, padding: "12px 14px", fontSize: 15, border: "1.5px solid #D1D5DB",
                borderRadius: 6, outline: "none", color: "#111827", background: "white",
                fontFamily: "inherit", transition: "border-color 0.12s", letterSpacing: "-0.1px",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
              onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
            />
            <button onClick={() => go()} style={{
              padding: "12px 24px", fontSize: 14, fontWeight: 500,
              background: "#0F1F38", color: "white", border: "none", borderRadius: 6,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              transition: "background 0.12s", letterSpacing: "-0.1px",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0A1426"}
              onMouseLeave={e => e.currentTarget.style.background = "#0F1F38"}>
              Run Brief
            </button>
          </div>
          {/* Friction-killer microcopy directly under the input row —
              the highest-friction decision point in the funnel. Pattern
              borrowed from Pipedrive's "14-day free trial, no credit
              card required" placement. */}
          <p style={{
            fontSize: 12,
            color: "#6B7280",
            margin: "10px 0 0",
            lineHeight: 1.5,
          }}>
            First report free. No credit card required.
          </p>
        </div>

        {/* CREDIBILITY STACK — signals legitimacy via association with
            authoritative public-sector data sources. Sits below the
            input box where a skeptical visitor would think "is this
            real data or made-up scores?" The answer is: public records. */}
        <p style={{
          fontSize: 11,
          color: "#9CA3AF",
          letterSpacing: "0.2px",
          margin: "0 0 28px",
          lineHeight: 1.6,
          textAlign: "center",
        }}>
          Data from FEMA{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          U.S. Census{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          BLS{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Shovels{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          GreatSchools{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          County Tax Assessors
        </p>

        {/* PIPELINE ERROR */}
        {pipelineError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 13, color: "#B91C1C" }}>
            {pipelineError}
          </div>
        )}

        {/* SAMPLE REPORT — runs a live demo address straight into the R&A */}
        <div style={{ margin: "12px 0 8px", textAlign: "center" }}>
          <button
            type="button"
            onClick={runDemo}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, color: "#457B9D",
              borderBottom: "1px solid #457B9D", paddingBottom: 1,
              fontFamily: "inherit", letterSpacing: "-0.1px",
            }}
          >
            See a live sample report &rarr;
          </button>
        </div>

      </div>{/* /end first 540px wrapper (HERO + INPUT + SAMPLE link) */}

      {/* WHAT YOU GET — sample page previews. Lives OUTSIDE the 540px text
          column so the 3 previews can render at a comfortable 350px each
          on desktop without needing a CSS breakout. Renders 3 across at
          every viewport — cards shrink on mobile rather than stacking. */}
      <div style={{ maxWidth: 1100, margin: "0 auto 48px", padding: "0 24px" }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.8px",
          textTransform: "uppercase", display: "block", marginBottom: 14, margin: "0 0 14px 0",
        }}>
          What you get in 60 seconds
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}>
          {[
            { src: "/new_ss_1.png", alt: "Sample: deal snapshot and operating statement" },
            { src: "/new_ss_2.png", alt: "Sample: tax-adjusted, price sensitivity, debt service" },
            { src: "/new_ss_3.png", alt: "Sample: demographics, schools, crime" },
          ].map((s) => (
            <div
              key={s.src}
              role="button"
              tabIndex={0}
              onClick={runDemo}
              style={{
                display: "block",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(29, 53, 87, 0.10), 0 1px 3px rgba(0,0,0,0.05)",
                border: "1px solid #E5E7EB",
                background: "white",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(29, 53, 87, 0.14), 0 2px 4px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(29, 53, 87, 0.10), 0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              {/* Plain <img>: static bitmaps in /public, not above-the-fold critical. */}
              <img
                src={s.src}
                alt={s.alt}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Re-open the narrow 540px column for the rest of the landing
          (Coverage, Features, Market Suggestion). Top padding is 0 here
          since the previous block already supplied bottom margin. */}
      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 24px 48px" }}>

        {/* COVERAGE */}
        <div style={{ margin: "0 0 48px", paddingLeft: 2 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.8px",
            display: "block", marginBottom: 12, margin: "0 0 12px 0", textTransform: "uppercase",
          }}>
            Markets We Cover
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 24px", alignItems: "start" }}>
            {[
              {
                heading: "Texas / Southwest",
                markets: [
                  "Dallas-Ft. Worth, TX",
                  "Houston, TX",
                  "San Antonio, TX",
                  "Austin, TX",
                  "El Paso, TX",
                  "Oklahoma City, OK",
                  "Tulsa, OK",
                  "Phoenix, AZ",
                  "Denver, CO",
                  "Las Vegas, NV",
                ],
              },
              {
                heading: "Southeast",
                markets: [
                  "Charlotte, NC",
                  "Raleigh-Durham, NC",
                  "Atlanta, GA",
                  "Nashville, TN",
                  "Memphis, TN-MS",
                  "Louisville / Lexington, KY",
                  "Tampa, FL",
                  "Orlando, FL",
                  "Jacksonville, FL",
                  "Miami – Fort Lauderdale – West Palm, FL",
                ],
              },
              {
                heading: "Midwest / Mid-Atlantic",
                markets: [
                  "Philadelphia, PA",
                  "Toledo, OH",
                  "Cleveland / Akron, OH",
                  "Columbus, OH",
                  "Cincinnati, OH-KY",
                  "Dayton, OH",
                  "Kansas City, MO-KS",
                  "St. Louis, MO",
                  "Indianapolis, IN",
                ],
              },
            ].map(({ heading, markets }) => (
              <div key={heading}>
                <h3 style={{
                  fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.6px",
                  textTransform: "uppercase", margin: "0 0 6px 0",
                }}>
                  {heading}
                </h3>
                {markets.map((label) => {
                  const slug = MARKET_POST_SLUG[label];
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                      <span style={{ fontSize: 10, color: "#9CA3AF" }}>●</span>
                      {slug ? (
                        <Link href={`/blog/${slug}`} style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#1D3557"}
                          onMouseLeave={e => e.currentTarget.style.color = "#374151"}>
                          {label}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#C4C9D4", margin: "10px 0 0" }}>
            Don&apos;t see your market?{" "}
            <button
              onClick={() => setSuggestOpen(true)}
              style={{ background: "none", border: "none", color: "#C4C9D4", fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "none" }}
              onMouseEnter={e => e.currentTarget.style.color = "#9CA3AF"}
              onMouseLeave={e => e.currentTarget.style.color = "#C4C9D4"}>
              Request it →
            </button>
          </p>
        </div>

        {/* FEATURES — card grid */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.8px",
            textTransform: "uppercase", display: "block", marginBottom: 14, margin: "0 0 14px 0",
          }}>
            What&rsquo;s in a DealBrief Research Report
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Tax Assessment", desc: "Assessed value vs. asking price, reassessment risk modeling" },
              { label: "Permit History", desc: "City records cross-referenced against broker capex claims" },
              { label: "FEMA Flood Zone", desc: "Flood designation, insurance requirements, lender impact" },
              { label: "Crime & Safety", desc: "ZIP-level crime grade, rate per 1,000, national percentile" },
              { label: "Demographics", desc: "Median income, population, renter household prevalence, education" },
              { label: "Walk & Bike Score", desc: "Walkability, bike infrastructure, transit access" },
              { label: "Back-of-Envelope NOI", desc: "Revenue, OpEx, estimated cap rates, cap rate sensitivity" },
              { label: "Debt Service Scenarios", desc: "4 rates × 2 LTV levels with DSCR and cash-on-cash" },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "14px 16px", borderRadius: 6, background: "white",
                border: "1px solid #E5E7EB",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D3557", marginBottom: 3, letterSpacing: "-0.1px" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.45 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MARKET SUGGESTION */}
        <div style={{
          padding: "20px 24px", borderRadius: 8,
          border: "1px solid #E5E7EB", background: "white",
          marginBottom: 64,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>Want your market covered?</span>
              <span style={{ fontSize: 13, color: "#9CA3AF", marginLeft: 8 }}>Most-requested go live first.</span>
            </div>
            {!suggestOpen && !suggestDone && (
              <button onClick={() => setSuggestOpen(true)} style={{
                padding: "6px 16px", fontSize: 13, fontWeight: 500,
                background: "transparent", color: "#1D3557", border: "1px solid #D1D5DB",
                borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.12s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#1D3557"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; }}>
                Suggest
              </button>
            )}
          </div>
          {suggestOpen && !suggestDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <input
                type="text" placeholder="e.g. Houston, TX" value={suggestVal}
                onChange={e => setSuggestVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitSuggest()}
                autoFocus
                style={{
                  padding: "8px 12px", fontSize: 14, border: "1.5px solid #E5E7EB",
                  borderRadius: 5, outline: "none", color: "#111827", background: "#FAFAFA",
                  fontFamily: "inherit",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email" placeholder="Your email (so we can notify you)" value={suggestEmail}
                  onChange={e => setSuggestEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitSuggest()}
                  style={{
                    flex: 1, padding: "8px 12px", fontSize: 14, border: "1.5px solid #E5E7EB",
                    borderRadius: 5, outline: "none", color: "#111827", background: "#FAFAFA",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
                  onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                />
                <button onClick={submitSuggest} style={{
                  padding: "8px 18px", fontSize: 13, fontWeight: 500,
                  background: "#1D3557", color: "white", border: "none", borderRadius: 5,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  Submit
                </button>
              </div>
            </div>
          )}
          {suggestDone && (
            <p style={{ fontSize: 13, color: "#059669", margin: "12px 0 0", fontWeight: 500 }}>
              Noted — thanks.
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Link
              href="/blog"
              style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.color = "#1D3557"}
              onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
            >
              Blog
            </Link>
            <a
              href="mailto:info@getdealbrief.com"
              style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.color = "#1D3557"}
              onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
            >
              Contact Us
            </a>
          </div>
          <p style={{ fontSize: 11, color: "#C4C7CC", margin: 0 }}>
            Public data aggregation for informational purposes only. Not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}

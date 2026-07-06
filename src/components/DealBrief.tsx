"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import { sendGAEvent } from "@next/third-parties/google";

// Google Maps Places API key — exposed client-side because the API
// requires it for browser-side autocomplete. SHOULD be HTTP-referrer
// restricted in Google Cloud Console to getdealbrief.com (+ Vercel
// preview URLs + localhost) — otherwise anyone can scrape it from
// our JS bundle and run autocomplete calls on our bill. Different
// key from the server-side pipeline GOOGLE_MAPS_API_KEY.
const GOOGLE_MAPS_PUBLIC_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

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

function FieldRow({ label, name, value, placeholder, editable = true, tooltip, onChange }: { label: string; name?: string; value?: string; placeholder?: string; editable?: boolean; tooltip?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
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
            border: "1px solid transparent", borderRadius: 4,
            background: "transparent", fontFamily: "inherit",
            transition: "all 0.12s",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFAFA"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
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

export default function DealBrief() {
  const [view, setView] = useState("landing");
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
  const [managementPct, setManagementPct] = useState("8.0");
  const [marketingPerUnit, setMarketingPerUnit] = useState("150");
  const [adminPerUnit, setAdminPerUnit] = useState("100");
  const [reservesPerUnit, setReservesPerUnit] = useState("400");
  const [propertyType, setPropertyType] = useState("Multifamily");
  const [unitsKey, setUnitsKey] = useState(0);
  // Same remount trick as unitsKey — Tax Rate FieldRow uses `defaultValue`
  // (uncontrolled input), so programmatic changes to `taxRateEdit` from the
  // TN/KS/MO/IN class-scale useEffect below don't reach the DOM. Bump this
  // key whenever the class-scale flips the rate, forcing a remount so the
  // input re-reads its `value` prop.
  const [rateKey, setRateKey] = useState(0);
  const [devKey, setDevKey] = useState("");
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
      const k = new URLSearchParams(window.location.search).get("dev") || "";
      setDevKey(k);
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

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  // Email for first-free-report gating + Stripe receipt. Eligibility
  // check happens on submit; the unique index on reports.email is the
  // authoritative gate (see /api/free-report).
  const [email, setEmail] = useState("");

  // Controlled state for land/improvement/other inputs so assessed value can be derived as their sum
  const [landEdit, setLandEdit] = useState("");
  const [imprEdit, setImprEdit] = useState("");
  const [otherEdit, setOtherEdit] = useState("");
  // Controlled state for units + tax rate so Annual Taxes reacts live when a
  // per-unit fee applies (e.g. Charlotte multifamily solid-waste fee).
  const [unitsEdit, setUnitsEdit] = useState("");
  const [taxRateEdit, setTaxRateEdit] = useState("");

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

  const handleGenerate = async () => {
    if (!formRef.current) return;
    setGenerateError("");
    const fd = new FormData(formRef.current);
    const body: Record<string, unknown> = {};
    fd.forEach((val, key) => { body[key] = val; });

    // Validation: at least one of asking price or buyer cap rate must be populated
    if (!body.askingPrice && !body.buyerCapRate) {
      setGenerateError("Please enter an Asking Price or Buyer Cap Rate before generating — at least one is required for the financial analysis.");
      return;
    }
    // Soft warning surfaced inline if units is blank
    if (!body.units) {
      setGenerateError("⚠ Units is blank — enter the number of units to get per-unit expense estimates and breakeven analysis. You can still generate without it.");
      // Don't return — allow the user to proceed if they confirm by clicking again
      // or we just show the warning; for now we block until they fill it in
      return;
    }
    // Email is OPTIONAL. It is used only as the free-report eligibility
    // key (one free report per email address). If the user leaves it blank
    // they skip eligibility entirely and go straight to Stripe checkout,
    // which collects an email on the hosted page anyway. If they type
    // something but it isn't a plausible email, reject so they can fix
    // the typo before paying for a report tied to a bad address.
    const emailTrimmed = String(body.email ?? email ?? "").trim();
    const emailIsValid =
      emailTrimmed.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
    if (emailTrimmed.length > 0 && !emailIsValid) {
      setGenerateError(
        "That doesn't look like a valid email — fix it, or leave it blank to go straight to checkout."
      );
      return;
    }
    body.email = emailIsValid ? emailTrimmed.toLowerCase() : "";

    setGenerating(true);
    body.rates = selectedRates;
    body.ltvs = selectedLtvs;
    body.amortYears = amortYears;
    body.ioPeriod = ioPeriod;
    body.vacancyPct = vacancyPct;
    body.badDebtPct = badDebtPct;
    body.otherIncomePct = otherIncomePct;
    body.opexOverrides = [insurancePerUnit, maintenancePerUnit, utilitiesPerUnit, managementPct, marketingPerUnit, adminPerUnit, reservesPerUnit].join(",");
    if (data?._pipeline) body._pipeline = data._pipeline;

    try {
      // 1) Eligibility check — advisory, server is source of truth.
      //    Only meaningful when the user actually supplied an email.
      //    Blank email → skip eligibility and go straight to checkout.
      let free = false;
      if (emailIsValid) {
        try {
          const eligRes = await fetch("/api/eligibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: body.email }),
          });
          if (eligRes.ok) {
            const eligJson = await eligRes.json();
            free = Boolean(eligJson.free);
          }
        } catch {
          // Network glitch on eligibility check → fall through to paid.
        }
      }

      // 2a) Free path
      if (free) {
        const freeRes = await fetch("/api/free-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (freeRes.status === 409) {
          // Lost the race against another tab/window with the same email
          // — fall through to Stripe.
          free = false;
        } else {
          const freeJson = await freeRes.json();
          if (!freeRes.ok || freeJson.error) {
            throw new Error(freeJson.error || `Server error ${freeRes.status}`);
          }
          if (!freeJson.id) throw new Error("No report id returned");
          // GA funnel — bottom of the funnel for the free path (visitor
          // successfully generated a report). `path: "free"` distinguishes
          // from the paid path so you can compare conversion rates.
          sendGAEvent("event", "report_run", {
            path: "free",
          });
          // Reddit Ads pixel — fire SignUp conversion. Reddit's algorithm
          // uses this to optimize bidding once we have enough conversion
          // data (typically ~30 events). The base PageVisit fires from
          // layout.tsx on every page load; this is the value event.
          if (typeof window !== "undefined") {
            const w = window as unknown as { rdt?: (...args: unknown[]) => void };
            if (typeof w.rdt === "function") {
              w.rdt("track", "SignUp");
            }
          }
          window.location.href = `/report/${freeJson.id}`;
          return;
        }
      }

      // 2b) Paid path
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `Server error ${res.status}`);
      }
      const { url } = json;
      if (!url) throw new Error("No checkout URL returned");
      // GA funnel — paid-path completion. User is being redirected to
      // Stripe; we count this as "report_run" with path="paid" so the
      // overall conversion metric covers both free and paid users. (The
      // actual report only renders after Stripe payment succeeds; we
      // could add a separate `report_purchased` event from the Stripe
      // webhook later if we want to distinguish intent from completion.)
      sendGAEvent("event", "report_run", {
        path: "paid",
      });
      // Reddit Ads pixel — fire Lead conversion. We use Lead (not
      // Purchase) because at this point the user is being redirected to
      // Stripe but hasn't completed payment yet. If we later add a
      // Stripe-webhook-triggered confirmation event, that would be the
      // place to fire Reddit's Purchase event with the actual order
      // value for ROAS optimization.
      if (typeof window !== "undefined") {
        const w = window as unknown as { rdt?: (...args: unknown[]) => void };
        if (typeof w.rdt === "function") {
          w.rdt("track", "Lead");
        }
      }
      window.location.href = url;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setGenerating(false);
    }
  };

  const handleDevGenerate = async () => {
    if (!formRef.current || !devKey) return;
    setGenerateError("");
    const fd = new FormData(formRef.current);
    const body: Record<string, unknown> = {};
    fd.forEach((val, key) => { body[key] = val; });

    // Same validation as handleGenerate
    if (!body.askingPrice && !body.buyerCapRate) {
      setGenerateError("Please enter an Asking Price or Buyer Cap Rate before generating — at least one is required for the financial analysis.");
      return;
    }
    if (!body.units) {
      setGenerateError("⚠ Units is blank — enter the number of units to get per-unit expense estimates and breakeven analysis. You can still generate without it.");
      return;
    }

    setGenerating(true);
    body.rates = selectedRates;
    body.ltvs = selectedLtvs;
    body.amortYears = amortYears;
    body.ioPeriod = ioPeriod;
    body.vacancyPct = vacancyPct;
    body.badDebtPct = badDebtPct;
    body.otherIncomePct = otherIncomePct;
    body.opexOverrides = [insurancePerUnit, maintenancePerUnit, utilitiesPerUnit, managementPct, marketingPerUnit, adminPerUnit, reservesPerUnit].join(",");
    if (data?._pipeline) body._pipeline = data._pipeline;

    try {
      const res = await fetch(`/api/dev-report?key=${encodeURIComponent(devKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as {error?: string}).error || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const devStreet = (address || "").split(",")[0].trim();
      a.download = devStreet ? `DealBrief - ${devStreet}.pdf` : "DealBrief.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Dev generation failed.");
    } finally {
      setGenerating(false);
    }
  };

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
      const geoAddr = pipeline?.geo?.formattedAddress || addr;
      const userRangeMatch = addr.match(/^(\d+-\d+)\b/);
      const geoNumMatch    = geoAddr.match(/^(\d+)\b/);
      const displayAddr = userRangeMatch && geoNumMatch
        ? geoAddr.replace(geoNumMatch[1], userRangeMatch[1])
        : geoAddr;
      setData({
        address: displayAddr,
        yearBuilt:    a.yearBuilt    || "",
        buildingArea: a.buildingArea || "",
        lotSize:      a.lotSize      || "",
        units:        a.units        || "",
        unitMix:      "",
        zoning:       a.zoning || "",
        assessedValue:    a.assessedValue  || "",
        marketValue:      a.marketValue    || "",
        landValue:        a.landValue      || "",
        improvementValue: a.improvements   || "",
        otherValue:       a.otherValue     || "",
        lpv:              a.lpv            || "",
        adjustedLpv:      a.adjustedLpv    || "",
        assessmentRatio:  typeof a.assessmentRatio === "number" ? a.assessmentRatio.toString() : (a.assessmentRatio || ""),
        reappraisalYear:  a.reappraisalYear || "",
        annualTaxes:      a.annualTaxes    || "",
        taxRate:          a.taxRate        || "",
        taxFeePerUnit:    a.taxFeePerUnit != null ? String(a.taxFeePerUnit) : "",
        // FIPS state used by class-threshold rate adjustment when user
        // edits unit count. KS/TN/MO/IN switch rate between 1-4 unit
        // residential and 5+ unit commercial brackets.
        fipsState:        pipelineData?.geo?.fipsState || "",
        femaFloodZone:    pipelineData?.fema?.floodZone || "",
        walkScore:        pipelineData?.walkscore?.walk?.toString() || "",
        bikeScore:        pipelineData?.walkscore?.bike?.toString() || "",
        crimeGrade:       pipelineData?.crime?.overallGrade || "",
        crimeRate:        pipelineData?.crime?.ratePerThousand
          ? `${pipelineData.crime.ratePerThousand} per 1,000`
          : "",
        medianHHIncome:  pipelineData?.census?.medianIncome || "",
        population:      pipelineData?.census?.population?.toString() || "",
        medianAge:       pipelineData?.census?.medianAge?.toString() || "",
        medianHomeValue: pipelineData?.census?.medianHomeValue || "",
        medianRent:      pipelineData?.census?.medianRent || "",
        _pipeline: pipelineData,
      } as typeof MOCK_RETURN_DATA & { _pipeline?: unknown });
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
      setView("confirm");
    } catch (err) {
      sendGAEvent("event", "pipeline_error", {
        error_kind: "network",
        error_msg: err instanceof Error ? err.message.slice(0, 60) : "unknown",
      });
      setPipelineError(err instanceof Error ? err.message : "Unable to reach the server. Please try again.");
      setView("landing");
    }
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

  const features = [
    "Tax assessment & reassessment risk",
    "Permit history vs. broker claims",
    "FEMA flood zone",
    "ZIP-level crime grade",
    "Census demographics",
    "Walk & bike score",
    "Back-of-envelope NOI",
    "Debt service at 4 rate scenarios",
  ];

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
      <div style={{ padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px", cursor: "pointer" }}
          onClick={() => { setView("landing"); setData(null); }}>
          DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
        </span>
        <button onClick={() => { setView("landing"); setData(null); }}
          style={{ background: "none", border: "none", fontSize: 13, color: "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
          ← New search
        </button>
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
          if (raFirstEditFiredRef.current) return;
          raFirstEditFiredRef.current = true;
          const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          sendGAEvent("event", "ra_first_edit", {
            field_name: (target?.name || target?.id || "unknown").slice(0, 40),
          });
        }}
      >
      <div style={{ maxWidth: 660, margin: "0 auto", padding: "36px 24px 64px" }}>
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
              value={propertyType}
              onChange={e => {
                const val = e.target.value;
                setPropertyType(val);
                if (val === "Single Family Rental") {
                  setData(prev => prev ? { ...prev, units: "1" } : prev);
                  setUnitsKey(k => k + 1);
                }
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
          <FieldRow key={unitsKey} label="Units *" name="units" value={data.units} placeholder="Required — e.g. 8"
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
              <FieldRow key={rateKey} label="Tax Rate" name="taxRate" value={taxRateEdit || data.taxRate || ""} placeholder="e.g. 2.20%"
                onChange={(e) => setTaxRateEdit(e.target.value)}
                tooltip={isAZ
                  ? "Effective rate applied to Adj. LPV (Net Assessed Value), not raw LPV. AZ taxes = LPV × assessment ratio × levy rate."
                  : "Tax rate used when calculating reassessed taxes."} />
            </SectionCard>
          );
        })()}

        <SectionCard title="Deal Inputs">
          <FieldRow label="Asking Price *" name="askingPrice" value="" placeholder="$995,000"
            tooltip="Broker/Seller's asking price for the property. DealBrief needs this or Buyer Cap Rate for all calculations to work. You can provide both for more functionality." />
          <FieldRow label="Broker Cap Rate" name="brokerCapRate" value="" placeholder="6.76%"
            tooltip="Broker/Seller's implied cap rate at the asking price. Provided for reference — not required." />
          <FieldRow label="Buyer Cap Rate *" name="buyerCapRate" value="" placeholder="7.0%"
            tooltip="Your required going-in cap rate. DealBrief needs this or Asking Price for calculations. Provide both for full sensitivity analysis." />
          <FieldRow label="Occupancy" name="occupancy" value="" placeholder="100%"
            tooltip="Current occupancy for reference — displayed on the report. NOI is driven by the Vacancy % set in Analysis Assumptions below." />
          <FieldRow label="Average Monthly In-Place Rent" name="inPlaceRents" value="" placeholder="$1,250"
            tooltip="Average per unit. Used to drive GPR. Use market rents if you want to show a mark-to-market NOI. If not provided, GPR will be estimated from the property zip code median rent, if available." />
          <FieldRow label="Broker Claims" name="brokerClaims" value="" placeholder="New roof 2022, renovated units"
            tooltip="Free form — describe any relevant broker or seller claims about the property. These will appear in the report for reference." />
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

        {/* Email — OPTIONAL. Used only as the free-report eligibility key
            (one free report per email). Blank email or already-used email
            routes to Stripe checkout, which collects an email on the
            hosted page anyway. */}
        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: "1px solid #E5E7EB",
        }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 500,
            color: "#374151", marginBottom: 6, letterSpacing: "-0.1px",
          }}>
            Email address <span style={{ color: "#1D3557", fontWeight: 500 }}>(for free first report)</span>
          </label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%", maxWidth: 360, padding: "9px 12px", fontSize: 14,
              color: "#111827", border: "1.5px solid #D1D5DB", borderRadius: 6,
              fontFamily: "inherit", outline: "none",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
            onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
          />
          {/* Decision-led microcopy — previous copy ("Your first report is
              free. Use your email to check eligibility...") was ambiguous
              and visitors interpreted email as report delivery rather than
              free-report claim. New copy makes the two paths (with email
              vs without) explicit and names the paid price up front so
              there's no Stripe-page sticker shock. */}
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 8, marginBottom: 0, lineHeight: 1.5, maxWidth: 480 }}>
            Enter your email to claim your free first report.
            Leave blank to skip straight to paid checkout ($29 per report).
            We don't send marketing emails or share your address.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, marginTop: 20 }}>
          {generateError && (
            <p style={{ fontSize: 13, color: "#C0392B", margin: 0, textAlign: "right" }}>{generateError}</p>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {devKey && (
            <button
              type="button"
              onClick={handleDevGenerate}
              disabled={generating}
              style={{
                padding: "12px 20px", fontSize: 13, fontWeight: 500,
                background: generating ? "#9CA3AF" : "#2D6A4F",
                color: "white", border: "none", borderRadius: 6,
                cursor: generating ? "not-allowed" : "pointer",
                fontFamily: "inherit", letterSpacing: "-0.1px",
              }}>
              {generating ? "Generating…" : "⚡ Dev PDF"}
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "12px 32px", fontSize: 14, fontWeight: 500,
              background: generating ? "#9CA3AF" : "#1D3557",
              color: "white", border: "none", borderRadius: 6,
              cursor: generating ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "-0.1px",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { if (!generating) e.currentTarget.style.background = "#152A47"; }}
            onMouseLeave={e => { if (!generating) e.currentTarget.style.background = generating ? "#9CA3AF" : "#1D3557"; }}>
            {generating ? "Redirecting to checkout…" : "Generate DealBrief →"}
          </button>
          </div>
          {/* Price callout right under the Generate button — pre-empts
              the Stripe-page sticker shock that was likely a factor in
              the one paid-path drop we saw this week. Right-aligned to
              hug the Generate button. */}
          <p style={{
            fontSize: 11, color: "#6B7280", margin: 0,
            textAlign: "right", letterSpacing: "0.2px", lineHeight: 1.5,
          }}>
            <span style={{ color: "#1D3557", fontWeight: 600 }}>First report free</span>
            {" "}with email above. Additional reports{" "}
            <span style={{ color: "#1F2937", fontWeight: 600 }}>$29 each</span>.
          </p>
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
        <span style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: "0.2px" }}>
          Pre-Offer Research
        </span>
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
            Pre-offer property research for multifamily buyers. Tax, permits, FEMA flood, crime, demographics, and debt service scenarios — one 60-second PDF.
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
              { src: "/sample-debt-service.png",  alt: "Sample debt service scenarios page" },
              { src: "/sample-demographics.png",  alt: "Sample crime and demographics page" },
              { src: "/sample-key-flags.png",     alt: "Sample deal context and key flags page" },
            ].map((s) => (
              <a
                key={s.src}
                href="/sample-report.pdf"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  sendGAEvent("event", "sample_preview_click", {
                    file_name: "sample-report.pdf",
                    card_name: s.src.replace("/sample-", "").replace(".png", ""),
                    location: "mobile_above_fold",
                  });
                }}
                style={{
                  display: "block",
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
              </a>
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
            First report free. No credit card. No subscription.
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
          Regrid{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          U.S. Census{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          BLS{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          Shovels{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          GreatSchools{" "}<span style={{ color: "#D1D5DB" }}>·</span>{" "}
          county tax assessors
        </p>

        {/* PIPELINE ERROR */}
        {pipelineError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 13, color: "#B91C1C" }}>
            {pipelineError}
          </div>
        )}

        {/* SAMPLE REPORT */}
        <div style={{ margin: "12px 0 8px", textAlign: "center" }}>
          <a
            href="/sample-report.pdf"
            target="_blank"
            rel="noopener noreferrer"
            // Fires a Google Analytics custom event so we can see how many
            // visitors download the sample PDF vs how many actually run a
            // report from the address-input box. Event name kept in sync
            // with the GA4 custom-event definition; if you rename it here,
            // also rename it in the GA UI to keep historical reporting.
            onClick={() => {
              sendGAEvent("event", "sample_report_download", {
                file_name: "sample-report.pdf",
                location: "landing_below_form",
              });
            }}
            style={{
              fontSize: 13, color: "#457B9D", textDecoration: "none",
              borderBottom: "1px solid #457B9D", paddingBottom: 1,
              fontFamily: "inherit", letterSpacing: "-0.1px",
            }}
          >
            View a sample report to see what&rsquo;s included &rarr;
          </a>
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
            { src: "/sample-debt-service.png",  alt: "Sample debt service scenarios page" },
            { src: "/sample-demographics.png",  alt: "Sample crime and demographics page" },
            { src: "/sample-key-flags.png",     alt: "Sample deal context and key flags page" },
          ].map((s) => (
            <a
              key={s.src}
              href="/sample-report.pdf"
              target="_blank"
              rel="noopener noreferrer"
              // Separate GA event from the text-link's `sample_report_download`
              // so the two click targets show up as distinct rows in GA reports
              // (no need to slice by an event parameter). `card_name` lets us
              // also see which of the three previews is doing the most work.
              onClick={() => {
                sendGAEvent("event", "sample_preview_click", {
                  file_name: "sample-report.pdf",
                  card_name: s.src.replace("/sample-", "").replace(".png", ""),
                });
              }}
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
              {/* Plain <img> instead of next/image: these are static
                  bitmaps in /public, not above-the-fold critical, and
                  next/image's required dimensions add boilerplate
                  without measurable benefit at this size. */}
              <img
                src={s.src}
                alt={s.alt}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </a>
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
            Multifamily Markets We Cover
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
                  "Louisville / Lexington, KY",
                  "Northern Kentucky",
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
                  "Cincinnati, OH",
                  "Dayton, OH",
                  "Nashville, TN",
                  "Memphis, TN-MS",
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
                {markets.map((label) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>●</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
                  </div>
                ))}
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
            <a
              href="/blog"
              style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.color = "#1D3557"}
              onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
            >
              Blog
            </a>
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

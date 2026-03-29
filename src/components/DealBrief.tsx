"use client";
import React, { useState, useEffect, useRef } from "react";

const MOCK_RETURN_DATA = {
  address: "2718 Cleveland St, Dallas, TX 75215",
  propertyType: "Multifamily Apartment",
  yearBuilt: "1961",
  buildingArea: "8,000 SF",
  lotSize: "0.29 AC",
  units: "8",
  unitMix: "4x 3BR/1BA, 4x 4BR/1BA",
  zoning: "MF-2",
  assessedValue: "$925,000",
  landValue: "$125,000",
  improvementValue: "$800,000",
  taxRate: "2.3%",
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
  "Estimating walk score",
];

function LoadingSequence() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 420);
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

function FieldRow({ label, name, value, placeholder, editable = true }: { label: string; name?: string; value?: string; placeholder?: string; editable?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "0 24px", height: 44,
      borderBottom: "1px solid #F3F4F6",
    }}>
      <span style={{ width: 180, fontSize: 13, color: "#6B7280", flexShrink: 0, letterSpacing: "-0.1px" }}>
        {label}
      </span>
      {editable ? (
        <input
          type="text"
          name={name}
          defaultValue={value || ""}
          placeholder={placeholder || ""}
          style={{
            flex: 1, padding: "0 8px", height: 32, fontSize: 14, color: "#111827",
            border: "1px solid transparent", borderRadius: 4,
            background: "transparent", fontFamily: "inherit",
            transition: "all 0.12s",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFAFA"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
        />
      ) : (
        <span style={{ fontSize: 14, color: "#111827" }}>{value}</span>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white", borderRadius: 8, border: "1px solid #E5E7EB",
      marginBottom: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "10px 24px", borderBottom: "1px solid #E5E7EB" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.8px", textTransform: "uppercase" }}>
          {title}
        </span>
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
  const [suggestDone, setSuggestDone] = useState(false);
  const [data, setData] = useState<typeof MOCK_RETURN_DATA | null>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const [selectedRates, setSelectedRates] = useState(["8.5", "7.5", "6.5", "5.0"]);
  const [selectedLtvs, setSelectedLtvs] = useState(["75", "50"]);
  const [amortYears, setAmortYears] = useState("30");
  const [ioPeriod, setIoPeriod] = useState("0");

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 50);
  }, []);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleGenerate = async () => {
    if (!formRef.current) return;
    setGenerating(true);
    setGenerateError("");
    const fd = new FormData(formRef.current);
    const body: Record<string, unknown> = {};
    fd.forEach((val, key) => { body[key] = val; });
    body.rates = selectedRates;
    body.ltvs = selectedLtvs;
    body.amortYears = amortYears;
    body.ioPeriod = ioPeriod;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setGenerating(false);
    }
  };

  const go = () => {
    if (!address.trim()) return;
    setView("loading");
    setTimeout(() => {
      setData({ ...MOCK_RETURN_DATA, address });
      setView("confirm");
    }, 2600);
  };

  const submitSuggest = () => {
    if (!suggestVal.trim()) return;
    setSuggestDone(true);
    setSuggestVal("");
    setTimeout(() => { setSuggestDone(false); setSuggestOpen(false); }, 2500);
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
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <LoadingSequence />
    </div>
  );

  if (view === "confirm" && data) return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
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

      <form ref={formRef}>
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
          <FieldRow label="Type" name="propertyType" value={data.propertyType} />
          <FieldRow label="Year Built" name="yearBuilt" value={data.yearBuilt} />
          <FieldRow label="Building Area" name="buildingArea" value={data.buildingArea} />
          <FieldRow label="Lot Size" name="lotSize" value={data.lotSize} />
          <FieldRow label="Units" name="units" value={data.units} />
          <FieldRow label="Unit Mix" name="unitMix" value={data.unitMix} />
        </SectionCard>

        {/* Tax Assessment — only shown when auto-fetch failed */}
        {!data.assessedValue && (
          <SectionCard title="Tax Assessment · Not Found">
            <FieldRow label="Assessed Value" name="assessedValue" value="" placeholder="e.g. $925,000" />
            <FieldRow label="Land Value" name="landValue" value="" placeholder="e.g. $125,000" />
            <FieldRow label="Improvements" name="improvements" value="" placeholder="e.g. $800,000" />
            <FieldRow label="Effective Tax Rate" name="taxRate" value="" placeholder="e.g. 2.3%" />
          </SectionCard>
        )}

        <SectionCard title="Deal Inputs · Optional">
          <FieldRow label="Asking Price" name="askingPrice" value="" placeholder="$995,000" />
          <FieldRow label="Broker Cap Rate" name="brokerCapRate" value="" placeholder="6.76%" />
          <FieldRow label="Occupancy" name="occupancy" value="" placeholder="100%" />
          <FieldRow label="In-Place Rents" name="inPlaceRents" value="" placeholder="3BR: $1,100 / 4BR: $1,300" />
          <FieldRow label="Broker Claims" name="brokerClaims" value="" placeholder="New roof 2022, renovated units" />
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

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, marginTop: 20 }}>
          {generateError && (
            <p style={{ fontSize: 13, color: "#C0392B", margin: 0, textAlign: "right" }}>{generateError}</p>
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
      </div>
      </form>
    </div>
  );

  // LANDING
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

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

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "80px 24px 48px" }}>
        {/* HERO */}
        <div style={{
          marginBottom: 48,
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.5s ease",
        }}>
          <h1 style={{
            fontSize: 32, fontWeight: 600, color: "#111827", lineHeight: 1.25,
            margin: "0 0 14px", letterSpacing: "-0.5px",
          }}>
            The research brief you'd build yourself — if you had 3 hours.
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
            Enter a multifamily address.  Get tax assessment, permit records, flood zone, crime, demographics, and debt service analysis in one report.
          </p>
        </div>

        {/* INPUT */}
        <div style={{
          background: "white", borderRadius: 8, padding: "24px",
          border: "1.5px solid #1D3557",
          marginBottom: 12,
        }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Property Address
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="2718 Cleveland St, Dallas, TX 75215"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === "Enter" && go()}
              style={{
                flex: 1, padding: "12px 14px", fontSize: 15, border: "1.5px solid #D1D5DB",
                borderRadius: 6, outline: "none", color: "#111827", background: "white",
                fontFamily: "inherit", transition: "border-color 0.12s", letterSpacing: "-0.1px",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#1D3557"}
              onBlur={e => e.currentTarget.style.borderColor = "#D1D5DB"}
            />
            <button onClick={go} style={{
              padding: "12px 24px", fontSize: 14, fontWeight: 500,
              background: "#1D3557", color: "white", border: "none", borderRadius: 6,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              transition: "background 0.12s", letterSpacing: "-0.1px",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#152A47"}
              onMouseLeave={e => e.currentTarget.style.background = "#1D3557"}>
              Run Brief
            </button>
          </div>
        </div>

        {/* DFW NOTE */}
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 48px", paddingLeft: 2 }}>
          Currently covering Dallas, Denton, Tarrant & Collin counties.
        </p>

        {/* FEATURES — card grid */}
        <div style={{ marginBottom: 48 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: 14 }}>
            What's in the brief
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Tax Assessment", desc: "Assessed value vs. asking price, reassessment risk modeling" },
              { label: "Permit History", desc: "City records cross-referenced against broker capex claims" },
              { label: "FEMA Flood Zone", desc: "Flood designation, insurance requirements, lender impact" },
              { label: "Crime & Safety", desc: "ZIP-level crime grade, rate per 1,000, national percentile" },
              { label: "Demographics", desc: "Median income, population, housing tenure, education" },
              { label: "Walk & Bike Score", desc: "Walkability, bike infrastructure, transit access" },
              { label: "Back-of-Envelope NOI", desc: "GPR, vacancy, OpEx breakdown, estimated cap rate" },
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
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <input
                type="text" placeholder="e.g. Houston, TX" value={suggestVal}
                onChange={e => setSuggestVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitSuggest()}
                autoFocus
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
          )}
          {suggestDone && (
            <p style={{ fontSize: 13, color: "#059669", margin: "12px 0 0", fontWeight: 500 }}>
              Noted — thanks.
            </p>
          )}
        </div>

        {/* FOOTER */}
        <p style={{ fontSize: 11, color: "#C4C7CC", textAlign: "center", margin: 0 }}>
          Public data aggregation for informational purposes only.  Not investment advice.
        </p>
      </div>
    </div>
  );
}

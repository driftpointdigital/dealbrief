---
title: "How to Analyze Debt Service on an Apartment Building"
slug: "multifamily-debt-service-dscr-analysis"
description: "DSCR and debt service stress testing for small multifamily. How to model rate and LTV scenarios pre-offer, what your lender actually wants to see, and the breakeven occupancy that tells you whether the deal really works."
date: "2026-04-02"
category: "Underwriting"
keywords:
  - "multifamily debt service calculator"
  - "apartment building DSCR analysis"
  - "DSCR multifamily"
  - "debt service coverage ratio apartments"
  - "multifamily underwriting DSCR"
author: "DealBrief"
---

Debt service is where small multifamily deals quietly break. Buyers run a single base-case scenario at the rate the broker mentioned and the LTV the lender promised, the DSCR comes back at 1.25, and they call it good. Then rates move 75 bps before close, or the appraisal comes in low, or the lender's actual proceeds are 65% LTV instead of 75%, and suddenly the deal pencils at 1.10 instead.

A real debt service analysis runs the deal across multiple rates and multiple LTVs, then asks: at what occupancy and rent does this deal stop covering its debt? The buyers who do this consistently come out ahead.

## What DSCR actually is

Debt Service Coverage Ratio is the ratio of NOI to annual debt service.

`DSCR = NOI / (P&I payment × 12)`

A DSCR of 1.25 means the property's NOI is 25% larger than its annual debt service. A DSCR of 1.0 means NOI exactly covers debt; below 1.0, the property doesn't cash flow.

What counts as NOI matters. Use a clean NOI: gross potential rent, minus vacancy and collection loss (a realistic number, not 3%), minus operating expenses including reserves, minus property taxes (the post-sale tax, not the broker-quoted tax). What's left is what your lender will use.

What counts as debt service is the principal and interest payment on the senior mortgage. Don't include mezzanine or seller financing in the senior DSCR (track those separately).

## What lenders actually require

Different lenders, different DSCR floors. Rough ranges as of late 2025:

- **Agency (Fannie / Freddie small-balance)**: 1.25x DSCR minimum, sometimes 1.30x for higher-LTV deals.
- **Community banks**: 1.20-1.25x, with flexibility based on borrower track record.
- **CMBS**: 1.25x typically, sometimes 1.30x in tighter markets.
- **DSCR loans (non-recourse, investor-focused)**: 1.0-1.25x depending on lender. These are the loans that have grown most aggressively post-2020.
- **Bridge / hard money**: rarely DSCR-constrained, but you're paying for that flexibility in rate.

The DSCR your lender quotes is calculated on their underwritten NOI, not your pro forma NOI. Lenders make adjustments. Common adjustments: they'll use a higher vacancy assumption than you, they'll include reserves you didn't, they'll adjust the rent roll for above-market units. The result is the lender's NOI usually comes in 5-15% below your pro forma. Build that into your modeling.

## The actual analysis: rate and LTV scenarios

Don't run a single base case. Run a grid.

**Rate scenarios:**
- Your current quoted rate (call it R)
- R + 100 bps
- R + 200 bps

**LTV scenarios:**
- The LTV the lender promised (often 75% for agency)
- A more conservative LTV (often 65-70%)

That's a 3 × 2 = 6 scenario grid. For each cell, compute the loan amount, the P&I payment at your amortization (usually 25-30 year), and the resulting DSCR.

Example for a $1.2M purchase, $90K NOI, 30-year amortization:

| Rate / LTV | 75% ($900K loan) | 65% ($780K loan) |
|---|---|---|
| 6.50% | DSCR 1.32 | DSCR 1.53 |
| 7.50% | DSCR 1.19 | DSCR 1.37 |
| 8.50% | DSCR 1.08 | DSCR 1.25 |

What this tells you: at the lender's promised LTV (75%) and a 100 bps rate move (7.50%), the deal is at 1.19 DSCR, which is below the agency minimum of 1.25. If rates move before close, you either need to put more equity in (lower the LTV) or accept terms from a lender with a lower DSCR floor (and probably a higher rate).

If your business plan can't survive a +100 bps shock at the lender's stated LTV, that's information you should price into your offer. Either bid lower, structure with more equity, or be prepared to walk.

## Breakeven occupancy: the question lenders don't ask

DSCR tells you whether the deal covers debt at the underwritten NOI. Breakeven occupancy tells you how much room you have before it doesn't.

`Breakeven occupancy = (Operating expenses + Debt service) / Gross potential rent`

If your breakeven is 78%, you can lose 22% of your rent (through vacancy, concessions, or collection loss) before you stop covering operating costs plus mortgage. That's your real margin of safety.

For small multifamily in stable markets, breakeven below 80% is comfortable. Breakeven at 85-90% means a single bad tenant turn or a 90-day vacancy can flip the property cash-flow-negative for the month. Breakeven above 90% means you're financing a job, not an investment.

Compute breakeven for each rate scenario in the grid above. The deal that pencils at base case but has 91% breakeven at +200 bps is a deal you should bid lower on.

## The OpEx component most buyers miss

DSCR analysis is sensitive to NOI. NOI is sensitive to operating expenses. Most buyers underestimate operating expenses, especially on small multifamily.

The classic missing pieces:

- **Management fee** (when the property is self-managed by the seller): add 6-10% of EGI.
- **Reserves**: $250-500 per unit per year, minimum.
- **Real-world insurance**: post-2022, carrier rates have hardened. Get a real quote, not a placeholder. In FL and coastal TX, this can be 2-3x what historical OpEx shows.
- **Capex / turnover**: the actual cost of preparing a unit for re-lease. Often $1,500-4,000 per turn on smaller units, more for larger.

Run the deal twice: once with the seller's claimed OpEx, once with a market-realistic OpEx. The difference is usually 15-25% of expenses, which translates to 8-15% of NOI, which translates to 0.10-0.20 of DSCR.

If your DSCR with realistic OpEx is below your lender's floor at any of the rate scenarios in your grid, the deal probably doesn't work without an equity injection or a price cut.

## What to do with the analysis

Three options when the grid reveals stress.

**Bid lower.** The simplest fix. If the deal works at $1.1M instead of $1.2M, offer $1.1M. The seller can take it or find another buyer.

**Structure differently.** More equity (lower LTV), shorter amortization (worse DSCR but lower total interest), interest-only period (better DSCR in years 1-3 but back-loads risk), or seller financing (sometimes the seller will carry at terms a bank won't).

**Accept the deal and hold a larger reserve.** If you believe in the long-term thesis and the breakeven occupancy is acceptable, hold 6-12 months of debt service in a separate account. This is what experienced buyers do on deals they want to win despite the math being tight.

What you should not do: assume rates will fall, or that rents will grow into the deal, or that you'll figure it out. The deals that fail in years 3-5 are almost all deals where the buyer assumed one of those things.

## Or get the debt service scenarios run for you

[DealBrief](https://www.getdealbrief.com) runs the full debt service scenario grid (4 rates × 2 LTVs, with DSCR, cash-on-cash, and breakeven occupancy for each) on any address in our covered markets. Real OpEx benchmarks, post-sale tax projections, and the rest of the [pre-offer due diligence checklist](/blog/pre-offer-due-diligence-checklist-small-multifamily) included. Your first report is free.

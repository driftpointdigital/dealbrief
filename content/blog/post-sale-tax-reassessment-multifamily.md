---
title: "How to Estimate Post-Sale Tax Reassessment on a Multifamily Property"
slug: "post-sale-tax-reassessment-multifamily"
description: "The current tax bill on the OM is for the current owner, not for you. Here's how to model the post-sale tax bump in TX, FL, AZ, NC, PA, and other multifamily markets, with worked examples."
date: "2026-05-11"
category: "Due Diligence"
keywords:
  - "property tax reassessment multifamily"
  - "tax assessment vs purchase price"
  - "post-sale tax reassessment"
  - "multifamily tax bump after sale"
  - "how taxes change after buying apartment building"
author: "DealBrief"
---

The current tax bill on the offering memo is for the current owner, not for you. After you close, the assessor will catch up. In some states they catch up immediately. In others they catch up in 4 to 7 years. In rare states they don't catch up at all until the next mandated reassessment cycle.

How much they catch up by, and how fast, depends entirely on which state and county you're buying in. Pricing this wrong is the single most common underwriting miss on small multifamily, and the impact to NOI from post-sale reassessment in volume markets like Texas, Florida, and Arizona can be very material and result in significantly lower returns than initial underwriting expected.

This post is the practical model for getting the post-sale tax number right.

## Three reassessment systems

US jurisdictions fall into three buckets. The bucket determines how you model.

### Annual or near-annual reassessment

The assessor revalues every year. Sale or no sale, they're updating the assessed value to track market.

**Where this applies:**
- **Texas**: Travis, Dallas, Harris, Tarrant, and Bexar counties all reassess annually. No cap on investment property growth.
- **Florida non-homestead**: investment property is subject to a 10% annual assessed-value growth cap, but is reassessed every year up to that cap.
- **Arizona**: Limited Property Value (LPV) is the actual tax base, capped at 5% per year growth. Full Cash Value (FCV) is reassessed annually to track market.
- **Most Florida counties for non-homestead property** (10% YoY assessed cap).

**What this means for you:** assume the assessor catches your purchase price within 1 to 7 years, depending on the cap and how far above current assessed your sale price is. If there's no cap (TX), you might see the catch-up in year 1. If there's a 10% cap (FL non-homestead) and you bought 60% above current assessed, you'll see roughly 10% per year increases for the next 5 to 6 years.

### Sale-triggered reassessment

The sale itself triggers a reset to market value, which the assessor interprets as your purchase price in most cases.

**Where this applies:** California (Prop 13 system: sale resets the base year to the year of sale; thereafter capped at 2% per year on the now-elevated base). Not common outside CA.

**What this means for you:** post-close tax equals purchase price times millage rate. That's your year-1 number, no matter what the OM shows.

### Cycle-based reassessment

The assessor revalues only on a multi-year cycle. The sale does NOT trigger a reset. You inherit the existing assessed value until the next cycle hits.

**Where this applies:**
- **Pennsylvania**: each county sets its own cycle. Allegheny last reassessed 2012. Bucks last reassessed 1972 (yes, really). Lehigh 2013. Lancaster 2018. Delaware 2021. Chester 1998. Montgomery 1998. Philadelphia is the exception: OPA reassesses annually and behaves more like the first bucket.
- **North Carolina**: each county on a 4 to 8 year cycle. Mecklenburg (Charlotte) reappraises every 4 years; most other counties every 8.
- **Maryland**: 3-year triennial cycle by group.
- **Parts of Massachusetts and a few other states.**

**What this means for you:** your year-1 tax is the seller's tax. But you need to know when the next cycle hits and model the bump that arrives at cycle reset.

## Why brokers show you the wrong number

Brokers quote the current tax bill. Two reasons. First, it's the only number that's publicly available with certainty. Second, it's the smaller number.

The first reason is fair. The second is a magician's misdirection. They're not lying. They're showing you a real number. It's just a real number that doesn't apply to you.

## How to model the post-sale tax in four steps

### Step 1: identify which system applies

Look up the assessor's reassessment policy. Three quick signals:

- **Annual market valuation**: the assessor website will say "values reflect market as of January 1, [year]" and the year updates annually.
- **Sale-triggered**: California only, basically.
- **Cycle-based**: the website will state a base year (e.g., "values reflect 2018 market") that does NOT update annually.

If you can't tell, the cycle-based jurisdictions almost always advertise the cycle prominently because it determines tax appeals.

### Step 2: get the millage rate

Total millage per $1,000 of assessed value, summed across all taxing authorities (county, city or township, school district, any special districts). The combined rate is typically what's published on the tax bill, but you may need to add layers manually if the property is in an unincorporated area.

For PA, the rate is RAW-assessment-relative (multiplies the base-year value, not the FMV). For most other states, the rate is FMV-relative.

### Step 3: project the new assessed value

By system:

- **Annual reassessment, no cap (TX)**: project new assessed = purchase price.
- **Annual reassessment, capped (FL non-homestead 10%, AZ LPV 5%)**: project new assessed = current assessed × (1 + cap) raised to the number of years until catch-up. Catch-up year is when (1 + cap)^N × current = purchase price.
- **Sale-triggered (CA)**: new assessed = purchase price (year 1).
- **Cycle-based, pre-cycle (NC mid-cycle, PA, MD mid-cycle)**: new assessed = current assessed (no change until next cycle).
- **Cycle-based, at next cycle**: estimate cycle-end value using recent comparable sales in the same county; the assessor will use mass appraisal methods that follow the broad market trend, not your specific sale.

### Step 4: project the annual tax

`Annual tax = new assessed value × combined millage rate / 1,000`

In states where you got a discount via assessed-value caps, model the year-by-year ramp, not just year 1 vs. year 7. The ramp is real cash flow.

## Worked examples

### Charlotte triplex (Mecklenburg County, NC)

Mecklenburg reassesses every 4 years. Most recent was 2023; next is 2027.

- Purchase price: $750,000
- Current assessed: $400,000
- Combined millage: 1.3% (county + city)

**Year 1-4 tax:** $400,000 × 1.3% = $5,200/year.

**Year 5+ tax (post-2027 reassessment):** anchored to recent Mecklenburg multifamily comps, estimated $650,000-$750,000. Best estimate $700,000.

`$700,000 × 1.3% = $9,100/year`

Tax bump in year 5: +$3,900/year. NPV over a 7-year hold at 10% discount: roughly $11,000. Material to the offer.

### Tampa 16-unit (Hillsborough County, FL)

Florida non-homestead: annual reassessment, 10% cap.

- Purchase price: $2,400,000
- Current assessed: $1,400,000
- Combined millage: 2.0%

**Year 1 tax:** assessor moves to $1,400,000 × 1.10 = $1,540,000 assessed. Tax = $30,800.

**Year 2 tax:** $1,540,000 × 1.10 = $1,694,000. Tax = $33,880.

**Year 7 tax:** caught up to $2,400,000 (give or take based on market changes during the catch-up period). Tax = $48,000.

**Broker quoted:** $1,400,000 × 2.0% = $28,000. By year 3 you're paying 30% more. By year 7 you're paying 70% more. If your DSCR was 1.25 at the broker's number, you may be below 1.10 by year 5 on tax escalation alone, before any rate stress.

### Bucks County, PA duplex

Bucks last reassessed 1972. The base year doesn't update without legislative action.

- Purchase price: $400,000
- Current assessed (raw base-year): $40,000
- STEB Common-Level Ratio for Bucks: 0.0586 (meaning the raw value represents about 5.86% of current FMV)
- Combined millage: 3.5% (raw-relative)

**Year 1+ tax:** $40,000 × 3.5% = $1,400/year. Unchanged.

**There is no post-sale reassessment in Pennsylvania** outside of Philadelphia. The assessment stays anchored to the 1972 base year. The seller's tax bill IS your tax bill, indefinitely.

What that means: you can underwrite Bucks County multifamily at the current tax bill. The tax bump everyone else worries about doesn't exist here. (Other things do, but tax catch-up isn't one of them.)

## What to do with the post-sale tax number

If the post-sale tax is materially higher than the broker-quoted tax (almost always true in TX, FL, AZ markets), three options.

**Reprice your offer.** Calculate the NPV of the tax bump over your projected hold. Cut the offer by that amount, in writing. Brokers will push back, but the discount is real and the math is in your favor.

**Run rate sensitivity together with tax sensitivity.** A property that pencils at 5.5% rates plus broker-quoted tax may not pencil at 7% rates plus post-sale tax. Make sure the deal works across both stresses simultaneously, not one at a time.

**Adjust your exit cap assumption.** The buyer at exit will model the same way you should be modeling now. Their year-1 tax is your year-N tax. So the NOI you can sell on at exit is lower than the NOI you hold on. Your exit cap effectively widens against you, which compresses your projected return on equity. Build that in.

## Or get the modeling done for you

[DealBrief](https://www.getdealbrief.com) pulls current assessed value, current combined millage, sale history, and (for PA and AZ) the state-specific rescaling factors that determine your post-sale tax. The full back-of-envelope tax projection is included in every report, alongside the rest of the [pre-offer diligence checklist](/blog/pre-offer-due-diligence-checklist-small-multifamily). Your first report is free.

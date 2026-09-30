"""
Impact modeling formulas for advertising recommendations.
Provides concrete, quantified impact calculations with confidence levels.

Currency: every text-building function accepts currency_symbol (default "RM ")
so recommendation formulas/assumptions render in the account currency. The
default keeps MYR clients (e.g. YCK) byte-identical; callers thread the real
symbol via utils.currency_symbol(account_currency_code).
"""


def _to_monthly(value, date_days):
    """Normalize a value from an arbitrary date window to a monthly projection."""
    return value / max(date_days, 1) * 30.44


# ── Sanity caps (P4) ─────────────────────────────────────────────────────────
# Projections are directional estimates; these bounds stop any single rec from
# promising an implausible result. Conservative guardrails, not platform-sourced.
MAX_VOLUME_UPLIFT = 1.0        # never project >100% more conversions than current
MAX_SPEND_UPLIFT_RATIO = 1.0   # never project additional spend > current spend

# ── Exclusion realism (P6) ───────────────────────────────────────────────────
# A zero-converting segment's spend is not 100% recoverable: excluding it usually
# reallocates budget elsewhere rather than deleting it, and a small sample is weak
# evidence of true waste.
EXCLUSION_REALLOCATION_HAIRCUT = 0.7  # share of excluded spend counted as real savings
EXCLUSION_MIN_SPEND = 20.0            # window spend below which "waste" is low-confidence

# ── Uplift coefficients ──────────────────────────────────────────────────────
# Directional heuristics — industry-standard in concept, magnitudes chosen in-house
# (not sourced from a published platform benchmark). Named here so every model shares
# one definition instead of scattered magic numbers; tune in one place.
SCALING_VOLUME_UPLIFT = 0.20      # budget scale-up → ~+20% conversions (diminishing returns)
SCALING_CPA_DEGRADATION = 1.10    # incremental traffic converts ~10% more expensively
BID_INCREASE_EFFICIENCY = 0.80    # +X% bid → ~0.8·X% more volume
BID_DECREASE_CONV_LOSS = 0.20     # a bid cut sheds ~20% of the keyword's conversions
SCHEDULE_PEAK_MULTIPLIER = 2.5    # peak hours convert ~2.5× the wasted-hour rate
CPA_VALUE_MULTIPLE = 3            # 3× CPA proxy for value/conversion when none is tracked


def real_customer_value(conversion_value=0, conversions=0, value_per_conversion=None):
    """Revenue per conversion from the account's own tracked data, else None.

    Prefers the platform-reported value_per_conversion; otherwise derives it from
    tracked conversion_value / conversions. Returns None when no tracked value
    exists, which signals callers/models to fall back to the 3× CPA proxy.
    """
    if value_per_conversion and value_per_conversion > 0:
        return value_per_conversion
    if conversion_value and conversions and conversion_value > 0 and conversions > 0:
        return conversion_value / conversions
    return None


def calculate_exclusion_impact(spend, conversions=0, date_days=30, currency_symbol="RM "):
    """
    Calculate impact of excluding zero-converting audiences/placements.

    Args:
        spend: Spend over the selected date range
        conversions: Number of conversions (should be 0 for exclusions)
        date_days: Number of days in the selected range (used to normalize to monthly)
        currency_symbol: Account currency prefix for text output

    Returns:
        dict with monthly_savings, confidence, confidence_pct, formula
    """
    # Only part of the excluded spend is truly recoverable (the rest reallocates).
    monthly_savings = _to_monthly(spend, date_days) * EXCLUSION_REALLOCATION_HAIRCUT

    # Confidence scales with sample size: a big zero-converter is clear waste, a tiny
    # one is weak evidence.
    if spend >= EXCLUSION_MIN_SPEND * 3:
        confidence_pct = 85
    elif spend >= EXCLUSION_MIN_SPEND:
        confidence_pct = 70
    else:
        confidence_pct = 50
    confidence = 'high' if confidence_pct >= 80 else 'moderate' if confidence_pct >= 60 else 'low'

    haircut_pct = int(EXCLUSION_REALLOCATION_HAIRCUT * 100)
    return {
        'monthly_savings': monthly_savings,
        'additional_conversions_monthly': 0,
        'additional_revenue_monthly': 0,
        'confidence': confidence,
        'confidence_pct': confidence_pct,
        'formula': f"{currency_symbol}{spend:.2f} / {date_days}d × 30.44 × {haircut_pct}% recoverable = {currency_symbol}{monthly_savings:.2f} saved/month",
        'assumptions': [
            'Segment has 0 conversions',
            f'~{haircut_pct}% of this spend is recoverable (rest reallocates to other segments)',
            'Trend continues if not excluded'
        ]
    }


def calculate_scaling_impact(current_spend, current_conversions, scale_factor=1.25, customer_value=None, date_days=30, currency_symbol="RM "):
    """
    Calculate impact of scaling budget for top performers.

    Args:
        current_spend: Spend over the selected date range
        current_conversions: Conversions over the selected date range
        scale_factor: Budget multiplier (1.25 = 25% increase)
        customer_value: Revenue per conversion
        date_days: Number of days in the selected range (used to normalize to monthly)
        currency_symbol: Account currency prefix for text output
    """
    if current_conversions == 0:
        return {
            'monthly_savings': 0,
            'additional_conversions_monthly': 0,
            'additional_revenue_monthly': 0,
            'confidence': 'low',
            'confidence_pct': 30,
            'formula': 'No conversions to scale from',
            'assumptions': []
        }

    current_cpa = current_spend / current_conversions

    if customer_value is None:
        customer_value = current_cpa * CPA_VALUE_MULTIPLE
        value_note = f'{currency_symbol}{customer_value:.0f} (estimated 3× CPA)'
    else:
        value_note = f'{currency_symbol}{customer_value:.0f} (your tracked conversion value)'

    new_cpa = current_cpa * SCALING_CPA_DEGRADATION
    additional_conversions = current_conversions * SCALING_VOLUME_UPLIFT
    # Sanity caps: never project implausible uplift, and don't advertise a net loss.
    additional_conversions = min(additional_conversions, current_conversions * MAX_VOLUME_UPLIFT)
    additional_revenue = additional_conversions * customer_value
    additional_spend = min(additional_conversions * new_cpa, current_spend * MAX_SPEND_UPLIFT_RATIO)
    net_benefit = max(0.0, additional_revenue - additional_spend)

    return {
        'monthly_savings': 0,
        'additional_conversions_monthly': _to_monthly(additional_conversions, date_days),
        'additional_spend_monthly': _to_monthly(additional_spend, date_days),
        'additional_revenue_monthly': _to_monthly(additional_revenue, date_days),
        'net_benefit_monthly': _to_monthly(net_benefit, date_days),
        'new_cpa': new_cpa,
        'confidence': 'moderate',
        'confidence_pct': 70,
        'formula': f"{current_conversions:.1f} conv × {int(SCALING_VOLUME_UPLIFT * 100)}% growth × {value_note} - {additional_conversions:.1f} conv × {currency_symbol}{new_cpa:.2f} CPA",
        'assumptions': [
            f'{int((scale_factor - 1) * 100)}% budget increase → {int(SCALING_VOLUME_UPLIFT * 100)}% volume increase (diminishing returns)',
            f'CPA increases {int((SCALING_CPA_DEGRADATION - 1) * 100)}% (lower intent traffic)',
            f'Customer value: {value_note}'
        ]
    }


def calculate_creative_refresh_impact(spend, frequency, current_conversions, customer_value=None, date_days=30, currency_symbol="RM "):
    """
    Calculate impact of refreshing fatigued creatives.

    Assumptions based on frequency severity:
    - Frequency > 5: CTR +40%, Conv Rate +10%
    - Frequency 3-5: CTR +25%, Conv Rate +10%

    Args:
        spend: Ad spend over the selected window
        frequency: Current ad frequency
        current_conversions: Conversions over the selected window
        customer_value: Revenue per conversion
        date_days: Number of days in the selected window (normalizes to monthly)
        currency_symbol: Account currency prefix for text output

    Returns:
        dict with impact metrics, confidence, formula
    """
    # Impact varies by frequency severity
    if frequency > 5:
        ctr_improvement = 0.40
        conv_rate_improvement = 0.10
        confidence_pct = 75
    elif frequency > 3:
        ctr_improvement = 0.25
        conv_rate_improvement = 0.10
        confidence_pct = 70
    else:
        ctr_improvement = 0.15
        conv_rate_improvement = 0.05
        confidence_pct = 60

    # Calculate customer value if not provided
    if current_conversions > 0 and customer_value is None:
        current_cpa = spend / current_conversions
        customer_value = current_cpa * CPA_VALUE_MULTIPLE
        value_note = f'{currency_symbol}{customer_value:.0f} (estimated 3× CPA)'
    elif customer_value is None:
        # No conversions to derive value from; revenue is 0 regardless (0 × anything).
        customer_value = 0
        value_note = 'not estimated (no conversions yet)'
    else:
        value_note = f'{currency_symbol}{customer_value:.0f} (your tracked conversion value)'

    # Additional conversions from improved conversion rate
    additional_conversions = current_conversions * conv_rate_improvement
    additional_revenue = additional_conversions * customer_value

    # Cost stays same (using existing budget more efficiently)
    net_benefit = additional_revenue

    return {
        'monthly_savings': 0,
        'additional_conversions_monthly': _to_monthly(additional_conversions, date_days),
        'additional_revenue_monthly': _to_monthly(additional_revenue, date_days),
        'net_benefit_monthly': _to_monthly(net_benefit, date_days),
        'ctr_improvement_pct': int(ctr_improvement * 100),
        'conv_rate_improvement_pct': int(conv_rate_improvement * 100),
        'confidence': 'moderate',
        'confidence_pct': confidence_pct,
        'formula': f"CTR +{int(ctr_improvement * 100)}% + Conv Rate +{int(conv_rate_improvement * 100)}% = {_to_monthly(additional_conversions, date_days):.1f} more conv/month",
        'assumptions': [
            f'Frequency {frequency:.1f} indicates creative fatigue',
            f'CTR improvement: +{int(ctr_improvement * 100)}%',
            f'Conversion rate improvement: +{int(conv_rate_improvement * 100)}%',
            f'Customer value: {value_note}'
        ]
    }


def calculate_schedule_impact(wasted_hours_spend, peak_multiplier=SCHEDULE_PEAK_MULTIPLIER, avg_cpa=None, customer_value=None, date_days=30, currency_symbol="RM "):
    """
    Calculate impact of adjusting ad schedule to avoid wasted hours.

    Assumptions:
    - Peak hours convert at ~2.5x the wasted-hour rate
    - Redirect wasted-hour spend to peak hours

    Args:
        wasted_hours_spend: Spend in low-performing hours over the selected window
        peak_multiplier: How much better peak hours perform
        avg_cpa: Account cost per acquisition (caller derives from account; falls back
            to a neutral estimate when unavailable)
        customer_value: Revenue per conversion
        date_days: Number of days in the selected window (normalizes to monthly)
        currency_symbol: Account currency prefix for text output

    Returns:
        dict with impact metrics, confidence, formula
    """
    if not avg_cpa or avg_cpa <= 0:
        avg_cpa = 50  # neutral fallback when the account has no derivable CPA

    # Calculate customer value if not provided (conservative 3× CPA)
    if customer_value is None:
        customer_value = avg_cpa * CPA_VALUE_MULTIPLE
        value_note = f'{currency_symbol}{customer_value:.0f} (estimated 3× CPA)'
    else:
        value_note = f'{currency_symbol}{customer_value:.0f} (your tracked conversion value)'

    # Conversions if we redirect to peak hours
    redirected_conversions = (wasted_hours_spend / avg_cpa) * peak_multiplier
    additional_revenue = redirected_conversions * customer_value

    # Savings from not wasting money in bad hours (don't double-count with revenue)
    monthly_savings = 0  # Conservative: don't count savings AND revenue

    return {
        'monthly_savings': monthly_savings,
        'additional_conversions_monthly': _to_monthly(redirected_conversions, date_days),
        'additional_revenue_monthly': _to_monthly(additional_revenue, date_days),
        'net_benefit_monthly': _to_monthly(additional_revenue, date_days),
        'confidence': 'moderate',
        'confidence_pct': 70,
        'formula': f"{currency_symbol}{wasted_hours_spend:.2f} redirected to peak hours ({peak_multiplier}× conversion rate)",
        'assumptions': [
            f'Peak hours convert at {peak_multiplier}× the wasted-hour rate',
            f'Redirect {currency_symbol}{wasted_hours_spend:.2f} to peak hours',
            f'Average CPA: {currency_symbol}{avg_cpa:.2f}',
            f'Customer value: {value_note}'
        ]
    }


def calculate_bid_adjustment_impact(current_bid, suggested_bid, keyword_spend, keyword_conversions, customer_value=None, date_days=30, currency_symbol="RM "):
    """
    Calculate impact of bid adjustments (Google Ads).

    Assumptions:
    - For increases: +25% bid → +20% impressions (80% efficiency)
    - For decreases: -35% bid → save 35% spend, lose 20% conversions

    Args:
        current_bid: Current max CPC bid
        suggested_bid: Recommended max CPC bid
        keyword_spend: Keyword spend over the selected window
        keyword_conversions: Keyword conversions over the selected window
        customer_value: Revenue per conversion
        date_days: Number of days in the selected window (normalizes to monthly)
        currency_symbol: Account currency prefix for text output

    Returns:
        dict with impact metrics, confidence, formula
    """
    if current_bid == 0:
        return {
            'monthly_savings': 0,
            'additional_conversions_monthly': 0,
            'additional_revenue_monthly': 0,
            'confidence': 'low',
            'confidence_pct': 30,
            'formula': 'Invalid current bid',
            'assumptions': []
        }

    bid_change_pct = (suggested_bid - current_bid) / current_bid

    # Calculate customer value if not provided
    if keyword_conversions > 0 and customer_value is None:
        current_cpa = keyword_spend / keyword_conversions
        customer_value = current_cpa * CPA_VALUE_MULTIPLE
        value_note = f'{currency_symbol}{customer_value:.0f} (estimated 3× CPA)'
    elif customer_value is None:
        # No conversions to derive value from; revenue is 0 regardless (0 × anything).
        customer_value = 0
        value_note = 'not estimated (no conversions yet)'
    else:
        value_note = f'{currency_symbol}{customer_value:.0f} (your tracked conversion value)'

    if bid_change_pct > 0:  # Increase bid
        # Volume doesn't scale 1:1 with bid - apply efficiency factor
        volume_increase = bid_change_pct * BID_INCREASE_EFFICIENCY
        additional_conversions = keyword_conversions * volume_increase if keyword_conversions > 0 else 0
        # Sanity caps: bounded uplift, no advertised net loss.
        additional_conversions = min(additional_conversions, keyword_conversions * MAX_VOLUME_UPLIFT)
        additional_revenue = additional_conversions * customer_value
        additional_spend = min(keyword_spend * bid_change_pct, keyword_spend * MAX_SPEND_UPLIFT_RATIO)
        net_benefit = max(0.0, additional_revenue - additional_spend)

        return {
            'monthly_savings': 0,
            'additional_conversions_monthly': _to_monthly(additional_conversions, date_days),
            'additional_spend_monthly': _to_monthly(additional_spend, date_days),
            'additional_revenue_monthly': _to_monthly(additional_revenue, date_days),
            'net_benefit_monthly': _to_monthly(net_benefit, date_days),
            'confidence': 'moderate',
            'confidence_pct': 70,
            'formula': f"+{int(bid_change_pct * 100)}% bid → +{int(volume_increase * 100)}% volume = {additional_conversions:.1f} more conv/{date_days}d",
            'assumptions': [
                f'{int(bid_change_pct * 100)}% bid increase → {int(volume_increase * 100)}% volume increase (80% efficiency)',
                f'Customer value: {value_note}'
            ]
        }
    else:  # Decrease bid
        savings = abs(keyword_spend * bid_change_pct)
        conversions_lost = keyword_conversions * BID_DECREASE_CONV_LOSS if keyword_conversions > 0 else 0

        return {
            'monthly_savings': _to_monthly(savings, date_days),
            'conversions_lost_monthly': _to_monthly(conversions_lost, date_days),
            'additional_conversions_monthly': -_to_monthly(conversions_lost, date_days),
            'net_benefit_monthly': _to_monthly(savings, date_days),
            'confidence': 'moderate',
            'confidence_pct': 70,
            'formula': f"{int(abs(bid_change_pct) * 100)}% bid cut → save {currency_symbol}{_to_monthly(savings, date_days):.2f}/month",
            'assumptions': [
                f'{int(abs(bid_change_pct) * 100)}% bid decrease → save {int(abs(bid_change_pct) * 100)}% spend',
                f'Lose ~{int(BID_DECREASE_CONV_LOSS * 100)}% of conversions'
            ]
        }


def get_automation_metadata(rec_type, platform='facebook'):
    """
    Get automation metadata for a recommendation type.

    Args:
        rec_type: Recommendation type
        platform: 'facebook' or 'google'

    Returns:
        dict with is_automatable, manual_reason
    """
    facebook_auto = {
        'audience_exclusion', 'creative_refresh', 'placement_exclusion',
        'budget_adjustment', 'geo_exclusion', 'schedule_adjustment',
        'budget_scaling', 'campaign_review', 'roas_scaling', 'roas_review',
        'geo_scaling', 'day_schedule'
    }

    facebook_manual_reasons = {
        'audience_fatigue': 'Creating lookalike audiences requires strategic decisions',
        'objective_mismatch': "Facebook API doesn't allow changing campaign objectives post-creation",
        'creative_test': 'A/B testing requires human creativity for new ad variations',
        'landing_page': 'Landing page optimization requires website CMS access'
    }

    google_auto = {
        'keyword_action', 'bid_adjustment', 'schedule_bid_adjustment',
        'geo_bid_adjustment', 'device_bid_adjustment', 'geo_exclusion'
    }

    google_manual_reasons = {
        'quality_improvement': 'Requires strategic improvements (landing page speed, ad relevance, promotional testing)',
        'budget_pacing': 'Informational only - no action required'
    }

    if platform == 'facebook':
        is_automatable = rec_type in facebook_auto
        manual_reason = facebook_manual_reasons.get(rec_type) if not is_automatable else None
    else:  # google
        is_automatable = rec_type in google_auto
        manual_reason = google_manual_reasons.get(rec_type) if not is_automatable else None

    return {
        'is_automatable': is_automatable,
        'manual_reason': manual_reason
    }

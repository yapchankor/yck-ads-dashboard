#!/usr/bin/env python3
"""
Complete Google Ads insights workflow with Week 1 + Week 2 Quick Wins.
Generates comprehensive analysis including search queries, quality score roadmap, ROI, budget pacing, and landing page heatmap.
"""

import json
import sys
import os
from datetime import datetime
sys.path.append('execution')

from analyze_advanced_insights import (
    analyze_search_queries,
    generate_quality_score_roadmap,
    generate_conversion_value_alert
)
from analyze_week2_insights import (
    analyze_budget_pacing,
    analyze_device_performance,
    analyze_landing_page_performance,
    analyze_geo_performance,
    analyze_time_performance
)
from impact_models import (
    calculate_exclusion_impact,
    calculate_bid_adjustment_impact,
    get_automation_metadata,
    real_customer_value,
)
from utils import currency_symbol


# Per-client branding for ad-copy recommendations, keyed by client_name (as
# passed from modal_cloud). A client absent here gets a generic refresh
# suggestion with no fabricated copy and no hardcoded landing page.
CLIENT_BRANDING = {
    "YAP CHAN KOR": {
        "website": "https://www.yapchankor.com",
        "brand_descriptor": "chiropractic care",
        "industry_setting": "chiropractic care setting, showing a chiropractor treating a patient",
    },
    "GENERA": {
        "website": "https://www.generasoftware.com",
        "brand_descriptor": "software solutions",
    },
}


def create_enhanced_insights(metrics_file, output_insights, output_recommendations, client_name=None):
    """Generate enhanced insights with all Week 1 features."""

    print("Loading metrics...")
    with open(metrics_file, 'r') as f:
        metrics = json.load(f)

    # Account currency drives all money text; defaults to "RM " (MYR) when the
    # metrics file carries no currency_code, so MYR clients stay byte-identical.
    cur = currency_symbol(metrics.get('currency_code'))
    branding = CLIENT_BRANDING.get(str(client_name or '').upper(), {})

    summary = metrics.get('summary', {})
    # Real conversion value is only trustworthy when the client's tracked value
    # represents actual revenue. Many accounts log a nominal lead value (e.g. YCK's
    # ~RM5/conv for a pain clinic), which would make projections wildly wrong. Gate on
    # a per-client flag (default off → 3× CPA proxy, numbers unchanged).
    use_tracked_value = bool(summary.get('tracked_value_is_revenue', False))
    account_cv = real_customer_value(
        summary.get('total_conversion_value', 0), summary.get('total_conversions', 0)
    ) if use_tracked_value else None

    def _cv(conv_value, conversions, value_per_conversion=None):
        """Per-entity real value, else account average, else None (→ 3× CPA proxy)."""
        if not use_tracked_value:
            return None
        return real_customer_value(conv_value, conversions, value_per_conversion) or account_cv

    campaigns = metrics.get('campaigns', [])
    keywords = metrics.get('keywords', [])
    search_queries = metrics.get('search_queries', [])

    print(f"Loaded: {len(campaigns)} campaigns, {len(keywords)} keywords, {len(search_queries)} search queries")

    start_dt = datetime.strptime(metrics['date_range']['start_date'], '%Y-%m-%d')
    end_dt = datetime.strptime(metrics['date_range']['end_date'], '%Y-%m-%d')
    days_in_range = max(1, (end_dt - start_dt).days + 1)

    def is_inactive_status(status):
        return str(status or '').upper() in {'PAUSED', 'REMOVED', 'DELETED', 'INACTIVE', 'ENDED', 'ARCHIVED'}

    def row_scope_is_active(row, include_entity_status=True):
        if is_inactive_status(row.get('campaign_status')):
            return False
        if is_inactive_status(row.get('ad_group_status')):
            return False
        if include_entity_status and is_inactive_status(row.get('status')):
            return False
        return True

    active_keywords = [k for k in keywords if row_scope_is_active(k)]
    active_search_queries = [q for q in search_queries if row_scope_is_active(q, include_entity_status=False)]

    # Run Week 1 analyses
    print("\nRunning search query analysis...")
    search_analysis = analyze_search_queries(active_search_queries, active_keywords, currency_symbol=cur)

    print("Generating quality score roadmap...")
    qs_roadmap = generate_quality_score_roadmap(active_keywords, currency_symbol=cur)

    print("Checking conversion value tracking...")
    conv_value_alert = generate_conversion_value_alert(summary, currency_symbol=cur)

    # Run Week 2 analyses
    print("Analyzing budget pacing...")
    budget_pacing = analyze_budget_pacing(metrics, monthly_budget=None, currency_symbol=cur)  # User can set budget later

    print("Analyzing device performance...")
    device_performance = analyze_device_performance(campaigns, active_keywords, metrics.get('device_performance', []), currency_symbol=cur)

    print("Creating landing page heatmap...")
    ads = metrics.get('ads', [])
    landing_page_heatmap = analyze_landing_page_performance(active_keywords, ads)

    print("Analyzing geographic performance...")
    geo_data = metrics.get('geo_performance', [])
    # Get active campaign IDs for geo/schedule recommendations
    active_campaign_ids = [str(c['id']) for c in campaigns if c.get('status') == 'ENABLED']
    geo_performance = analyze_geo_performance(geo_data, active_campaign_ids, currency_symbol=cur)

    print("Analyzing time-of-day and day-of-week performance...")
    time_data = metrics.get('time_performance', [])
    time_performance = analyze_time_performance(time_data, active_campaign_ids, currency_symbol=cur)

    # Generate base insights (your existing logic)
    insights = {
        "summary": f"Analysis of Google Ads performance for customer {metrics.get('customer_id')} "
                   f"({metrics['date_range']['start_date']} to {metrics['date_range']['end_date']}). "
                   f"Generated {summary.get('total_conversions', 0):.1f} conversions at "
                   f"{cur}{summary.get('total_cost', 0) / max(summary.get('total_conversions', 1), 1):.2f} CPA "
                   f"from {cur}{summary.get('total_cost', 0):,.2f} spend.",

        "top_performers": [],
        "underperformers": [],
        "opportunities": [],
        "metrics_highlights": summary,

        # Week 1 Quick Wins
        "search_query_analysis": search_analysis,
        "quality_score_roadmap": qs_roadmap,
        "conversion_value_alert": conv_value_alert,

        # Week 2 Quick Wins
        "budget_pacing": budget_pacing,
        "device_performance": device_performance,
        "landing_page_heatmap": landing_page_heatmap,
        "geo_performance": geo_performance,

        # Week 3 Quick Wins
        "time_performance": time_performance
    }

    # Analyze top performers (require minimum spend for statistical significance)
    # Filter: at least 2 conversions OR min RM 10 spend to avoid single-click flukes
    performing_keywords = sorted(
        [k for k in active_keywords if k['conversions'] >= 2 or (k['conversions'] >= 1 and k['cost'] >= 10)],
        key=lambda x: x.get('cost_per_conversion', 999)
    )[:5]

    for kw in performing_keywords:
        insights["top_performers"].append(
            f"Keyword '{kw['keyword_text']}': {kw['conversions']:.0f} conversions at "
            f"{cur}{kw.get('cost_per_conversion', 0):.2f} CPA"
        )

    # Add search query insights to underperformers
    if search_analysis['total_wasted_spend'] > 0:
        insights["underperformers"].append(
            f"Search Query Waste: {len(search_analysis['wasted_spend_queries'])} queries with 0 conversions, "
            f"wasting {cur}{search_analysis['total_wasted_spend']:.2f}"
        )

    # Add quality score issues
    if qs_roadmap['total_low_qs'] > 0:
        insights["underperformers"].append(
            f"Quality Score Issues: {qs_roadmap['total_low_qs']} keywords with QS < 5, "
            f"spending {cur}{qs_roadmap['total_spend_low_qs']:.2f}"
        )

    # Generate recommendations
    recommendations = []

    def is_enabled_keyword(keyword):
        return str(keyword.get('status', 'ENABLED')).upper() == 'ENABLED' and row_scope_is_active(keyword)

    def criterion_resource_name(keyword):
        return keyword.get('resource_name') or ''

    def monthly_savings_from_period(value, factor=1.0):
        return value * factor / days_in_range * 30.44

    def enrich_analyzer_recommendation(rec):
        rec = rec.copy()
        rec.setdefault("platform", "Google")
        rec.setdefault("impact", "Medium")
        rec.setdefault("automation", get_automation_metadata(rec.get("type", "review"), platform='google'))
        if rec.get("impact_data"):
            return rec

        current_spend = float(rec.get("current_spend") or 0)
        if current_spend == 0:
            current_spend = float(rec.get("cost") or 0)
        adjustment = str(rec.get("suggested_adjustment") or "")
        factor = 1.0
        if adjustment.endswith("%"):
            try:
                factor = abs(float(adjustment.replace("%", "").replace("+", ""))) / 100
            except ValueError:
                factor = 1.0

        rec["impact_data"] = {
            "monthly_savings": monthly_savings_from_period(current_spend, factor) if current_spend else 0,
            "additional_conversions_monthly": 0,
            "additional_revenue_monthly": 0,
            "net_benefit_monthly": monthly_savings_from_period(current_spend, factor) if current_spend else 0,
            "confidence": "moderate",
            "confidence_pct": 60,
            "formula": f"Period spend {cur}{current_spend:.2f} x {factor:.0%} adjustment / {days_in_range}d x 30.44",
            "assumptions": ["Analyzer recommendation based on segmented performance", "Bid modifiers may affect volume as well as spend"],
        }
        return rec

    # 1. KEYWORD PAUSE RECOMMENDATIONS - for low QS + no conversions
    low_qs_no_conv = [
        k for k in active_keywords
        if is_enabled_keyword(k)
        and criterion_resource_name(k)
        and k.get('quality_score', 0) > 0
        and k['quality_score'] <= 2
        and k['conversions'] == 0
        and k['cost'] > 5
    ]
    for kw in sorted(low_qs_no_conv, key=lambda x: x['cost'], reverse=True)[:3]:
        # Calculate impact
        impact_data = calculate_exclusion_impact(kw['cost'], conversions=0, date_days=days_in_range, currency_symbol=cur)
        automation = get_automation_metadata('keyword_action', platform='google')

        recommendations.append({
            "type": "keyword_action",
            "action": "pause",
            "target": criterion_resource_name(kw),
            "keyword": kw['keyword_text'],
            "campaign_name": kw.get('campaign_name', 'Unknown'),
            "ad_group_name": kw.get('ad_group_name', 'Unknown'),
            "current": "ENABLED",
            "suggested": "PAUSED",
            "reason": f"Quality Score of {kw['quality_score']}, 0 conversions, {cur}{kw['cost']:.2f} wasted. CTR {kw['ctr']*100:.1f}%",
            "expected_impact": f"Save {cur}{impact_data['monthly_savings']:.0f}/month ({impact_data['confidence_pct']}% confidence)",
            "impact_data": impact_data,
            "automation": automation,
        })

    # 2. BID INCREASE RECOMMENDATIONS - for top performers
    top_performers = [
        k for k in active_keywords
        if is_enabled_keyword(k)
        and criterion_resource_name(k)
        and k['conversions'] >= 2
        and k.get('cost_per_conversion', 999) < 15
    ]
    for kw in sorted(top_performers, key=lambda x: x.get('cost_per_conversion', 999))[:3]:
        # Use actual avg CPC if keyword-level bid is 0 (ad group bidding)
        current_bid = kw.get('cpc_bid_micros', 0) / 1000000
        if current_bid == 0:
            current_bid = kw.get('avg_cpc', 0)
        suggested_bid = current_bid * 1.25  # 25% increase

        # Calculate impact
        impact_data = calculate_bid_adjustment_impact(
            current_bid=current_bid,
            suggested_bid=suggested_bid,
            keyword_spend=kw['cost'],
            keyword_conversions=kw['conversions'],
            customer_value=_cv(
                kw.get('conversion_value', 0), kw.get('conversions', 0),
                kw.get('value_per_conversion'),
            ),
            date_days=days_in_range,
            currency_symbol=cur,
        )
        automation = get_automation_metadata('bid_adjustment', platform='google')

        recommendations.append({
            "type": "bid_adjustment",
            "target": criterion_resource_name(kw),
            "keyword": kw['keyword_text'],
            "campaign_name": kw.get('campaign_name', 'Unknown'),
            "ad_group_name": kw.get('ad_group_name', 'Unknown'),
            "current_bid": current_bid,
            "suggested_bid": suggested_bid,
            "reason": f"Strong performer: {int(kw['conversions'])} conversions at {cur}{kw.get('cost_per_conversion', 0):.2f} CPA. CTR {kw['ctr']*100:.1f}%",
            "expected_impact": f"+{impact_data.get('additional_conversions_monthly', 0):.1f} conversions/month ({impact_data['confidence_pct']}% confidence)",
            "impact_data": impact_data,
            "automation": automation,
        })

    # 3. BID DECREASE RECOMMENDATIONS - for high spend, no conversions
    overpriced = [
        k for k in active_keywords
        if is_enabled_keyword(k)
        and criterion_resource_name(k)
        and k['conversions'] == 0
        and k['cost'] > 10
        and k.get('quality_score', 0) >= 4
    ]
    for kw in sorted(overpriced, key=lambda x: x['cost'], reverse=True)[:2]:
        # Use actual avg CPC if keyword-level bid is 0 (ad group bidding)
        current_bid = kw.get('cpc_bid_micros', 0) / 1000000
        if current_bid == 0:
            current_bid = kw.get('avg_cpc', 0)
        suggested_bid = current_bid * 0.65  # 35% decrease

        # Calculate impact
        impact_data = calculate_bid_adjustment_impact(
            current_bid=current_bid,
            suggested_bid=suggested_bid,
            keyword_spend=kw['cost'],
            keyword_conversions=kw['conversions'],
            customer_value=_cv(
                kw.get('conversion_value', 0), kw.get('conversions', 0),
                kw.get('value_per_conversion'),
            ),
            date_days=days_in_range,
            currency_symbol=cur,
        )
        automation = get_automation_metadata('bid_adjustment', platform='google')

        recommendations.append({
            "type": "bid_adjustment",
            "target": criterion_resource_name(kw),
            "keyword": kw['keyword_text'],
            "campaign_name": kw.get('campaign_name', 'Unknown'),
            "ad_group_name": kw.get('ad_group_name', 'Unknown'),
            "current_bid": current_bid,
            "suggested_bid": suggested_bid,
            "reason": f"0 conversions despite {cur}{kw['cost']:.2f} spend. Reduce bid to test at lower position",
            "expected_impact": f"Save {cur}{impact_data['monthly_savings']:.0f}/month ({impact_data['confidence_pct']}% confidence)",
            "impact_data": impact_data,
            "automation": automation,
        })

    # 4. AD COPY RECOMMENDATIONS - based on top performing ad groups
    ad_group_performance = {}
    for kw in active_keywords:
        ag_name = kw.get('ad_group_name', 'Unknown')
        if ag_name not in ad_group_performance:
            ad_group_performance[ag_name] = {'conversions': 0, 'clicks': 0, 'cost': 0, 'conversion_value': 0, 'keywords': []}
        ad_group_performance[ag_name]['conversions'] += kw['conversions']
        ad_group_performance[ag_name]['clicks'] += kw['clicks']
        ad_group_performance[ag_name]['cost'] += kw['cost']
        ad_group_performance[ag_name]['conversion_value'] += kw.get('conversion_value', 0)
        ad_group_performance[ag_name]['keywords'].append(kw['keyword_text'])

    top_ad_groups = sorted(
        [(name, data) for name, data in ad_group_performance.items() if data['conversions'] > 5],
        key=lambda x: x[1]['conversions'],
        reverse=True
    )[:2]

    for ag_name, ag_data in top_ad_groups:
        automation = get_automation_metadata('ad_copy', platform='google')
        ad_copy_add_conversions = ag_data['conversions'] * 0.12 / days_in_range * 30.44
        # Monetise the extra conversions at the ad group's real value/conversion, then
        # account average, then the 3× CPA proxy. Better ad copy adds no spend, so net
        # benefit = that value.
        ad_copy_cpa = ag_data['cost'] / ag_data['conversions'] if ag_data['conversions'] else 0
        ad_copy_cv = _cv(ag_data['conversion_value'], ag_data['conversions'])
        ad_copy_value = ad_copy_cv if ad_copy_cv is not None else (ad_copy_cpa * 3)
        ad_copy_revenue = ad_copy_add_conversions * ad_copy_value
        assumptions = ['Better ad relevance', 'Improved Quality Score', 'Higher click-through rate']
        if ad_copy_cv is not None:
            assumptions.append(f"Customer value: {cur}{ad_copy_value:.0f} (your tracked conversion value)")
        impact_data = {
            'monthly_savings': 0,
            'additional_conversions_monthly': ad_copy_add_conversions,
            'additional_revenue_monthly': ad_copy_revenue,
            'additional_spend_monthly': 0,
            'net_benefit_monthly': ad_copy_revenue,
            'confidence': 'moderate',
            'confidence_pct': 65,
            'formula': f"Estimated 12% CTR improvement from targeted ad copy",
            'assumptions': assumptions
        }

        rec = {
            "type": "ad_copy",
            "ad_group_name": ag_name,
            "reason": f"Ad group '{ag_name}' has {int(ag_data['conversions'])} conversions. Create specific ad highlighting this theme",
            "expected_impact": f"Improve CTR by 10-15%, +{impact_data['additional_conversions_monthly']:.1f} conversions/month ({impact_data['confidence_pct']}% confidence)",
            "impact_data": impact_data,
            "automation": automation,
        }

        # Client-driven ad copy. Full templated copy (headline/description/image)
        # only when the client's branding carries an industry setting; otherwise
        # emit a generic refresh suggestion with no fabricated copy and the
        # client's own landing page (or null, so the UI prompts to set one).
        brand_descriptor = branding.get('brand_descriptor')
        website = branding.get('website')
        industry_setting = branding.get('industry_setting')

        if brand_descriptor and industry_setting:
            theme_lower = ag_name.lower()
            rec["headline"] = f"{ag_name.title()} Relief | Book Today"
            rec["description"] = f"Expert {brand_descriptor} for {ag_name.lower()}. Fast, effective relief."
            rec["image_prompt"] = (
                f"Professional {industry_setting} with {theme_lower}. "
                f"Modern, clean clinic environment with natural lighting. Patient appears relieved and comfortable. "
                f"Focus on professional healthcare atmosphere, trust, and wellness. "
                f"Photorealistic style, warm and inviting colors, high quality medical photography. "
                f"No text overlay needed."
            )
            rec["final_url"] = website
        else:
            rec["suggested"] = f"Refresh or expand ad copy for the '{ag_name}' theme"
            rec["final_url"] = website

        recommendations.append(rec)

    # 5. SEARCH QUERY-BASED NEGATIVE KEYWORDS
    seen_keywords = set()  # Dedup across sections 5 & 6
    for neg_kw in search_analysis.get('negative_keyword_suggestions', [])[:5]:
        kw_key = neg_kw['negative_keyword'].lower()
        if kw_key in seen_keywords:
            continue
        seen_keywords.add(kw_key)

        # Calculate impact
        monthly_savings = neg_kw['wasted_spend'] / days_in_range * 30.44
        impact_data = {
            'monthly_savings': monthly_savings,
            'additional_conversions_monthly': 0,
            'confidence': 'high',
            'confidence_pct': 85,
            'formula': f"Spend {cur}{neg_kw['wasted_spend']:.2f} / {days_in_range}d × 30.44 = {cur}{monthly_savings:.2f} saved/month",
            'assumptions': ['Pattern will continue without negatives', 'No conversion potential from these queries']
        }
        automation = get_automation_metadata('keyword_action', platform='google')

        recommendations.append({
            "type": "keyword_action",
            "action": "add_negative",
            "target": f"Campaign-wide",
            "keyword": neg_kw['negative_keyword'],
            "campaign_id": str(neg_kw.get('campaign_id', '')),
            "campaign_name": neg_kw.get('campaign_name', 'Unknown'),
            "ad_group_name": neg_kw.get('ad_group_name', 'Unknown'),
            "current": "N/A",
            "suggested": f"NEGATIVE - {neg_kw['match_type']}",
            "negative_keywords": [neg_kw['negative_keyword']],
            "match_type": neg_kw.get('match_type', 'PHRASE'),
            "reason": neg_kw['reason'],
            "expected_impact": f"Prevent {cur}{monthly_savings:.2f} monthly waste ({impact_data['confidence_pct']}% confidence)",
            "impact_data": impact_data,
            "automation": automation,
        })

    # 6. SEARCH QUERY WASTE RECOMMENDATIONS
    for wasted in search_analysis.get('wasted_spend_queries', [])[:5]:
        if wasted['cost'] > 5:
            search_term = wasted['search_term'].lower()

            # Skip duplicates
            if search_term in seen_keywords:
                continue
            seen_keywords.add(search_term)

            # Detect specific negative keywords from the search term
            negative_keywords = []
            informational_words = ['exercises', 'symptoms', 'what is', 'how to', 'why', 'causes', 'pictures']
            product_words = ['shoes', 'brace', 'sleeve', 'support', 'insoles', 'cream', 'gel']
            diy_words = ['diy', 'home', 'natural', 'remedies', 'free', 'at home']

            for word in informational_words:
                if word in search_term:
                    negative_keywords.append(word)
            for word in product_words:
                if word in search_term:
                    negative_keywords.append(word)
            for word in diy_words:
                if word in search_term:
                    negative_keywords.append(word)

            # Generate specific action
            # Since these are wasted search queries (not actual keywords),
            # the best action is to add them as negative keywords
            if negative_keywords:
                # Add specific negative keywords if we detected problematic words
                action = "add_negative_keywords"
                suggested = f"Add negative keywords: {', '.join(negative_keywords[:3])}"
                target_negative_keywords = negative_keywords[:5]
            else:
                # Add the entire search query as a negative keyword
                action = "add_negative_keywords"
                suggested = f"Add '{wasted['search_term']}' as negative keyword (PHRASE match)"
                target_negative_keywords = [wasted['search_term']]

            # Calculate impact
            impact_data = calculate_exclusion_impact(wasted['cost'], conversions=0, date_days=days_in_range, currency_symbol=cur)
            automation = get_automation_metadata('keyword_action', platform='google')

            recommendations.append({
                "type": "keyword_action",
                "action": action,
                "target": wasted.get('ad_group_name', 'Unknown'),  # Ad group name - for display purposes
                "campaign_name": wasted.get('campaign_name', 'Unknown'),
                "ad_group_name": wasted.get('ad_group_name', 'Unknown'),
                "campaign_id": str(wasted.get('campaign_id', '')),  # Campaign ID - for apply_recommendations.py
                "keyword": wasted['search_term'],
                "current": "Broad match triggering irrelevant searches",
                "suggested": suggested,
                "negative_keywords": target_negative_keywords,
                "reason": f"Zero conversions from '{wasted['search_term']}', wasted {cur}{wasted['cost']:.2f}",
                "expected_impact": f"Save {cur}{impact_data['monthly_savings']:.2f}/month ({impact_data['confidence_pct']}% confidence)",
                "how_to_apply": "Google Ads → Keywords → Select keyword → Add negative keywords",
                "impact_data": impact_data,
                "automation": automation,
            })

    # 7. QUALITY SCORE IMPROVEMENT RECOMMENDATIONS
    if qs_roadmap.get('improvement_plan'):
        for plan in qs_roadmap['improvement_plan'][:3]:
            automation = get_automation_metadata('quality_improvement', platform='google')
            impact_data = {
                'monthly_savings': 0,
                'additional_conversions_monthly': 0,
                'confidence': 'moderate',
                'confidence_pct': 60,
                'formula': plan['expected_impact'],
                'assumptions': ['Quality Score improvements require manual optimization', 'Results vary by implementation quality']
            }

            recommendations.append({
                "type": "quality_improvement",
                "action": "improve_quality_score",
                "target": f"{plan['affected_keywords']} keywords",
                "issue": plan['issue'],
                "current": f"QS < 5 affecting {plan['affected_keywords']} keywords",
                "suggested": plan['actions'][0] if plan['actions'] else "Review and optimize",
                "reason": f"Priority {plan['priority']}: {plan['issue']} affecting {plan['affected_keywords']} keywords",
                "expected_impact": f"{plan['expected_impact']} ({impact_data['confidence_pct']}% confidence)",
                "campaign_ids": active_campaign_ids,  # Add campaign IDs for automated application
                "impact_data": impact_data,
                "automation": automation,
            })

    # 8. GEOGRAPHIC RECOMMENDATIONS
    if geo_performance.get('recommendations'):
        for geo_rec in geo_performance['recommendations']:
            recommendations.append(enrich_analyzer_recommendation(geo_rec))

    # 9. TIME-OF-DAY / DAY-OF-WEEK RECOMMENDATIONS
    if time_performance.get('recommendations'):
        for time_rec in time_performance['recommendations']:
            recommendations.append(enrich_analyzer_recommendation(time_rec))

    # 10. DEVICE RECOMMENDATIONS
    if device_performance.get('recommendations'):
        for device_rec in device_performance['recommendations']:
            recommendations.append(enrich_analyzer_recommendation(device_rec))

    # 11. PERFORMANCE MAX RECOMMENDATIONS (keyword-free; PMax has no keywords/QS)
    pmax_campaigns_active = [
        c for c in campaigns
        if str(c.get('type', '')).upper() == 'PERFORMANCE_MAX'
        and not is_inactive_status(c.get('status'))
    ]
    for pm in sorted(pmax_campaigns_active, key=lambda x: x.get('cost', 0), reverse=True):
        cost = pm.get('cost', 0)
        conversions = pm.get('conversions', 0)
        daily_budget = pm.get('daily_budget', 0)
        name = pm.get('name', 'Unknown')

        # Rule A: spending with zero conversions -> almost always a conversion-tracking gap
        if cost > 10 and conversions == 0:
            impact_data = calculate_exclusion_impact(cost, conversions=0, date_days=days_in_range, currency_symbol=cur)
            recommendations.append({
                "type": "pmax_tracking_check",
                "action": "check_conversion_tracking",
                "target": name,
                "campaign_name": name,
                "campaign_id": pm.get('id'),
                "current": f"{cur}{cost:.2f} spend, 0 conversions",
                "suggested": "Verify conversion tracking / import offline conversions",
                "reason": f"Performance Max campaign '{name}' spent {cur}{cost:.2f} with 0 conversions. PMax optimises to conversions, so 0 usually means tracking is broken, not that the campaign failed.",
                "expected_impact": f"Recover attribution on up to {cur}{impact_data['monthly_savings']:.0f}/month of spend ({impact_data['confidence_pct']}% confidence)",
                "impact_data": impact_data,
                "automation": get_automation_metadata('pmax_tracking_check', platform='google'),
            })

        # Rule B: budget-limited pacing -> spend is pinned to the daily cap
        elif daily_budget > 0 and (cost / days_in_range) >= (daily_budget * 0.9):
            avg_daily = cost / days_in_range
            recommendations.append({
                "type": "pmax_budget_pacing",
                "action": "review_budget_pacing",
                "target": name,
                "campaign_name": name,
                "campaign_id": pm.get('id'),
                "current": f"{cur}{avg_daily:.2f}/day vs {cur}{daily_budget:.2f} budget",
                "suggested": "Review daily budget headroom",
                "reason": f"Performance Max campaign '{name}' is averaging {cur}{avg_daily:.2f}/day against a {cur}{daily_budget:.2f} daily budget (budget-limited). If ROAS is healthy, raising the cap can unlock more conversions.",
                "expected_impact": "Potential incremental volume if performance targets are being met",
                "automation": get_automation_metadata('pmax_budget_pacing', platform='google'),
            })

    # Save outputs
    print(f"\nSaving insights to {output_insights}...")
    with open(output_insights, 'w') as f:
        json.dump(insights, f, indent=2)

    print(f"Saving recommendations to {output_recommendations}...")
    with open(output_recommendations, 'w') as f:
        json.dump(recommendations, f, indent=2)

    print("\n" + "="*70)
    print("ANALYSIS COMPLETE")
    print("="*70)
    print(f"\nKey Findings:")
    print(f"  - Search queries analyzed: {search_analysis['total_queries']}")
    print(f"  - Wasted spend identified: RM {search_analysis['total_wasted_spend']:.2f}")
    print(f"  - Low QS keywords: {qs_roadmap['total_low_qs']}")
    print(f"  - Negative keyword suggestions: {len(search_analysis.get('negative_keyword_suggestions', []))}")
    print(f"  - Total recommendations: {len(recommendations)}")

    if conv_value_alert:
        print(f"\n[WARNING] CRITICAL: {conv_value_alert['issue']}")

    return insights, recommendations


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_full_insights.py <metrics_file>")
        sys.exit(1)

    metrics_file = sys.argv[1]
    # Extract customer_id from filename like "google_ads_metrics_7867388610_20260128_215306.json"
    filename = os.path.basename(metrics_file)
    parts = filename.split('_')
    customer_id = parts[3] if len(parts) > 3 else 'unknown'

    output_insights = f".tmp/insights_enhanced_{customer_id}.json"
    output_recs = f".tmp/recommendations_enhanced_{customer_id}.json"

    create_enhanced_insights(metrics_file, output_insights, output_recs)

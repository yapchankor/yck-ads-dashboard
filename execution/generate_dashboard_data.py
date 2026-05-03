"""
Generate comprehensive dashboard data.json from metrics and insights
"""
import json
from datetime import datetime, timedelta
from collections import defaultdict
import os

def generate_dashboard_data(metrics_file, recs_file, output_file, insights_file=None):
    # Load the metrics
    with open(metrics_file, 'r') as f:
        metrics = json.load(f)

    # Load recommendations
    with open(recs_file, 'r') as f:
        recs_list = json.load(f)

    if insights_file is None:
        inferred = recs_file.replace('recommendations_enhanced_', 'insights_enhanced_')
        insights_file = inferred if os.path.exists(inferred) else None

    insights_payload = {}
    if insights_file and os.path.exists(insights_file):
        with open(insights_file, 'r') as f:
            insights_payload = json.load(f)

    # === CAMPAIGNS ===
    campaigns = metrics.get('campaigns', [])
    active_campaigns = [c for c in campaigns if c.get('cost', 0) > 0]

    # === KEYWORDS ===
    keywords = metrics.get('keywords', [])
    valid_qs = [k.get('quality_score', 0) for k in keywords if k.get('quality_score', 0) > 0]
    avg_qs = sum(valid_qs) / len(valid_qs) if valid_qs else 0
    low_qs_keywords = [k for k in keywords if 0 < k.get('quality_score', 0) < 5]

    # === SEARCH QUERIES ANALYSIS ===
    search_queries = metrics.get('search_queries', [])
    wasted_queries = [sq for sq in search_queries if sq.get('conversions', 0) == 0 and sq.get('cost', 0) > 10]
    total_wasted = sum(sq.get('cost', 0) for sq in wasted_queries)

    # === TIME PERFORMANCE ===
    time_data = metrics.get('time_performance', [])
    hourly_perf = defaultdict(lambda: {'clicks': 0, 'conversions': 0, 'cost': 0})
    daily_perf = defaultdict(lambda: {'clicks': 0, 'conversions': 0, 'cost': 0})

    for t in time_data:
        hour = t.get('hour', 0)
        day = t.get('day_of_week', 'UNKNOWN')
        hourly_perf[hour]['clicks'] += t.get('clicks', 0)
        hourly_perf[hour]['conversions'] += t.get('conversions', 0)
        hourly_perf[hour]['cost'] += t.get('cost', 0)
        daily_perf[day]['clicks'] += t.get('clicks', 0)
        daily_perf[day]['conversions'] += t.get('conversions', 0)
        daily_perf[day]['cost'] += t.get('cost', 0)

    best_hour = max(hourly_perf.items(), key=lambda x: x[1]['clicks'])[0] if hourly_perf else None
    best_day = max(daily_perf.items(), key=lambda x: x[1]['clicks'])[0] if daily_perf else None

    # === SUMMARY ===
    total_spend = sum(c.get('cost', 0) for c in campaigns)
    total_impressions = sum(c.get('impressions', 0) for c in campaigns)
    total_clicks = sum(c.get('clicks', 0) for c in campaigns)
    total_conversions = sum(c.get('conversions', 0) for c in campaigns)

    # === BUILD DASHBOARD DATA ===
    dashboard_data = {
        'customer_id': '7867388610',
        'account_name': 'YCK Chiropractic',
        'generated_at': datetime.now().isoformat(),
        'date_range': metrics.get('date_range', {
            'start_date': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
            'end_date': datetime.now().strftime('%Y-%m-%d'),
            'days': 30
        }),
        'summary': {
            'total_spend': round(total_spend, 2),
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'total_conversions': round(total_conversions, 2),
            'cost_per_conversion': round(total_spend / total_conversions, 2) if total_conversions > 0 else 0,
            'avg_ctr': round((total_clicks / total_impressions * 100), 2) if total_impressions > 0 else 0,
            'avg_quality_score': round(avg_qs, 1)
        },
        'trends': {
            'spend_change': 0,
            'conversions_change': 0,
            'cpa_change': 0,
            'quality_score_change': 0
        },
        'campaigns': [
            {
                'id': str(c.get('id', '')),
                'campaign_id': str(c.get('id', '')),
                'name': c.get('name', 'Unknown'),
                'campaign_name': c.get('name', 'Unknown'),
                'platform': 'Google',
                'status': c.get('status', 'UNKNOWN'),
                'spend': round(c.get('cost', 0), 2),
                'cost': round(c.get('cost', 0), 2),
                'impressions': c.get('impressions', 0),
                'clicks': c.get('clicks', 0),
                'ctr': round(c.get('ctr', 0) * 100, 2) if c.get('ctr', 0) < 1 else round(c.get('ctr', 0), 2),
                'conversions': round(c.get('conversions', 0), 2),
                'conversion_value': round(c.get('conversion_value', 0), 2),
                'cpa': round(c.get('cost_per_conversion', 0), 2),
                'cost_per_conversion': round(c.get('cost_per_conversion', 0), 2),
                'roas': round(c.get('roas', 0), 2),
                'daily_budget': round(c.get('daily_budget', 0), 2),
                'budget_id': str(c.get('budget_id', '')) if c.get('budget_id') is not None else '',
                'budget_resource_name': c.get('budget_resource_name'),
                'budget_name': c.get('budget_name'),
                'budget_status': c.get('budget_status'),
            }
            for c in sorted(active_campaigns, key=lambda x: x.get('cost', 0), reverse=True)
        ],
        'keywords': [
            {
                'resource_name': k.get('resource_name'),
                'target_id': k.get('resource_name'),
                'keyword_id': k.get('keyword_id'),
                'keyword': k.get('keyword_text', 'Unknown'),
                'keyword_text': k.get('keyword_text', 'Unknown'),
                'campaign': k.get('campaign_name', '-'),
                'campaign_id': str(k.get('campaign_id', '')),
                'campaign_name': k.get('campaign_name', '-'),
                'campaign_status': k.get('campaign_status'),
                'ad_group_id': str(k.get('ad_group_id', '')),
                'ad_group_name': k.get('ad_group_name'),
                'ad_group_status': k.get('ad_group_status'),
                'status': k.get('status'),
                'match_type': k.get('match_type'),
                'impressions': k.get('impressions', 0),
                'clicks': k.get('clicks', 0),
                'ctr': round(k.get('ctr', 0) * 100, 2) if k.get('ctr', 0) < 1 else round(k.get('ctr', 0), 2),
                'avg_cpc': round(k.get('avg_cpc', 0), 2),
                'cost': round(k.get('cost', 0), 2),
                'conversions': round(k.get('conversions', 0), 2),
                'conversion_value': round(k.get('conversion_value', 0), 2),
                'cpa': round(k.get('cost_per_conversion', 0), 2),
                'cost_per_conversion': round(k.get('cost_per_conversion', 0), 2),
                'quality_score': k.get('quality_score', 0),
                'ad_relevance': k.get('ad_relevance'),
                'landing_page_experience': k.get('landing_page_experience'),
                'expected_ctr': k.get('expected_ctr'),
            }
            for k in sorted(keywords, key=lambda x: x.get('impressions', 0), reverse=True)
        ],
        'search_queries': [
            {
                'query': sq.get('search_term', ''),
                'search_term': sq.get('search_term', ''),
                'campaign': sq.get('campaign_name', ''),
                'campaign_id': str(sq.get('campaign_id', '')),
                'campaign_name': sq.get('campaign_name', ''),
                'campaign_status': sq.get('campaign_status'),
                'ad_group_id': str(sq.get('ad_group_id', '')),
                'ad_group_name': sq.get('ad_group_name'),
                'ad_group_status': sq.get('ad_group_status'),
                'match_type': sq.get('match_type'),
                'status': sq.get('status'),
                'impressions': sq.get('impressions', 0),
                'clicks': sq.get('clicks', 0),
                'ctr': round(sq.get('ctr', 0) * 100, 2) if sq.get('ctr', 0) < 1 else round(sq.get('ctr', 0), 2),
                'cost': round(sq.get('cost', 0), 2),
                'conversions': sq.get('conversions', 0),
                'conversion_value': round(sq.get('conversion_value', 0), 2),
                'avg_cpc': round(sq.get('avg_cpc', 0), 2),
                'cpa': round(sq.get('cost', 0) / sq.get('conversions', 0), 2) if sq.get('conversions', 0) else 0,
            }
            for sq in sorted(search_queries, key=lambda x: x.get('clicks', 0), reverse=True)
        ],
        'geo_performance': [
            {
                'location_name': geo.get('location_name', ''),
                'location_id': geo.get('criterion_id') or geo.get('country_criterion_id'),
                'criterion_id': geo.get('criterion_id') or geo.get('country_criterion_id'),
                'country_criterion_id': geo.get('country_criterion_id'),
                'resource_name': geo.get('resource_name'),
                'criterion_resource_name': geo.get('criterion_resource_name'),
                'criterion_status': geo.get('criterion_status'),
                'negative': geo.get('negative', False),
                'location_type': geo.get('location_type', ''),
                'campaign_id': str(geo.get('campaign_id', '')),
                'campaign_name': geo.get('campaign_name', ''),
                'campaign_status': geo.get('campaign_status'),
                'impressions': geo.get('impressions', 0),
                'clicks': geo.get('clicks', 0),
                'ctr': geo.get('ctr', 0),
                'cost': round(geo.get('cost', 0), 2),
                'conversions': geo.get('conversions', 0),
                'conversion_value': round(geo.get('conversion_value', 0), 2),
                'cpa': round(geo.get('cost_per_conversion', 0), 2),
                'cost_per_conversion': round(geo.get('cost_per_conversion', 0), 2),
            }
            for geo in sorted(metrics.get('geo_performance', []), key=lambda x: x.get('clicks', 0), reverse=True)
        ],
        'ad_groups': [
            {
                'id': str(ag.get('id', '')),
                'ad_group_id': str(ag.get('id', '')),
                'name': ag.get('name', 'Unknown'),
                'ad_group_name': ag.get('name', 'Unknown'),
                'status': ag.get('status'),
                'campaign_id': str(ag.get('campaign_id', '')),
                'campaign_name': ag.get('campaign_name'),
                'campaign_status': ag.get('campaign_status'),
                'spend': round(ag.get('cost', 0), 2),
                'cost': round(ag.get('cost', 0), 2),
                'impressions': ag.get('impressions', 0),
                'clicks': ag.get('clicks', 0),
                'ctr': round(ag.get('ctr', 0) * 100, 2) if ag.get('ctr', 0) < 1 else round(ag.get('ctr', 0), 2),
                'avg_cpc': round(ag.get('avg_cpc', 0), 2),
                'conversions': round(ag.get('conversions', 0), 2),
                'conversion_value': round(ag.get('conversion_value', 0), 2),
                'cpa': round(ag.get('cost_per_conversion', 0), 2),
                'cost_per_conversion': round(ag.get('cost_per_conversion', 0), 2),
                'roas': round(ag.get('roas', 0), 2),
            }
            for ag in sorted(metrics.get('ad_groups', []), key=lambda x: x.get('cost', 0), reverse=True)
        ],
        'ads': [
            {
                'resource_name': ad.get('resource_name'),
                'ad_id': str(ad.get('ad_id', '')),
                'ad_type': ad.get('ad_type'),
                'status': ad.get('status'),
                'campaign_id': str(ad.get('campaign_id', '')),
                'campaign_name': ad.get('campaign_name'),
                'campaign_status': ad.get('campaign_status'),
                'ad_group_id': str(ad.get('ad_group_id', '')),
                'ad_group_name': ad.get('ad_group_name'),
                'ad_group_status': ad.get('ad_group_status'),
                'final_urls': ad.get('final_urls', []),
                'headlines': ad.get('headlines', []),
                'descriptions': ad.get('descriptions', []),
                'impressions': ad.get('impressions', 0),
                'clicks': ad.get('clicks', 0),
                'ctr': round(ad.get('ctr', 0) * 100, 2) if ad.get('ctr', 0) < 1 else round(ad.get('ctr', 0), 2),
                'spend': round(ad.get('cost', 0), 2),
                'cost': round(ad.get('cost', 0), 2),
                'conversions': round(ad.get('conversions', 0), 2),
                'conversion_value': round(ad.get('conversion_value', 0), 2),
                'roas': round(ad.get('roas', 0), 2),
            }
            for ad in sorted(metrics.get('ads', []), key=lambda x: x.get('impressions', 0), reverse=True)
        ],
        'negative_keywords': metrics.get('negative_keywords', []),
        'google_negative_keywords': metrics.get('google_negative_keywords') or metrics.get('negative_keywords', []),
        'budget_pacing': insights_payload.get('budget_pacing', {}),
        'landing_page_heatmap': insights_payload.get('landing_page_heatmap', {}),
        'quality_score_roadmap': insights_payload.get('quality_score_roadmap', {}),
        'search_query_analysis': insights_payload.get('search_query_analysis', {}),
        'device_performance': insights_payload.get('device_performance', {}),
        'google_device_rows': metrics.get('device_performance', []),
        'conversion_value_alert': insights_payload.get('conversion_value_alert'),
        'google_time_performance': insights_payload.get('time_performance', {}),
        'google_geo_analysis': insights_payload.get('geo_performance', {}),
        'insights': [],
        'recommendations': []
    }

    # Add insights
    dashboard_data['insights'].append({
        'type': 'warning',
        'title': 'Low Quality Scores',
        'description': f'{len(low_qs_keywords)} keywords have quality scores below 5. Improving ad relevance and landing pages could reduce CPC by 20-30%.'
    })

    dashboard_data['insights'].append({
        'type': 'alert',
        'title': 'Wasted Ad Spend',
        'description': f'RM {total_wasted:,.2f} spent on {len(wasted_queries)} search queries with zero conversions. Consider adding negative keywords.'
    })

    if best_hour is not None:
        dashboard_data['insights'].append({
            'type': 'opportunity',
            'title': f'Best Performing Hour: {best_hour}:00',
            'description': f'Hour {best_hour}:00 generates the most clicks ({hourly_perf[best_hour]["clicks"]:,}). Consider increasing bids during peak hours.'
        })

    if best_day:
        day_name = best_day.title() if best_day else 'N/A'
        dashboard_data['insights'].append({
            'type': 'opportunity',
            'title': f'Best Performing Day: {day_name}',
            'description': f'{day_name} generates the most engagement ({daily_perf[best_day]["clicks"]:,} clicks). Consider dayparting strategy.'
        })

    enabled_campaigns = [c for c in campaigns if str(c.get('status', '')).upper() == 'ENABLED']
    paused_campaigns = [c for c in campaigns if str(c.get('status', '')).upper() == 'PAUSED']
    dashboard_data['insights'].append({
        'type': 'info',
        'title': 'Campaign Status',
        'description': (
            f'{len(enabled_campaigns)} enabled and {len(paused_campaigns)} paused Google campaigns '
            f'in this data set. Total spend: RM {total_spend:,.2f}.'
        )
    })

    if total_conversions > 0:
        dashboard_data['insights'].append({
            'type': 'alert',
            'title': 'High CPA Alert',
            'description': f'Cost per conversion is RM {total_spend / total_conversions:,.2f}. Review conversion tracking and keyword targeting.'
        })
    else:
        dashboard_data['insights'].append({
            'type': 'alert',
            'title': 'No Conversions',
            'description': 'No conversions recorded. Verify conversion tracking is set up correctly in Google Ads.'
        })

    # Add recommendations with action data
    # Get campaign ID mapping for negative keyword recommendations
    campaign_id_map = {c.get('name', ''): c.get('id') for c in campaigns}

    def format_currency(value):
        return f"RM {value:.2f}"

    def build_bid_copy(keyword_text, current_bid, suggested_bid):
        if not current_bid or not suggested_bid:
            return None, None
        change_pct = ((suggested_bid - current_bid) / current_bid) * 100 if current_bid else 0
        direction = "Increase" if suggested_bid > current_bid else "Decrease"
        title = f"{direction} bid: {keyword_text}" if keyword_text else f"{direction} keyword bid"
        suggested_action = (
            f"{direction} max CPC bid from {format_currency(current_bid)} to "
            f"{format_currency(suggested_bid)} ({change_pct:+.1f}%). "
            "This updates the keyword-level bid in Google Ads; it does not pause the keyword or change match type."
        )
        return title, suggested_action

    for rec in recs_list:
        action = rec.get('action', 'review').replace('_', ' ').title()
        keyword = rec.get('keyword', '')
        target = rec.get('target', '')
        suggested = rec.get('suggested', '')
        rec_type = rec.get('type', 'review')

        # Determine action_type for the frontend
        action_name = str(rec.get('action', '')).lower()
        if (
            'negative keyword' in suggested.lower()
            or action_name in {'add_negative', 'add_negative_keywords'}
            or rec.get('negative_keywords')
        ):
            action_type = 'add_negative_keyword'
        elif rec_type == 'keyword_action':
            action_type = 'keyword_action'
        elif rec_type == 'bid_adjustment':
            action_type = 'bid_adjustment'
        else:
            action_type = rec_type

        # Try to extract campaign_id from the recommendation
        campaign_name = rec.get('campaign_name', '') or rec.get('campaign', '')
        ad_group_name = rec.get('ad_group_name', '') or rec.get('ad_group', '')
        campaign_id = rec.get('campaign_id') or campaign_id_map.get(campaign_name)

        # Generate a stable ID for tracking - include more fields to avoid collisions
        import hashlib
        rec_id_raw = f"{action}_{keyword}_{target}_{campaign_id}_{ad_group_name}_{rec_type}"
        rec_id = hashlib.md5(rec_id_raw.encode()).hexdigest()

        title = f'{action}: {keyword}' if keyword else action
        suggested_action = suggested

        if action_type == 'bid_adjustment':
            current_bid = rec.get('current_bid')
            suggested_bid = rec.get('suggested_bid')
            bid_title, bid_suggested_action = build_bid_copy(keyword, current_bid, suggested_bid)
            if bid_title:
                title = bid_title
            if bid_suggested_action:
                suggested_action = bid_suggested_action
        elif action_type == 'schedule_bid_adjustment':
            slot = rec.get('time_slot') or target or 'schedule'
            adjustment = rec.get('suggested_adjustment') or 'adjust'
            title = f"{adjustment} schedule bid: {slot}"
            suggested_action = f"Apply {adjustment} bid adjustment for {slot} after reviewing campaign schedule coverage."
        elif action_type == 'geo_bid_adjustment':
            location = rec.get('location') or target or 'location'
            adjustment = rec.get('suggested_adjustment') or 'adjust'
            title = f"{adjustment} location bid: {location}"
            suggested_action = f"Apply {adjustment} bid adjustment for {location} where campaign targeting supports it."
        elif action_type == 'device_bid_adjustment':
            device = rec.get('device') or target or 'device'
            adjustment = rec.get('suggested_adjustment') or 'adjust'
            title = f"{adjustment} device bid: {str(device).replace('_', ' ').title()}"
            suggested_action = f"Review device performance and apply a {adjustment} bid adjustment for {str(device).replace('_', ' ').title()} if campaign settings support it."
        elif action_type == 'geo_exclusion':
            location = rec.get('location') or target or 'location'
            title = f"Exclude location: {location}"
            suggested_action = f"Exclude {location} from campaigns with verified zero-conversion spend."
        elif action_type == 'quality_improvement':
            title = f"Improve Quality Score: {rec.get('issue') or target}"
            suggested_action = rec.get('suggested') or "Review Quality Score drivers and improve the affected landing pages, ad relevance, or CTR."
        elif action_type == 'ad_copy':
            title = f"Create ad copy: {rec.get('ad_group_name') or 'ad group'}"
            suggested_action = f"Draft and review new responsive search ad copy for {rec.get('ad_group_name') or 'this ad group'}."

        # Build recommendation object
        rec_obj = {
            'id': rec_id,
            'recommendation_id': rec_id,
            'title': title,
            'description': rec.get('reason', ''),
            'platform': 'Google',
            'impact': 'High' if 'wasted' in rec.get('reason', '').lower() else 'Medium',
            'expected_impact': rec.get('expected_impact') or rec.get('impact_text') or "Improved Performance",
            'action_type': action_type,
            'target_id': target,
            'keyword': keyword,
            'suggested_action': suggested_action,
            'campaign_id': campaign_id,
            'campaign_name': campaign_name,
            'ad_group_name': ad_group_name,
            'negative_keywords': rec.get('negative_keywords') or ([keyword] if action_type == 'add_negative_keyword' and keyword else []),
            'match_type': rec.get('match_type') or 'PHRASE',
            'impact_data': rec.get('impact_data') or {},
            'automation': rec.get('automation') or {},
            'formula': (rec.get('impact_data') or {}).get('formula'),
            'assumptions': (rec.get('impact_data') or {}).get('assumptions') or [],
            'current': rec.get('current'),
            'suggested': rec.get('suggested'),
            'issue': rec.get('issue'),
            'headline': rec.get('headline'),
            'description_copy': rec.get('description'),
            'final_url': rec.get('final_url'),
            'image_prompt': rec.get('image_prompt'),
            'location': rec.get('location'),
            'location_id': rec.get('location_id') or rec.get('country_criterion_id'),
            'campaign_ids': rec.get('campaign_ids') or [],
            'current_cpa': rec.get('current_cpa'),
            'suggested_adjustment': rec.get('suggested_adjustment'),
            'time_slot': rec.get('time_slot'),
            'current_spend': rec.get('current_spend'),
            'current_performance': rec.get('current_performance'),
            'how_to_apply': rec.get('how_to_apply'),
            'device': rec.get('device'),
        }

        # Add bid-related fields for bid_adjustment recommendations
        if action_type == 'bid_adjustment':
            if rec.get('current_bid'):
                rec_obj['current_bid'] = round(rec.get('current_bid'), 2)
            if rec.get('suggested_bid'):
                rec_obj['suggested_bid'] = round(rec.get('suggested_bid'), 2)

        dashboard_data['recommendations'].append(rec_obj)

    # Save
    with open(output_file, 'w') as f:
        json.dump(dashboard_data, f, indent=2)

    print('Updated data.json with comprehensive insights:')
    print(f'  Campaigns: {len(dashboard_data["campaigns"])}')
    print(f'  Keywords: {len(dashboard_data["keywords"])}')
    print(f'  Search Queries: {len(dashboard_data["search_queries"])}')
    print(f'  Insights: {len(dashboard_data["insights"])}')
    print(f'  Recommendations: {len(dashboard_data["recommendations"])}')
    print()
    print('Insights added:')
    for i in dashboard_data['insights']:
        print(f'  - [{i["type"]}] {i["title"]}')

    return dashboard_data


if __name__ == '__main__':
    import glob

    # Find latest metrics file
    metrics_files = glob.glob('.tmp/google_ads_metrics_7867388610_*.json')
    if not metrics_files:
        print('No metrics file found!')
        exit(1)

    latest_metrics = max(metrics_files)
    print(f'Using metrics: {latest_metrics}')

    generate_dashboard_data(
        latest_metrics,
        '.tmp/recommendations_enhanced_7867388610.json',
        'netlify-dashboard/data.json'
    )

#!/usr/bin/env python3
"""
Fetch Google Ads performance metrics for a specified customer and date range.

Usage:
    python fetch_google_ads_metrics.py --customer_id 1234567890 --start_date 2024-01-01 --end_date 2024-01-31

Output:
    JSON file in .tmp/ directory with all performance metrics
"""

import argparse
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

# Load environment variables
load_dotenv()


def load_google_ads_client():
    """Load Google Ads API client from credentials."""
    # Configuration can be loaded from google-ads.yaml or environment variables
    login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")

    # Remove dashes if present and validate
    login_customer_id = login_customer_id.replace("-", "").strip()

    credentials = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "use_proto_plus": True
    }

    # Only add login_customer_id if it's valid (10 digits)
    if login_customer_id and len(login_customer_id) == 10 and login_customer_id.isdigit():
        credentials["login_customer_id"] = login_customer_id

    return GoogleAdsClient.load_from_dict(credentials)


def fetch_campaign_metrics(client, customer_id, start_date, end_date):
    """Fetch campaign-level performance metrics."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_per_conversion,
            metrics.value_per_conversion,
            campaign.target_cpa.target_cpa_micros,
            campaign.target_roas.target_roas,
            campaign_budget.id,
            campaign_budget.resource_name,
            campaign_budget.name,
            campaign_budget.status,
            campaign_budget.amount_micros
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND campaign.status != 'REMOVED'
        ORDER BY metrics.impressions DESC
    """

    campaigns = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                campaign_data = {
                    "id": row.campaign.id,
                    "name": row.campaign.name,
                    "status": row.campaign.status.name,
                    "type": row.campaign.advertising_channel_type.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,  # Convert micros to currency
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": row.metrics.cost_per_conversion / 1_000_000 if row.metrics.cost_per_conversion else 0,
                    "value_per_conversion": row.metrics.value_per_conversion,
                    "roas": (row.metrics.conversions_value / (row.metrics.cost_micros / 1_000_000)) if row.metrics.cost_micros > 0 else 0,
                    "budget_id": row.campaign_budget.id,
                    "budget_resource_name": row.campaign_budget.resource_name,
                    "budget_name": row.campaign_budget.name,
                    "budget_status": row.campaign_budget.status.name,
                    "daily_budget": row.campaign_budget.amount_micros / 1_000_000,
                }
                campaigns.append(campaign_data)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        for error in ex.failure.errors:
            print(f"\tError: {error.message}")
        raise

    return campaigns


def fetch_campaign_impression_share(client, customer_id, start_date, end_date):
    """Fetch Search impression-share metrics per campaign (additive; safe to fail).

    Returns a dict keyed by campaign id. Impression share is only populated for
    Search/Shopping campaigns; other channel types return zeros from the API.
    Wrapped so any query incompatibility can never break the core campaign pull.
    """
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            metrics.search_impression_share,
            metrics.search_budget_lost_impression_share,
            metrics.search_rank_lost_impression_share,
            metrics.search_top_impression_share,
            metrics.search_absolute_top_impression_share
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND campaign.status != 'REMOVED'
    """

    result = {}
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                result[row.campaign.id] = {
                    "search_impression_share": row.metrics.search_impression_share,
                    "search_lost_is_budget": row.metrics.search_budget_lost_impression_share,
                    "search_lost_is_rank": row.metrics.search_rank_lost_impression_share,
                    "search_top_is": row.metrics.search_top_impression_share,
                    "search_abs_top_is": row.metrics.search_absolute_top_impression_share,
                }
    except GoogleAdsException as ex:
        print(f"Impression share metrics unavailable: {ex.error.code().name}")
        return {}
    except Exception as e:
        print(f"Impression share metrics skipped: {e}")
        return {}

    return result


def fetch_campaign_daily_metrics(client, customer_id, start_date, end_date):
    """Fetch campaign-level metrics segmented by date for fast dashboard filtering."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            segments.date,
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_per_conversion,
            metrics.value_per_conversion,
            campaign_budget.id,
            campaign_budget.resource_name,
            campaign_budget.name,
            campaign_budget.status,
            campaign_budget.amount_micros
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND campaign.status != 'REMOVED'
        ORDER BY segments.date DESC, metrics.impressions DESC
    """

    rows = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                cost = row.metrics.cost_micros / 1_000_000
                conversions = row.metrics.conversions
                rows.append({
                    "date": row.segments.date,
                    "id": row.campaign.id,
                    "name": row.campaign.name,
                    "status": row.campaign.status.name,
                    "type": row.campaign.advertising_channel_type.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": cost,
                    "conversions": conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": cost / conversions if conversions > 0 else 0,
                    "value_per_conversion": row.metrics.value_per_conversion,
                    "roas": row.metrics.conversions_value / cost if cost > 0 else 0,
                    "budget_id": row.campaign_budget.id,
                    "budget_resource_name": row.campaign_budget.resource_name,
                    "budget_name": row.campaign_budget.name,
                    "budget_status": row.campaign_budget.status.name,
                    "daily_budget": row.campaign_budget.amount_micros / 1_000_000,
                })

    except GoogleAdsException as ex:
        print(f"Daily campaign metrics failed: {ex.error.code().name}")
        return []

    return rows


def fetch_adgroup_daily_metrics(client, customer_id, start_date, end_date):
    """Fetch ad group-level metrics segmented by date for custom range filtering."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            segments.date,
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM ad_group
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND ad_group.status != 'REMOVED'
        ORDER BY segments.date DESC, metrics.cost_micros DESC
    """

    rows = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                cost = row.metrics.cost_micros / 1_000_000
                conversions = row.metrics.conversions
                rows.append({
                    "date": row.segments.date,
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "id": row.ad_group.id,
                    "name": row.ad_group.name,
                    "status": row.ad_group.status.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": cost,
                    "conversions": conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": cost / conversions if conversions > 0 else 0,
                    "roas": row.metrics.conversions_value / cost if cost > 0 else 0,
                })
    except GoogleAdsException as ex:
        print(f"Daily ad group metrics failed: {ex.error.code().name}")
        return []

    return rows


def fetch_adgroup_metrics(client, customer_id, start_date, end_date):
    """Fetch ad group-level performance metrics."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_per_conversion
        FROM ad_group
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND ad_group.status != 'REMOVED'
        ORDER BY metrics.impressions DESC
    """

    ad_groups = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                ad_group_data = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "id": row.ad_group.id,
                    "name": row.ad_group.name,
                    "status": row.ad_group.status.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": row.metrics.cost_per_conversion / 1_000_000 if row.metrics.cost_per_conversion else 0,
                    "roas": (row.metrics.conversions_value / (row.metrics.cost_micros / 1_000_000)) if row.metrics.cost_micros > 0 else 0,
                }
                ad_groups.append(ad_group_data)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        raise

    return ad_groups


def fetch_keyword_metrics(client, customer_id, start_date, end_date):
    """Fetch keyword-level performance metrics."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.quality_info.quality_score,
            ad_group_criterion.quality_info.creative_quality_score,
            ad_group_criterion.quality_info.post_click_quality_score,
            ad_group_criterion.quality_info.search_predicted_ctr,
            ad_group_criterion.criterion_id,
            ad_group_criterion.status,
            ad_group_criterion.cpc_bid_micros,
            ad_group_criterion.resource_name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_per_conversion
        FROM keyword_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND ad_group_criterion.status != 'REMOVED'
        ORDER BY metrics.impressions DESC
        LIMIT 1000
    """

    keywords = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                keyword_data = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "ad_group_id": row.ad_group.id,
                    "ad_group_name": row.ad_group.name,
                    "ad_group_status": row.ad_group.status.name,
                    "keyword_id": row.ad_group_criterion.criterion_id,
                    "keyword_text": row.ad_group_criterion.keyword.text,
                    "match_type": row.ad_group_criterion.keyword.match_type.name,
                    "status": row.ad_group_criterion.status.name,
                    "cpc_bid_micros": row.ad_group_criterion.cpc_bid_micros if hasattr(row.ad_group_criterion, 'cpc_bid_micros') else 0,
                    "resource_name": row.ad_group_criterion.resource_name,
                    "quality_score": row.ad_group_criterion.quality_info.quality_score,
                    "ad_relevance": row.ad_group_criterion.quality_info.creative_quality_score.name,
                    "landing_page_experience": row.ad_group_criterion.quality_info.post_click_quality_score.name,
                    "expected_ctr": row.ad_group_criterion.quality_info.search_predicted_ctr.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": row.metrics.cost_per_conversion / 1_000_000 if row.metrics.cost_per_conversion else 0,
                    "roas": (row.metrics.conversions_value / (row.metrics.cost_micros / 1_000_000)) if row.metrics.cost_micros > 0 else 0,
                }
                keywords.append(keyword_data)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        raise

    return keywords


def fetch_ad_metrics(client, customer_id, start_date, end_date):
    """Fetch ad-level performance metrics for ad copy analysis."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group_ad.resource_name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.type,
            ad_group_ad.ad.final_urls,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_micros
        FROM ad_group_ad
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND ad_group_ad.status != 'REMOVED'
            AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
        ORDER BY metrics.impressions DESC
        LIMIT 500
    """

    ads = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                # Extract headlines and descriptions
                headlines = [h.text for h in row.ad_group_ad.ad.responsive_search_ad.headlines]
                descriptions = [d.text for d in row.ad_group_ad.ad.responsive_search_ad.descriptions]

                # Extract final URLs (landing pages)
                final_urls = list(row.ad_group_ad.ad.final_urls) if row.ad_group_ad.ad.final_urls else []

                ad_data = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "ad_group_id": row.ad_group.id,
                    "ad_group_name": row.ad_group.name,
                    "ad_group_status": row.ad_group.status.name,
                    "resource_name": row.ad_group_ad.resource_name,
                    "ad_id": row.ad_group_ad.ad.id,
                    "ad_type": row.ad_group_ad.ad.type_.name,
                    "status": row.ad_group_ad.status.name,
                    "final_urls": final_urls,
                    "headlines": headlines,
                    "descriptions": descriptions,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "roas": (row.metrics.conversions_value / (row.metrics.cost_micros / 1_000_000)) if row.metrics.cost_micros > 0 else 0,
                }
                ads.append(ad_data)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        raise

    return ads


def fetch_search_query_report(client, customer_id, start_date, end_date):
    """Fetch search query performance report - what users actually searched for."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            segments.search_term_match_type,
            search_term_view.search_term,
            search_term_view.status,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM search_term_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND metrics.impressions > 0
        ORDER BY metrics.impressions DESC
        LIMIT 500
    """

    search_queries = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                query_data = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "ad_group_id": row.ad_group.id,
                    "ad_group_name": row.ad_group.name,
                    "ad_group_status": row.ad_group.status.name,
                    "search_term": row.search_term_view.search_term,
                    "match_type": row.segments.search_term_match_type.name,
                    "status": row.search_term_view.status.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                }
                search_queries.append(query_data)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        # Search query report might not be available for all accounts
        print("Note: Search query report not available or no data")
        return []

    return search_queries


def fetch_geographic_metrics(client, customer_id, start_date, end_date):
    """Fetch geographic performance report with targeted location detail."""
    ga_service = client.get_service("GoogleAdsService")
    geo_target_service = client.get_service("GeoTargetConstantService")

    # First, get campaign location targets (including proximity/radius targeting)
    location_targets_query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign_criterion.resource_name,
            campaign_criterion.criterion_id,
            campaign_criterion.type,
            campaign_criterion.status,
            campaign_criterion.location.geo_target_constant,
            campaign_criterion.proximity.address.city_name,
            campaign_criterion.proximity.address.province_name,
            campaign_criterion.proximity.address.street_address,
            campaign_criterion.proximity.radius,
            campaign_criterion.proximity.radius_units,
            campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
            campaign_criterion.proximity.geo_point.longitude_in_micro_degrees,
            campaign_criterion.negative
        FROM campaign_criterion
        WHERE campaign_criterion.type IN ('LOCATION', 'PROXIMITY')
    """

    location_names = {}  # (campaign_id, criterion_id) -> location name
    location_metadata = {}  # (campaign_id, criterion_id) -> targeting metadata

    try:
        response = ga_service.search_stream(customer_id=customer_id, query=location_targets_query)
        for batch in response:
            for row in batch.results:
                criterion_id = row.campaign_criterion.criterion_id
                campaign_id = row.campaign.id
                location_metadata[(campaign_id, criterion_id)] = {
                    "campaign_status": row.campaign.status.name,
                    "criterion_resource_name": row.campaign_criterion.resource_name,
                    "criterion_type": row.campaign_criterion.type_.name,
                    "criterion_status": row.campaign_criterion.status.name,
                    "negative": row.campaign_criterion.negative,
                }

                # Check for proximity (radius) targeting
                if hasattr(row.campaign_criterion, 'proximity') and row.campaign_criterion.proximity:
                    prox = row.campaign_criterion.proximity
                    # street_address often contains the location name (e.g., "Ampang, Selangor")
                    street = prox.address.street_address if hasattr(prox.address, 'street_address') else ''
                    city = prox.address.city_name if hasattr(prox.address, 'city_name') else ''
                    province = prox.address.province_name if hasattr(prox.address, 'province_name') else ''
                    radius = prox.radius if hasattr(prox, 'radius') else 0

                    # Build location name from available fields
                    location_desc = street or city or province or 'Unknown'
                    location_name = f"{radius} km around {location_desc}"
                    location_names[(campaign_id, criterion_id)] = location_name

                # Check for location (geo target) targeting - we'll resolve names later
                elif hasattr(row.campaign_criterion, 'location') and row.campaign_criterion.location.geo_target_constant:
                    geo_resource = row.campaign_criterion.location.geo_target_constant
                    geo_id = geo_resource.split('/')[-1] if '/' in geo_resource else geo_resource
                    # Store geo_id to resolve later
                    location_names[(campaign_id, criterion_id)] = ('geo_id', geo_id)

    except GoogleAdsException as ex:
        print(f"  Warning: Could not fetch location targets: {ex.error.code().name}")

    # Resolve geo_target_constant IDs to names
    geo_ids_to_resolve = set()
    for key, val in location_names.items():
        if isinstance(val, tuple) and val[0] == 'geo_id':
            geo_ids_to_resolve.add(val[1])

    if geo_ids_to_resolve:
        geo_id_names = {}
        try:
            id_list = ','.join(geo_ids_to_resolve)
            geo_query = f'''
                SELECT
                    geo_target_constant.id,
                    geo_target_constant.name,
                    geo_target_constant.canonical_name
                FROM geo_target_constant
                WHERE geo_target_constant.id IN ({id_list})
            '''
            response = ga_service.search_stream(customer_id=customer_id, query=geo_query)
            for batch in response:
                for row in batch.results:
                    geo_id_names[str(row.geo_target_constant.id)] = row.geo_target_constant.canonical_name or row.geo_target_constant.name
        except Exception as e:
            print(f"  Warning: Could not resolve geo target names: {e}")

        # Update location_names with resolved names
        for key, val in list(location_names.items()):
            if isinstance(val, tuple) and val[0] == 'geo_id':
                geo_id = val[1]
                location_names[key] = geo_id_names.get(geo_id, f"Location {geo_id}")

    # Now get location performance metrics
    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            location_view.resource_name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM location_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND metrics.impressions > 0
        ORDER BY metrics.clicks DESC
        LIMIT 100
    """

    geo_data = []

    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                campaign_id = row.campaign.id
                campaign_name = row.campaign.name

                # Extract criterion_id from location_view resource_name
                # Format: customers/{customer_id}/locationViews/{campaign_id}~{criterion_id}
                criterion_id = None
                resource_name = row.location_view.resource_name
                if '~' in resource_name:
                    criterion_id = int(resource_name.split('~')[-1])

                # Look up location name from our pre-fetched location targets
                location_name = location_names.get((campaign_id, criterion_id), f"Location {criterion_id}")
                metadata = location_metadata.get((campaign_id, criterion_id), {})

                location_data = {
                    "campaign_id": campaign_id,
                    "campaign_name": campaign_name,
                    "campaign_status": row.campaign.status.name,
                    "criterion_id": criterion_id,
                    "country_criterion_id": criterion_id,
                    "resource_name": row.location_view.resource_name,
                    "criterion_resource_name": metadata.get("criterion_resource_name"),
                    "criterion_type": metadata.get("criterion_type"),
                    "criterion_status": metadata.get("criterion_status"),
                    "negative": metadata.get("negative", False),
                    "location_name": location_name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": (row.metrics.cost_micros / 1_000_000 / row.metrics.conversions) if row.metrics.conversions > 0 else 0,
                }
                geo_data.append(location_data)

    except GoogleAdsException as ex:
        print(f"Location view request failed: {ex.error.code().name}")
        for error in ex.failure.errors:
            print(f"  Error: {error.message}")
        # Fall back to geographic_view if location_view fails
        return fetch_geographic_metrics_fallback(client, customer_id, start_date, end_date)

    # location_view criterion_ids ARE geo_target_constant IDs. Any that didn't resolve via the
    # campaign_criterion map above still read "Location {id}" (e.g. "Location 2826" = UK), so
    # resolve them directly against geo_target_constant.
    unresolved_ids = {
        str(row["criterion_id"]) for row in geo_data
        if row.get("criterion_id") and str(row.get("location_name", "")).startswith("Location ")
    }
    if unresolved_ids:
        resolved = {}
        try:
            id_list = ','.join(unresolved_ids)
            geo_query = f'''
                SELECT
                    geo_target_constant.id,
                    geo_target_constant.name,
                    geo_target_constant.canonical_name
                FROM geo_target_constant
                WHERE geo_target_constant.id IN ({id_list})
            '''
            response = ga_service.search_stream(customer_id=customer_id, query=geo_query)
            for batch in response:
                for row in batch.results:
                    resolved[str(row.geo_target_constant.id)] = (
                        row.geo_target_constant.canonical_name or row.geo_target_constant.name
                    )
        except Exception as e:
            print(f"  Warning: Could not resolve location_view geo names: {e}")
        for row in geo_data:
            name = resolved.get(str(row.get("criterion_id")))
            if name:
                row["location_name"] = name

    return geo_data


def fetch_geographic_metrics_fallback(client, customer_id, start_date, end_date):
    """Fallback to basic geographic_view if user_location_view fails."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            geographic_view.country_criterion_id,
            geographic_view.location_type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM geographic_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
    """

    geo_data = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                location_data = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "country_criterion_id": row.geographic_view.country_criterion_id if hasattr(row.geographic_view, 'country_criterion_id') else None,
                    "criterion_id": row.geographic_view.country_criterion_id if hasattr(row.geographic_view, 'country_criterion_id') else None,
                    "location_type": row.geographic_view.location_type.name if hasattr(row.geographic_view, 'location_type') else "UNKNOWN",
                    "location_name": None,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": (row.metrics.cost_micros / 1_000_000 / row.metrics.conversions) if row.metrics.conversions > 0 else 0,
                }
                geo_data.append(location_data)

    except GoogleAdsException as ex:
        print(f"Geographic fallback failed: {ex.error.code().name}")
        return []

    return geo_data


def fetch_time_segmented_metrics(client, customer_id, start_date, end_date):
    """Fetch performance metrics segmented by hour of day and day of week."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            segments.hour,
            segments.day_of_week,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND metrics.impressions > 0
        ORDER BY segments.date DESC, segments.hour ASC
    """

    time_data = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                time_record = {
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "date": row.segments.date,
                    "hour": row.segments.hour,
                    "day_of_week": row.segments.day_of_week.name if hasattr(row.segments, 'day_of_week') else "UNKNOWN",
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": (row.metrics.cost_micros / 1_000_000 / row.metrics.conversions) if row.metrics.conversions > 0 else 0,
                }
                time_data.append(time_record)

    except GoogleAdsException as ex:
        print(f"Request failed with status {ex.error.code().name}")
        print("Note: Time-segmented data not available or no data")
        return []

    return time_data


def fetch_device_metrics(client, customer_id, start_date, end_date):
    """Fetch campaign performance segmented by device."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            segments.device,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND metrics.impressions > 0
        ORDER BY metrics.cost_micros DESC
    """

    device_data = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)

        for batch in response:
            for row in batch.results:
                cost = row.metrics.cost_micros / 1_000_000
                conversions = row.metrics.conversions
                device_data.append({
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "device": row.segments.device.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": cost,
                    "conversions": conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": cost / conversions if conversions > 0 else 0,
                })

    except GoogleAdsException as ex:
        print(f"Device metrics failed: {ex.error.code().name}")
        return []

    return device_data


def fetch_negative_keywords(client, customer_id):
    """Fetch active negative keywords at campaign and ad group level for dedupe/state checks."""
    ga_service = client.get_service("GoogleAdsService")
    negative_keywords = []

    campaign_query = """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign_criterion.resource_name,
            campaign_criterion.criterion_id,
            campaign_criterion.status,
            campaign_criterion.keyword.text,
            campaign_criterion.keyword.match_type
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'KEYWORD'
            AND campaign_criterion.negative = TRUE
            AND campaign_criterion.status != 'REMOVED'
    """

    try:
        response = ga_service.search_stream(customer_id=customer_id, query=campaign_query)
        for batch in response:
            for row in batch.results:
                negative_keywords.append({
                    "level": "campaign",
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "resource_name": row.campaign_criterion.resource_name,
                    "criterion_id": row.campaign_criterion.criterion_id,
                    "status": row.campaign_criterion.status.name,
                    "keyword": row.campaign_criterion.keyword.text,
                    "text": row.campaign_criterion.keyword.text,
                    "match_type": row.campaign_criterion.keyword.match_type.name,
                })
    except GoogleAdsException as ex:
        print(f"Campaign negative keyword fetch failed: {ex.error.code().name}")

    ad_group_query = """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group_criterion.resource_name,
            ad_group_criterion.criterion_id,
            ad_group_criterion.status,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
            AND ad_group_criterion.negative = TRUE
            AND ad_group_criterion.status != 'REMOVED'
    """

    try:
        response = ga_service.search_stream(customer_id=customer_id, query=ad_group_query)
        for batch in response:
            for row in batch.results:
                negative_keywords.append({
                    "level": "ad_group",
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "campaign_status": row.campaign.status.name,
                    "ad_group_id": row.ad_group.id,
                    "ad_group_name": row.ad_group.name,
                    "ad_group_status": row.ad_group.status.name,
                    "resource_name": row.ad_group_criterion.resource_name,
                    "criterion_id": row.ad_group_criterion.criterion_id,
                    "status": row.ad_group_criterion.status.name,
                    "keyword": row.ad_group_criterion.keyword.text,
                    "text": row.ad_group_criterion.keyword.text,
                    "match_type": row.ad_group_criterion.keyword.match_type.name,
                })
    except GoogleAdsException as ex:
        print(f"Ad group negative keyword fetch failed: {ex.error.code().name}")

    return negative_keywords


def fetch_optimization_score(client, customer_id):
    """Account optimization score + pending recommendation types (additive; safe to fail)."""
    ga_service = client.get_service("GoogleAdsService")
    result = {"optimization_score": None, "recommendations": [], "currency_code": None}

    try:
        resp = ga_service.search_stream(
            customer_id=customer_id,
            query="SELECT customer.optimization_score, customer.currency_code FROM customer",
        )
        for batch in resp:
            for row in batch.results:
                result["optimization_score"] = row.customer.optimization_score
                result["currency_code"] = row.customer.currency_code
    except Exception as e:
        print(f"Optimization score unavailable: {e}")

    try:
        resp = ga_service.search_stream(
            customer_id=customer_id,
            # impact is a selectable MESSAGE; its leaf metrics aren't individually
            # selectable, so pull the whole message and read nested fields.
            query="SELECT recommendation.type, recommendation.impact FROM recommendation",
        )
        # Per type: count + Google's own quantified impact (potential - base).
        agg = {}
        for batch in resp:
            for row in batch.results:
                t = row.recommendation.type.name
                a = agg.setdefault(t, {"count": 0, "est_conversions": 0.0, "est_cost_change": 0.0})
                a["count"] += 1
                impact = row.recommendation.impact
                a["est_conversions"] += (
                    impact.potential_metrics.conversions - impact.base_metrics.conversions
                )
                a["est_cost_change"] += (
                    impact.potential_metrics.cost_micros - impact.base_metrics.cost_micros
                ) / 1e6
        result["recommendations"] = [
            {
                "type": t,
                "count": a["count"],
                "est_conversions": round(a["est_conversions"], 2),
                "est_cost_change": round(a["est_cost_change"], 2),
            }
            for t, a in sorted(agg.items(), key=lambda x: -x[1]["count"])
        ]
    except Exception as e:
        print(f"Recommendations unavailable: {e}")
        # Degrade to type + count only (some rec types omit impact metrics).
        try:
            resp = ga_service.search_stream(
                customer_id=customer_id,
                query="SELECT recommendation.type FROM recommendation",
            )
            counts = {}
            for batch in resp:
                for row in batch.results:
                    t = row.recommendation.type.name
                    counts[t] = counts.get(t, 0) + 1
            result["recommendations"] = [
                {"type": t, "count": n}
                for t, n in sorted(counts.items(), key=lambda x: -x[1])
            ]
        except Exception as e2:
            print(f"Recommendations fallback unavailable: {e2}")

    return result


def fetch_pmax_campaigns(client, customer_id, start_date, end_date):
    """Performance Max campaigns (additive; safe to fail).

    Classic keyword fetch surfaces these too, but a dedicated pull keeps the PMax
    dashboard section self-contained and independent of the campaign list ordering.
    """
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.average_cpc,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_per_conversion,
            campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
            AND campaign.status != 'REMOVED'
            AND segments.date BETWEEN '{start_date}' AND '{end_date}'
        ORDER BY metrics.impressions DESC
    """

    pmax_campaigns = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                cost = row.metrics.cost_micros / 1_000_000
                pmax_campaigns.append({
                    "id": row.campaign.id,
                    "name": row.campaign.name,
                    "status": row.campaign.status.name,
                    "type": row.campaign.advertising_channel_type.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "avg_cpc": row.metrics.average_cpc / 1_000_000,
                    "cost": cost,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cost_per_conversion": row.metrics.cost_per_conversion / 1_000_000 if row.metrics.cost_per_conversion else 0,
                    "roas": (row.metrics.conversions_value / cost) if cost > 0 else 0,
                    "daily_budget": row.campaign_budget.amount_micros / 1_000_000,
                })
    except Exception as e:
        print(f"PMax campaigns unavailable: {e}")

    return pmax_campaigns


def fetch_pmax_asset_groups(client, customer_id, start_date, end_date):
    """Performance Max asset-group performance (additive; safe to fail)."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            asset_group.id,
            asset_group.name,
            asset_group.status,
            asset_group.ad_strength,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM asset_group
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
        ORDER BY metrics.impressions DESC
    """

    asset_groups = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                cost = row.metrics.cost_micros / 1_000_000
                asset_groups.append({
                    "id": row.asset_group.id,
                    "name": row.asset_group.name,
                    "status": row.asset_group.status.name,
                    "ad_strength": row.asset_group.ad_strength.name,
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "ctr": (row.metrics.ctr * 100) if row.metrics.ctr else 0,
                    "cost": cost,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                    "cpa": (cost / row.metrics.conversions) if row.metrics.conversions > 0 else 0,
                })
    except Exception as e:
        print(f"PMax asset groups unavailable: {e}")

    return asset_groups


def fetch_pmax_search_terms(client, customer_id, campaign_ids, start_date, end_date):
    """Performance Max keywordless search-term (theme/category) insights (additive; safe to fail).

    The API requires filtering campaign_search_term_insight by a single
    campaign_id, so we query per PMax campaign and merge the results.
    """
    ga_service = client.get_service("GoogleAdsService")
    search_terms = []

    for cid in campaign_ids:
        query = f"""
            SELECT
                campaign_search_term_insight.category_label,
                campaign_search_term_insight.id,
                campaign_search_term_insight.campaign_id,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign_search_term_insight
            WHERE campaign_search_term_insight.campaign_id = {cid}
                AND segments.date BETWEEN '{start_date}' AND '{end_date}'
            ORDER BY metrics.impressions DESC
        """
        try:
            response = ga_service.search_stream(customer_id=customer_id, query=query)
            for batch in response:
                for row in batch.results:
                    label = row.campaign_search_term_insight.category_label
                    search_terms.append({
                        "category_label": label if label else "(Uncategorized)",
                        "campaign_id": row.campaign_search_term_insight.campaign_id,
                        "impressions": row.metrics.impressions,
                        "clicks": row.metrics.clicks,
                        "conversions": row.metrics.conversions,
                        "conversion_value": row.metrics.conversions_value,
                    })
        except Exception as e:
            print(f"PMax search-term insights unavailable for campaign {cid}: {e}")

    return search_terms


def fetch_pmax_channels(client, customer_id, start_date, end_date):
    """PMax per-channel breakdown via ad_network_type segmentation (additive; safe to fail).

    Google historically does not expose a true Search/YouTube/Display split for PMax;
    this ad_network_type segmentation is a best-effort proxy and may return nothing.
    """
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            campaign.id,
            campaign.name,
            segments.ad_network_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM campaign
        WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
            AND campaign.status != 'REMOVED'
            AND segments.date BETWEEN '{start_date}' AND '{end_date}'
        ORDER BY metrics.impressions DESC
    """

    channels = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                channels.append({
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name,
                    "channel": row.segments.ad_network_type.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": row.metrics.cost_micros / 1_000_000,
                    "conversions": row.metrics.conversions,
                    "conversion_value": row.metrics.conversions_value,
                })
    except Exception as e:
        print(f"PMax channel breakdown unavailable: {e}")

    return channels


def fetch_rsa_asset_performance(client, customer_id, start_date, end_date):
    """Per-asset (headline/description) performance labels for RSAs (additive; safe to fail)."""
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            ad_group_ad_asset_view.performance_label,
            ad_group_ad_asset_view.field_type,
            asset.text_asset.text,
            ad_group.name,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions
        FROM ad_group_ad_asset_view
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
            AND ad_group_ad_asset_view.field_type IN ('HEADLINE', 'DESCRIPTION')
        ORDER BY metrics.impressions DESC
    """

    # Cap to the top assets by impressions (rows arrive ordered) to bound the
    # payload — large accounts have thousands of RSA assets. Google only assigns a
    # strength label (LOW/GOOD/BEST/LEARNING) to eligible assets; the rest come back
    # NOT_APPLICABLE, so we keep all labels and colour-code on the frontend when rated.
    max_rows = 200

    assets = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                assets.append({
                    "text": row.asset.text_asset.text,
                    "field_type": row.ad_group_ad_asset_view.field_type.name,
                    "performance_label": row.ad_group_ad_asset_view.performance_label.name,
                    "ad_group_name": row.ad_group.name,
                    "campaign_name": row.campaign.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "conversions": row.metrics.conversions,
                })
                if len(assets) >= max_rows:
                    break
            if len(assets) >= max_rows:
                break
    except Exception as e:
        print(f"RSA asset performance unavailable: {e}")

    return assets


def fetch_change_history(client, customer_id):
    """Recent account changes, last 30 days (API caps at 30d / 10k rows; additive, safe to fail)."""
    ga_service = client.get_service("GoogleAdsService")

    # API requires a bounded change_date_time range within the last 30 days
    # (a single-sided bound is rejected as an infinite range).
    since = (datetime.now() - timedelta(days=29)).strftime("%Y-%m-%d %H:%M:%S")
    until = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    query = f"""
        SELECT
            change_event.change_date_time,
            change_event.user_email,
            change_event.change_resource_type,
            change_event.resource_change_operation,
            change_event.client_type,
            change_event.changed_fields
        FROM change_event
        WHERE change_event.change_date_time >= '{since}'
            AND change_event.change_date_time <= '{until}'
        ORDER BY change_event.change_date_time DESC
        LIMIT 500
    """

    changes = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                ce = row.change_event
                try:
                    fields = list(ce.changed_fields.paths)
                except Exception:
                    fields = []
                changes.append({
                    "change_date_time": ce.change_date_time,
                    "user_email": ce.user_email,
                    "resource_type": ce.change_resource_type.name,
                    "operation": ce.resource_change_operation.name,
                    "client_type": ce.client_type.name,
                    "changed_fields": fields,
                })
    except Exception as e:
        print(f"Change history unavailable: {e}")

    return changes


def main():
    parser = argparse.ArgumentParser(description="Fetch Google Ads performance metrics")
    parser.add_argument("--customer_id", required=True, help="Google Ads customer ID (without dashes)")
    parser.add_argument("--start_date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end_date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--output_dir", default=".tmp", help="Output directory for JSON file")

    args = parser.parse_args()

    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)

    # Initialize Google Ads client
    print("Initializing Google Ads API client...")
    client = load_google_ads_client()

    # Fetch metrics at all levels
    print(f"Fetching metrics for customer {args.customer_id} from {args.start_date} to {args.end_date}...")

    print("  - Fetching campaign metrics...")
    campaigns = fetch_campaign_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching impression share...")
    impression_share = fetch_campaign_impression_share(client, args.customer_id, args.start_date, args.end_date)
    for c in campaigns:
        c.update(impression_share.get(c["id"], {}))

    print("  - Fetching daily campaign metrics...")
    campaign_daily = fetch_campaign_daily_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching daily ad group metrics...")
    ad_group_daily = fetch_adgroup_daily_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching ad group metrics...")
    ad_groups = fetch_adgroup_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching keyword metrics...")
    keywords = fetch_keyword_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching ad metrics...")
    ads = fetch_ad_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching search query report...")
    search_queries = fetch_search_query_report(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching geographic performance...")
    geo_performance = fetch_geographic_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching time-segmented performance...")
    time_performance = fetch_time_segmented_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching device-segmented performance...")
    device_performance = fetch_device_metrics(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching negative keywords...")
    negative_keywords = fetch_negative_keywords(client, args.customer_id)

    print("  - Fetching optimization score & recommendations...")
    optimization = fetch_optimization_score(client, args.customer_id)

    print("  - Fetching Performance Max campaigns...")
    pmax_campaigns = fetch_pmax_campaigns(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching Performance Max asset groups...")
    pmax_asset_groups = fetch_pmax_asset_groups(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching Performance Max search-term insights...")
    pmax_campaign_ids = [c["id"] for c in pmax_campaigns]
    pmax_search_terms = fetch_pmax_search_terms(client, args.customer_id, pmax_campaign_ids, args.start_date, args.end_date)

    print("  - Fetching Performance Max channel breakdown...")
    pmax_channels = fetch_pmax_channels(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching RSA per-asset performance...")
    rsa_asset_performance = fetch_rsa_asset_performance(client, args.customer_id, args.start_date, args.end_date)

    print("  - Fetching account change history...")
    change_history = fetch_change_history(client, args.customer_id)

    # Compile all data
    metrics_data = {
        "customer_id": args.customer_id,
        "fetched_at": datetime.now().isoformat(),
        "campaigns": campaigns,
        "campaign_daily": campaign_daily,
        "ad_group_daily": ad_group_daily,
        "ad_groups": ad_groups,
        "keywords": keywords,
        "ads": ads,
        "search_queries": search_queries,
        "geo_performance": geo_performance,
        "time_performance": time_performance,
        "device_performance": device_performance,
        "negative_keywords": negative_keywords,
        "google_negative_keywords": negative_keywords,
        "optimization_score": optimization.get("optimization_score"),
        "google_recommendations": optimization.get("recommendations", []),
        "currency_code": optimization.get("currency_code"),
        "pmax_campaigns": pmax_campaigns,
        "pmax_asset_groups": pmax_asset_groups,
        "pmax_search_terms": pmax_search_terms,
        "pmax_channels": pmax_channels,
        "rsa_asset_performance": rsa_asset_performance,
        "change_history": change_history,
        "date_range": {
            "start_date": args.start_date,
            "end_date": args.end_date,
            "days": max(1, (datetime.strptime(args.end_date, "%Y-%m-%d") - datetime.strptime(args.start_date, "%Y-%m-%d")).days + 1)
        },
        "summary": {
            "total_campaigns": len(campaigns),
            "total_ad_groups": len(ad_groups),
            "total_keywords": len(keywords),
            "total_ads": len(ads),
            "total_search_queries": len(search_queries),
            "total_geo_locations": len(geo_performance),
            "total_time_segments": len(time_performance),
            "total_device_segments": len(device_performance),
            "total_negative_keywords": len(negative_keywords),
            "total_pmax_campaigns": len(pmax_campaigns),
            "total_pmax_asset_groups": len(pmax_asset_groups),
            "total_pmax_search_terms": len(pmax_search_terms),
            "total_rsa_assets": len(rsa_asset_performance),
            "total_change_events": len(change_history),
            "total_campaign_daily_rows": len(campaign_daily),
            "total_ad_group_daily_rows": len(ad_group_daily),
            "total_impressions": sum(c["impressions"] for c in campaigns),
            "total_clicks": sum(c["clicks"] for c in campaigns),
            "total_cost": sum(c["cost"] for c in campaigns),
            "total_conversions": sum(c["conversions"] for c in campaigns),
            "total_conversion_value": sum(c["conversion_value"] for c in campaigns),
        }
    }

    # Calculate overall ROAS
    if metrics_data["summary"]["total_cost"] > 0:
        metrics_data["summary"]["overall_roas"] = (
            metrics_data["summary"]["total_conversion_value"] /
            metrics_data["summary"]["total_cost"]
        )
    else:
        metrics_data["summary"]["overall_roas"] = 0

    # Save to JSON file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(
        args.output_dir,
        f"google_ads_metrics_{args.customer_id}_{timestamp}.json"
    )

    with open(output_file, 'w') as f:
        json.dump(metrics_data, f, indent=2)

    print(f"\n[OK] Metrics saved to: {output_file}")
    print(f"\nSummary:")
    print(f"  Campaigns: {metrics_data['summary']['total_campaigns']}")
    print(f"  Ad Groups: {metrics_data['summary']['total_ad_groups']}")
    print(f"  Keywords: {metrics_data['summary']['total_keywords']}")
    print(f"  Ads: {metrics_data['summary']['total_ads']}")
    print(f"  Total Impressions: {metrics_data['summary']['total_impressions']:,}")
    print(f"  Total Clicks: {metrics_data['summary']['total_clicks']:,}")
    print(f"  Total Cost: ${metrics_data['summary']['total_cost']:,.2f}")
    print(f"  Total Conversions: {metrics_data['summary']['total_conversions']:.2f}")
    print(f"  Overall ROAS: {metrics_data['summary']['overall_roas']:.2f}x")

    # Return output file path for orchestration
    return output_file


if __name__ == "__main__":
    main()

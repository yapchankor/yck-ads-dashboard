import os
import re

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.targetingsearch import TargetingSearch
from facebook_business.exceptions import FacebookRequestError


def meta_error_response(ex):
    if isinstance(ex, FacebookRequestError):
        return {
            "status": "error",
            "code": ex.api_error_code(),
            "message": f"Meta API Error {ex.api_error_code()}: {ex.api_error_message()}",
            "type": ex.api_error_type(),
            "trace_id": ex.api_error_trace_id(),
        }
    return {
        "status": "error",
        "code": type(ex).__name__,
        "message": f"{type(ex).__name__}: {ex}",
    }


def init_facebook_api():
    """Initialize the Facebook Ads API from environment variables."""
    app_id = os.getenv("FACEBOOK_APP_ID")
    app_secret = os.getenv("FACEBOOK_APP_SECRET")
    access_token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    if not access_token:
        raise Exception("FACEBOOK_ACCESS_TOKEN not set")
    FacebookAdsApi.init(app_id or "", app_secret or "", access_token)


def _success(action, target_id, **extra):
    payload = {
        "status": "success",
        "action": action,
        "id": target_id,
    }
    payload.update(extra)
    return payload


def _to_plain_data(value):
    if value is None:
        return {}
    if hasattr(value, "export_all_data"):
        value = value.export_all_data()
    if isinstance(value, dict):
        return {
            key: _to_plain_data(val)
            if isinstance(val, (dict, list)) or hasattr(val, "export_all_data")
            else val
            for key, val in value.items()
        }
    if isinstance(value, list):
        return [
            _to_plain_data(item)
            if isinstance(item, (dict, list)) or hasattr(item, "export_all_data")
            else item
            for item in value
        ]
    return value


def _normalize_text(value):
    return str(value or "").strip()


def _normalize_list(values):
    if values is None:
        return []
    if isinstance(values, str):
        return [part.strip() for part in values.split(",") if part.strip()]
    if isinstance(values, (list, tuple, set)):
        return [str(value).strip() for value in values if str(value).strip()]
    return [str(values).strip()]


def parse_age_range(segment_value):
    """Parse age range text like '18-24 Female' into min/max ages."""
    match = re.search(r"(\d{2})\s*-\s*(\d{2})", _normalize_text(segment_value))
    if match:
        return int(match.group(1)), int(match.group(2))

    match = re.search(r"(\d{2})", _normalize_text(segment_value))
    if match:
        age = int(match.group(1))
        return age, age

    return None, None


def parse_gender(segment_value):
    """Return Meta gender code: 1=male, 2=female."""
    segment_lower = _normalize_text(segment_value).lower()
    if "female" in segment_lower:
        return 2
    if "male" in segment_lower:
        return 1
    return None


def parse_placement_name(placement_name):
    """Parse a user-facing placement label into Meta targeting fields."""
    placement_map = {
        "facebook - feed": ("facebook", "facebook_positions", "feed"),
        "facebook - right column": ("facebook", "facebook_positions", "right_column"),
        "facebook - marketplace": ("facebook", "facebook_positions", "marketplace"),
        "facebook - video feeds": ("facebook", "facebook_positions", "video_feeds"),
        "facebook - instant article": ("facebook", "facebook_positions", "instant_article"),
        "instagram - feed": ("instagram", "instagram_positions", "stream"),
        "instagram - stories": ("instagram", "instagram_positions", "story"),
        "instagram - explore": ("instagram", "instagram_positions", "explore"),
        "instagram - reels": ("instagram", "instagram_positions", "reels"),
        "audience network": ("audience_network", None, None),
        "audience network - classic": ("audience_network", None, None),
        "messenger - inbox": ("messenger", "messenger_positions", "messenger_home"),
        "messenger - stories": ("messenger", "messenger_positions", "story"),
    }
    key = re.sub(r"\s+", " ", _normalize_text(placement_name).lower())
    return placement_map.get(key, (None, None, None))


def _fetch_adset_targeting(adset_id, fields=None):
    fields = fields or ["name", "targeting", "campaign", "daily_budget", "lifetime_budget"]
    adset_data = AdSet(adset_id).api_get(fields=fields)
    targeting = _to_plain_data(adset_data.get("targeting", {}))
    return adset_data, dict(targeting or {})


def _update_adset_targeting(adset_id, targeting):
    AdSet(adset_id).remote_update(params={"targeting": targeting})


def lookup_location_id(location_name):
    """Resolve a location name into the key/type Meta expects for exclusions."""
    search_query = _normalize_text(location_name).split(",")[0].strip()
    if not search_query:
        return None, None

    results = TargetingSearch.search(params={"type": "adgeolocation", "q": search_query})
    for result in results or []:
        result_type = _normalize_text(result.get("type")).lower()
        key = result.get("key")
        if not key:
            continue
        if result_type in {"region", "city", "country"}:
            return str(key), result_type

        if result.get("country_code") and "," in _normalize_text(location_name):
            return str(key), "region"

    return None, None


def pause_campaign(campaign_id):
    """Pause a Meta Ads campaign."""
    try:
        init_facebook_api()
        Campaign(campaign_id).remote_update(params={"status": Campaign.Status.paused})
        return _success("pause_campaign", campaign_id)
    except Exception as ex:
        return meta_error_response(ex)


def pause_ad_set(ad_set_id):
    """Pause a Meta Ads ad set."""
    try:
        init_facebook_api()
        AdSet(ad_set_id).remote_update(params={"status": AdSet.Status.paused})
        return _success("pause_ad_set", ad_set_id)
    except Exception as ex:
        return meta_error_response(ex)


def pause_ad(ad_id):
    """Pause a Meta ad, used for fatigued creative recommendations."""
    try:
        init_facebook_api()
        Ad(ad_id).remote_update(params={"status": Ad.Status.paused})
        return _success("pause_ad", ad_id)
    except Exception as ex:
        return meta_error_response(ex)


def update_budget(campaign_id, suggested_budget):
    """Update the daily budget for a Meta Ads campaign."""
    try:
        init_facebook_api()
        budget_cents = int(round(float(suggested_budget) * 100))
        Campaign(campaign_id).remote_update(params={"daily_budget": budget_cents})
        return _success("update_campaign_budget", campaign_id, new_budget=budget_cents / 100)
    except Exception as ex:
        return meta_error_response(ex)


def update_ad_set_budget(ad_set_id, suggested_budget):
    """Update the daily budget for a Meta Ads ad set."""
    try:
        init_facebook_api()
        budget_cents = int(round(float(suggested_budget) * 100))
        AdSet(ad_set_id).remote_update(params={"daily_budget": budget_cents})
        return _success("update_ad_set_budget", ad_set_id, new_budget=budget_cents / 100)
    except Exception as ex:
        return meta_error_response(ex)


def scale_campaign_budget(campaign_id, scale_factor=1.25):
    """Scale a Meta campaign budget by a fixed factor using live budget data."""
    try:
        init_facebook_api()
        campaign = Campaign(campaign_id).api_get(fields=["daily_budget", "lifetime_budget"])
        daily_budget = campaign.get("daily_budget")
        lifetime_budget = campaign.get("lifetime_budget")

        if daily_budget:
            current_budget = int(daily_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            Campaign(campaign_id).remote_update(params={"daily_budget": new_budget})
            return _success(
                "scale_campaign_budget",
                campaign_id,
                budget_type="daily",
                previous_budget=current_budget / 100,
                new_budget=new_budget / 100,
            )

        if lifetime_budget:
            current_budget = int(lifetime_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            Campaign(campaign_id).remote_update(params={"lifetime_budget": new_budget})
            return _success(
                "scale_campaign_budget",
                campaign_id,
                budget_type="lifetime",
                previous_budget=current_budget / 100,
                new_budget=new_budget / 100,
            )

        return {
            "status": "error",
            "code": "MissingBudget",
            "message": "No campaign budget found. This campaign may use ad set budgets.",
        }
    except Exception as ex:
        return meta_error_response(ex)


def scale_ad_set_budget(ad_set_id, scale_factor=1.25):
    """Scale a Meta ad set budget by a fixed factor using live budget data."""
    try:
        init_facebook_api()
        adset = AdSet(ad_set_id).api_get(fields=["daily_budget", "lifetime_budget"])
        daily_budget = adset.get("daily_budget")
        lifetime_budget = adset.get("lifetime_budget")

        if daily_budget:
            current_budget = int(daily_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            AdSet(ad_set_id).remote_update(params={"daily_budget": new_budget})
            return _success(
                "scale_ad_set_budget",
                ad_set_id,
                budget_type="daily",
                previous_budget=current_budget / 100,
                new_budget=new_budget / 100,
            )

        if lifetime_budget:
            current_budget = int(lifetime_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            AdSet(ad_set_id).remote_update(params={"lifetime_budget": new_budget})
            return _success(
                "scale_ad_set_budget",
                ad_set_id,
                budget_type="lifetime",
                previous_budget=current_budget / 100,
                new_budget=new_budget / 100,
            )

        return {
            "status": "error",
            "code": "MissingBudget",
            "message": "No ad set budget found for scaling.",
        }
    except Exception as ex:
        return meta_error_response(ex)


def exclude_demographic_segment(adset_id, segment_type, segment_value):
    """Narrow an ad set's age/gender targeting to exclude a poor segment."""
    try:
        init_facebook_api()
        if _normalize_text(segment_type).lower() == "placement":
            return exclude_placement(adset_id, segment_value)

        adset_data, targeting = _fetch_adset_targeting(adset_id)
        changes = []

        min_age, max_age = parse_age_range(segment_value)
        if min_age is not None and max_age is not None:
            current_min = int(targeting.get("age_min") or 18)
            current_max = int(targeting.get("age_max") or 65)

            if min_age == current_min and max_age < current_max:
                targeting["age_min"] = max_age + 1
                changes.append(f"age_min {current_min} to {max_age + 1}")
            elif max_age == current_max and min_age > current_min:
                targeting["age_max"] = min_age - 1
                changes.append(f"age_max {current_max} to {min_age - 1}")
            elif current_min < min_age and max_age < current_max:
                lower_range = min_age - current_min
                upper_range = current_max - max_age
                if upper_range >= lower_range:
                    targeting["age_min"] = max_age + 1
                    changes.append(f"kept ages {max_age + 1}-{current_max}")
                else:
                    targeting["age_max"] = min_age - 1
                    changes.append(f"kept ages {current_min}-{min_age - 1}")

        gender_to_exclude = parse_gender(segment_value)
        if gender_to_exclude:
            current_genders = targeting.get("genders") or [1, 2]
            if gender_to_exclude in current_genders and len(current_genders) > 1:
                targeting["genders"] = [gender for gender in current_genders if gender != gender_to_exclude]
                gender_name = "male" if gender_to_exclude == 1 else "female"
                changes.append(f"removed {gender_name}")
            elif len(current_genders) == 1:
                return {
                    "status": "error",
                    "code": "UnsafeTargetingChange",
                    "message": f"Cannot exclude {segment_value}; it is the only gender currently targeted.",
                }

        if not changes:
            return {
                "status": "error",
                "code": "UnparseableSegment",
                "message": f"Could not turn '{segment_value}' into a safe age/gender targeting edit.",
            }

        _update_adset_targeting(adset_id, targeting)
        return _success(
            "exclude_demographic_segment",
            adset_id,
            adset_name=adset_data.get("name"),
            changes=changes,
        )
    except Exception as ex:
        return meta_error_response(ex)


def exclude_placement(adset_id, placement_name):
    """Remove a placement from an ad set's manual placement targeting."""
    try:
        init_facebook_api()
        adset_data, targeting = _fetch_adset_targeting(adset_id)
        platform, position_field, position = parse_placement_name(placement_name)

        if not platform:
            return {
                "status": "error",
                "code": "UnknownPlacement",
                "message": f"Unknown placement format: '{placement_name}'.",
            }

        platforms = list(targeting.get("publisher_platforms") or [])
        if not platforms:
            return {
                "status": "error",
                "code": "AutomaticPlacements",
                "message": "This ad set appears to use automatic placements; switch to manual placements before excluding one placement.",
            }

        changes = []
        if position_field and position:
            positions = list(targeting.get(position_field) or [])
            if position not in positions:
                return {
                    "status": "error",
                    "code": "PlacementNotTargeted",
                    "message": f"Placement '{placement_name}' is not explicitly targeted or is already excluded.",
                }
            targeting[position_field] = [item for item in positions if item != position]
            changes.append(f"removed {position} from {position_field}")
            if not targeting[position_field] and platform in platforms:
                platforms = [item for item in platforms if item != platform]
                changes.append(f"removed {platform} platform")
        elif platform in platforms:
            platforms = [item for item in platforms if item != platform]
            changes.append(f"removed {platform} platform")
        else:
            return {
                "status": "error",
                "code": "PlacementNotTargeted",
                "message": f"Placement '{placement_name}' is not targeted or is already excluded.",
            }

        if not platforms:
            return {
                "status": "error",
                "code": "UnsafeTargetingChange",
                "message": f"Cannot exclude '{placement_name}' because it would remove all placements.",
            }

        targeting["publisher_platforms"] = platforms
        _update_adset_targeting(adset_id, targeting)
        return _success(
            "exclude_placement",
            adset_id,
            adset_name=adset_data.get("name"),
            placement=placement_name,
            changes=changes,
        )
    except Exception as ex:
        return meta_error_response(ex)


def exclude_geo_location(adset_id, location_name=None, location_key=None, location_type=None):
    """Add a region/city/country to an ad set's geo exclusions."""
    try:
        init_facebook_api()
        location_name = _normalize_text(location_name)
        location_key = _normalize_text(location_key)
        location_type = _normalize_text(location_type).lower()

        if not location_key:
            location_key, location_type = lookup_location_id(location_name)

        if not location_key or location_type not in {"region", "city", "country"}:
            return {
                "status": "error",
                "code": "LocationLookupFailed",
                "message": f"Could not resolve '{location_name}' to a Meta location ID.",
            }

        adset_data, targeting = _fetch_adset_targeting(adset_id)
        geo_locs = dict(targeting.get("geo_locations") or {})

        if location_type == "region":
            excluded = list(geo_locs.get("excluded_regions") or [])
            if any(str(item.get("key")) == str(location_key) for item in excluded):
                return {
                    "status": "error",
                    "code": "AlreadyExcluded",
                    "message": f"Location '{location_name or location_key}' is already excluded.",
                }
            excluded.append({"key": str(location_key), "name": location_name or str(location_key)})
            geo_locs["excluded_regions"] = excluded
        elif location_type == "city":
            excluded = list(geo_locs.get("excluded_cities") or [])
            if any(str(item.get("key")) == str(location_key) for item in excluded):
                return {
                    "status": "error",
                    "code": "AlreadyExcluded",
                    "message": f"Location '{location_name or location_key}' is already excluded.",
                }
            excluded.append({"key": str(location_key), "name": location_name or str(location_key)})
            geo_locs["excluded_cities"] = excluded
        else:
            excluded = list(geo_locs.get("excluded_countries") or [])
            country_code = str(location_key).upper()
            if country_code in [str(item).upper() for item in excluded]:
                return {
                    "status": "error",
                    "code": "AlreadyExcluded",
                    "message": f"Country '{location_name or country_code}' is already excluded.",
                }
            excluded.append(country_code)
            geo_locs["excluded_countries"] = excluded

        targeting["geo_locations"] = geo_locs
        _update_adset_targeting(adset_id, targeting)
        return _success(
            "exclude_geo_location",
            adset_id,
            adset_name=adset_data.get("name"),
            location=location_name or location_key,
            location_type=location_type,
        )
    except Exception as ex:
        return meta_error_response(ex)


def adjust_ad_schedule(adset_id, best_hours):
    """Set an ad set schedule to only run in high-performing hours."""
    try:
        init_facebook_api()
        hours = sorted({int(hour) for hour in best_hours if str(hour).strip().isdigit() and 0 <= int(hour) <= 23})
        if not hours:
            return {
                "status": "error",
                "code": "MissingScheduleHours",
                "message": "No valid peak hours were provided.",
            }

        adset_data = AdSet(adset_id).api_get(fields=["name"])
        schedule = [
            {
                "start_minute": hour * 60,
                "end_minute": (hour + 1) * 60,
                "days": [0, 1, 2, 3, 4, 5, 6],
                "timezone_type": "USER",
            }
            for hour in hours
        ]
        AdSet(adset_id).remote_update(params={"adset_schedule": schedule})
        return _success(
            "adjust_ad_schedule",
            adset_id,
            adset_name=adset_data.get("name"),
            best_hours=hours,
        )
    except Exception as ex:
        return meta_error_response(ex)


def adjust_day_schedule(adset_id, wasted_days):
    """Set an ad set schedule to avoid poor-performing days."""
    try:
        init_facebook_api()
        day_map = {
            "sunday": 0,
            "monday": 1,
            "tuesday": 2,
            "wednesday": 3,
            "thursday": 4,
            "friday": 5,
            "saturday": 6,
        }
        wasted_day_nums = {
            day_map[day.lower()]
            for day in _normalize_list(wasted_days)
            if day.lower() in day_map
        }

        if not wasted_day_nums:
            return {
                "status": "error",
                "code": "MissingScheduleDays",
                "message": "No valid days were provided for schedule adjustment.",
            }

        active_days = [day for day in range(7) if day not in wasted_day_nums]
        if not active_days:
            return {
                "status": "error",
                "code": "UnsafeScheduleChange",
                "message": "Cannot exclude every day of the week.",
            }

        adset_data = AdSet(adset_id).api_get(fields=["name"])
        schedule = [{
            "start_minute": 0,
            "end_minute": 1440,
            "days": active_days,
            "timezone_type": "USER",
        }]
        AdSet(adset_id).remote_update(params={"adset_schedule": schedule})
        return _success(
            "adjust_day_schedule",
            adset_id,
            adset_name=adset_data.get("name"),
            excluded_days=_normalize_list(wasted_days),
        )
    except Exception as ex:
        return meta_error_response(ex)

import os
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.protobuf import field_mask_pb2

DEVICE_ENUM_NAMES = {
    "mobile": "MOBILE",
    "desktop": "DESKTOP",
    "tablet": "TABLET",
    "connected_tv": "CONNECTED_TV",
    "other": "OTHER",
}


def _parse_bid_modifier(adjustment):
    """Convert '+25%' / '-30%' / 1.2 style input into a Google bid modifier."""
    if adjustment is None:
        raise ValueError("Missing bid adjustment")

    text = str(adjustment).strip()
    if text.endswith("%"):
        pct = float(text[:-1].replace("+", ""))
        modifier = 1 + (pct / 100)
    else:
        value = float(text)
        modifier = value if value > 0 else 1 + (value / 100)

    return max(0.1, min(modifier, 10.0))


def _criterion_resource_name(customer_id, campaign_id, criterion_id):
    return f"customers/{customer_id}/campaignCriteria/{campaign_id}~{criterion_id}"


def _mutate_campaign_criterion_bid_modifier(client, customer_id, resource_name, bid_modifier):
    campaign_criterion_service = client.get_service("CampaignCriterionService")
    operation = client.get_type("CampaignCriterionOperation")
    criterion = operation.update
    criterion.resource_name = resource_name
    criterion.bid_modifier = bid_modifier
    operation.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["bid_modifier"]))

    response = campaign_criterion_service.mutate_campaign_criteria(
        customer_id=customer_id,
        operations=[operation],
    )
    return response.results[0].resource_name

def google_ads_error_response(ex):
    """Return enough Google Ads API detail to debug apply failures."""
    code = ex.error.code().name if hasattr(ex, "error") else "UNKNOWN"
    errors = []

    for error in getattr(ex.failure, "errors", []) or []:
        field_path = ""
        if getattr(error, "location", None):
            field_path = ".".join(
                element.field_name
                for element in error.location.field_path_elements
                if element.field_name
            )
        errors.append({
            "message": error.message,
            "field_path": field_path,
            "trigger": str(getattr(error, "trigger", "")),
            "error_code": str(getattr(error, "error_code", "")),
        })

    message = "; ".join(
        f"{err['field_path']}: {err['message']}" if err["field_path"] else err["message"]
        for err in errors
        if err["message"]
    ) or str(ex)

    return {
        "status": "error",
        "code": code,
        "request_id": getattr(ex, "request_id", None),
        "message": f"Google Ads Error {code}: {message}",
        "errors": errors,
    }

def unexpected_error_response(ex):
    return {
        "status": "error",
        "code": type(ex).__name__,
        "message": f"{type(ex).__name__}: {ex}",
    }

def load_google_ads_client():
    """Load Google Ads API client from credentials."""
    login_customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", "").strip()
    credentials = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "use_proto_plus": True
    }
    if login_customer_id and len(login_customer_id) == 10 and login_customer_id.isdigit():
        credentials["login_customer_id"] = login_customer_id
    return GoogleAdsClient.load_from_dict(credentials)

def add_negative_keyword(customer_id, campaign_id, keyword, match_type="PHRASE"):
    """Execute adding a negative keyword to a campaign."""
    client = load_google_ads_client()
    campaign_criterion_service = client.get_service("CampaignCriterionService")
    
    # Create the campaign criterion
    campaign_criterion_operation = client.get_type("CampaignCriterionOperation")
    campaign_criterion = campaign_criterion_operation.create
    campaign_criterion.campaign = campaign_criterion_service.campaign_path(customer_id, campaign_id)
    campaign_criterion.negative = True
    
    # Set the keyword info
    match_type_enum = client.enums.KeywordMatchTypeEnum[str(match_type or "PHRASE").upper()]
    campaign_criterion.keyword.text = keyword
    campaign_criterion.keyword.match_type = match_type_enum
    
    try:
        response = campaign_criterion_service.mutate_campaign_criteria(
            customer_id=customer_id, operations=[campaign_criterion_operation]
        )
        return {"status": "success", "resource_name": response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)

def pause_ad_group_criterion(customer_id, criterion_resource_name):
    """Execute pausing a specific keyword/criterion."""
    client = load_google_ads_client()
    agc_service = client.get_service("AdGroupCriterionService")
    
    operation = client.get_type("AdGroupCriterionOperation")
    criterion = operation.update
    criterion.resource_name = criterion_resource_name
    criterion.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
    operation.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["status"]))
    
    try:
        response = agc_service.mutate_ad_group_criteria(
            customer_id=customer_id, operations=[operation]
        )
        return {"status": "success", "resource_name": response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)

def update_bid(customer_id, criterion_resource_name, suggested_bid):
    """Execute updating a CPC bid for a criterion."""
    client = load_google_ads_client()
    agc_service = client.get_service("AdGroupCriterionService")

    operation = client.get_type("AdGroupCriterionOperation")
    criterion = operation.update
    criterion.resource_name = criterion_resource_name
    bid_micros = round(suggested_bid * 1_000_000 / 10_000) * 10_000
    criterion.cpc_bid_micros = int(bid_micros)
    operation.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["cpc_bid_micros"]))

    try:
        response = agc_service.mutate_ad_group_criteria(
            customer_id=customer_id, operations=[operation]
        )
        return {"status": "success", "resource_name": response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)

def _set_campaign_status(customer_id, campaign_id, status_enum_name):
    """Shared helper for pause_campaign / enable_campaign."""
    client = load_google_ads_client()
    campaign_service = client.get_service("CampaignService")

    operation = client.get_type("CampaignOperation")
    campaign = operation.update
    campaign.resource_name = campaign_service.campaign_path(customer_id, campaign_id)
    campaign.status = client.enums.CampaignStatusEnum[status_enum_name]
    operation.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["status"]))

    try:
        response = campaign_service.mutate_campaigns(
            customer_id=customer_id, operations=[operation]
        )
        return {"status": "success", "resource_name": response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)

def pause_campaign(customer_id, campaign_id):
    """Pause a Google Ads campaign."""
    return _set_campaign_status(customer_id, campaign_id, "PAUSED")

def enable_campaign(customer_id, campaign_id):
    """Enable (un-pause) a Google Ads campaign."""
    return _set_campaign_status(customer_id, campaign_id, "ENABLED")

def update_campaign_budget(customer_id, campaign_id, new_daily_budget):
    """Update the daily budget for a campaign by looking up its current budget resource."""
    client = load_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT campaign_budget.resource_name
        FROM campaign
        WHERE campaign.id = {campaign_id}
        LIMIT 1
    """

    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        budget_resource_name = None
        for row in response:
            budget_resource_name = row.campaign_budget.resource_name
            break

        if not budget_resource_name:
            return {"status": "error", "message": f"No budget found for campaign {campaign_id}"}

        budget_service = client.get_service("CampaignBudgetService")
        budget_operation = client.get_type("CampaignBudgetOperation")
        budget = budget_operation.update
        budget.resource_name = budget_resource_name
        budget.amount_micros = int(round(new_daily_budget * 1_000_000 / 10_000) * 10_000)
        budget_operation.update_mask.CopyFrom(field_mask_pb2.FieldMask(paths=["amount_micros"]))

        budget_response = budget_service.mutate_campaign_budgets(
            customer_id=customer_id, operations=[budget_operation]
        )
        return {"status": "success", "resource_name": budget_response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)


def update_device_bid_modifier(customer_id, campaign_id, device, adjustment):
    """Update an existing campaign-level Google device bid modifier."""
    client = load_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    device_name = DEVICE_ENUM_NAMES.get(str(device or "").strip().lower())
    if not device_name:
        return {"status": "error", "message": f"Unsupported Google device: {device}"}

    bid_modifier = _parse_bid_modifier(adjustment)
    query = f"""
        SELECT
            campaign_criterion.criterion_id,
            campaign_criterion.resource_name
        FROM campaign_criterion
        WHERE campaign.id = {campaign_id}
            AND campaign_criterion.type = 'DEVICE'
            AND campaign_criterion.device.type = '{device_name}'
            AND campaign_criterion.status != 'REMOVED'
        LIMIT 1
    """

    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        resource_name = None
        for row in response:
            resource_name = row.campaign_criterion.resource_name
            break

        if not resource_name:
            return {
                "status": "error",
                "message": f"No editable device criterion found for campaign {campaign_id} / {device_name}",
            }

        updated_resource = _mutate_campaign_criterion_bid_modifier(
            client,
            customer_id,
            resource_name,
            bid_modifier,
        )
        return {"status": "success", "resource_name": updated_resource, "bid_modifier": bid_modifier}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)


def update_geo_bid_modifier(customer_id, campaign_id, location_id, adjustment):
    """Update an existing campaign-level location bid modifier."""
    if not location_id:
        return {"status": "error", "message": "Missing location criterion ID"}

    client = load_google_ads_client()
    resource_name = _criterion_resource_name(customer_id, campaign_id, location_id)
    bid_modifier = _parse_bid_modifier(adjustment)

    try:
        updated_resource = _mutate_campaign_criterion_bid_modifier(
            client,
            customer_id,
            resource_name,
            bid_modifier,
        )
        return {"status": "success", "resource_name": updated_resource, "bid_modifier": bid_modifier}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)


def exclude_geo_location(customer_id, campaign_id, location_id):
    """Add a campaign-level negative location criterion."""
    if not location_id:
        return {"status": "error", "message": "Missing location criterion ID"}

    client = load_google_ads_client()
    campaign_criterion_service = client.get_service("CampaignCriterionService")
    geo_target_constant_service = client.get_service("GeoTargetConstantService")

    operation = client.get_type("CampaignCriterionOperation")
    criterion = operation.create
    criterion.campaign = campaign_criterion_service.campaign_path(customer_id, campaign_id)
    criterion.negative = True
    criterion.location.geo_target_constant = geo_target_constant_service.geo_target_constant_path(location_id)

    try:
        response = campaign_criterion_service.mutate_campaign_criteria(
            customer_id=customer_id,
            operations=[operation],
        )
        return {"status": "success", "resource_name": response.results[0].resource_name}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)


def update_ad_schedule_bid_modifier(customer_id, campaign_id, time_slot, adjustment):
    """Update an existing campaign-level ad schedule bid modifier for an hour/day slot."""
    client = load_google_ads_client()
    ga_service = client.get_service("GoogleAdsService")
    bid_modifier = _parse_bid_modifier(adjustment)
    slot = str(time_slot or "").strip()

    hour = None
    day = None
    if ":" in slot and slot[:2].isdigit():
        hour = int(slot[:2])
    elif slot:
        day = slot.strip().upper()

    where = [
        f"campaign.id = {campaign_id}",
        "campaign_criterion.type = 'AD_SCHEDULE'",
        "campaign_criterion.status != 'REMOVED'",
    ]
    if hour is not None:
        where.append(f"campaign_criterion.ad_schedule.start_hour = {hour}")
    if day:
        where.append(f"campaign_criterion.ad_schedule.day_of_week = '{day}'")

    query = f"""
        SELECT campaign_criterion.resource_name
        FROM campaign_criterion
        WHERE {' AND '.join(where)}
        LIMIT 1
    """

    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        resource_name = None
        for row in response:
            resource_name = row.campaign_criterion.resource_name
            break

        if not resource_name:
            return {
                "status": "error",
                "message": f"No editable ad schedule criterion found for campaign {campaign_id} / {time_slot}",
            }

        updated_resource = _mutate_campaign_criterion_bid_modifier(
            client,
            customer_id,
            resource_name,
            bid_modifier,
        )
        return {"status": "success", "resource_name": updated_resource, "bid_modifier": bid_modifier}
    except GoogleAdsException as ex:
        return google_ads_error_response(ex)
    except Exception as ex:
        return unexpected_error_response(ex)

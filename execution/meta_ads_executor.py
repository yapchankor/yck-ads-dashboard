import os
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.ad import Ad
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
    app_id = os.getenv('FACEBOOK_APP_ID')
    app_secret = os.getenv('FACEBOOK_APP_SECRET')
    access_token = os.getenv('FACEBOOK_ACCESS_TOKEN')
    if not access_token:
        raise Exception("FACEBOOK_ACCESS_TOKEN not set")
    FacebookAdsApi.init(app_id or '', app_secret or '', access_token)

def pause_campaign(campaign_id):
    """Pause a Meta Ads campaign."""
    init_facebook_api()
    campaign = Campaign(campaign_id)
    campaign.remote_update(params={
        'status': Campaign.Status.paused,
    })
    return {"status": "success", "id": campaign_id}

def pause_ad_set(ad_set_id):
    """Pause a Meta Ads ad set."""
    init_facebook_api()
    adset = AdSet(ad_set_id)
    adset.remote_update(params={
        'status': AdSet.Status.paused,
    })
    return {"status": "success", "id": ad_set_id}

def update_budget(campaign_id, suggested_budget):
    """Update the daily budget for a Meta Ads campaign."""
    try:
        init_facebook_api()
        campaign = Campaign(campaign_id)
        # Meta budgets are in cents (integer)
        budget_cents = int(float(suggested_budget) * 100)
        campaign.remote_update(params={
            'daily_budget': budget_cents,
        })
        return {"status": "success", "id": campaign_id}
    except Exception as ex:
        return meta_error_response(ex)

def update_ad_set_budget(ad_set_id, suggested_budget):
    """Update the daily budget for a Meta Ads ad set."""
    try:
        init_facebook_api()
        adset = AdSet(ad_set_id)
        budget_cents = int(float(suggested_budget) * 100)
        adset.remote_update(params={
            'daily_budget': budget_cents,
        })
        return {"status": "success", "id": ad_set_id}
    except Exception as ex:
        return meta_error_response(ex)

def scale_campaign_budget(campaign_id, scale_factor=1.25):
    """Scale a Meta campaign budget by a fixed factor using live budget data."""
    try:
        init_facebook_api()
        campaign = Campaign(campaign_id).api_get(fields=['daily_budget', 'lifetime_budget'])
        daily_budget = campaign.get('daily_budget')
        lifetime_budget = campaign.get('lifetime_budget')

        if daily_budget:
            current_budget = int(daily_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            Campaign(campaign_id).remote_update(params={'daily_budget': new_budget})
            return {
                "status": "success",
                "id": campaign_id,
                "budget_type": "daily",
                "previous_budget": current_budget / 100,
                "new_budget": new_budget / 100,
            }

        if lifetime_budget:
            current_budget = int(lifetime_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            Campaign(campaign_id).remote_update(params={'lifetime_budget': new_budget})
            return {
                "status": "success",
                "id": campaign_id,
                "budget_type": "lifetime",
                "previous_budget": current_budget / 100,
                "new_budget": new_budget / 100,
            }

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
        adset = AdSet(ad_set_id).api_get(fields=['daily_budget', 'lifetime_budget'])
        daily_budget = adset.get('daily_budget')
        lifetime_budget = adset.get('lifetime_budget')

        if daily_budget:
            current_budget = int(daily_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            AdSet(ad_set_id).remote_update(params={'daily_budget': new_budget})
            return {
                "status": "success",
                "id": ad_set_id,
                "budget_type": "daily",
                "previous_budget": current_budget / 100,
                "new_budget": new_budget / 100,
            }

        if lifetime_budget:
            current_budget = int(lifetime_budget)
            new_budget = int(round(current_budget * float(scale_factor)))
            AdSet(ad_set_id).remote_update(params={'lifetime_budget': new_budget})
            return {
                "status": "success",
                "id": ad_set_id,
                "budget_type": "lifetime",
                "previous_budget": current_budget / 100,
                "new_budget": new_budget / 100,
            }

        return {
            "status": "error",
            "code": "MissingBudget",
            "message": "No ad set budget found for scaling.",
        }
    except Exception as ex:
        return meta_error_response(ex)

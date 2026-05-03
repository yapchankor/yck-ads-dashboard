import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "execution"))

from modal_cloud import apply_recommendation_guardrails


DATE_RANGE = {"start_date": "2026-04-01", "end_date": "2026-04-26"}


def guarded_recommendations(recommendations, campaigns=None, keywords=None):
    data = {
        "date_range": DATE_RANGE,
        "summary": {"total_spend": 1000, "total_conversions": 100},
        "campaigns": campaigns or [],
        "keywords": keywords or [],
        "recommendations": recommendations,
    }
    return apply_recommendation_guardrails(data)["recommendations"]


class RecommendationContractTests(unittest.TestCase):
    def test_underutilized_meta_budget_increase_is_suppressed(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_adjustment",
                    "platform": "Meta",
                    "title": "Increase budget for Campaign A",
                    "description": "Only using 14% of daily budget. Campaign may be limited.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "current_budget": 100,
                    "suggested_bid": 125,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(recommendations, [])

    def test_valid_meta_budget_adjustment_can_be_auto_applied(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_adjustment",
                    "platform": "Meta",
                    "title": "Increase budget for Campaign A",
                    "description": "CPA is below account average and delivery is constrained.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "current_budget": 100,
                    "suggested_bid": 125,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertEqual(recommendations[0]["quality_label"], "High confidence")
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_budget_adjustment_above_25_percent_is_manual_only(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_adjustment",
                    "platform": "Meta",
                    "title": "Increase budget for Campaign A",
                    "description": "CPA is below account average and delivery is constrained.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "current_budget": 100,
                    "suggested_bid": 140,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertEqual(recommendations[0]["quality_label"], "Manual only")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_budget_scaling_with_campaign_id_can_auto_apply_without_cached_budget(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_scaling",
                    "platform": "Meta",
                    "title": "Scale budget for Campaign A",
                    "description": "CPA RM 5.00 is below average. 6 conversions from RM 60 spend.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "spend": 60,
                    "conversions": 6,
                    "suggested_bid": 125,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertEqual(recommendations[0]["quality_label"], "High confidence")
        self.assertTrue(recommendations[0]["automation_allowed"])
        self.assertNotIn("creative/platform setup", " ".join(recommendations[0]["guardrail_reasons"]).lower())

    def test_valid_budget_scaling_uses_verified_current_budget(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_scaling",
                    "platform": "Meta",
                    "title": "Scale budget for Campaign A",
                    "description": "CPA RM 5.00 is below average. 6 conversions from RM 60 spend.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "spend": 60,
                    "conversions": 6,
                    "current_budget": 100,
                    "suggested_bid": 125,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertEqual(recommendations[0]["quality_label"], "High confidence")
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_budget_scaling_above_25_percent_is_manual_only(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "budget_scaling",
                    "platform": "Meta",
                    "title": "Scale budget for Campaign A",
                    "description": "CPA RM 5.00 is below average. 6 conversions from RM 60 spend.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "spend": 60,
                    "conversions": 6,
                    "current_budget": 100,
                    "suggested_bid": 140,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertEqual(recommendations[0]["quality_label"], "Manual only")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_google_zero_conversion_keyword_pause_is_auto_applyable(self):
        target_id = "customers/123/adGroupCriteria/456~789"
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "keyword_action",
                    "platform": "Google",
                    "title": "Pause: carpal tunnel syndrome",
                    "description": "Quality Score of 2, 0 conversions, RM 72.50 wasted. CTR 7.3%",
                    "campaign_name": "YCK Main Search #2",
                    "ad_group_name": "Carpal Tunnel Syndrome",
                    "keyword": "carpal tunnel syndrome",
                    "target_id": target_id,
                    "suggested_action": "PAUSED",
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Google", "name": "YCK Main Search #2", "status": "ENABLED"}],
            keywords=[
                {
                    "resource_name": target_id,
                    "keyword": "carpal tunnel syndrome",
                    "campaign_name": "YCK Main Search #2",
                    "status": "ENABLED",
                    "campaign_status": "ENABLED",
                    "ad_group_status": "ENABLED",
                }
            ],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertEqual(recommendations[0]["quality_label"], "High confidence")
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_keyword_pause_with_conversions_needs_review(self):
        target_id = "customers/123/adGroupCriteria/456~789"
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "keyword_action",
                    "platform": "Google",
                    "title": "Pause: carpal tunnel syndrome",
                    "description": "Quality Score of 2, 2 conversions, RM 72.50 spent. CTR 7.3%",
                    "campaign_name": "YCK Main Search #2",
                    "keyword": "carpal tunnel syndrome",
                    "target_id": target_id,
                    "suggested_action": "PAUSED",
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Google", "name": "YCK Main Search #2", "status": "ENABLED"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertEqual(recommendations[0]["quality_label"], "Needs review")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_recommendations_for_paused_campaign_are_suppressed(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "bid_adjustment",
                    "platform": "Google",
                    "title": "Increase bid: slipped disc",
                    "description": "Strong performer: 2 conversions at RM 6.63 CPA.",
                    "campaign_name": "Paused Campaign",
                    "keyword": "slipped disc",
                    "target_id": "customers/123/adGroupCriteria/456~789",
                    "current_bid": 1.0,
                    "suggested_bid": 1.25,
                    "impact_data": {"confidence_pct": 80},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Google", "name": "Paused Campaign", "status": "PAUSED"}],
        )

        self.assertEqual(recommendations, [])

    def test_meta_placement_exclusion_with_required_fields_can_auto_apply(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "placement_exclusion",
                    "platform": "Meta",
                    "title": "Remove placement: Instagram - Stories",
                    "description": "Spent RM 18.00 with zero conversions on Instagram - Stories.",
                    "placement": "Instagram - Stories",
                    "adset_id": "adset-1",
                    "spend": 18,
                    "clicks": 12,
                    "conversions": 0,
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertEqual(recommendations[0]["quality_label"], "High confidence")
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_meta_placement_exclusion_missing_adset_is_manual_only(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "placement_exclusion",
                    "platform": "Meta",
                    "title": "Remove placement: Instagram - Stories",
                    "description": "Spent RM 18.00 with zero conversions on Instagram - Stories.",
                    "placement": "Instagram - Stories",
                    "spend": 18,
                    "clicks": 12,
                    "conversions": 0,
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertEqual(recommendations[0]["quality_label"], "Manual only")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_meta_simple_audience_exclusion_can_auto_apply(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "audience_exclusion",
                    "platform": "Meta",
                    "title": "Exclude Female",
                    "description": "Spent RM 18.00 with zero conversions on Female segment.",
                    "segment": "Female",
                    "segment_type": "gender",
                    "adset_id": "adset-1",
                    "spend": 18,
                    "clicks": 12,
                    "conversions": 0,
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_meta_combined_age_gender_audience_exclusion_is_manual(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "audience_exclusion",
                    "platform": "Meta",
                    "title": "Exclude Female 18-24",
                    "description": "Spent RM 18.00 with zero conversions on Female 18-24 segment.",
                    "segment": "Female 18-24",
                    "segment_type": "demographic",
                    "adset_id": "adset-1",
                    "spend": 18,
                    "clicks": 12,
                    "conversions": 0,
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_meta_objective_mismatch_remains_manual_only(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "objective_mismatch",
                    "platform": "Meta",
                    "title": "Switch objective",
                    "description": "Generating conversions despite LINK_CLICKS objective.",
                    "campaign_id": "123",
                    "spend": 20,
                    "conversions": 3,
                    "impact_data": {"confidence_pct": 65},
                    "automation": {"is_automatable": False},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_meta_campaign_pause_remains_needs_review(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "campaign_review",
                    "platform": "Meta",
                    "title": "Review or pause Campaign A",
                    "description": "Spent RM 72.00 with zero conversions.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "123",
                    "spend": 72,
                    "clicks": 30,
                    "conversions": 0,
                    "impact_data": {"confidence_pct": 90},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertEqual(recommendations[0]["quality_label"], "Needs review")
        self.assertFalse(recommendations[0]["automation_allowed"])

    def test_meta_geo_scaling_with_adset_id_can_auto_apply(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "geo_scaling",
                    "platform": "Meta",
                    "title": "Scale ad set because Putrajaya is performing well",
                    "description": "CPA RM 1.65 is 26.8% below average. 29 conversions from RM 47.71 spend.",
                    "campaign_name": "Campaign A",
                    "campaign_id": "campaign-1",
                    "adset_name": "Ad Set A",
                    "adset_id": "adset-1",
                    "location": "Putrajaya, MY",
                    "spend": 47.71,
                    "clicks": 40,
                    "conversions": 29,
                    "impact_data": {"confidence_pct": 70},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "campaign_id": "campaign-1", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "eligible")
        self.assertTrue(recommendations[0]["automation_allowed"])

    def test_meta_geo_scaling_without_target_is_manual_with_clear_reason(self):
        recommendations = guarded_recommendations(
            [
                {
                    "action_type": "geo_scaling",
                    "platform": "Meta",
                    "title": "Increase spend in Putrajaya, MY",
                    "description": "CPA RM 1.65 is 26.8% below average. 29 conversions from RM 47.71 spend.",
                    "location": "Putrajaya, MY",
                    "spend": 47.71,
                    "clicks": 40,
                    "conversions": 29,
                    "impact_data": {"confidence_pct": 70},
                    "automation": {"is_automatable": True},
                }
            ],
            campaigns=[{"platform": "Meta", "name": "Campaign A", "status": "ACTIVE"}],
        )

        self.assertEqual(len(recommendations), 1)
        self.assertEqual(recommendations[0]["guardrail_status"], "manual_only")
        self.assertFalse(recommendations[0]["automation_allowed"])
        self.assertIn("linked campaign or ad set", " ".join(recommendations[0]["guardrail_reasons"]))


if __name__ == "__main__":
    unittest.main()

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "execution"))

import analyze_week2_insights  # type: ignore[import-not-found]
import analyze_facebook_insights  # type: ignore[import-not-found]


class BudgetPacingNormalizationTests(unittest.TestCase):
    def test_google_budget_pacing_exact_month_and_shared_budgets(self):
        # Campaign 1 and Campaign 2 share budget_id "100" (daily_budget = 50.0)
        # Campaign 3 has its own budget "200" (daily_budget = 30.0)
        # Total unique daily budget should be 50.0 + 30.0 = 80.0 (NOT 50 + 50 + 30 = 130)
        metrics_data = {
            "summary": {"total_cost": 2400.0},
            "date_range": {"start_date": "2026-02-01", "end_date": "2026-02-28"},
            "campaigns": [
                {
                    "name": "Campaign A (Shared)",
                    "status": "ENABLED",
                    "daily_budget": 50.0,
                    "budget_id": "100",
                    "cost": 1000.0,
                },
                {
                    "name": "Campaign B (Shared)",
                    "status": "ENABLED",
                    "daily_budget": 50.0,
                    "budget_id": "100",
                    "cost": 800.0,
                },
                {
                    "name": "Campaign C (Standalone)",
                    "status": "ENABLED",
                    "daily_budget": 30.0,
                    "budget_id": "200",
                    "cost": 600.0,
                },
            ],
        }

        result = analyze_week2_insights.analyze_budget_pacing(metrics_data)

        # In 2026, February has 28 days (not leap year)
        self.assertEqual(result["days_in_month"], 28)
        self.assertEqual(result["days_in_period"], 28)
        self.assertAlmostEqual(result["daily_avg_spend"], 2400.0 / 28, places=2)
        self.assertAlmostEqual(result["projected_monthly_spend"], 2400.0, places=2)

        # Shared budgets should be deduplicated: 50.0 + 30.0 = 80.0
        self.assertEqual(result["account_daily_budget"], 80.0)
        self.assertEqual(result["planned_monthly_budget"], 80.0 * 28)  # 2240.0
        self.assertEqual(result["shared_budgets_count"], 2)

    def test_meta_budget_pacing_cbo_and_abo(self):
        # Campaign 1: CBO with daily_budget = 60.0
        # Campaign 2: ABO with campaign daily_budget = 0, but 2 active ad sets with budgets 25.0 and 15.0
        campaigns = [
            {
                "campaign_id": "c1",
                "campaign_name": "Meta CBO Campaign",
                "daily_budget": 60.0,
                "spend": 1200.0,
            },
            {
                "campaign_id": "c2",
                "campaign_name": "Meta ABO Campaign",
                "daily_budget": 0.0,
                "spend": 800.0,
            },
        ]

        ad_sets = [
            {
                "campaign_id": "c2",
                "adset_name": "Ad Set 1",
                "status": "ACTIVE",
                "daily_budget": 25.0,
            },
            {
                "campaign_id": "c2",
                "adset_name": "Ad Set 2",
                "status": "ACTIVE",
                "daily_budget": 15.0,
            },
        ]

        date_range = {"start_date": "2026-04-01", "end_date": "2026-04-30"}
        days_in_range = 30

        result = analyze_facebook_insights.analyze_budget_pacing(
            campaigns, days_in_range, ad_sets=ad_sets, date_range=date_range
        )

        # April has 30 days
        self.assertEqual(result["days_in_month"], 30)
        self.assertEqual(result["total_spend"], 2000.0)
        self.assertAlmostEqual(result["daily_avg_spend"], 2000.0 / 30, places=2)

        # Total account daily budget: 60 (CBO) + (25 + 15) (ABO) = 100.0
        self.assertEqual(result["account_daily_budget"], 100.0)
        self.assertEqual(result["planned_monthly_budget"], 100.0 * 30)  # 3000.0

        pacing_details = result["campaign_pacing"]
        self.assertEqual(len(pacing_details), 2)
        cbo_item = next(p for p in pacing_details if p["campaign_id"] == "c1")
        abo_item = next(p for p in pacing_details if p["campaign_id"] == "c2")

        self.assertEqual(cbo_item["budget_structure"], "CBO")
        self.assertEqual(cbo_item["budget"], 60.0)

        self.assertEqual(abo_item["budget_structure"], "ABO")
        self.assertEqual(abo_item["budget"], 40.0)  # 25 + 15


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""
Utility functions for Google Ads workflow.
"""

import json
import os
from datetime import datetime, timedelta
import re


def parse_timeline(timeline_str):
    """
    Parse a natural language timeline into start_date and end_date.

    Examples:
        "last 7 days" -> (7 days ago, today)
        "last 30 days" -> (30 days ago, today)
        "last week" -> (last Monday, last Sunday)
        "last month" -> (first day of last month, last day of last month)
        "Q1 2024" -> (2024-01-01, 2024-03-31)

    Returns:
        tuple: (start_date, end_date) as strings in YYYY-MM-DD format
    """
    timeline_str = timeline_str.lower().strip()
    today = datetime.now().date()

    # "last N days"
    match = re.search(r'last (\d+) days?', timeline_str)
    if match:
        days = int(match.group(1))
        start_date = today - timedelta(days=days)
        end_date = today - timedelta(days=1)  # Yesterday
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    # "last week"
    if 'last week' in timeline_str:
        # Find last Monday
        days_since_monday = (today.weekday() + 7) % 7
        last_monday = today - timedelta(days=days_since_monday + 7)
        last_sunday = last_monday + timedelta(days=6)
        return last_monday.strftime('%Y-%m-%d'), last_sunday.strftime('%Y-%m-%d')

    # "last month"
    if 'last month' in timeline_str:
        # First day of current month
        first_of_month = today.replace(day=1)
        # Last day of last month
        last_day_last_month = first_of_month - timedelta(days=1)
        # First day of last month
        first_day_last_month = last_day_last_month.replace(day=1)
        return first_day_last_month.strftime('%Y-%m-%d'), last_day_last_month.strftime('%Y-%m-%d')

    # "this month"
    if 'this month' in timeline_str:
        first_of_month = today.replace(day=1)
        return first_of_month.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')

    # "Q1 2024", "Q2 2024", etc.
    match = re.search(r'q([1-4])\s*(\d{4})', timeline_str)
    if match:
        quarter = int(match.group(1))
        year = int(match.group(2))

        quarter_starts = {
            1: f'{year}-01-01',
            2: f'{year}-04-01',
            3: f'{year}-07-01',
            4: f'{year}-10-01'
        }
        quarter_ends = {
            1: f'{year}-03-31',
            2: f'{year}-06-30',
            3: f'{year}-09-30',
            4: f'{year}-12-31'
        }

        return quarter_starts[quarter], quarter_ends[quarter]

    # "YTD" or "year to date"
    if 'ytd' in timeline_str or 'year to date' in timeline_str:
        start_of_year = today.replace(month=1, day=1)
        return start_of_year.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')

    # Specific date range: "2024-01-01 to 2024-01-31"
    match = re.search(r'(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})', timeline_str)
    if match:
        return match.group(1), match.group(2)

    # Default: last 30 days
    start_date = today - timedelta(days=30)
    end_date = today - timedelta(days=1)
    return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')


def lookup_customer_id(company_name):
    """
    Look up customer ID from company name using the client database.

    Uses the new client management system (.tmp/clients.json)

    Returns:
        str: Customer ID if found, None otherwise
    """
    clients_file = '.tmp/clients.json'

    if not os.path.exists(clients_file):
        return None

    try:
        with open(clients_file, 'r') as f:
            clients = json.load(f)

        # Try exact match first
        if company_name in clients:
            return clients[company_name]['customer_id']

        # Try case-insensitive match
        company_lower = company_name.lower()
        for name, data in clients.items():
            if name.lower() == company_lower:
                return data['customer_id']

        # Try partial match
        for name, data in clients.items():
            if company_lower in name.lower() or name.lower() in company_lower:
                print(f"Found partial match: '{name}'")
                return data['customer_id']

        return None

    except Exception as e:
        print(f"Error reading client database: {e}")
        return None


def save_customer_mapping(company_name, customer_id):
    """
    Save a company name to customer ID mapping for future lookups.

    Args:
        company_name (str): The company name
        customer_id (str): The Google Ads customer ID
    """
    mapping_file = '.tmp/customer_mapping.json'

    # Ensure .tmp directory exists
    os.makedirs('.tmp', exist_ok=True)

    # Load existing mapping or create new
    mapping = {}
    if os.path.exists(mapping_file):
        try:
            with open(mapping_file, 'r') as f:
                mapping = json.load(f)
        except Exception as e:
            print(f"Error reading existing mapping: {e}")

    # Add or update mapping
    mapping[company_name] = customer_id

    # Save
    try:
        with open(mapping_file, 'w') as f:
            json.dump(mapping, f, indent=2)
        print(f"Saved mapping: {company_name} -> {customer_id}")
    except Exception as e:
        print(f"Error saving mapping: {e}")


def format_currency(amount, currency='MYR'):
    """Format a number as currency."""
    if currency == 'USD':
        return f"${amount:,.2f}"
    elif currency == 'MYR':
        return f"RM {amount:,.2f}"
    elif currency == 'EUR':
        return f"€{amount:,.2f}"
    elif currency == 'GBP':
        return f"£{amount:,.2f}"
    else:
        return f"{amount:,.2f} {currency}"


def currency_symbol(currency='MYR'):
    """Return the currency prefix used inline in recommendation/insight text.

    A trailing space is included for alphabetic codes (RM, and the fallback
    "<CODE> " form) so that f"{currency_symbol(code)}{value:.2f}" reproduces the
    legacy f"RM {value:.2f}" byte-for-byte when the account currency is MYR.
    Symbol currencies (£, $, €) have no trailing space, matching normal usage.
    """
    if not currency:
        currency = 'MYR'
    symbols = {'USD': '$', 'MYR': 'RM ', 'EUR': '€', 'GBP': '£'}
    return symbols.get(str(currency).upper(), f"{str(currency).upper()} ")


# Per-client brand colors for report chrome (headers, titles, borders, buttons).
# Mirrors the dashboard palette in frontend/src/lib/client-config.ts so a client's PDF matches
# their dashboard. Keyed by the Modal client_name. Unknown clients keep the legacy blue so
# existing reports are unaffected.
BRAND_PRIMARY = {
    'YAP CHAN KOR': '#1E3F36',  # YCK forest green
    'GENERA': '#0E5C55',        # Genera teal
}
DEFAULT_BRAND_PRIMARY = '#1a73e8'


def brand_primary(client_name=None):
    """Return the client's brand primary hex, or the legacy blue if unknown."""
    if not client_name:
        return DEFAULT_BRAND_PRIMARY
    return BRAND_PRIMARY.get(str(client_name).strip().upper(), DEFAULT_BRAND_PRIMARY)


def hex_to_rgba(hex_color, alpha=1.0):
    """Convert '#RRGGBB' to a CSS rgba() string (for light background tints)."""
    h = str(hex_color).lstrip('#')
    if len(h) != 6:
        h = DEFAULT_BRAND_PRIMARY.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def format_percentage(value):
    """Format a decimal as percentage."""
    return f"{value:.2%}"


def format_number(value):
    """Format a number with thousands separator."""
    return f"{value:,}"


def calculate_roas(conversion_value, cost):
    """Calculate Return on Ad Spend."""
    if cost == 0:
        return 0
    return conversion_value / cost


def calculate_cpa(cost, conversions):
    """Calculate Cost Per Acquisition."""
    if conversions == 0:
        return 0
    return cost / conversions


def clean_customer_id(customer_id):
    """
    Clean customer ID by removing dashes and validating format.

    Args:
        customer_id (str): Customer ID with or without dashes

    Returns:
        str: Cleaned customer ID (10 digits, no dashes)

    Raises:
        ValueError: If customer ID is invalid
    """
    # Remove dashes
    cleaned = customer_id.replace('-', '')

    # Validate: should be 10 digits
    if not cleaned.isdigit() or len(cleaned) != 10:
        raise ValueError(f"Invalid customer ID: {customer_id}. Should be 10 digits.")

    return cleaned


if __name__ == "__main__":
    # Test timeline parsing
    print("Testing timeline parsing:")
    test_cases = [
        "last 7 days",
        "last 30 days",
        "last week",
        "last month",
        "Q1 2024",
        "YTD"
    ]

    for case in test_cases:
        start, end = parse_timeline(case)
        print(f"  {case:20} -> {start} to {end}")

    # Test customer ID cleaning
    print("\nTesting customer ID cleaning:")
    test_ids = ["123-456-7890", "1234567890", "123-456-789"]

    for test_id in test_ids:
        try:
            cleaned = clean_customer_id(test_id)
            print(f"  {test_id} -> {cleaned}")
        except ValueError as e:
            print(f"  {test_id} -> ERROR: {e}")

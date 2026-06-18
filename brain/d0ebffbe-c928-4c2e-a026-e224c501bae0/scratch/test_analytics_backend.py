import requests
import json

url = "http://127.0.0.1:5001/api/analyze-data"

# Dummy data payload matching what our JS sends
payload = {
    "filename": "SaaS_Ad_Spend_Conversions_Q1.csv",
    "rowCount": 12,
    "columnCount": 4,
    "schema": {
        "Month": "String",
        "AdSpend_USD": "Numeric",
        "Conversions": "Numeric",
        "ConversionRate": "Numeric"
    },
    "stats": [
        {"name": "Month", "type": "String", "missing": 0, "missingPercentage": 0, "uniqueCount": 12, "topCategory": "Jan", "topCategoryFreq": 1},
        {"name": "AdSpend_USD", "type": "Numeric", "missing": 0, "missingPercentage": 0, "min": 2000, "max": 12000, "mean": 6500},
        {"name": "Conversions", "type": "Numeric", "missing": 0, "missingPercentage": 0, "min": 150, "max": 1100, "mean": 540},
        {"name": "ConversionRate", "type": "Numeric", "missing": 0, "missingPercentage": 0, "min": 4.2, "max": 9.5, "mean": 7.1}
    ],
    "sample": [
        {"Month": "Jan", "AdSpend_USD": 2000, "Conversions": 150, "ConversionRate": 7.5},
        {"Month": "Feb", "AdSpend_USD": 3000, "Conversions": 240, "ConversionRate": 8.0},
        {"Month": "Mar", "AdSpend_USD": 4500, "Conversions": 380, "ConversionRate": 8.4},
        {"Month": "Apr", "AdSpend_USD": 6000, "Conversions": 520, "ConversionRate": 8.6},
        {"Month": "May", "AdSpend_USD": 8000, "Conversions": 720, "ConversionRate": 9.0},
        {"Month": "Jun", "AdSpend_USD": 10000, "Conversions": 950, "ConversionRate": 9.5},
        {"Month": "Jul", "AdSpend_USD": 12000, "Conversions": 1100, "ConversionRate": 9.17},
        {"Month": "Aug", "AdSpend_USD": 11000, "Conversions": 900, "ConversionRate": 8.18},
        {"Month": "Sep", "AdSpend_USD": 8500, "Conversions": 610, "ConversionRate": 7.17},
        {"Month": "Oct", "AdSpend_USD": 6500, "Conversions": 430, "ConversionRate": 6.61},
        {"Month": "Nov", "AdSpend_USD": 4000, "Conversions": 250, "ConversionRate": 6.25},
        {"Month": "Dec", "AdSpend_USD": 2500, "Conversions": 160, "ConversionRate": 6.4}
    ]
}

try:
    print("Sending analytical dataset payload to /api/analyze-data...")
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    print("Status Code:", response.status_code)
    
    if response.status_code == 200:
        res_json = response.json()
        print("\nSUCCESS! Parsed AI Analytics Response Keys:")
        print(res_json.keys())
        print("\nSample KPIs generated:")
        print(json.dumps(res_json.get("kpi_metrics"), indent=2))
        print("\nSample Chart Generated:")
        print(json.dumps(res_json.get("charts")[0], indent=2))
        print("\nSample Insights:")
        print(json.dumps(res_json.get("insights")[0], indent=2))
    else:
        print("Error Response:", response.text)
except Exception as e:
    print("Error:", e)

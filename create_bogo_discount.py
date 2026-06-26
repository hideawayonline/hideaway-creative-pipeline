"""
Create a "Buy One Get One Free" (BOGO) discount code in Shopify.

Uses Shopify's native Buy X Get Y discount (`discountCodeBxgyCreate`):
customer buys 1 qualifying item, gets 1 item at 100% off (free). This is the
code your Klaviyo->Kudosity SMS blast points customers to.

Setup (.env):
  SHOPIFY_STORE=your-store.myshopify.com
  SHOPIFY_ADMIN_TOKEN=shpat_xxx          # Admin API access token
    (Shopify admin > Settings > Apps and sales channels > Develop apps >
     create an app > Admin API scopes: write_discounts, read_discounts)

Usage:
  python create_bogo_discount.py --code BOGOFREE --ends 2026-06-30
  # scope to a collection instead of the whole store:
  python create_bogo_discount.py --code BOGOFREE --collection-id 123456789 --ends 2026-06-30
  # once per customer, cap total redemptions:
  python create_bogo_discount.py --code BOGOFREE --usage-limit 10000 --ends 2026-06-30

  --dry-run prints the GraphQL variables without creating anything.
"""
import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

SHOPIFY_STORE = os.getenv("SHOPIFY_STORE")
SHOPIFY_ADMIN_TOKEN = os.getenv("SHOPIFY_ADMIN_TOKEN")
API_VERSION = os.getenv("SHOPIFY_API_VERSION", "2024-10")

MUTATION = """
mutation discountCodeBxgyCreate($bxgyDiscount: DiscountCodeBxgyInput!) {
  discountCodeBxgyCreate(bxgyDiscount: $bxgyDiscount) {
    codeDiscountNode {
      id
      codeDiscount {
        ... on DiscountCodeBxgy {
          title
          status
          startsAt
          endsAt
          codes(first: 1) { nodes { code } }
        }
      }
    }
    userErrors { field message code }
  }
}
"""


def build_variables(args) -> dict:
    # "items" target: whole store (all: true) or a specific collection.
    if args.collection_id:
        items = {"collections": {"add": [f"gid://shopify/Collection/{args.collection_id}"]}}
    else:
        items = {"all": True}

    discount = {
        "title": args.title or f"BOGO Free ({args.code})",
        "code": args.code,
        "startsAt": f"{args.starts}T00:00:00Z",
        "customerSelection": {"all": True},
        "customerBuys": {
            "value": {"quantity": str(args.buy_qty)},
            "items": items,
        },
        "customerGets": {
            "value": {
                "discountOnQuantity": {
                    "quantity": str(args.get_qty),
                    # 1.0 == 100% off == free
                    "effect": {"percentage": 1.0},
                }
            },
            "items": items,
        },
        "appliesOncePerCustomer": args.once_per_customer,
    }
    if args.ends:
        discount["endsAt"] = f"{args.ends}T23:59:59Z"
    if args.usage_limit:
        discount["usageLimit"] = args.usage_limit
    return {"bxgyDiscount": discount}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--code", default="BOGOFREE", help="Discount code customers type at checkout")
    parser.add_argument("--title", help="Internal title (default: 'BOGO Free (<code>)')")
    parser.add_argument("--starts", default="2026-06-26", help="Start date YYYY-MM-DD")
    parser.add_argument("--ends", help="End date YYYY-MM-DD (omit for no expiry)")
    parser.add_argument("--buy-qty", type=int, default=1, help="Qty customer must buy (default 1)")
    parser.add_argument("--get-qty", type=int, default=1, help="Qty customer gets free (default 1)")
    parser.add_argument("--collection-id", help="Limit BOGO to a Shopify collection ID (numeric)")
    parser.add_argument("--usage-limit", type=int, help="Max total redemptions (omit for unlimited)")
    parser.add_argument(
        "--once-per-customer",
        action="store_true",
        default=True,
        help="Limit to one use per customer (default on)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print variables, create nothing")
    args = parser.parse_args()

    variables = build_variables(args)

    if args.dry_run:
        print(json.dumps(variables, indent=2))
        print("\n(dry run — nothing created)")
        return

    if not SHOPIFY_STORE or not SHOPIFY_ADMIN_TOKEN:
        sys.exit(
            "ERROR: set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN in .env.\n"
            "Create an Admin API token with write_discounts scope:\n"
            "  Shopify admin > Settings > Apps and sales channels > Develop apps."
        )

    url = f"https://{SHOPIFY_STORE}/admin/api/{API_VERSION}/graphql.json"
    resp = requests.post(
        url,
        headers={
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json",
        },
        json={"query": MUTATION, "variables": variables},
        timeout=60,
    )
    resp.raise_for_status()
    payload = resp.json()

    if payload.get("errors"):
        sys.exit(f"GraphQL error: {json.dumps(payload['errors'], indent=2)}")

    result = payload["data"]["discountCodeBxgyCreate"]
    errors = result.get("userErrors") or []
    if errors:
        sys.exit(f"Could not create discount:\n{json.dumps(errors, indent=2)}")

    node = result["codeDiscountNode"]
    cd = node["codeDiscount"]
    code = cd["codes"]["nodes"][0]["code"]
    print("=== BOGO discount created ===")
    print(f"  Code      : {code}")
    print(f"  Title     : {cd['title']}")
    print(f"  Status    : {cd['status']}")
    print(f"  Starts    : {cd['startsAt']}")
    print(f"  Ends      : {cd['endsAt']}")
    print(f"  Shopify ID: {node['id']}")
    print(f"\nUse '{code}' in your SMS offer (buy {args.buy_qty}, get {args.get_qty} free).")


if __name__ == "__main__":
    main()

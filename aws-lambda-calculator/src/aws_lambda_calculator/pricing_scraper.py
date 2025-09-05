import json
import requests
from os import path as os_path
from screenshotter import scrape_memory_prices as get_memory_prices

URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/index.json"

###################################################################################################################


def get_aws_regions() -> dict[str, str]:
    """
    Fetch the list of AWS regions from the pricing API.
    Returns a dict mapping region codes to their names.
    """
    response = requests.get(URL)
    response.raise_for_status()

    data = response.json()
    regions = {
        p["attributes"].get("regionCode"): p["attributes"].get("location")
        for p in data["products"].values()
    }
    regions.pop("", None)
    return regions


def get_region_data(region_code: str) -> dict:
    """
    Fetch the GLOBAL AWSLambda pricing index and filter down
    to only the SKUs for a given regionCode (e.g. 'us-east-1').
    Returns {'products': {...}, 'terms': {...}} where terms is the OnDemand map.
    """
    resp = requests.get(URL)
    resp.raise_for_status()
    data = resp.json()

    # keep only this region's SKUs
    prods = {
        sku: prod
        for sku, prod in data["products"].items()
        if prod["attributes"].get("regionCode") == region_code
    }
    terms = data["terms"]["OnDemand"]

    return {"products": prods, "terms": terms}


def get_tier_and_overflow(region_data: dict, arch: str) -> tuple[dict, str]:
    """
    Build the Tier map { nextThreshold: price } and OverflowRate for x86 or arm64.
    """
    usg = "Lambda-GB-Second" + ("-ARM" if arch == "arm64" else "")
    dims = []
    for sku, prod in region_data["products"].items():
        # tier SKUs have the same usagetype but NO memorySize attr
        if prod["attributes"].get("usagetype").endswith(usg) and not prod[
            "attributes"
        ].get("memorySize"):
            for term in region_data["terms"].get(sku, {}).values():
                for dim in term["priceDimensions"].values():
                    if dim.get("beginRange") is not None:
                        dims.append(dim)

    # sort by threshold
    dims.sort(key=lambda d: int(d["beginRange"]))
    tier = {}
    for i in range(len(dims) - 1):
        next_thr = dims[i + 1]["beginRange"]
        tier[next_thr] = dims[i]["pricePerUnit"]["USD"]

    overflow = dims[-1]["pricePerUnit"]["USD"] if dims else None
    return tier, overflow


def build_region_dict(region_name: str, region_code: str) -> None:
    """
    Fetch and write the AWS Lambda pricing data for a specific region.
    """
    region_data = get_region_data(region_code)

    region_dict = {
        "Requests": None,
        "EphemeralStorage": None,
        "x86": {"Memory": {}, "Tier": {}},
        "arm64": {"Memory": {}, "Tier": {}},
    }

    # grab Requests + EphemeralStorage exactly as before
    for sku, prod in region_data["products"].items():
        usg = prod["attributes"].get("usagetype", "")
        for term in region_data["terms"].get(sku, {}).values():
            for dim in term["priceDimensions"].values():
                if "Request" in dim["unit"]:
                    region_dict["Requests"] = dim["pricePerUnit"]["USD"]
                if "Storage" in usg and dim["unit"] == "GB-Seconds":
                    region_dict["EphemeralStorage"] = dim["pricePerUnit"]["USD"]

    # Get scraped memory prices for this region
    # Special case: if region_name starts with "EU", replace with "Europe"
    scraped_prices = get_memory_prices(
        region_code,
        region_name
        if not region_name.startswith("EU")
        else region_name.replace("EU", "Europe"),
    )

    for arch in ("x86", "arm64"):
        region_dict[arch]["Memory"] = scraped_prices.get(arch, {})
        if not region_dict[arch]["Memory"]:
            raise RuntimeError(
                f"No memory pricing data scraped for {arch} architecture in {region_code}"
            )

    # Fill Tier/OverflowRate for each arch
    for arch in ("x86", "arm64"):
        tier_map, overflow_rate = get_tier_and_overflow(region_data, arch)
        if not tier_map:
            raise RuntimeError(
                f"No tier pricing data found for {arch} architecture in {region_code}"
            )
        if not overflow_rate:
            raise RuntimeError(
                f"No overflow rate found for {arch} architecture in {region_code}"
            )

        region_dict[arch]["Tier"] = tier_map
        region_dict[arch]["OverflowRate"] = overflow_rate

    write_region_data(region_name, region_code, region_dict)


def write_region_data(region_name: str, region_code: str, data: dict) -> None:
    """
    Write the region data to a JSON file.
    """
    jsons_dir = os_path.join(os_path.dirname(__file__), "jsons")
    with open(f"{jsons_dir}/{region_code}.json", "w") as f:
        json.dump(data, f, indent=2)
    print(
        f"✔ Written data for {region_name} to {jsons_dir}/{region_code}.json successfully."
    )


# Overall Flow:
# 1. Use the pricing api to get all regions and their codes
# 2. For each region:
#  2.1 Use the pricing api to get Requests + EphemeralStorage
#  2.2 Use screenshot-based scraping to get Memory pricing for x86 and arm64
#  2.3 Build the Tier map and OverflowRate from the pricing api
#  2.4 Write the JSON file for that region
#  2.5 Report success or failure
if __name__ == "__main__":
    # Get regions
    regions = get_aws_regions()

    for region_code, region_name in regions.items():
        print(f"Processing region: {region_name} ({region_code})")
        build_region_dict(region_name, region_code)

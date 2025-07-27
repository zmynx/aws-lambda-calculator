import json
import requests
from os import path as os_path

URL = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/index.json"


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


def get_memory_dict(arch: str) -> dict[str, str]:
    """
    Return the hard‑coded AWS Lambda memory pricing (USD per 1 ms)
    for the given architecture ('x86' or 'arm64') in us-east-1.
    """
    memory_prices = {
        "x86": {
            "128": "0.0000000021",
            "512": "0.0000000083",
            "1024": "0.0000000167",
            "1536": "0.0000000250",
            "2048": "0.0000000333",
            "3072": "0.0000000500",
            "4096": "0.0000000667",
            "5120": "0.0000000833",
            "6144": "0.0000001000",
            "7168": "0.0000001167",
            "8192": "0.0000001333",
            "9216": "0.0000001500",
            "10240": "0.0000001667",
        },
        "arm64": {
            "128": "0.0000000017",
            "512": "0.0000000067",
            "1024": "0.0000000133",
            "1536": "0.0000000200",
            "2048": "0.0000000267",
            "3072": "0.0000000400",
            "4096": "0.0000000533",
            "5120": "0.0000000667",
            "6144": "0.0000000800",
            "7168": "0.0000000933",
            "8192": "0.0000001067",
            "9216": "0.0000001200",
            "10240": "0.0000001333",
        },
    }
    return memory_prices.get(arch, {})


def get_tier_and_overflow(region_data: dict, arch: str) -> tuple[dict, str]:
    """
    Build the Tier map { nextThreshold: price } and OverflowRate for x86 or arm64.
    """
    usg = "Lambda-GB-Second" + ("-ARM" if arch == "arm64" else "")
    dims = []
    for sku, prod in region_data["products"].items():
        # tier SKUs have the same usagetype but NO memorySize attr
        if prod["attributes"].get("usagetype") == usg and not prod["attributes"].get(
            "memorySize"
        ):
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

    # now fill Memory and Tier/OverflowRate for each arch
    for arch in ("x86", "arm64"):
        region_dict[arch]["Memory"] = get_memory_dict(arch)
        tier_map, overflow_rate = get_tier_and_overflow(region_data, arch)
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


if __name__ == "__main__":
    # Get regions
    regions = get_aws_regions()

    for region_code, region_name in regions.items():
        print(f"Processing region: {region_name} ({region_code})")
        build_region_dict(region_name, region_code)

import sys

URL = "https://aws.amazon.com/lambda/pricing/"

MAX_RETRIES = 3


def _log(msg: str) -> None:
    """Print and flush immediately for CI visibility."""
    print(msg, flush=True)
    sys.stdout.flush()


def scrape_memory_prices(
    region_code: str, region_name: str, max_retries: int = MAX_RETRIES
) -> dict:
    _log(f"[DEBUG] Starting scrape for {region_code} - {region_name}")
    target = region_name + " " + region_code

    # Find architecture tabs
    tab_selectors = [
        "button:has-text('x86 Price')",
        "a:has-text('x86 Price')",
        ".tab:has-text('x86')",
        "[role='tab']:has-text('x86')",
    ]

    arm_tab_selectors = [
        "button:has-text('Arm Price')",
        "a:has-text('Arm Price')",
        ".tab:has-text('Arm')",
        "[role='tab']:has-text('Arm')",
    ]

    # Pattern to match memory sizes followed by prices (e.g., "128 $0.0000000021")
    patterns = [
        r"(\d{3,5})\s*\$([0-9.]+)",  # "128 $0.0000000021"
        r"(\d{3,5})\s+\$([0-9.]+)",  # "128    $0.0000000021"
        r"(\d{3,5})\s*MB\s*\$([0-9.]+)",  # "128MB $0.0000000021"
    ]

    last_error = None
    for attempt in range(1, max_retries + 1):
        _log(f"[DEBUG] Attempt {attempt}/{max_retries} for {region_code}")
        try:
            result = _do_scrape(
                region_code,
                region_name,
                target,
                patterns,
                tab_selectors,
                arm_tab_selectors,
            )
            if result["x86"] and result["arm64"]:
                _log(
                    f"[DEBUG] Success for {region_code}: x86={len(result['x86'])} prices, arm64={len(result['arm64'])} prices"
                )
                return result
            _log(
                f"[WARN] Attempt {attempt}: Empty results for {region_code} (x86={len(result['x86'])}, arm64={len(result['arm64'])})"
            )
            last_error = "Empty results"
        except Exception as e:
            _log(
                f"[ERROR] Attempt {attempt} failed for {region_code}: {type(e).__name__}: {e}"
            )
            last_error = str(e)

    # If we get here, all attempts failed or returned empty results
    raise RuntimeError(
        f"Failed to scrape memory prices for {region_code} after {max_retries} attempts. "
        f"Last error: {last_error}. "
        f"The region may not be available on the AWS pricing page."
    )


def _do_scrape(
    region_code: str,
    region_name: str,
    target: str,
    patterns: list,
    tab_selectors: list,
    arm_tab_selectors: list,
) -> dict:
    """Internal function to perform a single scrape attempt."""
    from playwright.sync_api import sync_playwright

    region_pricing = {"x86": {}, "arm64": {}}

    with sync_playwright() as playwright:
        _log(f"[DEBUG] Launching browser for {region_code}")
        # Use channel="chromium" to force full Chromium instead of headless shell
        # The headless shell has issues with JavaScript-heavy pages
        browser = playwright.chromium.launch(
            headless=True,
            channel="chromium",
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-audio-output",
                "--disable-blink-features=AutomationControlled",  # Hide automation
            ],
        )
        try:
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                java_script_enabled=True,
                locale="en-US",
            )
            page = context.new_page()
            page.set_default_timeout(30000)  # 30s timeout
            _log(f"[DEBUG] Navigating to {URL}")
            page.goto(URL, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            _log(f"[DEBUG] Page loaded for {region_code}")

            # Try to dismiss any modal/overlay that might be present
            _dismiss_overlays(page)

            # Find tabs
            _log("[DEBUG] Looking for x86 tab")
            x86_tab = _find_element(page, tab_selectors)
            _log("[DEBUG] Looking for ARM tab")
            arm_tab = _find_element(page, arm_tab_selectors)

            if not x86_tab:
                raise RuntimeError("Could not find x86 Price tab on the page")
            if not arm_tab:
                raise RuntimeError("Could not find ARM Price tab on the page")
            _log(f"[DEBUG] Found both tabs for {region_code}")

            # Scrape x86 prices
            region_pricing["x86"] = _scrape_arch_prices(
                page, x86_tab, "x86 Price", target, patterns
            )

            # Scrape ARM prices
            region_pricing["arm64"] = _scrape_arch_prices(
                page, arm_tab, "ARM Price", target, patterns
            )

            context.close()
        finally:
            browser.close()

    return region_pricing


def _dismiss_overlays(page) -> None:
    """Try to dismiss any modal/overlay that might be present."""
    close_selectors = [
        "[aria-label='Close']",
        "button[aria-label='Close']",
        ".modal-close",
        ".overlay-close",
        "[data-testid='close']",
        "button:has-text('×')",
        "button:has-text('Close')",
    ]
    for selector in close_selectors:
        try:
            close_btn = page.query_selector(selector)
            if close_btn and close_btn.is_visible():
                close_btn.click()
                page.wait_for_timeout(1000)
                break
        except Exception:
            pass


def _find_element(page, selectors: list):
    """Find an element using multiple possible selectors."""
    for selector in selectors:
        element = page.query_selector(selector)
        if element:
            return element
    return None


def _scrape_arch_prices(page, tab, label: str, target: str, patterns: list) -> dict:
    """Scrape prices for a specific architecture (x86 or ARM)."""
    import re

    prices = {}
    _log(f"[DEBUG] Scraping {label} prices for target: {target}")

    # Click the tab
    try:
        tab.click()
        _log(f"[DEBUG] Clicked {label} tab")
    except Exception as e:
        _log(f"[DEBUG] Regular click failed for {label}, trying force click: {e}")
        tab.click(force=True)

    # Wait for content to load
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(2000)

    # Find and click the region dropdown
    _log(f"[DEBUG] Looking for region dropdown in {label}")
    try:
        dropdown = page.get_by_label(label).get_by_role("button").first
        if dropdown:
            dropdown.click()
            _log("[DEBUG] Clicked dropdown button")
        else:
            # Fallback: look for any region dropdown button
            _log("[DEBUG] Dropdown not found, trying fallback")
            page.get_by_label(label).get_by_role(
                "button", name="US East (Ohio)"
            ).click()
    except Exception as e:
        _log(f"[WARN] Could not click dropdown for {label}: {e}")
        # Try alternative approach - click any visible dropdown
        try:
            page.get_by_label(label).locator("button").first.click()
            _log("[DEBUG] Used alternative dropdown click")
        except Exception as e2:
            raise RuntimeError(f"Could not open region dropdown for {label}: {e2}")

    page.wait_for_timeout(1000)

    # Try to select the target region
    _log(f"[DEBUG] Selecting region: {target}")
    try:
        option = page.get_by_role("option", name=target)
        count = option.count()
        if count == 0:
            _log(f"[ERROR] Region '{target}' not found in dropdown (count=0)")
            raise RuntimeError(
                f"Region '{target}' not available in the pricing dropdown"
            )
        _log(f"[DEBUG] Found {count} options matching '{target}'")
        option.click()
        _log(f"[DEBUG] Selected region: {target}")
    except Exception as e:
        raise RuntimeError(f"Could not select region '{target}': {e}")

    # Wait for price data to load
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(2000)

    # Extract prices from page text
    _log("[DEBUG] Extracting prices from page")
    page_text = page.inner_text("body")
    for pattern in patterns:
        matches = re.findall(pattern, page_text)
        for memory, price in matches:
            if (
                memory.isdigit()
                and 128 <= int(memory) <= 10240
                and price.startswith("0.00000")
            ):
                prices[memory] = price

    _log(f"[DEBUG] Extracted {len(prices)} prices for {label}")
    return prices

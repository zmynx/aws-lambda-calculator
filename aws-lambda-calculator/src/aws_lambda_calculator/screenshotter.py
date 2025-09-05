URL = "https://aws.amazon.com/lambda/pricing/"


def scrape_memory_prices(region_code: str, region_name: str) -> dict:
    import re
    from playwright.sync_api import sync_playwright

    print(f"[DEBUG] Starting scrape for {region_code} - {region_name}")
    target = region_name + " " + region_code
    # screenshots_dir = './screenshots/'

    region_pricing = {"x86": {}, "arm64": {}}

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

    with sync_playwright() as playwright:
        print(f"[DEBUG] Launching browser for {region_code}")
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-audio-output",  # Disable audio to prevent ALSA errors
                "--disable-web-security",  # May help with CORS issues
                "--disable-features=VizDisplayCompositor",  # Reduce GPU usage
                "--no-zygote",  # Disable zygote process
                "--disable-font-subpixel-positioning",  # Fix font issues in CI
                "--disable-lcd-text",  # Fix font rendering issues
            ],
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = context.new_page()
        page.set_default_timeout(
            15000
        )  # Shorter timeout to identify hanging operations
        page.goto(URL, wait_until="domcontentloaded")  # Use faster load strategy

        # Wait for page to fully load and dismiss any overlays
        page.wait_for_timeout(2000)

        # Try to dismiss any modal/overlay that might be present
        try:
            # Common overlay/modal close buttons
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
                close_btn = page.query_selector(selector)
                if close_btn and close_btn.is_visible():
                    close_btn.click()
                    page.wait_for_timeout(1000)
                    break
        except Exception:
            pass  # Ignore if no overlay to close

        # Find x86 tab
        x86_tab = None
        for selector in tab_selectors:
            x86_tab = page.query_selector(selector)
            if x86_tab:
                break

        # Find ARM tab
        arm_tab = None
        for selector in arm_tab_selectors:
            arm_tab = page.query_selector(selector)
            if arm_tab:
                break

        # for arch in ("x86", "arm64"):
        # Take a screenshot of the region x86 price section

        # Wait for tab to be clickable and force click if needed
        try:
            page.wait_for_selector(
                "button:has-text('x86 Price')", state="visible", timeout=10000
            )
            x86_tab.click()
        except Exception:
            # Try force click if regular click fails
            x86_tab.click(force=True)

        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # Additional wait for dynamic content
        page.get_by_label("x86 Price").get_by_role(
            "button", name="US East (Ohio)"
        ).click()
        page.get_by_role("option", name=target).click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # Wait for price data to load
        # path = screenshots_dir + region_code + '_x86.png'
        # page.screenshot(path=path, full_page=True)
        page_text = page.inner_text("body")

        for pattern in patterns:
            matches = re.findall(pattern, page_text)
            for memory, price in matches:
                if (
                    memory.isdigit()
                    and 128 <= int(memory) <= 10240
                    and price.startswith("0.00000")
                ):
                    region_pricing["x86"][memory] = price

        # Select the ARM tab
        try:
            page.wait_for_selector(
                "button:has-text('Arm Price')", state="visible", timeout=10000
            )
            arm_tab.click()
        except Exception:
            # Try force click if regular click fails
            arm_tab.click(force=True)

        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # Additional wait for dynamic content
        page.get_by_label("ARM Price").get_by_role(
            "button", name="US East (Ohio)"
        ).click()
        page.get_by_role("option", name=target).click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # Wait for price data to load
        # path = screenshots_dir + region_code + '_arm.png'
        # page.screenshot(path=path, full_page=True)
        page_text = page.inner_text("body")
        for pattern in patterns:
            matches = re.findall(pattern, page_text)
            for memory, price in matches:
                if (
                    memory.isdigit()
                    and 128 <= int(memory) <= 10240
                    and price.startswith("0.00000")
                ):
                    region_pricing["arm64"][memory] = price

        # ---------------------
        context.close()
        browser.close()

    return region_pricing

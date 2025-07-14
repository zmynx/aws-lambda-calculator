import re
from playwright.sync_api import Playwright, sync_playwright, expect
from time import sleep


# url = "https://calculator.aws/#/createCalculator/Lambda"
url = "https://aws.amazon.com/lambda/pricing/"

def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False, slow_mo=200)
    context = browser.new_context()

    # Open a new page
    with context.new_page() as page:
        # Navigate to the URL
        page.goto(url)


        # Locate the table under the "Monthly cost breakdown"
        # We're going to assume it's the only or first visible table with those headers
        table = page.locator("table").first

        # Get all header rows in the thead
        header_rows = table.locator("thead tr")
        headers = []

        for i in range(header_rows.count()):
            row = header_rows.nth(i)
            cells = row.locator("th")
            headers.extend([cell.text_content().strip() for cell in cells.all()])

        # Clean headers if there are duplicates or empty cells
        headers = [h for h in headers if h]

        # Now get the body rows
        body_rows = table.locator("tbody tr")
        data = []

        for i in range(body_rows.count()):
            row = body_rows.nth(i)
            cells = row.locator("td")
            values = [cell.text_content().strip() for cell in cells.all()]
            row_dict = dict(zip(headers, values))
            data.append(row_dict)

        # Print extracted data
        for entry in data:
            print(entry)
        sleep(15)
        # # Fill out the form
        # page.get_by_label("Description - optional").fill("Example")
        #
        # page.get_by_role("button", name="Choose a location type").filter(
        #     has_text=re.compile(r"region", re.IGNORECASE)
        # )
        #
        # page.get_by_role("button", name="Choose a Region").filter(
        #     has_text=re.compile(r"us east \(ohio\)", re.IGNORECASE)
        # ).click()
        # page.get_by_role("listbox").select_option(3)
        #
        #
        # # page.get_by_role("button", name="Choose a Region").press("Tab")
        #
        # page.get_by_role(
        #     "radio",
        #     name=re.compile("lambda function - without free tier", re.IGNORECASE),
        # ).check()
        #
        # # Service settings
        # # fill_form(page, "Number of requests", "1000000")
        # page.get_by_role("button", name="Architecture x86").filter(
        #     has_text=re.compile(r"x86", re.IGNORECASE)
        # ).first.click()
        # # page.get_by_role("button", name="Architecture x86").first.press("Tab")
        # sleep(5)
        #
        # fill_form(page, "Duration of each request (in ms)", "1000")
        # fill_form(page, "Value", "512")
        #
        # # Provisioned Concurrency
        # fill_form(page, "Concurrency", "1")
        # fill_form(page, "Value", "1")
        # fill_form(page, "Value", "2")
        # fill_form(page, "Duration of each provisioned request (in ms)", "1000")
        # fill_form(page, "Value", "512")
        # sleep(10)  # Wait for the form to be ready
    # page.get_by_role("textbox", name="Description - optional").click()
    # page.get_by_role("textbox", name="Description - optional").fill("Example")
    # page.get_by_role("button", name="Choose a location typeInfo").click()
    # page.get_by_title("Region").locator("span").nth(1).click()
    # page.get_by_role("button", name="Choose a Region US East (Ohio)").click()
    # page.get_by_text("Europe (Frankfurt)").click()
    # # page.locator("span").filter(has_text="eu-central-1").nth(3).click()
    # # page.get_by_role("radio", name="Lambda Function - Without").check()
    # # page.get_by_role("radio", name="Lambda Function - Include").check()
    # # page.locator("#formField363-1750069063905-9301").click()
    # page.get_by_role("button", name="Architecture x86").click()
    # page.get_by_text("Arm").click()
    # page.get_by_role("option", name="Arm").locator("span").nth(2).click()
    # page.locator("#formField186-1750069063825-7362").click()
    # page.locator("#formField186-1750069063825-7362").fill("1000")
    # page.locator("#formField187-1750069063826-3497").click()
    # page.get_by_role("option", name="per hour").locator("span").nth(2).click()
    # page.locator("#formField196-1750069063828-454").click()
    # page.locator("#formField196-1750069063828-454").fill("15000")
    # page.locator("#formField198-1750069063828-5038").click()
    # page.locator("#formField198-1750069063828-5038").fill("2")
    # page.locator("#formField199-1750069063829-8138").click()
    # page.get_by_role("option", name="GB").locator("span").nth(2).click()
    # page.get_by_role("spinbutton", name="Amount of ephemeral storage").click()
    # page.get_by_role("spinbutton", name="Amount of ephemeral storage").fill("5120")
    # page.get_by_role("button", name="Amount of ephemeral storage").click()
    # page.get_by_title("MB").locator("span").nth(1).click()
    # page.get_by_role("button", name="Architecture x86").click()
    # page.get_by_title("x86").locator("span").nth(1).click()
    # page.get_by_role("textbox", name="Concurrency Enter amount").click()
    # page.get_by_role("textbox", name="Concurrency Enter amount").fill("5")
    # page.get_by_role("spinbutton", name="Time for which Provisioned").click()
    # page.get_by_role("spinbutton", name="Time for which Provisioned").fill("1")
    # page.get_by_role("button", name="Time for which Provisioned").click()
    # page.get_by_role("option", name="hours").locator("span").nth(2).click()
    # page.get_by_role("spinbutton", name="Number of requests for").click()
    # page.get_by_role("spinbutton", name="Number of requests for").fill("4")
    # page.get_by_role("button", name="Number of requests for").click()
    # page.get_by_role("option", name="per day").locator("span").nth(2).click()
    # page.get_by_role("textbox", name="Duration of each provisioned").click()
    # page.get_by_role("textbox", name="Duration of each provisioned").fill("100")
    # page.locator("#formField233-1750069063837-1849").click()
    # page.locator("#formField233-1750069063837-1849").fill("2")
    # page.locator("#formField234-1750069063837-7451").click()
    # page.get_by_role("option", name="GB").locator("span").nth(2).click()
    # page.locator("#formField249-1750069063839-8999").click()
    # page.locator("#formField249-1750069063839-8999").fill("100")
    # page.locator("#formField249-1750069063839-8999").press("Tab")
    # page.get_by_role("button", name="Unit Number of requests per month").click()
    # page.get_by_role("option", name="per day").locator("span").nth(2).click()
    # page.locator("#formField259-1750069063841-987").click()
    # page.locator("#formField259-1750069063841-987").fill("200")
    # page.locator("#formField261-1750069063842-5019").click()
    # page.locator("#formField261-1750069063842-5019").fill("7")
    # page.get_by_role("button", name="Amount of memory allocated Unit MB").click()
    # page.get_by_role("option", name="GB").locator("span").nth(2).click()

    # ---------------------
    browser.close()


with sync_playwright() as playwright:
    run(playwright)

import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:8080/boletins")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Select 2026 in the Ano filter and inspect the updated month filter.
        # Todos os anos 2026 2025 2024 2023 2022 2021 2020... dropdown
        elem = page.locator("xpath=/html/body/main/section[2]/form/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Inspect the month filter options so Outubro can be selected for 2026.
        # [internal] get_dropdown_options: index=
        
        # -> Select “Outubro” in the Mês filter and verify the filtered bulletin list and page address.
        # Todos os meses Janeiro Fevereiro Março Abril Maio... dropdown
        elem = page.locator("xpath=/html/body/main/section[2]/form/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the first October 2026 bulletin using its “Ler boletim” link and verify that its PDF opens for reading in a new tab.
        # Ler boletim (abre em nova aba) link
        elem = page.get_by_role("link", name="Ler boletim (abre em nova aba)").first
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A bulletin from the filtered 2026 results opened as a PDF for reading.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The opened bulletin should be a PDF from 2026.
        await expect(page).to_have_url(re.compile("/uploads/boletins/2026/"), timeout=15000), "The opened bulletin should be a PDF from 2026."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
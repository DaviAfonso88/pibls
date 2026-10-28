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
        await page.goto("http://localhost:8080")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the specified unknown URL and inspect the not-found page and its visible shortcuts.
        await page.goto("http://localhost:8080/does-not-exist")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the “Início” shortcut on the not-found page and verify that the homepage appears.
        # Início link
        elem = page.get_by_label("Atalhos").get_by_role("link", name="Início")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The homepage is displayed with the welcome heading “Seja bem-vindo. Aqui as pessoas importam.”
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The homepage welcome heading is displayed.
        await expect(page.locator("#boas-vindas").nth(0)).to_have_text("Seja bem-vindo. Aqui as pessoas importam.", timeout=15000), "The homepage welcome heading is displayed."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
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
        await page.goto("http://localhost:8080/admin/entrar")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Enter the provided staff email and password, then submit the sign-in form.
        # email email field
        elem = page.get_by_role("textbox", name="E-mail")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("lider@pibls.test")
        
        # -> Enter the provided staff email and password, then submit the sign-in form.
        # password password field
        elem = page.get_by_role("textbox", name="Senha")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("senha-local-123")
        
        # -> Enter the provided staff email and password, then submit the sign-in form.
        # Entrar button
        elem = page.get_by_role("button", name="Entrar")
        await elem.click(timeout=10000)
        
        # -> Open the staff panel’s “Eventos” section to find the event registrations.
        # Eventos link
        elem = page.get_by_role("link", name="Eventos")
        await elem.click(timeout=10000)
        
        # -> Open the “Inscritos” page for “TS Retiro de inscritos” and verify the registration count and search field.
        # Inscritos link
        elem = page.get_by_role("link", name="Ver os inscritos de TS Retiro")
        await elem.click(timeout=10000)
        
        # -> Enter “carla” in the Buscar field to filter the registrations table.
        # Nome ou telefone search field
        elem = page.get_by_role("searchbox", name="Buscar")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("carla")
        
        # --> Assertions to verify final state
        
        # --> Searching for “carla” narrows the table to one registration.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The filtered table shows one registration.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/section/div[3]/div/div/table/tbody/tr")).to_have_count(1, timeout=15000), "The filtered table shows one registration."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
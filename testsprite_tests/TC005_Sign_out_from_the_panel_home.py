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
        
        # -> Enter the provided staff account credentials and submit the sign-in form.
        # email email field
        elem = page.get_by_role("textbox", name="E-mail")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comunicacao@pibls.test")
        
        # -> Enter the provided staff account credentials and submit the sign-in form.
        # password password field
        elem = page.get_by_role("textbox", name="Senha")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Ts-sGU2ctGavt7V8ur1")
        
        # -> Enter the provided staff account credentials and submit the sign-in form.
        # Entrar button
        elem = page.get_by_role("button", name="Entrar")
        await elem.click(timeout=10000)
        
        # -> Click the “Sair” control in the staff panel to end the session.
        # Sair button
        elem = page.get_by_role("button", name="Sair")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The sign-in page is displayed at /admin/entrar.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The sign-in page URL is displayed.
        await expect(page).to_have_url(re.compile("/admin/entrar"), timeout=15000), "The sign-in page URL is displayed."
        
        # --> The signed-in session has ended, and the sign-in password field is visible.
        await page.get_by_role("textbox", name="Senha").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The sign-in password field is visible after signing out.
        await expect(page.get_by_role("textbox", name="Senha").nth(0)).to_be_visible(timeout=15000), "The sign-in password field is visible after signing out."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
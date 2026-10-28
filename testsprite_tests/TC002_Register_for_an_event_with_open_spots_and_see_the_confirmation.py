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
        await page.goto("http://localhost:8080/eventos")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the “TS Retiro de casais” event and verify its title and remaining-spots text.
        # Ver evento : TS Retiro de casais link
        elem = page.get_by_role("link", name="Ver evento : TS Retiro de")
        await elem.click(timeout=10000)
        
        # -> Enter the requested name, WhatsApp number, and church, then choose shirt size M and agree to the consent statement.
        # participant_name text field
        elem = page.get_by_role("textbox", name="Nome completo")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Maria Souza Teste")
        
        # -> Enter the requested name, WhatsApp number, and church, then choose shirt size M and agree to the consent statement.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="WhatsApp")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 98877-6655")
        
        # -> Enter the requested name, WhatsApp number, and church, then choose shirt size M and agree to the consent statement.
        # answers.igreja text field
        elem = page.get_by_role("textbox", name="Igreja onde congrega")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("PIBLS")
        
        # -> Enter the requested name, WhatsApp number, and church, then choose shirt size M and agree to the consent statement.
        # answers.camiseta radio button
        elem = page.get_by_role("radio", name="M")
        await elem.click(timeout=10000)
        
        # -> Enter the requested name, WhatsApp number, and church, then choose shirt size M and agree to the consent statement.
        # checkbox
        elem = page.get_by_role("checkbox", name="Li e concordo com a Política")
        await elem.click(timeout=10000)
        
        # -> Submit the registration using “Confirmar inscrição” and verify that “Inscrição confirmada!” and “Maria Souza Teste” appear.
        # Confirmar inscrição button
        elem = page.get_by_role("button", name="Confirmar inscrição")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The TS Retiro de casais event details show a remaining-spots count.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The event details show TS Retiro de casais.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("TS Retiro de casais", timeout=15000), "The event details show TS Retiro de casais."
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The event details show the remaining-spots status.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("vagas restantes", timeout=15000), "The event details show the remaining-spots status."
        
        # --> The registration confirmation heading is displayed.
        await page.get_by_role("heading", name="Inscrição confirmada!").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The registration confirmation heading is visible.
        await expect(page.get_by_role("heading", name="Inscrição confirmada!").nth(0)).to_be_visible(timeout=15000), "The registration confirmation heading is visible."
        
        # --> The confirmation lists Maria Souza Teste as the participant.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The confirmation lists Maria Souza Teste as the participant.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("Maria Souza Teste", timeout=15000), "The confirmation lists Maria Souza Teste as the participant."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
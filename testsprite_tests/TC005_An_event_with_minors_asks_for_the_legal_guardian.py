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
        
        # -> Open the “TS Acampamento de jovens” event from its event card.
        # Ver evento : TS Acampamento de jovens link
        elem = page.get_by_role("link", name="Ver evento : TS Acampamento")
        await elem.click(timeout=10000)
        
        # -> Enter the participant details, accept the general consent, and submit without guardian information to check for guardian-field errors.
        # participant_name text field
        elem = page.get_by_role("textbox", name="Nome completo")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Lucas Lima Teste")
        
        # -> Enter the participant details, accept the general consent, and submit without guardian information to check for guardian-field errors.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="WhatsApp")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 95544-3322")
        
        # -> Enter the participant details, accept the general consent, and submit without guardian information to check for guardian-field errors.
        # checkbox
        elem = page.get_by_role("checkbox", name="Li e concordo com a Política")
        await elem.click(timeout=10000)
        
        # -> Enter the participant details, accept the general consent, and submit without guardian information to check for guardian-field errors.
        # Confirmar inscrição button
        elem = page.get_by_role("button", name="Confirmar inscrição")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The legal guardian section heading is visible.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The legal guardian section heading is visible.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("Respons\u00e1vel legal (participante menor de 18 anos)", timeout=15000), "The legal guardian section heading is visible."
        
        # --> The guardian name and phone fields are visible.
        await page.get_by_role("textbox", name="Nome do responsável").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The guardian name field is visible.
        await expect(page.get_by_role("textbox", name="Nome do responsável").nth(0)).to_be_visible(timeout=15000), "The guardian name field is visible."
        await page.get_by_role("textbox", name="Telefone do responsável").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The guardian phone field is visible.
        await expect(page.get_by_role("textbox", name="Telefone do responsável").nth(0)).to_be_visible(timeout=15000), "The guardian phone field is visible."
        
        # --> Submitting without guardian information shows the required-data validation message.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The guardian-required validation message is shown.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("Informe os dados do respons\u00e1vel legal e marque a autoriza\u00e7\u00e3o.", timeout=15000), "The guardian-required validation message is shown."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
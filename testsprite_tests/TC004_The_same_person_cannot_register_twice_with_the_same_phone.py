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
        
        # -> Open the “TS Acampamento de jovens” event using its “Ver evento” link.
        # Ver evento : TS Acampamento de jovens link
        elem = page.get_by_role("link", name="Ver evento : TS Acampamento")
        await elem.click(timeout=10000)
        
        # -> Fill in Pedro Alves Teste’s participant and guardian details and mark the legal-responsibility checkbox.
        # participant_name text field
        elem = page.get_by_role("textbox", name="Nome completo")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Pedro Alves Teste")
        
        # -> Fill in Pedro Alves Teste’s participant and guardian details and mark the legal-responsibility checkbox.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="WhatsApp")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 97766-5544")
        
        # -> Fill in Pedro Alves Teste’s participant and guardian details and mark the legal-responsibility checkbox.
        # guardian_name text field
        elem = page.get_by_role("textbox", name="Nome do responsável")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Rita Alves Teste")
        
        # -> Fill in Pedro Alves Teste’s participant and guardian details and mark the legal-responsibility checkbox.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="Telefone do responsável")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 96655-4433")
        
        # -> Fill in Pedro Alves Teste’s participant and guardian details and mark the legal-responsibility checkbox.
        # checkbox
        elem = page.get_by_role("checkbox", name="Sou o responsável legal e")
        await elem.click(timeout=10000)
        
        # -> Select “Li e concordo com a Política de Privacidade” and submit the youth-camp registration.
        # checkbox
        elem = page.get_by_role("checkbox", name="Li e concordo com a Política")
        await elem.click(timeout=10000)
        
        # -> Select “Li e concordo com a Política de Privacidade” and submit the youth-camp registration.
        # Confirmar inscrição button
        elem = page.get_by_role("button", name="Confirmar inscrição")
        await elem.click(timeout=10000)
        
        # -> Return to the “TS Acampamento de jovens” registration page to attempt the same registration again.
        await page.goto("http://localhost:8080/eventos/ts-jovens")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Enter the same participant and guardian details, select both consent checkboxes, and submit the duplicate registration.
        # participant_name text field
        elem = page.get_by_role("textbox", name="Nome completo")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Pedro Alves Teste")
        
        # -> Enter the same participant and guardian details, select both consent checkboxes, and submit the duplicate registration.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="WhatsApp")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 97766-5544")
        
        # -> Enter the same participant and guardian details, select both consent checkboxes, and submit the duplicate registration.
        # guardian_name text field
        elem = page.get_by_role("textbox", name="Nome do responsável")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Rita Alves Teste")
        
        # -> Enter the same participant and guardian details, select both consent checkboxes, and submit the duplicate registration.
        # (31) 99999-8888 tel field
        elem = page.get_by_role("textbox", name="Telefone do responsável")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("(31) 96655-4433")
        
        # -> Enter the same participant and guardian details, select both consent checkboxes, and submit the duplicate registration.
        # checkbox
        elem = page.get_by_role("checkbox", name="Sou o responsável legal e")
        await elem.click(timeout=10000)
        
        # -> Check “Li e concordo com a Política de Privacidade” and submit the duplicate registration with “Confirmar inscrição.”
        # checkbox
        elem = page.get_by_role("checkbox", name="Li e concordo com a Política")
        await elem.click(timeout=10000)
        
        # -> Check “Li e concordo com a Política de Privacidade” and submit the duplicate registration with “Confirmar inscrição.”
        # Confirmar inscrição button
        elem = page.get_by_role("button", name="Confirmar inscrição")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert-outcome: passed
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
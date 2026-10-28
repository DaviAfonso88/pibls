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
        
        # -> Sign in with the provided staff email and password using the visible login form.
        # email email field
        elem = page.get_by_role("textbox", name="E-mail")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("lider@pibls.test")
        
        # -> Sign in with the provided staff email and password using the visible login form.
        # password password field
        elem = page.get_by_role("textbox", name="Senha")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("senha-local-123")
        
        # -> Sign in with the provided staff email and password using the visible login form.
        # Entrar button
        elem = page.get_by_role("button", name="Entrar")
        await elem.click(timeout=10000)
        
        # -> Open the event list using the visible “Eventos” navigation link.
        # Eventos link
        elem = page.get_by_role("link", name="Eventos")
        await elem.click(timeout=10000)
        
        # -> Open the “Inscritos” page for “TS Retiro de inscritos.”
        # Inscritos link
        elem = page.get_by_role("link", name="Ver os inscritos de TS Retiro")
        await elem.click(timeout=10000)
        
        # -> Click “Exportar CSV” and verify that the page confirms “CSV baixado.”
        # Download: Exportar CSV button
        elem = page.get_by_role("button", name="Exportar CSV")
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # -> Click “Exportar PDF” and verify that its download confirmation appears after generation completes.
        # Download: Exportar PDF button
        elem = page.get_by_role("button", name="Exportar PDF")
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # --> Assertions to verify final state
        
        # --> The personal-data notice is visible on the registrations page.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The personal-data notice should be visible.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("O arquivo exportado tem dados pessoais.", timeout=15000), "The personal-data notice should be visible."
        
        # --> The PDF export displays its download confirmation.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The PDF download confirmation should appear.
        await expect(page.locator("xpath=/html/body/section/ol/li").nth(0)).to_have_text("PDF baixado.", timeout=15000), "The PDF download confirmation should appear."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
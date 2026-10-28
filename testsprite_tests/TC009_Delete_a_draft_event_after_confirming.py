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
        
        # -> Enter the provided admin email and password, then submit the sign-in form.
        # email email field
        elem = page.get_by_role("textbox", name="E-mail")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comunicacao@pibls.test")
        
        # -> Enter the provided admin email and password, then submit the sign-in form.
        # password password field
        elem = page.get_by_role("textbox", name="Senha")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("senha-local-123")
        
        # -> Enter the provided admin email and password, then submit the sign-in form.
        # Entrar button
        elem = page.get_by_role("button", name="Entrar")
        await elem.click(timeout=10000)
        
        # -> Open the event creation form using the dashboard’s “Novo evento” link.
        # Novo evento link
        elem = page.get_by_role("link", name="Novo evento")
        await elem.click(timeout=10000)
        
        # -> Choose “Música” as the responsible ministry for the disposable event.
        # Escolha… Comunicação Oração Apoio à Tesouraria... dropdown
        elem = page.locator("xpath=/html/body/div[2]/main/div/form/div/section/div/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill the event name, start date and time, location, and short description for the disposable test event.
        # title text field
        elem = page.get_by_role("textbox", name="Nome")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TS Excluir 01")
        
        # -> Fill the event name, start date and time, location, and short description for the disposable test event.
        # starts_at datetime-local field
        elem = page.get_by_role("textbox", name="Começa")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2099-12-05T09:00")
        
        # -> Fill the event name, start date and time, location, and short description for the disposable test event.
        # Templo da PIBLS… text field
        elem = page.get_by_role("textbox", name="Local")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Sal\u00e3o")
        
        # -> Fill the event name, start date and time, location, and short description for the disposable test event.
        # Fill the event name, start date and time, location, and short description for the disposable test event.
        elem = page.get_by_role("textbox", name="Descrição")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Evento tempor\u00e1rio para verificar exclus\u00e3o definitiva.")
        
        # -> Save the disposable event as a draft and verify that its edit page opens.
        # Salvar rascunho button
        elem = page.get_by_role("button", name="Salvar rascunho")
        await elem.click(timeout=10000)
        
        # -> Scroll down the “TS Excluir 01” edit page to find the event deletion control.
        await page.mouse.wheel(0, 300)
        
        # -> Click “Excluir evento” for “TS Excluir 01” and verify that the definitive-deletion confirmation appears.
        # Excluir evento button
        elem = page.get_by_role("button", name="Excluir evento")
        await elem.click(timeout=10000)
        
        # -> Confirm deletion of “TS Excluir 01” in the dialog and verify the events list no longer shows it.
        # Excluir evento button
        elem = page.get_by_role("button", name="Excluir evento")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The events list is displayed at /admin/eventos.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The page is at the events route.
        await expect(page).to_have_url(re.compile("/admin/eventos"), timeout=15000), "The page is at the events route."
        await page.get_by_role("heading", name="Eventos").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The events list heading is visible.
        await expect(page.get_by_role("heading", name="Eventos").nth(0)).to_be_visible(timeout=15000), "The events list heading is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
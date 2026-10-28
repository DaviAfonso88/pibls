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
        
        # -> Sign in with the provided account using the visible E-mail and Senha fields, then check the resulting page.
        # email email field
        elem = page.get_by_role("textbox", name="E-mail")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("comunicacao@pibls.test")
        
        # -> Sign in with the provided account using the visible E-mail and Senha fields, then check the resulting page.
        # password password field
        elem = page.get_by_role("textbox", name="Senha")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("senha-local-123")
        
        # -> Sign in with the provided account using the visible E-mail and Senha fields, then check the resulting page.
        # Entrar button
        elem = page.get_by_role("button", name="Entrar")
        await elem.click(timeout=10000)
        
        # -> Open the event creation form using the “Novo evento” shortcut.
        # Novo evento link
        elem = page.get_by_role("link", name="Novo evento")
        await elem.click(timeout=10000)
        
        # -> Enter the event name and inspect the available options for “Ministério responsável.”
        # title text field
        elem = page.get_by_role("textbox", name="Nome")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TS Formulario 01")
        
        # -> Enter the event name and inspect the available options for “Ministério responsável.”
        # [internal] get_dropdown_options: index=
        
        # -> Set “Ministério responsável” to “Música” on the new-event form.
        # Escolha… Comunicação Oração Apoio à Tesouraria... dropdown
        elem = page.locator("xpath=/html/body/div[2]/main/div/form/div/section/div/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Fill the event start time, location, and a short description in the new-event form.
        # starts_at datetime-local field
        elem = page.get_by_role("textbox", name="Começa")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2099-12-05T09:00")
        
        # -> Fill the event start time, location, and a short description in the new-event form.
        # Templo da PIBLS… text field
        elem = page.get_by_role("textbox", name="Local")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Sal\u00e3o")
        
        # -> Fill the event start time, location, and a short description in the new-event form.
        # Fill the event start time, location, and a short description in the new-event form.
        elem = page.get_by_role("textbox", name="Descrição")
        await elem.click(timeout=10000)
        
        # -> Fill the event start time, location, and a short description in the new-event form.
        # Fill the event start time, location, and a short description in the new-event form.
        elem = page.get_by_role("textbox", name="Descrição")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Descri\u00e7\u00e3o breve do evento")
        
        # -> Fill the event start time, location, and a short description in the new-event form.
        await page.mouse.wheel(0, 300)
        
        # -> Open the first question editor using “Adicionar pergunta” and inspect its fields.
        # Adicionar pergunta button
        elem = page.get_by_role("button", name="Adicionar pergunta")
        await elem.click(timeout=10000)
        
        # -> Enter “Tamanho da camiseta” as the first question and inspect the available response types.
        # text field
        elem = page.get_by_role("textbox", name="Pergunta")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Tamanho da camiseta")
        
        # -> Enter “Tamanho da camiseta” as the first question and inspect the available response types.
        # [internal] get_dropdown_options: index=
        
        # -> Set the first question’s response type to “Escolha uma opção” and inspect the fields that appear.
        # Texto curto Texto longo Número Data Escolha uma... dropdown
        elem = page.locator("xpath=/html/body/div[2]/main/div/form/section/div/ol/li/fieldset/div/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Enter P, M, and G as separate choices and mark “Obrigatória” for “Tamanho da camiseta.”
        # text area
        elem = page.get_by_role("textbox", name="Opções (uma por linha)")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("P\nM\nG")
        
        # -> Enter P, M, and G as separate choices and mark “Obrigatória” for “Tamanho da camiseta.”
        # checkbox
        elem = page.get_by_role("checkbox", name="Obrigatória")
        await elem.click(timeout=10000)
        
        # -> Add a second question to the form and inspect its new question field.
        # Adicionar pergunta button
        elem = page.get_by_role("button", name="Adicionar pergunta")
        await elem.click(timeout=10000)
        
        # -> Enter “Cidade” in the second question’s “Pergunta” field, keeping its default “Texto curto” response type.
        # text field
        elem = page.get_by_role("group", name="Pergunta 2 de").get_by_label("Pergunta", exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Cidade")
        
        # -> Click the “Mover a pergunta Cidade para cima” control and verify that Cidade appears before Tamanho da camiseta.
        # Mover a pergunta Cidade para cima button
        elem = page.get_by_role("button", name="Mover a pergunta Cidade para cima")
        await elem.click(timeout=10000)
        
        # -> Save the draft using “Salvar rascunho” and verify the edit page retains the question order and options.
        # Salvar rascunho button
        elem = page.get_by_role("button", name="Salvar rascunho")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The form shows 2 of 30 questions.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The form shows 2 of 30 questions.
        await expect(page.locator("#conteudo").nth(0)).to_contain_text("2 de 30 perguntas", timeout=15000), "The form shows 2 of 30 questions."
        
        # --> The saved questions are ordered with Cidade before Tamanho da camiseta.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The first question is Cidade.
        await expect(page.get_by_role("group", name="Pergunta 1 de").get_by_label("Pergunta", exact=True).nth(0)).to_have_value("Cidade", timeout=15000), "The first question is Cidade."
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The second question is Tamanho da camiseta.
        await expect(page.get_by_role("group", name="Pergunta 2 de").get_by_label("Pergunta", exact=True).nth(0)).to_have_value("Tamanho da camiseta", timeout=15000), "The second question is Tamanho da camiseta."
        
        # --> Tamanho da camiseta retains the options P, M, and G.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: Tamanho da camiseta has the options P, M, and G.
        await expect(page.get_by_role("textbox", name="Opções (uma por linha)").nth(0)).to_have_value("P\nM\nG", timeout=15000), "Tamanho da camiseta has the options P, M, and G."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
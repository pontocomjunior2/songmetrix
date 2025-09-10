import asyncio
from playwright import async_api

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
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # Click on the 'Registre-se' link to go to the registration page.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[2]/div[2]/div/div[3]/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Try to input text into the 'Nome Completo' field (index 3) using a different approach or skip and continue with other fields.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Admin User')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('11999999999')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div[3]/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@songmetrix.com')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div[4]/div/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Admin@@2024')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div[5]/div/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Admin@@2024')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div[2]/div/form/div[6]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Assertion: Verify registration success message with 14-day free trial
        assert free_trial_text := await frame.locator('text=14 dias grátis ativados!').text_content()
        assert free_trial_text is not None and '14 dias grátis ativados!' in free_trial_text
          
        # Assertion: Verify confirmation email message is shown
        email_confirmation_message = await frame.locator('text=Confirme seu email para começar').text_content()
        assert email_confirmation_message is not None and 'Confirme seu email para começar' in email_confirmation_message
          
        email_confirmation_details = await frame.locator('text=Enviamos um email de confirmação para você. Não esqueça de verificar sua caixa de spam.').text_content()
        assert email_confirmation_details is not None and 'Enviamos um email de confirmação para você. Não esqueça de verificar sua caixa de spam.' in email_confirmation_details
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    
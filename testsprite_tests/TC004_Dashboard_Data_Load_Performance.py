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
        # Input email and password, then submit login form to access dashboard.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[2]/div[2]/div/form/div/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@songmetrix.com')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[2]/div[2]/div/form/div[2]/div/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Admin@@2024')
        

        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[2]/div[2]/div/form/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Check if all required dashboard data and visualizations are fully loaded and visible. Then perform multiple access attempts to check uptime and responsiveness.
        frame = context.pages[-1]
        elem = frame.locator('xpath=html/body/div/div[3]/div/div/nav/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # Navigate back to the dashboard page to perform multiple access attempts for uptime and responsiveness testing.
        await page.goto('http://localhost:5173', timeout=10000)
        

        # Perform multiple access attempts to check dashboard uptime and responsiveness over time.
        await page.goto('http://localhost:5173/dashboard', timeout=10000)
        

        # Continue performing multiple access attempts to check dashboard uptime and responsiveness over time.
        await page.goto('http://localhost:5173/dashboard', timeout=10000)
        

        # Assert that the dashboard page title is correct to confirm page load
        assert await page.title() == 'SongMetrix - Monitoramento de Rádios'
        # Assert that the Core Web Vitals FCP (First Contentful Paint) is under 3000ms (3 seconds)
        fcp_text = await frame.locator('xpath=//div[contains(text(),"FCP")]').text_content()
        fcp_value_ms = int(''.join(filter(str.isdigit, fcp_text)))
        assert fcp_value_ms <= 3000, f'FCP is too high: {fcp_value_ms}ms'
        # Assert that there are no critical warnings in Session Summary
        warnings_text = await frame.locator('xpath=//div[contains(text(),"Warnings")]/following-sibling::div').text_content()
        warnings_count = int(''.join(filter(str.isdigit, warnings_text)))
        assert warnings_count == 0, f'Found {warnings_count} warnings in session summary'
        # Assert that key dashboard metrics are present and valid
        active_radios = await frame.locator('xpath=//div[contains(text(),"Active Radios (Your Format)")]/following-sibling::div').text_content()
        executions = await frame.locator('xpath=//div[contains(text(),"Executions (Top 5 Artists)")]/following-sibling::div').text_content()
        main_genre = await frame.locator('xpath=//div[contains(text(),"Main Genre")]/following-sibling::div').text_content()
        assert int(active_radios) > 0, 'Active Radios count should be greater than 0'
        assert int(executions) > 0, 'Executions count should be greater than 0'
        assert main_genre.strip() != '', 'Main Genre should not be empty'
        # Perform multiple access attempts to check uptime and responsiveness
        for _ in range(3):
            await page.goto('http://localhost:5173/dashboard', timeout=10000)
            assert await page.title() == 'SongMetrix - Monitoramento de Rádios'
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    
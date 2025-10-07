/**
 * Puppeteer Renderer Utility
 * Handles headless browser rendering of HTML content to PNG images
 * Used for converting TradingView HTML charts to static images
 */
export class PuppeteerRenderer {
    /**
     * Render HTML content to PNG using Puppeteer headless browser
     */
    static async renderHtmlToPng(html: string, outputPath: string, options: {
        width?: number;
        height?: number;
        saveHtml?: boolean;
        waitForSelector?: string;
        waitForFunction?: () => boolean;
        renderDelay?: number;
    } = {}): Promise<void> {
        const {
            width = 1200,
            height = 800,
            saveHtml = false,
            waitForSelector = '#chart-container canvas',
            renderDelay = 3000,
        } = options;

        try {
            // Save HTML file for debugging if requested
            if (saveHtml) {
                const fs = await import('fs');
                const htmlPath = outputPath.replace(/\.png$/, '.html');
                fs.writeFileSync(htmlPath, html, 'utf8');
                console.log('📄 [PuppeteerRenderer] HTML saved for review:', htmlPath);
            }
            
            // Try to use puppeteer if available
            const puppeteer = await import('puppeteer').catch(() => null);
            
            if (!puppeteer) {
                throw new Error('Puppeteer not available - cannot render HTML to PNG');
            }

            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            
            // Set viewport size to match chart dimensions
            await page.setViewport({ width, height });
            
            // Enable console logging from the page for debugging
            page.on('console', msg => console.log('[Browser Console]', msg.text()));
            page.on('pageerror', error => console.error('[Browser Error]', error.message));
            
            // Load the HTML content
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            // Wait for the LightweightCharts library to load
            if (options.waitForFunction) {
                await page.waitForFunction(options.waitForFunction, { timeout: 10000 });
            } else {
                await page.waitForFunction(() => {
                    return typeof (window as any).LightweightCharts !== 'undefined';
                }, { timeout: 10000 });
            }
            
            console.log('[PuppeteerRenderer] Page scripts loaded');
            
            // Wait for the chart container to exist
            await page.waitForSelector('#chart-container', { timeout: 5000 });
            console.log('[PuppeteerRenderer] Chart container found');
            
            // Wait for the actual canvas element that TradingView creates
            if (waitForSelector) {
                await page.waitForSelector(waitForSelector, { timeout: 10000 });
                console.log('[PuppeteerRenderer] Target element found:', waitForSelector);
            }
            
            // Give the chart time to render - TradingView needs this
            await new Promise(resolve => setTimeout(resolve, renderDelay));
            console.log('[PuppeteerRenderer] Waited for rendering');
            
            // Take screenshot of the full page
            await page.screenshot({ path: outputPath, type: 'png', fullPage: true });
            
            await browser.close();
            
            console.log('✅ [PuppeteerRenderer] PNG generated successfully:', outputPath);
        } catch (error) {
            console.error('❌ [PuppeteerRenderer] Error rendering HTML to PNG:', error);
            throw error;
        }
    }

    /**
     * Check if Puppeteer is available
     */
    static async isAvailable(): Promise<boolean> {
        try {
            const puppeteer = await import('puppeteer');
            return !!puppeteer;
        } catch {
            return false;
        }
    }
}


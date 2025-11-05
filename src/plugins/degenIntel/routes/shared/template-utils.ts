/**
 * Template loading and HTML manipulation utilities
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to routes/shared directory
export const frontendDist = path.resolve(__dirname, '../../');
export const frontendNewDist = path.resolve(__dirname, '../../../src/plugins/degenIntel/frontend_new');

// Lazy load the template to avoid top-level await issues
let INDEX_TEMPLATE: string | null = null;

export async function getIndexTemplate() {
    if (INDEX_TEMPLATE === null) {
        const INDEX_PATH = path.resolve(frontendDist, 'index.html');
        console.log('INDEX_PATH', INDEX_PATH);
        try {
            INDEX_TEMPLATE = await fsp.readFile(INDEX_PATH, 'utf8');
        } catch (error) {
            console.error('Failed to load index.html template:', error);
            INDEX_TEMPLATE = '<!DOCTYPE html><html><head></head><body><h1>Frontend not available</h1></body></html>';
        }
    }
    return INDEX_TEMPLATE;
}

export function injectBase(html: string, href: string) {
    // Put the tag right after <head …> so the browser sees it first
    html = html.replace(
        /<head([^>]*)>/i,
        (_match, attrs) => `<head${attrs}>\n  <base href="${href}">`
    );

    html = html.replace(
        /href="\/degen-intel\/([^"]*)"/i,
        (_match, attrs) => `href="degen-intel/${attrs}"`
    );
    html = html.replace(
        /src="\/degen-intel\/([^"]*)"/i,
        (_match, attrs) => `src="degen-intel/${attrs}"`
    );

    return html;
}


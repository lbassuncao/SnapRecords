import { LogLevel } from './SnapTypes';

/*========================================================================================================

    UTILS FILE

    Utility function to sanitize HTML strings and prevent basic XSS attacks.
    This function creates a temporary DOM element, parses the input HTML string,
    removes all <script> and <style> elements, and strips out any attributes
    that start with 'on' (such as onclick, onmouseover, etc.) from all elements.
    It returns the sanitized HTML as a string.

==========================================================================================================*/

// Utility function to sanitize HTML strings and prevent basic XSS attacks
export function sanitizeHTML(str: string): string {
    // Create a temporary div to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = str;

    // Remove script and style elements
    temp.querySelectorAll('script, style').forEach((el) => el.remove());

    // Remove all 'on*' event attributes from elements
    temp.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        }
    });

    // Return the sanitized HTML
    return temp.innerHTML;
}

// Utility function for logging messages based on debug flag and log level
/* eslint-disable no-console */
export function log(debug: boolean, level: LogLevel, ...args: unknown[]): void {
    // Skip logging if debug is disabled
    if (!debug) return;

    // Prefix for all log messages
    const prefix = 'SnapRecords:';

    // Log message with the specified level
    console[level](prefix, ...args);
}
/* eslint-enable no-console */

/*========================================================================================================
    UTILS FILE ENDS HERE
==========================================================================================================*/

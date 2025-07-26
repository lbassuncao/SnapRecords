import { enableMapSet } from 'immer';

// Enable Immer plugin to support Map and Set data structures
enableMapSet();

// Mock scrollIntoView function for JSDOM compatibility
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock global fetch API for controlled testing of network requests
global.fetch = jest.fn();

// Mock window.matchMedia for responsive design logic
Object.defineProperty(window, 'matchMedia', {
    // Allow the property to be writable
    writable: true,
    // Mock implementation of matchMedia
    value: jest.fn().mockImplementation(query => ({
        // Default to false for media query matches
        matches: false,
        // Store the query string
        media: query,
        // Placeholder for change event handler
        onchange: null,
        // Mock addListener method
        addListener: jest.fn(),
        // Mock removeListener method
        removeListener: jest.fn(),
        // Mock addEventListener method
        addEventListener: jest.fn(),
        // Mock removeEventListener method
        removeEventListener: jest.fn(),
        // Mock dispatchEvent method
        dispatchEvent: jest.fn(),
    })),
});
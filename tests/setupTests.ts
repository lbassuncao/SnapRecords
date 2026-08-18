window.HTMLElement.prototype.scrollIntoView = jest.fn();

if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}

// Mock global fetch API for controlled testing of network requests
global.fetch = jest.fn();

// Mock window.matchMedia for responsive design logic
Object.defineProperty(window, 'matchMedia', {
    // Allow the property to be writable
    writable: true,
    // Mock implementation of matchMedia
    value: jest.fn().mockImplementation((query: string) => ({
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

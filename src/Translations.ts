import { log } from './utils.js';
import { Translation, LogLevel } from './SnapTypes.js';

/*========================================================================================================

    TRANSLATION MANAGER CLASS

    Class responsible for managing translation files and caching

    Manages the loading, caching, and retrieval of translation files for different languages.
    Handles retry logic for failed fetch attempts and provides a fallback mechanism to a default language.
    Designed to optimize translation file access by caching loaded translations in memory.

==========================================================================================================*/

// Exporting the class directly to allow per-instance configuration,
// instead of using a shared singleton instance.
export class TranslationManager {
    // Debug flag from
    // parent SnapRecords instance
    #debug: boolean;
    // Maximum number of retry
    // attempts for fetching translations
    readonly #maxRetries = 3;
    // Base path for translation files
    #langPath: string = '/lang';
    // Delay between retry attempts in milliseconds
    readonly #retryDelay = 500;
    // Fallback language code
    readonly #fallbackLang = 'en_US';
    // In-memory cache for loaded translations
    #cache: Map<string, Translation> = new Map();
    // Logger function provided by the parent SnapRecords instance
    #logger: (level: LogLevel, message: string, ...args: unknown[]) => void;

    // Clears the translation cache
    public clearCache(): void {
        this.#cache.clear();
        this.#logger(LogLevel.INFO, 'Translation cache cleared.');
    }

    // The constructor now receives
    // the language path, which will be provided
    // by the SnapRecords instance.
    constructor(
        langPath: string = '/lang',
        debug: boolean = false,
        logger?: (level: LogLevel, message: string, ...args: unknown[]) => void
    ) {
        this.#langPath = langPath;
        this.#debug = debug;
        // Use the provided logger or default to utils.log
        this.#logger =
            logger || ((level, message, ...args) => log(this.#debug, level, message, ...args));
    }

    // Fetches or retrieves cached translations for a given language
    public async get(lang: string): Promise<Translation> {
        // Return cached translation if available
        if (this.#cache.has(lang)) {
            this.#logger(LogLevel.INFO, `Translation for ${lang} found in cache.`);
            return this.#cache.get(lang)!;
        }

        this.#logger(LogLevel.INFO, `Attempting to load translation for: ${lang}`);

        // Attempt to fetch translation with retries
        for (let attempt = 1; attempt <= this.#maxRetries + 1; attempt++) {
            try {
                // Fetch translation file from the server using the configured path
                const response = await fetch(`${this.#langPath}/${lang}.json`);
                if (!response.ok) {
                    throw new Error(
                        `Translation file for ${lang} not found (status: ${response.status}).`
                    );
                }
                // Parse and cache the translation
                const translation: Translation = await response.json();
                this.#cache.set(lang, translation);
                this.#logger(LogLevel.INFO, `Translation for ${lang} loaded and cached.`);
                return translation;
            } catch (error) {
                this.#logger(
                    LogLevel.ERROR,
                    `Failed to load translation for ${lang} (attempt ${attempt}):`,
                    error
                );
                // Handle fetch failure
                if (attempt > this.#maxRetries) {
                    // Fall back to default language if all retries fail
                    if (lang === this.#fallbackLang) {
                        // Prevent infinite recursion if fallback fails
                        this.#logger(
                            LogLevel.ERROR,
                            `CRITICAL: Fallback translation '${this.#fallbackLang}' failed to load.`
                        );
                        throw new Error(
                            `CRITICAL: Fallback translation '${this.#fallbackLang}' failed to load.`
                        );
                    }
                    this.#logger(
                        LogLevel.WARN,
                        `All retries failed for ${lang}. Falling back to ${this.#fallbackLang}.`
                    );
                    // Attempt to fetch fallback language
                    return this.get(this.#fallbackLang);
                }
                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, this.#retryDelay * attempt));
            }
        }
        // Unreachable code for TypeScript validation
        throw new Error(`Failed to load translation for ${lang} and its fallback.`);
    }
}

/*========================================================================================================
    TRANSLATION MANAGER OBJECT ENDS HERE
==========================================================================================================*/

import { log, sanitizeLanguage } from './utils.js';
import { Translation, LogLevel } from './SnapTypes.js';
import defaultTranslations from './lang/en_US.json';

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
    #controller = new AbortController();
    // Logger function provided by the parent SnapRecords instance
    #logger: (level: LogLevel, message: string, ...args: unknown[]) => void;

    // Clears the translation cache
    public clearCache(): void {
        this.#controller.abort();
        this.#controller = new AbortController();
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
        this.#langPath = (langPath || '/lang').replace(/\/+$/, '') || '/lang';
        this.#debug = debug;
        // Use the provided logger or default to utils.log
        this.#logger =
            logger || ((level, message, ...args) => log(this.#debug, level, message, ...args));
    }

    // Fetches or retrieves cached translations for a given language
    public async get(lang: string): Promise<Translation> {
        const safeLang = sanitizeLanguage(lang);
        if (!safeLang) {
            return defaultTranslations as Translation;
        }
        if (this.#cache.has(safeLang)) {
            this.#logger(LogLevel.INFO, `Translation for ${safeLang} found in cache.`);
            return this.#cache.get(safeLang)!;
        }

        this.#logger(LogLevel.INFO, `Attempting to load translation for: ${safeLang}`);
        const signal = this.#controller.signal;

        for (let attempt = 1; attempt <= this.#maxRetries + 1; attempt++) {
            if (signal.aborted) {
                const abortError = new Error('Translation load aborted.');
                abortError.name = 'AbortError';
                throw abortError;
            }
            try {
                const response = await fetch(`${this.#langPath}/${safeLang}.json`, {
                    signal,
                });
                if (!response.ok) {
                    throw new Error(
                        `Translation file for ${safeLang} not found (status: ${response.status}).`
                    );
                }
                const translation = this.#mergeWithDefaults(await response.json());
                this.#cache.set(safeLang, translation);
                this.#logger(LogLevel.INFO, `Translation for ${safeLang} loaded and cached.`);
                return translation;
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    throw error;
                }
                this.#logger(
                    LogLevel.ERROR,
                    `Failed to load translation for ${safeLang} (attempt ${attempt}):`,
                    error
                );
                if (attempt > this.#maxRetries) {
                    if (safeLang === this.#fallbackLang) {
                        this.#logger(
                            LogLevel.ERROR,
                            `CRITICAL: Fallback translation '${this.#fallbackLang}' failed to load.`
                        );
                        return defaultTranslations as Translation;
                    }
                    this.#logger(
                        LogLevel.WARN,
                        `All retries failed for ${safeLang}. Falling back to ${this.#fallbackLang}.`
                    );
                    return this.get(this.#fallbackLang);
                }
                await this.#delay(this.#retryDelay * attempt, signal);
            }
        }
        return defaultTranslations as Translation;
    }

    #delay(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                const abortError = new Error('Translation load aborted.');
                abortError.name = 'AbortError';
                reject(abortError);
                return;
            }
            const timer = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            }, ms);
            const onAbort = () => {
                clearTimeout(timer);
                const abortError = new Error('Translation load aborted.');
                abortError.name = 'AbortError';
                reject(abortError);
            };
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }

    #mergeWithDefaults(partial: unknown): Translation {
        return this.#mergeStringTree(defaultTranslations as Translation, partial) as Translation;
    }

    #mergeStringTree<T>(defaults: T, src: unknown): T {
        const input =
            src && typeof src === 'object' && !Array.isArray(src)
                ? (src as Record<string, unknown>)
                : {};
        const result = { ...defaults } as T;
        (Object.keys(defaults as object) as (keyof T)[]).forEach((key) => {
            const fallback = defaults[key];
            if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
                result[key] = this.#mergeStringTree(fallback, input[key as string]) as T[keyof T];
                return;
            }
            if (typeof fallback === 'string') {
                const value = input[key as string];
                result[key] = (typeof value === 'string' ? value : fallback) as T[keyof T];
            }
        });
        return result;
    }
}

/*========================================================================================================
    TRANSLATION MANAGER OBJECT ENDS HERE
==========================================================================================================*/

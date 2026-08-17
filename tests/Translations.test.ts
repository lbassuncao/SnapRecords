import { TranslationManager } from '../src/Translations';
import defaultTranslations from '../src/lang/en_US.json';

describe('TranslationManager', () => {
    it('merges partial JSON and ignores non-string fields', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    loading: 'A carregar...',
                    pagination: { showingRecords: 99 },
                    errors: { generic: null },
                }),
        });

        const manager = new TranslationManager('/lang', false);
        const translation = await manager.get('pt_PT');

        expect(translation.loading).toBe('A carregar...');
        expect(translation.pagination.showingRecords).toBe(
            defaultTranslations.pagination.showingRecords
        );
        expect(translation.errors.generic).toBe(defaultTranslations.errors.generic);
        expect(translation.previous).toBe(defaultTranslations.previous);

        manager.clearCache();
    });
});

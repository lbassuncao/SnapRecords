import {
    Component,
    Input,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    OnChanges,
    SimpleChanges,
    Output,
    EventEmitter,
} from '@angular/core';
import { SnapRecords } from 'snap-records';
import type { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

type SnapRecord = Identifiable & Record<string, unknown>;

@Component({
    selector: 'snap-records-wrapper',
    standalone: true,
    template: `<div #container></div>`,
})
export class SnapRecordsWrapperComponent<T extends SnapRecord>
    implements AfterViewInit, OnDestroy, OnChanges
{
    @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

    @Input({ required: true }) options!: SnapRecordsOptions<T>;

    @Output() ready = new EventEmitter<ISnapApi<T>>();

    private instance: SnapRecords<T> | null = null;

    ngAfterViewInit(): void {
        this.instance = new SnapRecords<T>(this.containerRef.nativeElement, this.options);
        this.ready.emit(this.instance.getApi());
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!this.instance || !changes['options']) return;

        const api = this.instance.getApi();
        if (api.isDestroyed) return;

        const currentOptions = changes['options'].currentValue as SnapRecordsOptions<T>;
        const prevOptions = changes['options'].previousValue as SnapRecordsOptions<T> | undefined;

        if (prevOptions && currentOptions.theme !== prevOptions.theme && currentOptions.theme) {
            api.setTheme(currentOptions.theme);
        }
        if (prevOptions && currentOptions.format !== prevOptions.format && currentOptions.format) {
            api.setFormat(currentOptions.format);
        }
        if (
            prevOptions &&
            currentOptions.language !== prevOptions.language &&
            currentOptions.language
        ) {
            void api.setLanguage(currentOptions.language);
        }

        api.updateParams({
            filtering: currentOptions.filtering,
            sorting: currentOptions.sorting,
            rowsPerPage: currentOptions.rowsPerPage,
        });
    }

    ngOnDestroy(): void {
        this.instance?.destroy();
        this.instance = null;
    }
}

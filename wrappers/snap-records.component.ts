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
    EventEmitter
} from '@angular/core';
import { SnapRecords } from 'snap-records';
import { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

@Component({
    selector: 'snap-records-wrapper',
    standalone: true,
    template: `<div #container [id]="componentId"></div>`,
})
export class SnapRecordsWrapperComponent<T extends Identifiable>
    implements AfterViewInit, OnDestroy, OnChanges {
    // Use @ViewChild to get a reference to the container div in the template
    @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

    // Use @Input to receive options from the parent component
    @Input({ required: true }) options!: SnapRecordsOptions<T>;

    // Use @Output to emit the API instance once it's ready
    @Output() ready = new EventEmitter<ISnapApi<T>>();

    // Hold the SnapRecords instance
    private instance: SnapRecords<T> | null = null;

    // Generate a unique ID for the container
    public readonly componentId = `snap-records-angular-${Math.random().toString(36).substring(2, 9)}`;

    ngAfterViewInit(): void {
        // The view is initialized, so the #container element exists.
        // We create the SnapRecords instance here.
        this.instance = new SnapRecords<T>(this.componentId, this.options);
        this.ready.emit(this.instance.getApi());
    }

    ngOnChanges(changes: SimpleChanges): void {
        // This hook is called whenever an @Input property changes.
        if (this.instance && changes['options']) {
            const currentOptions = changes['options'].currentValue;
            const prevOptions = changes['options'].previousValue;
            const api = this.instance.getApi();

            // Check for specific property changes to call the right API method
            if (prevOptions && currentOptions.theme !== prevOptions.theme) {
                api.setTheme(currentOptions.theme);
            }
            if (prevOptions && currentOptions.language !== prevOptions.language) {
                api.setLanguage(currentOptions.language);
            }

            // Update other parameters
            api.updateParams({
                filters: currentOptions.filters,
                sortConditions: currentOptions.sortConditions,
                rowsPerPage: currentOptions.rowsPerPage,
            });
        }
    }

    ngOnDestroy(): void {
        // This hook is called when the component is destroyed.
        // We must clean up the SnapRecords instance.
        this.instance?.destroy();
    }
}
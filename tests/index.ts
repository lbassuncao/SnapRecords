import {Identifiable} from '../src/SnapTypes'
export interface TestData extends Identifiable {
    [key: string]: any;
    name: string;
}

export type DropEffect = 'none' | 'copy' | 'link' | 'move';
export type EffectAllowed = 'none' | 'copy' | 'copyLink' | 'copyMove' | 'link' | 'linkMove' | 'move' | 'all' | 'uninitialized';
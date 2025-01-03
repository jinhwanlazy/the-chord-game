import { writable } from 'svelte/store';
import { allChords } from '$lib/chord';

export type Config = {
  debugMode: boolean;
  volume: number;
  bpm: number;
  gridSize: string;
  chordSet: Set<number>;
  addInversion: boolean;
  addTensions: boolean;
};

const defaultChordSet = new Set(allChords
    .map((_, index) => index)
    .filter(index => {
        const chord = allChords[index];
        return ['major'].includes(chord.chordType)
            && [0, 2, 4, 5, 7, 9, 11].includes(chord.rootNote)
            && (chord.rootNote === chord.bottomNote)
            && chord.tensionNotes.size === 0;
    })
);

const defaultConfig: Config = {
  debugMode: false,
  volume: 50,
  bpm: 45,
  gridSize: '4x4',
  chordSet: defaultChordSet,
  addInversion: false,
  addTensions: false,
};

export const globalConfig = writable<Config>(defaultConfig);

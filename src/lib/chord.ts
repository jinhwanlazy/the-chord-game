import type { Note } from '$lib/note';
import { NoteSet, noteToString } from '$lib/note';
import chordsData from './chords.json';

export const allChordTypes = ['major', 'minor', 'diminished', 'augmented', 'suspended4', 'suspended2', 'major7', 'dominant7', 'minor7', 'half-diminished7', 'diminished7', 'minor-major7', 'augmented7', 'augmented-major7', 'suspended7', 'major6', 'minor6'];
export type ChordType = typeof allChordTypes[number];

export interface Chord {
    notes: NoteSet;
    chordType: ChordType;
    rootNote: Note;
    bottomNote: Note;
    tensionNotes: NoteSet;
}

export function chordTypeToString(chordType: ChordType, skipMajor: boolean=true): string {
    switch (chordType) {
        case 'major': return skipMajor ? '' : 'Δ';
        case 'minor': return '-';
        case 'diminished': return '°';
        case 'augmented': return '+';
        case 'suspended4': return 'sus4';
        case 'suspended2': return 'sus2';

        case 'major7': return 'Δ7';
        case 'dominant7': return '7';
        case 'minor7': return '-7';
        case 'half-diminished7': return 'ø7';
        case 'diminished7': return 'o7';
        case 'minor-major7': return '−Δ7';
        case 'augmented7': return '+7';
        case 'augmented-major7': return '+Δ7';
        case 'suspended7': return 'sus7';

        case 'major6': return '6';
        case 'minor6': return '-6';
    }
}

export function chordTypeToNumber(chordType: ChordType): number {
    switch (chordType) {
        case 'major': return 0;
        case 'minor': return 1;
        case 'diminished': return 2;
        case 'augmented': return 3;
        case 'suspended4': return 4;
        case 'suspended2': return 5;

        case 'major7': return 6;
        case 'dominant7': return 7;
        case 'minor7': return 8;
        case 'half-diminished7': return 9;
        case 'diminished7': return 10;
        case 'minor-major7': return 11;
        case 'augmented7': return 12;
        case 'augmented-major7': return 13;
        case 'suspended7': return 14;

        case 'major6': return 15;
        case 'minor6': return 16;
    }
}

export function chordToString(chord: Chord, accidentalType: '#' | 'b' | 'random'): string {
    let symbol = '';
    symbol += noteToString(chord.rootNote, false, accidentalType);
    symbol += chordTypeToString(chord.chordType);
    if (chord.bottomNote !== undefined && chord.bottomNote !== chord.rootNote) {
        symbol += '/' + noteToString(chord.bottomNote, false, accidentalType);
    }
    if (chord.tensionNotes.size == 1) {
        if (chord.tensionNotes.bottomNote % 12 + 12 - chord.rootNote == 14) {
            symbol += 'add9';
        }
    }
    return symbol;
}

function createChord(chordData: any): Chord {
    return {
        'notes': new NoteSet(chordData.notes),
        'chordType': chordData.chordType,
        'rootNote': chordData.rootNote,
        'bottomNote': chordData.rootNote,
        'tensionNotes': new NoteSet(chordData.tensionNotes),
    };
}

export const allChords: Chord[] = chordsData.allChords.map(createChord);
export const chordDictionary: Map<string, Chord[]> = new Map();

function addChordToDictionary(chord: Chord, bottomNote: Note): void {
    let key = new NoteSet(chord.notes);
    for (const tensionNote of chord.tensionNotes) {
        key.add(tensionNote % 12);
    }
    const keyString = key.toString();
    if (!chordDictionary.has(keyString)) {
        chordDictionary.set(keyString, []);
    }
    chord.bottomNote = bottomNote;
    chordDictionary.get(keyString).push(chord);
}
// add default chords dictionary
for (const chordData of chordsData.allChords) {
    let chord = createChord(chordData);
    addChordToDictionary(chord, chord.rootNote);
}

// add inverted chords dictionary
for (const chordData of chordsData.allChords) {
    for (const note of chordData.notes) {
        let chord = createChord(chordData);
        if (note !== chord.rootNote) {
            addChordToDictionary(chord, note);
        }
    }
}

// find chord from dictionary
export function findChord(notes: NoteSet): Chord | undefined {
    if (notes.size === 0) {
        return undefined;
    }
    const keyString = new NoteSet(notes.map(note => note % 12)).toString();
    const chords = chordDictionary.get(keyString);
    if (chords === undefined || chords.length === 0) {
        return undefined;
    }
    if (chords.length === 1) {
        return chords[0];
    }
    for (const chord of chords) {
        if (false && chord.tensionNotes.size > 0) {
            const tensionNotes = notes.filter(note => chord.tensionNotes.has(note % 12));
            const rootNote = notes.filter(note => note % 12 === chord.rootNote)[0];
            if (tensionNotes.every(note => note - rootNote > 12)) {
                return chord;
            }
        } else if (chord.bottomNote === notes.bottomNote % 12) {
            return chord;
        }
    }
    return undefined;
}

export function validateNotes(chord: Chord, notes: NoteSet, strict: boolean = true): boolean {
  if ((strict || chord.bottomNote !== chord.rootNote) &&
    notes.bottomNote % 12 !== chord.bottomNote) {
    return false;
  }

  const normalizedNotes = new Set(notes.map(note => note % 12));
  return normalizedNotes.size !== chord.notes.length + chord.tensionNotes.length &&
    chord.notes.every(note => normalizedNotes.has(note)) &&
    chord.tensionNotes.every(note => normalizedNotes.has(note));
}



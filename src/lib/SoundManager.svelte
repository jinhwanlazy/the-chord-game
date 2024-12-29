<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { WebMidi } from 'webmidi';
  import * as Tone from 'tone';
  import type { Note } from '$lib/note';
  import { NoteSet } from '$lib/note';
  import { globalConfig } from '$lib/config';

  export let volume: number;

  const dispatch = createEventDispatcher();

  let midiInput: any = null;
  let currentNotes: NoteSet = new NoteSet();
  let synth: Tone.PolySynth;
  let beepSynth: Tone.Synth;
  let isMuted = false;

  onMount(async () => {
    await initializeMIDI();
    initializeSynth();
    initializeBeepSynth();
  });

  onDestroy(() => {
    if (midiInput) {
      midiInput.removeListener();
    }
  });

  async function initializeMIDI() {
    try {
      await WebMidi.enable();
      if (WebMidi.inputs.length > 0) {
        midiInput = WebMidi.inputs[0];
        midiInput.addListener('noteon', handleNoteOn);
        midiInput.addListener('noteoff', handleNoteOff);
      }
    } catch (err) {
      console.error('Failed to initialize MIDI:', err);
    }
  }

  function initializeSynth() {
    // Ensure Tone.js is started
    Tone.start();

    const context = new Tone.Context({
          latencyHint: 'interactive',
          lookAhead : 0.00,
          updateInterval : 0.001,
      });
    Tone.setContext(context);

    synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.set({
      oscillator: {
        type: 'triangle8'
      },
      envelope: {
        attack: 0.001,
        decay: 0.15,
        sustain: 0.2,
        release: 0.1
      }
    });
  }

  function handleNoteOn(e: any) {
    if (e.note && typeof e.note.number === 'number') {
      currentNotes.add(e.note.number);
      currentNotes = currentNotes; // Trigger reactivity
      playNote(e.note.number);
      dispatchNotesChange();
    }
  }

  function handleNoteOff(e: any) {
    if (e.note && typeof e.note.number === 'number') {
      currentNotes.delete(e.note.number);
      currentNotes = currentNotes; // Trigger reactivity
      stopNote(e.note.number);
      dispatchNotesChange();
    }
  }

  function playNote(note: number) {
    if (!isMuted) {
      const freq = Tone.Frequency(note, "midi").toFrequency();
      synth.triggerAttack(freq);
    }
  }

  function stopNote(note: number) {
    if (!isMuted) {
      const freq = Tone.Frequency(note, "midi").toFrequency();
      synth.triggerRelease(freq);
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
      synth.volume.value = -Infinity;
    } else {
      synth.volume.value = Tone.gainToDb(volume / 100);
    }
  }

  function dispatchNotesChange() {
    dispatch('notesChange', currentNotes);
  }


  function initializeBeepSynth() {
    beepSynth = new Tone.Synth({
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      }
    }).toDestination();
  }

  export function playBeep() {
    if (!isMuted) {
      beepSynth.volume.value = Tone.gainToDb(volume / 100);
      beepSynth.triggerAttackRelease("C5", "16n");
    }
  }

  $: {
    if (synth && beepSynth && !isMuted) {
      const dbVolume = Tone.gainToDb(volume / 100);
      synth.volume.value = dbVolume;
      beepSynth.volume.value = dbVolume;
    }
  }
</script>

<button
  on:click={toggleMute}
  class="text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
  aria-label={isMuted ? "Unmute" : "Mute"}
>
  {#if isMuted}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  {/if}
</button>

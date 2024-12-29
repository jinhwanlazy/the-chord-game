<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Note } from '$lib/note';
  import { NoteSet } from '$lib/note';
  import type { Chord } from '$lib/chord';
  import { findChord, chordToString, allChords, validateNotes } from '$lib/chord';
  import type { Config } from '$lib/config';
  import { globalConfig } from '$lib/config';
  import type SoundManager from '$lib/SoundManager.svelte';

  const dispatch = createEventDispatcher();

  let config: Config;
  globalConfig.subscribe(value => {
    config = value;
  });
  export let currentNotes: NoteSet = new NoteSet();
  export let soundManager: SoundManager;

  $: ({ bpm, gridSize, chordSet, allowInversions } = config);

  $: [numRows, numCols] = (gridSize || '4x4').split('x').map(Number);
  $: totalBoxes = numRows * numCols;
  $: beatDuration = 60000 / bpm;

  $: boxSize = (() => {
    const baseSize = 64; // 4rem or 64px
    const minSize = 32; // 2rem or 32px
    return Math.max(minSize, baseSize - (Math.max(numRows, numCols) - 4) * 4);
  })();

  $: {
    if (gridSize && chordSet) {
      initializeGame();
    }
  }

  const visibleBoxesBeforeStart: number = 4; // Number of visible boxes before game starts

  interface PlayerInput {
    note: Note;
    startTimestamp: number;
    endTimestamp: number | undefined;
  }

  // Game state
  let gameStatus: 'not-started' | 'in-progress' | 'finished' = 'not-started';
  let focusPosition: number = 0;
  let totalScore: number = 0;
  let targetChords: Chord[] = [];
  let currentChord: Chord | undefined;
  let activeInputs: Map<Note, PlayerInput> = new Map();
  let boxStatuses: {
      score: number;
      visible: boolean
      startTimestamp: number;
      inputs: Set<PlayerInput>;
      chordValidated: boolean;
  }[] = [];

  // Timing
  let prevTimestamp: number = 0;
  let lastBeatTime: number = 0;
  let animationFrameId: number;

  onMount(() => {
    initializeGame();
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  $: {
    updateCurrentNotes(currentNotes);
  }

  function updateCurrentNotes(notes: NoteSet) {
    updateCurrentActiveInputs(notes);
    updateCurrentChord(notes);

    // Game start with first chord matches
    if (gameStatus === 'not-started' &&
      targetChords.length > 0 && targetChords[0] &&
      validateNotes(targetChords[0], currentNotes)
    ) {
      startGame();
    }

    // Chord symbol displayed on top of the page
    dispatch('updateChord', currentChord ? chordToString(currentChord, '#') : '');
  }

  function updateCurrentActiveInputs(notes: NoteSet) {
    const now = performance.now();
    for (const [note, input] of activeInputs) {
      if (!notes.has(note)) {
        input.endTimestamp = now;
        activeInputs.delete(note);
      }
    }
    notes.forEach(note => {
      if (!activeInputs.has(note)) {
        activeInputs.set(note, {
          note,
          startTimestamp: now,
          endTimestamp: undefined,
        });
      }
    });
  }

  function updateCurrentChord(notes: NoteSet) {
    const chord_ = findChord(notes);
    if (chord_ === undefined) {
      currentChord = undefined;
    } else {
      currentChord = chord_;
    }
  }

  export function resetGame() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    initializeGame();
  }

  function initializeGame() {
    const chordIndices = Array.from(chordSet);
    targetChords = Array(totalBoxes).fill(0).map(() => {
      const randomIndex = chordIndices[Math.floor(Math.random() * chordIndices.length)];
      return allChords[randomIndex];
    });
    boxStatuses = Array(totalBoxes).fill(null).map((_, index) => ({
      score: 0,
      startTimestamp: 0,
      visible: index < visibleBoxesBeforeStart,
      inputs: new Set(),
      chordValidated: false,
    }));
    totalScore = 0;
    focusPosition = 0;
    gameStatus = 'not-started';
    dispatch('gameStatusChange', gameStatus);
  }

  function startGame() {
    const now = performance.now();
    if (gameStatus === 'not-started') {
      gameStatus = 'in-progress';
      focusPosition = 0;
      boxStatuses[focusPosition].startTimestamp = now;
      lastBeatTime = now;
      prevTimestamp = now;
      requestAnimationFrame(gameLoop);
      dispatch('gameStatusChange', gameStatus);

      // Play beep sound when the game starts
      if (soundManager && soundManager.playBeep) {
        soundManager.playBeep();
      }
    }
  }

  function gameLoop(now: number) {
    const elapsed = now - lastBeatTime;

    if (elapsed >= beatDuration) {
      updateBoxScore(now, beatDuration);
      moveFocus(now);
      lastBeatTime = now;
    }
    if (focusPosition < totalBoxes) {
      for (const [_, input] of activeInputs) {
        boxStatuses[focusPosition].inputs.add(input);
      }
    }
    //console.log('focusPosition:', focusPosition, 'totalBoxes:', totalBoxes, 'activeInputs:', activeInputs.size, 'boxInputs:', boxStatuses[focusPosition].inputs.size);

    if (gameStatus === 'in-progress') {
      updateBoxScore(now, elapsed);
      //updateBoxProgress(deltaTime, beatDuration);
      revealNextBox();
      animationFrameId = requestAnimationFrame(gameLoop);
    }
    prevTimestamp = now;
  }

  function revealNextBox() {
    for (let i = 0; i < totalBoxes; i++) {
      boxStatuses[i].visible = true;
    }
    boxStatuses = boxStatuses; // Trigger reactivity
  }

  function updateBoxScore(now: number, elapsed: number) {
    const box = boxStatuses[focusPosition];
    const targetChord = targetChords[focusPosition];
    const inputStartTimeThreshold = box.startTimestamp + beatDuration - Math.max(beatDuration / 16, 50);
    let inputs = Array.from(box.inputs).sort((a, b) => a.startTimestamp - b.startTimestamp);

    function isValidNote(note: Note) {
      return targetChord.notes.has(note % 12) || targetChord.tensionNotes.has(note % 12);
    }

    function noteDuration(input: PlayerInput, now: number) {
      return Math.min(input.endTimestamp ?? now, box.startTimestamp + beatDuration) - Math.max(input.startTimestamp, box.startTimestamp);
    }

    // -1 for any wrong note
    let wrongNotePanalty = inputs.some(input => {
      return input.startTimestamp <= inputStartTimeThreshold && !isValidNote(input.note);
    }) ? -1 : 0;

    // Filter out wrong notes and notes after the threshold
    inputs = inputs.filter(input => {
      return input.startTimestamp <= inputStartTimeThreshold && isValidNote(input.note);
    });

    if (focusPosition === 0) {
      console.log('boxInputs:', box.inputs.size, 'inputs:', inputs.length);
    }
    if (inputs.length === 0) {
      box.score = wrongNotePanalty;
      return;
    }

    // 0-1 for coverage.
    let coverage = 0;
    let lastEndTimestamp = 0;
    inputs.forEach(input => {
      const startTimestamp = Math.max(input.startTimestamp, box.startTimestamp, lastEndTimestamp);
      const endTimestamp = Math.min(input.endTimestamp ?? now, box.startTimestamp + beatDuration);
      coverage += Math.max(endTimestamp - startTimestamp, 0) / elapsed;
      lastEndTimestamp = endTimestamp;
    });

    // 0-1 for evenness.
    // Use KL divergence to measure the evenness of note lengths
    const noteDurationSum = inputs.reduce((acc, input) => acc + noteDuration(input, now), 0);
    const kl = inputs.reduce((acc, input) => {
      const duration = noteDuration(input, now) + 1e-8;
      return acc + Math.log(noteDurationSum / inputs.length / duration) / inputs.length;
    }, 0);
    const evenness = Math.max(1 - 10 * kl, 0);


    box.score = wrongNotePanalty + coverage * evenness;
    if (!box.chordValidated) {
      const allNotes = new NoteSet(inputs.map(input => input.note));
      console.log('allNotes:', allNotes);
      box.chordValidated = validateNotes(targetChord, allNotes);
    }
  }

  function moveFocus(timestamp: number) {
    console.log('moveFocus - timestamp:', timestamp);
    focusPosition++;
    const prevBox = boxStatuses[focusPosition - 1];
    if (focusPosition > 0 && prevBox.chordValidated) {
      totalScore += bpm * chordSet.size * prevBox.score;
    }
    if (focusPosition >= totalBoxes) {
      endGame();
    } else {
      const box = boxStatuses[focusPosition];
      box.startTimestamp = timestamp;
      if (soundManager && soundManager.playBeep) {
        soundManager.playBeep();
      }
    }
    boxStatuses = boxStatuses; // Trigger reactivity
  }

  function onSoundManagerReady(event: CustomEvent) {
    soundManager = event.detail;
  }

  //function updateBoxProgress(timeDelta: number, beatDuration: number) {
  //  const rest = 0.9;
  //  const expectedChord = targetChords[focusPosition];
  //  if (currentChord && chordToString(currentChord) === chordToString(expectedChord)) {
  //    const prevScore = boxStatuses[focusPosition].score;
  //    boxStatuses[focusPosition].score = Math.min(
  //            1, prevScore + timeDelta / beatDuration * 1 / rest);
  //  }
  //  boxStatuses = boxStatuses; // Trigger reactivity
  //}

  function getBoxColor(status: { score: number; chordValidated: boolean }): string {
    const rN = 55, gN = 65, bN = 81; // Neutral color:  bg-gray-700
    const rR = 239, gR = 68, bR = 68; // Color for negative score: bg-red-500
    const rG = 34, gG = 197, bG = 94; // Color for positive score: bg-green-500
    const rI = 234, gI = 179, bI = 88; // Color for not yet validated positive score: bg-yellow-500
    const rT = status.score <= 0 ? rR : (status.chordValidated ? rG : rI);
    const gT = status.score <= 0 ? gR : (status.chordValidated ? gG : gI);
    const bT = status.score <= 0 ? bR : (status.chordValidated ? bG : bI);
    const weight = Math.sqrt(Math.abs(status.score)); // sqrt for better color contrast
    const r = Math.round(rN + weight * (rT - rN));
    const g = Math.round(gN + weight * (gT - gN));
    const b = Math.round(bN + weight * (bT - bN));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function endGame() {
    gameStatus = 'finished';
    dispatch('gameStatusChange', gameStatus);
    // TODO: Implement shareable link generation
  }

</script>

<div class="game-container relative">
  <div class="score mb-4">Score: {Math.floor(totalScore)}</div>
  <div class="chord-grid-container relative">
    {#if gameStatus === 'not-started'}
      <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
        <button
          class="play-button"
          on:click={startGame}
          aria-label="Start Game"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full">
            <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    {/if}
    <div class="chord-grid" style="grid-template-columns: repeat({numCols}, minmax(0, 1fr));">
      {#each targetChords as chord, index}
        <div
          class="chord-box"
          style="
            background-color: {getBoxColor(boxStatuses[index])};
            width: {boxSize}px;
            height: {boxSize}px;
          "
          class:ring-2={index === focusPosition}
          class:ring-blue-500={index === focusPosition}
          class:pulsating={index === focusPosition}
        >
          {boxStatuses[index].visible ? (chord ? chordToString(chord, '#') : '?') : '?'}
        </div>
      {/each}
    </div>
  </div>
</div>


<style lang="postcss">
  .game-container {
    @apply flex flex-col items-center justify-center w-full h-full;
  }

  .score {
    @apply text-4xl mb-8 text-white;
  }

  .chord-grid-container {
    @apply relative;
  }

  .chord-grid {
    @apply grid gap-3 p-4 max-w-full max-h-full overflow-auto;
  }

  .chord-box {
    @apply flex items-center justify-center rounded-lg text-2xl text-white;
    transition: background-color 33ms linear;
  }

  .play-button {
    @apply w-32 h-32 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300;
  }

  .play-button svg {
    @apply w-24 h-24; /* Adjust the size of the icon */
  }
</style>

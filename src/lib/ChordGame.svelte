<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { NoteSet } from '$lib/note';
  import type { Chord } from '$lib/chord';
  import { findChord, chordToString, allChords } from '$lib/chord';
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

  // Game state
  let gameStatus: 'not-started' | 'in-progress' | 'finished' = 'not-started';
  let focusPosition: number = 0;
  let score: number = 0;
  let chordSymbols: Chord[] = [];
  let currentChord: Chord | undefined;
  let boxStatuses: { 
      progress: number;
      visible: boolean 
      inputs: {
          notes: NoteSet;
          timestamp: number;
          duration: number;
      }[];
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
    updateCurrentChord(currentNotes);
  }

  function updateCurrentChord(notes: NoteSet) {
    const chord_ = findChord(notes);
    if (chord_ === undefined) {
      currentChord = undefined;
    } else {
      currentChord = chord_;
    }
    if (gameStatus === 'not-started' && currentChord && chordToString(currentChord) === chordToString(chordSymbols[0])) {
      startGame();
    }
    dispatch('updateChord', currentChord ? chordToString(currentChord) : '');
  }

  export function resetGame() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    initializeGame();
  }

  function initializeGame() {
    const chordIndices = Array.from(chordSet);
    chordSymbols = Array(totalBoxes).fill(0).map(() => {
      const randomIndex = chordIndices[Math.floor(Math.random() * chordIndices.length)];
      return allChords[randomIndex];
    });
    boxStatuses = Array(totalBoxes).fill(null).map((_, index) => ({ 
      progress: 0, 
      visible: index < visibleBoxesBeforeStart,
      inputs: [],
    }));
    score = 0;
    focusPosition = 0;
    gameStatus = 'not-started';
    dispatch('gameStatusChange', gameStatus);

  }

  function startGame() {
    if (gameStatus === 'not-started') {
      gameStatus = 'in-progress';
      lastBeatTime = performance.now();
      prevTimestamp = performance.now();
      requestAnimationFrame(gameLoop);
      dispatch('gameStatusChange', gameStatus);

      // Play beep sound when the game starts
      if (soundManager && soundManager.playBeep) {
        soundManager.playBeep();
      }
    }
  }

  function gameLoop(timestamp: number) {
    const beatDuration = 60000 / bpm;
    const elapsed = timestamp - lastBeatTime;
    const deltaTime = timestamp - prevTimestamp;

    if (elapsed >= beatDuration) {
      moveFocus();
      lastBeatTime = timestamp;
    }

    if (gameStatus === 'in-progress') {
      updateBoxProgress(deltaTime, beatDuration);
      revealNextBox();
      animationFrameId = requestAnimationFrame(gameLoop);
    }
    prevTimestamp = timestamp;
  }

  function revealNextBox() {
    for (let i = 0; i < totalBoxes; i++) {
      boxStatuses[i].visible = true;
    }
    boxStatuses = boxStatuses; // Trigger reactivity
  }

  function moveFocus() {
    focusPosition++;
    if (focusPosition > 0) {
      score += bpm * boxStatuses[focusPosition - 1].progress;
    }
    if (focusPosition >= totalBoxes) {
      endGame();
    } else {
      if (soundManager && soundManager.playBeep) {
        soundManager.playBeep();
      }
    }
    boxStatuses = boxStatuses; // Trigger reactivity
  }

  function onSoundManagerReady(event: CustomEvent) {
    soundManager = event.detail;
  }

  function updateBoxProgress(timeDelta: number, beatDuration: number) { 
    const rest = 0.9;
    const expectedChord = chordSymbols[focusPosition];
    if (currentChord && chordToString(currentChord) === chordToString(expectedChord)) {
      const prevProgress = boxStatuses[focusPosition].progress;
      boxStatuses[focusPosition].progress = Math.min(
              1, prevProgress + timeDelta / beatDuration * 1 / rest);
    } 
    boxStatuses = boxStatuses; // Trigger reactivity
  }

  function getBoxColor(status: { progress: number; }): string {
    const rN = 239, gN = 68, bN = 68; // Negative color: bg-red-500
    const r0 = 55, g0 = 65, b0 = 81; // Neutral color:  bg-gray-700
    const rP = 34, gP = 197, bP = 94; // Positive color: bg-green-500
    const weight = Math.sqrt(Math.abs(status.progress));
  
    if (status.progress >= 0) {
      const r = Math.round(r0 + weight * (rP - r0));
      const g = Math.round(g0 + weight * (gP - g0));
      const b = Math.round(b0 + weight * (bP - b0));
      return `rgb(${r}, ${g}, ${b})`;
    }
    else {
      const r = Math.round(r0 + weight * (rN - r0));
      const g = Math.round(g0 + weight * (gN - g0));
      const b = Math.round(b0 + weight * (bN - b0));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function endGame() {
    gameStatus = 'finished';
    dispatch('gameStatusChange', gameStatus);
    // TODO: Implement shareable link generation
  }

</script>

<div class="game-container relative">
  <div class="score mb-4">Score: {Math.floor(score)}</div>
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
      {#each chordSymbols as chord, index}
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

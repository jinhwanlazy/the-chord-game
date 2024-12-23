<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import ConfigPanel from '$lib/ConfigPanel.svelte';
  import SoundManager from '$lib/SoundManager.svelte';
  import { NoteSet } from '$lib/note';
  import type { Chord } from '$lib/chord';
  import { allChords } from '$lib/chord';
  import { globalConfig } from '$lib/config';

  let ChordGame: { resetGame?: () => void } | null = null;
  let currentNotes: NoteSet = new NoteSet();
  let currentChord: string = '';
  let isConfigPanelOpen = false;
  let gameStatus: 'not-started' | 'in-progress' | 'finished' = 'not-started';
  let soundManager: SoundManager;

  onMount(async () => {
    if (browser) {
      const module = await import('$lib/ChordGame.svelte');
      ChordGame = module.default;
    }
  });

  function updateCurrentNotes(event: CustomEvent<NoteSet>) {
    currentNotes = event.detail;
  }

  function updateCurrentChord(event: CustomEvent<string>) {
    currentChord = event.detail;
  }

  function toggleConfigPanel() {
    isConfigPanelOpen = !isConfigPanelOpen;
    if (isConfigPanelOpen && gameStatus === 'in-progress') {
      gameStatus = 'not-started';
      if (ChordGame && ChordGame.resetGame) {
        ChordGame.resetGame();
      }
    }
  }

  function handleConfigUpdate(event: CustomEvent) {
    $globalConfig = { ...$globalConfig, ...event.detail };
  }

  function handleGameStatusChange(event: CustomEvent<'not-started' | 'in-progress' | 'finished'>) {
    gameStatus = event.detail;
    if (gameStatus === 'in-progress') {
      isConfigPanelOpen = false;
      if (soundManager && soundManager.playBeep) {
        soundManager.playBeep();
      }
    }
  }

</script>

<svelte:head>
  <title>Chord Game</title>
</svelte:head>

<div class="bg-gray-900 h-screen flex flex-col">
  <main class="flex-grow flex relative">
    <div class="absolute top-2 right-2 z-20 flex items-center space-x-2">
      {#if currentChord}
        <div class="flex items-center justify-center w-10 h-10 text-white bg-gray-800 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400">
          <span class="text-sm font-semibold">{currentChord}</span>
        </div>
      {/if}
      <SoundManager bind:this={soundManager} volume={$globalConfig.volume} on:notesChange={updateCurrentNotes} />
      <button
        on:click={toggleConfigPanel}
        class="text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-label="Toggle Configuration Panel"
      >
        {#if isConfigPanelOpen}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        {/if}
      </button>
    </div>

    <div class="flex-grow flex justify-center items-center" class:mr-[600px]={isConfigPanelOpen}>
      {#if browser && ChordGame}
        <svelte:component this={ChordGame} 
          {currentNotes}
          {soundManager}
          on:updateChord={updateCurrentChord}
          on:gameStatusChange={handleGameStatusChange}
        />
      {:else}
        <div class="text-center">
          <p class="text-4xl font-extrabold text-gray-200 sm:text-5xl sm:tracking-tight lg:text-6xl">Loading MIDI component...</p>
        </div>
      {/if}
    </div>

    {#if isConfigPanelOpen}
      <div class="absolute top-0 right-0 h-full w-[50vw] transition-transform duration-300 ease-in-out transform {isConfigPanelOpen ? 'translate-x-0' : 'translate-x-full'}">
        <ConfigPanel on:updateConfig={handleConfigUpdate} />
      </div>
    {/if}
  </main>

  {#if $globalConfig.debugMode}
    <div class="absolute bottom-2 left-2 text-white">
      <div>Current Notes: {currentNotes.size > 0 ? Array.from(currentNotes).join(', ') : 'None'}</div>
      <div>Current Chord: {currentChord || 'None'}</div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>

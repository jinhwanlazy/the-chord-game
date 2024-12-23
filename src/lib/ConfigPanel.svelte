<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { allChords, chordToString, chordTypeToString, chordTypeToNumber } from '$lib/chord';
  import { NoteSet, noteToString } from '$lib/note';
  import type { ChordType, Chord } from '$lib/chord';
  import { allChordTypes } from '$lib/chord';
  import type { Config } from '$lib/config';
  import { globalConfig } from '$lib/config';

  const dispatch = createEventDispatcher();

  let localConfig : Config;
  globalConfig.subscribe(value => {
    localConfig = value;
  });

  onMount(() => {
    updateChordSetMatrix();
  });

  // Config state
  let chordSetMatrix: boolean[][] = new Array(12).fill(0).map(() => 
      allChordTypes.map(() => false)
  );

  function updateChordSetMatrix() {
      chordSetMatrix = Array(12).fill(0).map(() => 
          allChordTypes.map(() => false)
      );
      for (const chordIndex of localConfig.chordSet) {
          const chord = allChords[chordIndex];

          chordSetMatrix[chord.rootNote][chordTypeToNumber(chord.chordType)] = true;
      }
  }

  function handleCheckboxChange() {
    updateConfig();
  }

  const gridSizes = ['4x4', '5x5', '6x6', '7x7', '8x8'];

  function updateConfig() {
    const selectedChordIndices = new Set<number>();
    allChords.forEach((chord, index) => {
      const selected = chordSetMatrix[chord.rootNote][chordTypeToNumber(chord.chordType)];
      if (selected && chord.rootNote === chord.bottomNote && chord.tensionNotes.size == 0) {
        selectedChordIndices.add(index);
      }
    });
    $globalConfig = localConfig;

    const newConfig = {
      ...localConfig,
      chordSet: selectedChordIndices,
    };
    console.log(selectedChordIndices);

    dispatch('updateConfig', newConfig);
  }
</script>

<div class="config-panel bg-gray-800 text-white p-4 overflow-y-auto h-full w-full">
  <h2 class="text-2xl font-bold mb-4">Configuration</h2>

  <div class="mb-4 overflow-x-auto">
    <h3 class="text-xl font-semibold mb-2">Chord Set</h3>
    <table class="chord-grid w-full">
      <thead>
        <tr>
          <th></th>
          {#each Array(12).fill(0).map((_, i) => i) as index}
            <th class="text-center">{noteToString(index, false, '#')}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each allChordTypes as chordType, chordTypeIndex}
          <tr>
            <td class="text-right pr-2">{chordTypeToString(chordType, false)}</td>
            {#each Array(12).fill(0).map((_, i) => i) as rootIndex}
              <td class="text-center p-0">
                <input
                  type="checkbox"
                  bind:checked={chordSetMatrix[rootIndex][chordTypeIndex]}
                  on:change={() => handleCheckboxChange()}
                  class="form-checkbox h-4 w-4 text-blue-600"
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="mb-4">
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={localConfig.allowInversions}
        on:change={updateConfig}
        class="form-checkbox h-4 w-4 text-blue-600"
      />
      <span class="ml-2">Allow Chord Inversions</span>
    </label>
  </div>

  <div class="mb-4">
    <label class="block">
      BPM:
      <input
        type="number"
        bind:value={localConfig.bpm}
        on:change={updateConfig}
        min="30"
        max="240"
        class="form-input mt-1 block w-full bg-gray-700 text-white"
      />
    </label>
  </div>

  <div class="mb-4">
    <fieldset>
      <legend class="block mb-2">Grid Size:</legend>
      {#each gridSizes as size}
        <label class="inline-flex items-center mr-4">
          <input
            type="radio"
            bind:group={localConfig.gridSize}
            value={size}
            on:change={updateConfig}
            class="form-radio text-blue-600"
          />
          <span class="ml-2">{size}</span>
        </label>
      {/each}
    </fieldset>
  </div>

  <div class="mb-4">
    <label class="block">
      Volume:
      <input
        type="range"
        bind:value={localConfig.volume}
        on:change={updateConfig}
        min="0"
        max="100"
        class="form-range w-full"
      />
    </label>
  </div>

  <div class="mb-4">
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={localConfig.debugMode}
        on:change={updateConfig}
        class="form-checkbox h-4 w-4 text-blue-600"
      />
      <span class="ml-2">Debug Mode</span>
    </label>
  </div>

  <div class="mt-8">
    <a
      href="https://github.com/yourusername/your-repo-name"
      target="_blank"
      rel="noopener noreferrer"
      class="text-blue-400 hover:text-blue-300"
    >
      View on GitHub
    </a>
  </div>
</div>

<style>
  .config-panel {
    width: 100%;
    max-width: 50vw;
  }

  .chord-grid {
    border-collapse: collapse;
  }

  .chord-grid th, .chord-grid td {
    padding: 0;
  }

  .chord-grid th {
    padding-bottom: 0.25rem;
  }

  .chord-grid td:first-child {
    padding-right: 0.5rem;
  }

  .chord-grid input[type="checkbox"] {
    margin: 0;
  }
</style>

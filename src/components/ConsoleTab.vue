<script setup lang="ts">
import { ref } from "vue";
import { isBusy, isConnected, runCommand } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const QUICK_COMMANDS = [
  "getvar all",
  "getvar product",
  "getvar current-slot",
  "getvar unlocked",
  "oem device-info",
  "flashing get_unlock_ability",
  "flashing unlock",
  "flashing lock"
];

const input = ref("");
const history: string[] = [];
let cursor = -1;

async function submit() {
  const command = input.value.trim();
  if (!command) return;
  if (history[0] !== command) history.unshift(command);
  cursor = -1;
  input.value = "";
  await runCommand(command);
}

function browse(step: number) {
  const next = cursor + step;
  if (next < -1 || next >= history.length) return;
  cursor = next;
  input.value = cursor === -1 ? "" : history[cursor];
}
</script>

<template>
  <div class="stack">
    <form class="row" @submit.prevent="submit">
      <input
        v-model="input"
        class="input mono command"
        :placeholder="t('console.placeholder')"
        :aria-label="t('tabs.console')"
        :disabled="!isConnected"
        spellcheck="false"
        autocomplete="off"
        @keydown.up.prevent="browse(1)"
        @keydown.down.prevent="browse(-1)"
      />
      <button class="btn" type="submit" :disabled="!isConnected || isBusy || !input.trim()">
        <AppIcon name="terminal" />{{ t("console.run") }}
      </button>
    </form>
    <p class="hint">{{ t("console.hint") }}</p>
    <div class="row">
      <button
        v-for="command in QUICK_COMMANDS"
        :key="command"
        class="btn outlined small mono"
        :disabled="!isConnected || isBusy"
        @click="runCommand(command)"
      >
        {{ command }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.command {
  flex: 1;
  min-width: 200px;
}
</style>

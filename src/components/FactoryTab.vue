<script setup lang="ts">
import { ref } from "vue";
import { flashFactory, isBusy, isConnected } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";
import FilePicker from "./FilePicker.vue";

const file = ref<File | null>(null);
const wipe = ref(false);
const reboot = ref(true);
</script>

<template>
  <p class="hint">{{ t("factory.description") }}</p>
  <FilePicker v-model="file" accept=".zip" />

  <label class="check">
    <input v-model="wipe" type="checkbox" />
    <span>
      {{ t("factory.wipe") }}
      <span class="hint block">{{ t("factory.wipeHint") }}</span>
    </span>
  </label>
  <label class="check">
    <input v-model="reboot" type="checkbox" />
    <span>{{ t("factory.reboot") }}</span>
  </label>

  <div class="banner">
    <AppIcon name="warning" />
    <span>{{ t("factory.notice") }}</span>
  </div>

  <div class="row">
    <button
      class="btn"
      :class="{ danger: wipe }"
      :disabled="!isConnected || isBusy || !file"
      @click="file && flashFactory(file, { wipe, reboot })"
    >
      <AppIcon name="archive" />{{ t("factory.start") }}
    </button>
  </div>
</template>

<style scoped>
.block {
  display: block;
}
</style>

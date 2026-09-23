<script setup lang="ts">
import { ref, watch } from "vue";
import { pendingConfirm } from "@/app/confirm";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const dialog = ref<HTMLDialogElement | null>(null);

watch(pendingConfirm, (request) => {
  if (request) dialog.value?.showModal();
  else dialog.value?.close();
});

function answer(ok: boolean) {
  pendingConfirm.value?.resolve(ok);
}
</script>

<template>
  <dialog ref="dialog" class="dialog" @cancel.prevent="answer(false)">
    <div class="stack">
      <h2 class="row"><AppIcon name="warning" :size="24" />{{ t("confirm.title") }}</h2>
      <p>{{ pendingConfirm?.message }}</p>
      <p v-if="pendingConfirm?.detail" class="banner error">{{ pendingConfirm.detail }}</p>
      <div class="row actions">
        <button class="btn outlined" autofocus @click="answer(false)">{{ t("confirm.cancel") }}</button>
        <button class="btn danger" @click="answer(true)">{{ t("confirm.ok") }}</button>
      </div>
    </div>
  </dialog>
</template>

<style>
.dialog {
  width: min(460px, calc(100vw - 32px));
  padding: 24px;
  border: 0;
  border-radius: 28px;
  background: var(--surface-high);
  color: var(--on-surface);
}

.dialog::backdrop {
  background: var(--scrim);
}

.dialog h2 {
  gap: 10px;
}

.dialog p {
  margin: 0;
  overflow-wrap: anywhere;
}

.dialog .actions {
  justify-content: flex-end;
}
</style>

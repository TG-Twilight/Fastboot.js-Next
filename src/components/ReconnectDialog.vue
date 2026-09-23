<script setup lang="ts">
import { ref, watch } from "vue";
import { cancelTask, pickReconnectDevice, session } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const dialog = ref<HTMLDialogElement | null>(null);

watch(
  () => session.reconnectTarget,
  (target) => {
    if (target) dialog.value?.showModal();
    else dialog.value?.close();
  }
);
</script>

<template>
  <dialog ref="dialog" class="dialog" @cancel.prevent>
    <div class="stack">
      <h2 class="row"><AppIcon name="usb" :size="24" />{{ t("reconnect.title") }}</h2>
      <p v-if="session.reconnectTarget">
        {{ t("reconnect.body", { target: t(`device.reboot.${session.reconnectTarget}`) }) }}
      </p>
      <div class="row actions">
        <button class="btn outlined" @click="cancelTask">{{ t("reconnect.abort") }}</button>
        <button class="btn" @click="pickReconnectDevice">{{ t("reconnect.select") }}</button>
      </div>
    </div>
  </dialog>
</template>

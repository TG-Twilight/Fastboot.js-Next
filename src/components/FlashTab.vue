<script setup lang="ts">
import { ref } from "vue";
import { bootImage, erasePartition, flashPartition, isBusy, isConnected, partitions, session } from "@/app/session";
import type { SlotSelector } from "@/fastboot/device";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";
import FilePicker from "./FilePicker.vue";

const slots: SlotSelector[] = ["current", "other", "a", "b"];

const partition = ref("");
const slot = ref<SlotSelector>("current");
const flashFile = ref<File | null>(null);
const bootFile = ref<File | null>(null);
const erasePartitionName = ref("");
</script>

<template>
  <div class="stack sections">
    <datalist id="partitions">
      <option v-for="name in partitions" :key="name" :value="name" />
    </datalist>

    <section class="stack">
      <h3 class="row"><AppIcon name="flash" :size="18" />{{ t("flash.sectionFlash") }}</h3>
      <div class="row fields">
        <label class="field grow">
          <span>{{ t("flash.partition") }}</span>
          <input v-model="partition" class="input mono" list="partitions" placeholder="boot" spellcheck="false" />
        </label>
        <div v-if="session.summary?.slot" class="field">
          <span>{{ t("flash.slot") }}</span>
          <div class="segmented">
            <button v-for="s in slots" :key="s" :aria-pressed="slot === s" @click="slot = s">
              {{ t(`flash.slot.${s}`) }}
            </button>
          </div>
        </div>
      </div>
      <p v-if="session.summary?.slot" class="hint">{{ t("flash.partitionHint") }}</p>
      <FilePicker v-model="flashFile" accept=".img,.bin,.mbn,.elf" />
      <div class="row">
        <button
          class="btn"
          :disabled="!isConnected || isBusy || !partition.trim() || !flashFile"
          @click="flashFile && flashPartition(partition, slot, flashFile)"
        >
          <AppIcon name="flash" />{{ t("flash.flash") }}
        </button>
      </div>
    </section>

    <section class="stack">
      <h3>{{ t("flash.sectionBoot") }}</h3>
      <p class="hint">{{ t("flash.bootHint") }}</p>
      <FilePicker v-model="bootFile" accept=".img" />
      <div class="row">
        <button class="btn tonal" :disabled="!isConnected || isBusy || !bootFile" @click="bootFile && bootImage(bootFile)">
          {{ t("flash.boot") }}
        </button>
      </div>
    </section>

    <section class="stack">
      <h3>{{ t("flash.sectionErase") }}</h3>
      <div class="row">
        <input
          v-model="erasePartitionName"
          class="input mono grow"
          list="partitions"
          :aria-label="t('flash.partition')"
          placeholder="userdata"
          spellcheck="false"
        />
        <button
          class="btn danger"
          :disabled="!isConnected || isBusy || !erasePartitionName.trim()"
          @click="erasePartition(erasePartitionName, slot)"
        >
          <AppIcon name="delete" />{{ t("flash.erase") }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sections > section + section {
  padding-top: 20px;
  border-top: 1px solid var(--outline-variant);
}

.sections h3 {
  gap: 6px;
}

.fields {
  align-items: flex-end;
  gap: 12px;
}

.grow {
  flex: 1;
  min-width: 180px;
}
</style>

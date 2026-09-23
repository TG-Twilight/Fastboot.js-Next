<script setup lang="ts">
import { ref } from "vue";
import { bootImage, erasePartition, flashPartition, isBusy, isConnected, partitions, profile } from "@/app/session";
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
  <datalist id="partitions">
    <option v-for="name in partitions" :key="name" :value="name" />
  </datalist>

  <section class="section">
    <h3 class="section-title"><AppIcon name="flash" :size="18" />{{ t("flash.sectionFlash") }}</h3>
    <div class="row fields">
      <label class="field grow">
        <span>{{ t("flash.partition") }}</span>
        <input v-model="partition" class="input mono" list="partitions" placeholder="boot" spellcheck="false" />
      </label>
      <div v-if="profile?.layout.ab" class="field">
        <span>{{ t("flash.slot") }}</span>
        <div class="segmented">
          <button v-for="s in slots" :key="s" :aria-pressed="slot === s" @click="slot = s">
            {{ t(`flash.slot.${s}`) }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="profile?.layout.ab" class="hint">{{ t("flash.partitionHint") }}</p>
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

  <section class="section">
    <h3 class="section-title"><AppIcon name="power" :size="18" />{{ t("flash.sectionBoot") }}</h3>
    <p class="hint">{{ t("flash.bootHint") }}</p>
    <FilePicker v-model="bootFile" accept=".img" />
    <div class="row">
      <button class="btn tonal" :disabled="!isConnected || isBusy || !bootFile" @click="bootFile && bootImage(bootFile)">
        {{ t("flash.boot") }}
      </button>
    </div>
  </section>

  <section class="section">
    <h3 class="section-title"><AppIcon name="delete" :size="18" />{{ t("flash.sectionErase") }}</h3>
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
</template>

<style scoped>
.fields {
  align-items: flex-end;
  gap: var(--space-3);
}

.grow {
  flex: 1;
  min-width: 180px;
}
</style>

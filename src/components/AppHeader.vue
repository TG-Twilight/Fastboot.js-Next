<script setup lang="ts">
import { cycleTheme, themeMode } from "@/app/theme";
import { t, toggleLocale } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const REPOSITORY = "https://github.com/TG-Twilight/Fastboot.js-Next";
const logo = `${import.meta.env.BASE_URL}favicon.svg`;
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <img :src="logo" alt="" width="32" height="32" />
      <div>
        <h1>Fastboot.js Next</h1>
        <p class="hint">{{ t("app.tagline") }}</p>
      </div>
    </div>
    <nav class="row">
      <button class="icon-btn" :title="t(`header.theme.${themeMode}`)" :aria-label="t(`header.theme.${themeMode}`)" @click="cycleTheme">
        <AppIcon :name="themeMode" />
      </button>
      <button class="btn outlined small" @click="toggleLocale">
        <AppIcon name="translate" :size="18" />{{ t("header.language") }}
      </button>
      <a class="icon-btn" :href="REPOSITORY" target="_blank" rel="noopener" :title="t('header.source')" :aria-label="t('header.source')">
        <AppIcon name="github" />
      </a>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 500;
}
</style>

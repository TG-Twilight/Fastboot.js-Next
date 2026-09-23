import { t, type MessageKey } from "@/i18n";
import type { DeviceProfile } from "./deviceProfile";
import { formatBytes } from "./format";

export type Tone = "good" | "warn" | "bad";

export interface Fact {
  label: MessageKey;
  value: string;
  tone?: Tone;
}

export interface FactGroup {
  title: MessageKey;
  facts: Fact[];
}

export interface Notice {
  tone: "info" | "warn" | "bad";
  text: string;
}

const unknown = () => t("info.unknown");

export function modeFact(p: DeviceProfile): Fact {
  return { label: "info.mode", value: t(p.mode === "fastbootd" ? "info.mode.fastbootd" : "info.mode.bootloader") };
}

export function lockFact(p: DeviceProfile): Fact {
  if (p.unlocked === null) return { label: "info.bootloaderLock", value: unknown() };
  return p.unlocked
    ? { label: "info.bootloaderLock", value: t("info.unlocked"), tone: "good" }
    : { label: "info.bootloaderLock", value: t("info.locked"), tone: "warn" };
}

export function slotFact(p: DeviceProfile): Fact {
  return {
    label: "info.slot",
    value: p.slot ? t("info.slotValue", { slot: p.slot.toUpperCase() }) : p.layout.ab ? unknown() : t("info.aOnly")
  };
}

function layoutText(p: DeviceProfile): string {
  const base = t(p.layout.virtualAb ? "info.layout.virtualAb" : p.layout.ab ? "info.layout.ab" : "info.layout.aOnly");
  return p.layout.dynamic ? `${base} + ${t("info.layout.dynamic")}` : base;
}

function volts(millivolts: number): string {
  return `${(millivolts / 1000).toFixed(2)} V`;
}

/** Facts worth reading before flashing, grouped the way flashing tools present them. Unknowns are left out. */
export function factGroups(p: DeviceProfile, manufacturer: string | null): FactGroup[] {
  const optional = (label: MessageKey, value: string | null): Fact[] => (value ? [{ label, value }] : []);

  const battery: Fact[] =
    p.batteryVoltage === null
      ? []
      : [
          p.batteryOk === false
            ? { label: "info.battery", value: t("info.batteryLow", { voltage: volts(p.batteryVoltage) }), tone: "bad" }
            : { label: "info.battery", value: volts(p.batteryVoltage) }
        ];

  return [
    {
      title: "info.group.device",
      facts: [
        { label: "info.codename", value: p.codename ?? unknown() },
        ...optional("info.manufacturer", manufacturer),
        ...optional("info.platform", p.platform),
        ...optional("info.storage", p.storage),
        ...optional("info.hwRevision", p.hwRevision),
        ...optional("info.serial", p.serial)
      ]
    },
    {
      title: "info.group.status",
      facts: [
        modeFact(p),
        lockFact(p),
        ...(p.secureBoot === null
          ? []
          : [{ label: "info.secureBoot" as const, value: t(p.secureBoot ? "info.enabled" : "info.disabled") }]),
        slotFact(p),
        { label: "info.layout", value: layoutText(p) },
        ...battery
      ]
    },
    {
      title: "info.group.firmware",
      facts: [
        ...optional("info.bootloaderVersion", p.bootloaderVersion),
        ...optional("info.basebandVersion", p.basebandVersion),
        ...optional("info.androidVersion", p.androidVersion),
        ...optional("info.vndk", p.vndkVersion),
        ...(p.antiRollback === null ? [] : [{ label: "info.antiRollback" as const, value: String(p.antiRollback), tone: "warn" as const }]),
        ...optional("info.maxDownload", p.maxDownloadSize ? formatBytes(p.maxDownloadSize) : null)
      ]
    }
  ].filter((group) => group.facts.length > 0) as FactGroup[];
}

/** Things that should stop or at least slow down someone about to flash. */
export function notices(p: DeviceProfile): Notice[] {
  const list: Notice[] = [];
  if (p.batteryOk === false) list.push({ tone: "bad", text: t("notice.battery") });
  if (p.snapshotStatus && p.snapshotStatus !== "none") {
    list.push({ tone: "bad", text: t("notice.snapshot", { status: p.snapshotStatus }) });
  }
  if (p.unlocked === false) list.push({ tone: "warn", text: t("notice.locked") });
  if (p.antiRollback !== null) list.push({ tone: "warn", text: t("notice.anti", { anti: p.antiRollback }) });
  if (p.mode === "fastbootd") list.push({ tone: "info", text: t("notice.fastbootd") });
  return list;
}

/** Plain-text version of the facts, for pasting into a forum post or chat. */
export function factsToText(groups: FactGroup[]): string {
  return groups
    .map((group) => [`[${t(group.title)}]`, ...group.facts.map((fact) => `${t(fact.label)}: ${fact.value}`)].join("\n"))
    .join("\n\n");
}

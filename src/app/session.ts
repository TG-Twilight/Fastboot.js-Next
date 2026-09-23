import { computed, reactive } from "vue";
import type { FastbootDevice, RebootTarget, Slot, SlotSelector } from "@/fastboot/device";
import { FactoryRequirementError, FastbootAbortError, FastbootAdbModeError, FastbootUsbError } from "@/fastboot/errors";
import type { FactoryStep } from "@/fastboot/factory";
import { isWebUsbSupported } from "@/fastboot/transport";
import { openFastboot, requestUsbDevice, waitForUsbDevice } from "@/fastboot/usb";
import { t } from "@/i18n";
import { confirmAction } from "./confirm";
import { isDangerousCommand, normalizeCommand } from "./format";
import { log } from "./log";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface DeviceSummary {
  product: string;
  serial: string;
  mode: "bootloader" | "fastbootd";
  slot: string | null;
  slotCount: number;
  unlocked: boolean | null;
  bootloaderVersion: string | null;
  basebandVersion: string | null;
}

export interface TaskState {
  title: string;
  step: string | null;
  stepIndex: number | null;
  stepTotal: number | null;
  /** null while the duration is unknown. */
  progress: number | null;
  cancellable: boolean;
}

export const session = reactive({
  state: "disconnected" as ConnectionState,
  summary: null as DeviceSummary | null,
  variables: [] as [string, string][],
  task: null as TaskState | null,
  /** Set while a reboot needs the user to pick the device again. */
  reconnectTarget: null as RebootTarget | null
});

export const isBusy = computed(() => session.task !== null || session.state === "connecting");
export const isConnected = computed(() => session.state === "connected");

/** Partition names reported by the device, without slot suffixes. */
export const partitions = computed(() => {
  const names = new Set<string>();
  for (const [name] of session.variables) {
    const match = /^partition-size:(.+?)(_[ab])?$/.exec(name);
    if (match) names.add(match[1]);
  }
  return [...names].sort();
});

let device: FastbootDevice | null = null;
let usb: USBDevice | null = null;
let expectingDisconnect = false;
let abortController: AbortController | null = null;
let reconnectPrompt: { resolve: (device: USBDevice) => void; reject: (error: Error) => void } | null = null;

const FALLBACK_VARIABLES = [
  "product",
  "serialno",
  "version-bootloader",
  "version-baseband",
  "current-slot",
  "slot-count",
  "unlocked",
  "secure",
  "is-userspace",
  "max-download-size"
];

function requireDevice(): FastbootDevice {
  if (!device) throw new FastbootUsbError(t("errors.disconnected"));
  return device;
}

function resetSession(): void {
  device = null;
  usb = null;
  session.state = "disconnected";
  session.summary = null;
  session.variables = [];
}

function isUserCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

function reportError(error: unknown): void {
  if (isUserCancel(error) || error instanceof FastbootAbortError) {
    log("warn", t("errors.cancelled"));
  } else if (error instanceof FastbootAdbModeError) {
    log("error", t("errors.adbMode"));
  } else if (error instanceof FactoryRequirementError) {
    log("error", t("errors.requirement", {
      variable: error.variable,
      expected: error.expected.join(" | "),
      actual: error.actual ?? "?"
    }));
  } else {
    log("error", error instanceof Error ? error.message : String(error));
    if (error instanceof FastbootUsbError && error.message.startsWith("Unable to open")) {
      log("info", t("errors.openHint"));
    }
  }
}

async function runTask(title: string, task: (signal: AbortSignal) => Promise<void>, cancellable = false): Promise<boolean> {
  if (session.task) return false;
  const controller = new AbortController();
  abortController = controller;
  session.task = { title, step: null, stepIndex: null, stepTotal: null, progress: null, cancellable };
  log("command", title);
  try {
    await task(controller.signal);
    log("success", t("task.done", { task: title }));
    return true;
  } catch (error) {
    reportError(error);
    return false;
  } finally {
    session.task = null;
    abortController = null;
  }
}

function setProgress(fraction: number): void {
  if (session.task) session.task.progress = fraction;
}

export function cancelTask(): void {
  abortController?.abort();
}

async function attach(selected: USBDevice): Promise<void> {
  // A freshly re-enumerated device can refuse to open for a moment, notably on Windows.
  for (let attempt = 0; ; attempt++) {
    try {
      device = await openFastboot(selected);
      break;
    } catch (error) {
      if (attempt >= 4 || error instanceof FastbootAdbModeError) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  usb = selected;
  device.onMessage = (message) => log("device", message);
  session.state = "connected";
  log("info", `${selected.manufacturerName ?? ""} ${selected.productName ?? ""} (${selected.serialNumber ?? "?"})`.trim());
  await readVariables();
}

async function readVariables(): Promise<void> {
  const current = requireDevice();
  let variables = await current.getAllVariables();
  if (!variables || variables.size === 0) {
    variables = new Map();
    for (const name of FALLBACK_VARIABLES) {
      const value = await current.getOptionalVariable(name);
      if (value !== null) variables.set(name, value);
    }
  }
  session.variables = [...variables].sort(([a], [b]) => a.localeCompare(b));

  const flag = (value: string | undefined) => (value === "yes" ? true : value === "no" ? false : null);
  session.summary = {
    product: variables.get("product") ?? usb?.productName ?? "",
    serial: variables.get("serialno") ?? usb?.serialNumber ?? "",
    mode: variables.get("is-userspace") === "yes" ? "fastbootd" : "bootloader",
    slot: variables.get("current-slot")?.replace(/^_/, "") ?? null,
    slotCount: Number(variables.get("slot-count") ?? 0),
    unlocked: flag(variables.get("unlocked")),
    bootloaderVersion: variables.get("version-bootloader") ?? null,
    basebandVersion: variables.get("version-baseband") ?? null
  };
}

export async function connect(): Promise<void> {
  if (session.task) return;
  let selected: USBDevice;
  try {
    // Must be the first await: the picker needs the click's user activation.
    selected = await requestUsbDevice();
  } catch (error) {
    if (!isUserCancel(error)) reportError(error);
    return;
  }
  session.state = "connecting";
  await runTask(t("task.connect"), () => attach(selected));
  if (!device) resetSession();
}

export async function disconnect(): Promise<void> {
  const current = device;
  resetSession();
  await current?.close();
}

export function refresh(): Promise<boolean> {
  return runTask(t("task.refresh"), readVariables);
}

/** Reboots into a fastboot mode and waits for the device to come back. */
async function rebootAndReconnect(target: "bootloader" | "fastboot", signal: AbortSignal): Promise<void> {
  const current = requireDevice();
  const serial = usb?.serialNumber ?? undefined;
  session.state = "reconnecting";
  try {
    const waiting = waitForUsbDevice(serial, 45_000, signal);
    await current.reboot(target);
    await current.close().catch(() => {});
    device = null;
    const next = (await waiting) ?? (await askToReconnect(target, signal));
    await attach(next);
  } finally {
    if (!device) resetSession();
  }
}

function askToReconnect(target: RebootTarget, signal: AbortSignal): Promise<USBDevice> {
  return new Promise<USBDevice>((resolve, reject) => {
    if (signal.aborted) return reject(new FastbootAbortError());
    session.reconnectTarget = target;
    reconnectPrompt = { resolve, reject };
    signal.addEventListener("abort", () => reject(new FastbootAbortError()), { once: true });
  }).finally(() => {
    session.reconnectTarget = null;
    reconnectPrompt = null;
  });
}

/** Called from the reconnect dialog, inside the click handler. */
export async function pickReconnectDevice(): Promise<void> {
  try {
    const selected = await requestUsbDevice();
    reconnectPrompt?.resolve(selected);
  } catch (error) {
    if (!isUserCancel(error)) reconnectPrompt?.reject(error as Error);
  }
}

function targetLabel(target: RebootTarget): string {
  return t(`device.reboot.${target}`);
}

export async function reboot(target: RebootTarget): Promise<void> {
  await runTask(t("task.reboot", { target: targetLabel(target) }), async (signal) => {
    if (target === "bootloader" || target === "fastboot") {
      await rebootAndReconnect(target, signal);
    } else {
      expectingDisconnect = true;
      await requireDevice().reboot(target);
    }
  }, true);
}

export async function setActiveSlot(slot: Slot): Promise<void> {
  if (!(await confirmAction(t("confirm.setActive", { slot: slot.toUpperCase() })))) return;
  await runTask(t("task.setActive", { slot: slot.toUpperCase() }), async () => {
    await requireDevice().setActiveSlot(slot);
    await readVariables();
  });
}

export async function runCommand(input: string): Promise<void> {
  const command = normalizeCommand(input);
  if (!command) return;

  const rebootMatch = /^reboot(?:-(bootloader|fastboot|recovery))?$/.exec(command);
  if (rebootMatch) return reboot((rebootMatch[1] ?? "system") as RebootTarget);

  if (isDangerousCommand(command) && !(await confirmAction(t("confirm.command", { command })))) return;
  await runTask(t("task.command", { command }), async () => {
    const result = await requireDevice().command(command);
    log("success", result.value ? `OKAY ${result.value}` : "OKAY");
    if (isDangerousCommand(command)) await readVariables();
  });
}

/** Adds the slot suffix before asking for confirmation, so the dialog names the real partition. */
async function resolveTarget(partition: string, slot: SlotSelector): Promise<string | null> {
  if (session.task) return null;
  try {
    return await requireDevice().resolvePartition(partition.trim(), slot);
  } catch (error) {
    reportError(error);
    return null;
  }
}

export async function flashPartition(partition: string, slot: SlotSelector, file: File): Promise<void> {
  const target = await resolveTarget(partition, slot);
  if (!target || !(await confirmAction(t("confirm.flash", { file: file.name, partition: target })))) return;
  await runTask(t("task.flash", { partition: target }), async (signal) => {
    await requireDevice().flash(target, file, { signal, onProgress: setProgress });
  }, true);
}

export async function erasePartition(partition: string, slot: SlotSelector): Promise<void> {
  const target = await resolveTarget(partition, slot);
  if (!target || !(await confirmAction(t("confirm.erase", { partition: target })))) return;
  await runTask(t("task.erase", { partition: target }), () => requireDevice().erase(target));
}

export async function bootImage(file: File): Promise<void> {
  if (!(await confirmAction(t("confirm.boot", { file: file.name })))) return;
  await runTask(t("task.boot", { file: file.name }), async (signal) => {
    await requireDevice().boot(file, { signal, onProgress: setProgress });
    expectingDisconnect = true;
  }, true);
}

function describeStep(step: FactoryStep): string {
  const base = (file: string) => file.slice(file.lastIndexOf("/") + 1);
  switch (step.kind) {
    case "open":
      return t("factory.step.open");
    case "extract":
      return t("factory.step.extract", { file: base(step.file) });
    case "check":
      return t(step.scope === "product" ? "factory.step.check.product" : "factory.step.check.all");
    case "flash":
      return t("factory.step.flash", { partition: step.partition });
    case "reboot":
      return t("factory.step.reboot", { target: targetLabel(step.target) });
    case "update-super":
      return t("factory.step.update-super");
    case "erase":
      return t("factory.step.erase", { partition: step.partition });
  }
}

export async function flashFactory(file: File, options: { wipe: boolean; reboot: boolean }): Promise<void> {
  const detail = options.wipe ? t("confirm.factoryWipe") : undefined;
  if (!(await confirmAction(t("confirm.factory", { file: file.name }), detail))) return;

  await runTask(t("task.factory"), async (signal) => {
    // Loaded on demand: the ZIP library is most of the bundle.
    const { flashFactoryZip } = await import("@/fastboot/factory");
    await flashFactoryZip(
      file,
      {
        device: requireDevice,
        rebootInto: (target) => rebootAndReconnect(target, signal),
        onStep: (step, index, total) => {
          if (step.kind === "reboot" && step.target === "system") expectingDisconnect = true;
          const text = describeStep(step);
          if (session.task) Object.assign(session.task, { step: text, stepIndex: index + 1, stepTotal: total });
          log("info", text);
        },
        onProgress: setProgress,
        onLog: (message) => log("info", message)
      },
      { ...options, signal }
    );
  }, true);
}

if (isWebUsbSupported()) {
  navigator.usb.addEventListener("disconnect", (event) => {
    if (event.device !== usb) return;
    // rebootAndReconnect takes care of the device going away.
    if (session.state === "reconnecting") return;
    resetSession();
    if (expectingDisconnect) {
      log("info", t("device.state.disconnected"));
    } else {
      log("warn", t("errors.disconnected"));
    }
    expectingDisconnect = false;
  });
}

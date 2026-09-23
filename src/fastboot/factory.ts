import { BlobReader, BlobWriter, TextWriter, ZipReader, type FileEntry } from "@zip.js/zip.js";
import type { FastbootDevice, SlotSelector } from "./device";
import { FactoryRequirementError, FastbootImageError, throwIfAborted } from "./errors";

// Mirrors `fastboot update` / flash-all.sh from AOSP (system/core/fastboot/fastboot.cpp).

export type FactoryRebootTarget = "bootloader" | "fastboot";

export type FactoryStep =
  | { kind: "open" }
  | { kind: "extract"; file: string }
  | { kind: "check"; scope: "product" | "all" }
  | { kind: "flash"; partition: string; file: string }
  | { kind: "reboot"; target: FactoryRebootTarget | "system" }
  | { kind: "update-super" }
  | { kind: "erase"; partition: string };

export interface FactoryHost {
  /** The current connection. Changes after every reboot. */
  device(): FastbootDevice;
  /** Reboots into `target` and resolves once the device has reconnected. */
  rebootInto(target: FactoryRebootTarget): Promise<void>;
  onStep?(step: FactoryStep, index: number, total: number): void;
  /** Progress of the current step, in [0, 1]. */
  onProgress?(fraction: number): void;
  onLog?(message: string): void;
}

export interface FactoryOptions {
  /** Erase userdata and metadata, like `fastboot -w`. */
  wipe: boolean;
  /** Reboot into Android when done. */
  reboot: boolean;
  signal?: AbortSignal;
}

type Task =
  | { op: "check"; scope: "product" | "all" }
  | { op: "flash"; source: "outer" | "image"; file: string; partition: string; slot: SlotSelector }
  | { op: "reboot"; target: FactoryRebootTarget }
  | { op: "update-super" }
  | { op: "erase"; partition: string; optional: boolean };

class ZipArchive {
  private constructor(
    private readonly reader: ZipReader<Blob>,
    private readonly files: FileEntry[]
  ) {}

  static async open(blob: Blob): Promise<ZipArchive> {
    const reader = new ZipReader(new BlobReader(blob));
    try {
      const entries = await reader.getEntries();
      return new ZipArchive(reader, entries.filter((e): e is FileEntry => !e.directory));
    } catch (error) {
      await reader.close().catch(() => {});
      throw new FastbootImageError("The file is not a readable ZIP archive", { cause: error });
    }
  }

  /** Looks a file up by its base name, wherever it sits in the archive. */
  find(name: string | RegExp): FileEntry | undefined {
    return this.files.find((entry) => {
      const base = entry.filename.slice(entry.filename.lastIndexOf("/") + 1);
      return typeof name === "string" ? base === name : name.test(base);
    });
  }

  blob(entry: FileEntry, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<Blob> {
    return entry.getData(new BlobWriter(), {
      signal,
      onprogress: (done, total) => onProgress?.(total ? done / total : 0)
    });
  }

  async text(name: string): Promise<string | null> {
    const entry = this.find(name);
    return entry ? entry.getData(new TextWriter()) : null;
  }

  close(): Promise<void> {
    return this.reader.close();
  }
}

interface Requirement {
  variable: string;
  values: string[];
  /** Only applies when the device product matches. */
  product: string | null;
  reject: boolean;
}

/** Parses android-info.txt (`require board=foo|bar`, `require-for-product:x ...`, `reject ...`). */
export function parseAndroidInfo(text: string): Requirement[] {
  const requirements: Requirement[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const match = /^(require|reject|require-for-product:(\S+))\s+([^=\s]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    requirements.push({
      variable: match[3] === "board" ? "product" : match[3],
      values: match[4].split("|").map((v) => v.trim()).filter(Boolean),
      product: match[2] ?? null,
      reject: match[1] === "reject"
    });
  }
  return requirements;
}

function matches(actual: string, pattern: string): boolean {
  if (pattern.endsWith("*")) return actual.startsWith(pattern.slice(0, -1));
  return actual.toLowerCase() === pattern.toLowerCase();
}

async function checkRequirements(device: FastbootDevice, requirements: Requirement[], scope: "product" | "all", log: (m: string) => void) {
  const product = await device.getOptionalVariable("product");
  for (const requirement of requirements) {
    if (scope === "product" && requirement.variable !== "product") continue;
    if (requirement.product && (!product || !matches(product, requirement.product))) continue;

    if (requirement.variable === "partition-exists") {
      for (const partition of requirement.values) {
        const hasSlot = await device.getOptionalVariable(`has-slot:${partition}`);
        if (hasSlot !== "yes" && hasSlot !== "no") {
          throw new FactoryRequirementError(`partition ${partition}`, ["present"], null);
        }
      }
      continue;
    }

    const actual = await device.getOptionalVariable(requirement.variable);
    const ok = actual !== null && requirement.values.some((v) => matches(actual, v));
    if (ok === requirement.reject) {
      throw new FactoryRequirementError(requirement.variable, requirement.values, actual);
    }
    log(`${requirement.variable}: ${actual} ✓`);
  }
}

/** Parses fastboot-info.txt, the flashing script shipped with newer factory images. */
export function parseFastbootInfo(text: string, wipe: boolean): Task[] {
  const tasks: Task[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let words = raw.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words[0].startsWith("#")) continue;

    if (words[0] === "if-wipe") {
      if (!wipe) continue;
      words = words.slice(1);
    }
    const [command, ...args] = words;
    switch (command) {
      case "version":
        if (args[0] !== "1") throw new FastbootImageError(`Unsupported fastboot-info.txt version ${args[0]}`);
        break;
      case "flash": {
        const slotOther = args.includes("--slot-other");
        const [partition, file] = args.filter((a) => !a.startsWith("--"));
        if (!partition) throw new FastbootImageError(`Invalid fastboot-info.txt line: ${raw}`);
        tasks.push({
          op: "flash",
          source: "image",
          partition,
          file: file ?? `${partition}.img`,
          slot: slotOther ? "other" : "current"
        });
        break;
      }
      case "reboot":
        if (args[0] !== "bootloader" && args[0] !== "fastboot") {
          throw new FastbootImageError(`Unsupported reboot target in fastboot-info.txt: ${args[0] ?? "(none)"}`);
        }
        tasks.push({ op: "reboot", target: args[0] });
        break;
      case "update-super":
        tasks.push({ op: "update-super" });
        break;
      case "erase":
        tasks.push({ op: "erase", partition: args[0], optional: false });
        break;
      default:
        throw new FastbootImageError(`Unsupported fastboot-info.txt command: ${command}`);
    }
  }
  return tasks;
}

/** Physical images the bootloader needs, flashed before switching to fastbootd. */
const BOOT_CRITICAL_IMAGES: [partition: string, file: string][] = [
  ["boot", "boot.img"],
  ["init_boot", "init_boot.img"],
  ["dtbo", "dtbo.img"],
  ["dts", "dt.img"],
  ["pvmfw", "pvmfw.img"],
  ["recovery", "recovery.img"],
  ["vbmeta", "vbmeta.img"],
  ["vbmeta_system", "vbmeta_system.img"],
  ["vbmeta_vendor", "vbmeta_vendor.img"],
  ["vendor_boot", "vendor_boot.img"],
  ["vendor_kernel_boot", "vendor_kernel_boot.img"]
];

/** Images that usually live in the super partition on dynamic-partition devices. */
const OS_IMAGES: [partition: string, file: string, slot: SlotSelector][] = [
  ["boot", "boot_other.img", "other"],
  ["odm", "odm.img", "current"],
  ["odm_dlkm", "odm_dlkm.img", "current"],
  ["product", "product.img", "current"],
  ["system", "system.img", "current"],
  ["system_dlkm", "system_dlkm.img", "current"],
  ["system_ext", "system_ext.img", "current"],
  ["system", "system_other.img", "other"],
  ["vendor", "vendor.img", "current"],
  ["vendor_dlkm", "vendor_dlkm.img", "current"],
  ["vendor", "vendor_other.img", "other"]
];

/** The plan `fastboot update` derives from the images present in the archive. */
function legacyPlan(archive: ZipArchive, wipe: boolean): Task[] {
  const flash = ([partition, file, slot = "current"]: [string, string, SlotSelector?]): Task => ({
    op: "flash",
    source: "image",
    partition,
    file,
    slot
  });
  const tasks: Task[] = BOOT_CRITICAL_IMAGES.filter(([, file]) => archive.find(file)).map((image) => flash(image));
  if (archive.find("super_empty.img")) tasks.push({ op: "update-super" });
  tasks.push(...OS_IMAGES.filter(([, file]) => archive.find(file)).map((image) => flash(image)));
  if (wipe) {
    tasks.push({ op: "erase", partition: "userdata", optional: false });
    tasks.push({ op: "erase", partition: "metadata", optional: true });
  }
  return tasks;
}

/**
 * Flashes a factory image: either the outer archive Google ships (bootloader, radio and an
 * image-*.zip) or an image zip on its own (what `fastboot update` takes).
 */
export async function flashFactoryZip(file: Blob, host: FactoryHost, options: FactoryOptions): Promise<void> {
  const { signal } = options;
  const log = (message: string) => host.onLog?.(message);
  let index = 0;
  let total = 1;
  const step = (s: FactoryStep) => {
    host.onStep?.(s, index, total);
    host.onProgress?.(0);
  };

  step({ kind: "open" });
  const outer = await ZipArchive.open(file);
  let images: ZipArchive = outer;
  let requirements: Requirement[] = [];

  try {
    const outerTasks: Task[] = [];
    if (!outer.find("android-info.txt")) {
      const imageZip = outer.find(/^image-.*\.zip$/);
      if (!imageZip) {
        throw new FastbootImageError("No android-info.txt or image-*.zip found, this does not look like a factory image");
      }
      for (const [partition, pattern] of [
        ["bootloader", /^bootloader-.*\.img$/],
        ["radio", /^radio-.*\.img$/]
      ] as const) {
        const entry = outer.find(pattern);
        if (!entry) continue;
        outerTasks.push({ op: "flash", source: "outer", partition, file: entry.filename, slot: "current" });
        outerTasks.push({ op: "reboot", target: "bootloader" });
      }

      step({ kind: "extract", file: imageZip.filename });
      images = await ZipArchive.open(await outer.blob(imageZip, host.onProgress, signal));
    }

    const androidInfo = await images.text("android-info.txt");
    requirements = androidInfo ? parseAndroidInfo(androidInfo) : [];
    const fastbootInfo = await images.text("fastboot-info.txt");
    if (fastbootInfo) log("Using fastboot-info.txt");

    const plan: Task[] = [
      { op: "check", scope: "product" },
      ...outerTasks,
      { op: "check", scope: "all" },
      ...(fastbootInfo ? parseFastbootInfo(fastbootInfo, options.wipe) : legacyPlan(images, options.wipe))
    ];
    total = plan.length + (options.reboot ? 1 : 0);

    for (const task of plan) {
      throwIfAborted(signal);
      await runTask(task, task.op === "flash" && task.source === "outer" ? outer : images);
      index++;
    }

    if (options.reboot) {
      step({ kind: "reboot", target: "system" });
      await host.device().reboot("system");
    }
    host.onProgress?.(1);
  } finally {
    if (images !== outer) await images.close().catch(() => {});
    await outer.close().catch(() => {});
  }

  async function runTask(task: Task, archive: ZipArchive): Promise<void> {
    const device = host.device();
    switch (task.op) {
      case "check":
        step({ kind: "check", scope: task.scope });
        await checkRequirements(device, requirements, task.scope, log);
        return;

      case "reboot":
        step({ kind: "reboot", target: task.target });
        await host.rebootInto(task.target);
        return;

      case "erase":
        step({ kind: "erase", partition: task.partition });
        try {
          await device.erase(task.partition);
        } catch (error) {
          if (!task.optional) throw error;
          log(`Skipped erasing ${task.partition}: ${(error as Error).message}`);
        }
        return;

      case "update-super": {
        const entry = archive.find("super_empty.img");
        if (!entry) throw new FastbootImageError("super_empty.img is missing");
        if (!(await device.isUserspace())) {
          step({ kind: "reboot", target: "fastboot" });
          await host.rebootInto("fastboot");
        }
        step({ kind: "update-super" });
        const fastbootd = host.device();
        const superName = (await fastbootd.getOptionalVariable("super-partition-name")) ?? "super";
        await fastbootd.download(await archive.blob(entry, undefined, signal));
        await fastbootd.command(`update-super:${superName}${options.wipe ? ":wipe" : ""}`);
        return;
      }

      case "flash": {
        const entry = archive.find(task.file.slice(task.file.lastIndexOf("/") + 1));
        if (!entry) throw new FastbootImageError(`${task.file} is missing from the archive`);
        const partition = await device.resolvePartition(task.partition, task.slot);
        step({ kind: "extract", file: task.file });
        const image = await archive.blob(entry, host.onProgress, signal);

        step({ kind: "flash", partition, file: task.file });
        const progress = { onProgress: host.onProgress, signal };
        if ((await device.isUserspace()) && (await device.isLogical(partition))) {
          await device.flashLogical(partition, image, progress);
        } else {
          await device.flash(partition, image, progress);
        }
        return;
      }
    }
  }
}

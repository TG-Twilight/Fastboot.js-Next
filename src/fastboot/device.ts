import { FastbootCommandError, FastbootError, FastbootProtocolError, FastbootUsbError, throwIfAborted } from "./errors";
import { imageSize, splitImage } from "./sparse";
import type { Transport } from "./transport";

/** Fastboot caps a command at 4096 bytes (it was 64 before Android 8). */
const MAX_COMMAND_LENGTH = 4096;
/** Used when the device does not report max-download-size. */
const FALLBACK_MAX_DOWNLOAD_SIZE = 256 * 1024 * 1024;
const WRITE_CHUNK_SIZE = 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface CommandResult {
  /** Text after OKAY. For getvar this is the value. */
  value: string;
  /** INFO lines the device printed while handling the command. */
  info: string[];
}

export type Slot = "a" | "b";
export type SlotSelector = "current" | "other" | Slot;
export type RebootTarget = "system" | "bootloader" | "fastboot" | "recovery";

export interface ProgressOptions {
  /** Fraction in [0, 1]. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Variables whose name contains a partition, e.g. `partition-size:boot_a: 0x4000000`. */
const PARTITION_VARIABLES = /^(partition-size|partition-type|has-slot|is-logical|slot-successful|slot-unbootable|slot-retry-count):[^:]+/;

/** Parses one `getvar all` INFO line into a name/value pair. */
export function parseVariableLine(line: string): [string, string] | null {
  const prefix = PARTITION_VARIABLES.exec(line);
  const split = prefix ? prefix[0].length : line.indexOf(":");
  if (split <= 0 || line[split] !== ":") return null;
  return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
}

export class FastbootDevice {
  /** Called for each INFO / TEXT message the device prints. */
  onMessage: ((message: string) => void) | null = null;

  private queue: Promise<unknown> = Promise.resolve();
  private maxDownloadSize: number | null = null;

  constructor(readonly transport: Transport) {}

  /**
   * Fastboot is strictly request/response, so every public operation holds the device
   * exclusively until it has finished.
   */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async send(command: string): Promise<void> {
    const bytes = encoder.encode(command);
    if (bytes.byteLength > MAX_COMMAND_LENGTH) {
      throw new FastbootError(`Command is longer than ${MAX_COMMAND_LENGTH} bytes`);
    }
    await this.transport.write(bytes);
  }

  /** Reads packets until the device reports a final status. */
  private async receive(command: string): Promise<{ status: "OKAY" | "DATA"; value: string; info: string[] }> {
    const info: string[] = [];
    for (;;) {
      const packet = decoder.decode(await this.transport.read());
      const status = packet.slice(0, 4);
      const payload = packet.slice(4);
      switch (status) {
        case "INFO":
        case "TEXT":
          info.push(payload);
          this.onMessage?.(payload);
          break;
        case "OKAY":
        case "DATA":
          return { status, value: payload, info };
        case "FAIL":
          throw new FastbootCommandError(command, payload);
        default:
          throw new FastbootProtocolError(`Unexpected response to "${command}": ${JSON.stringify(packet)}`);
      }
    }
  }

  private async execute(command: string): Promise<CommandResult> {
    await this.send(command);
    const response = await this.receive(command);
    if (response.status !== "OKAY") {
      throw new FastbootProtocolError(`Unexpected DATA response to "${command}"`);
    }
    return { value: response.value, info: response.info };
  }

  /** Runs a raw fastboot command, e.g. `getvar:product` or `oem device-info`. */
  command(command: string): Promise<CommandResult> {
    return this.exclusive(() => this.execute(command));
  }

  async getVariable(name: string): Promise<string> {
    return (await this.command(`getvar:${name}`)).value;
  }

  /** Returns `getvar all`, or null when the bootloader does not implement it. */
  async getAllVariables(): Promise<Map<string, string> | null> {
    let result: CommandResult;
    try {
      result = await this.command("getvar:all");
    } catch (error) {
      if (error instanceof FastbootCommandError) return null;
      throw error;
    }
    const variables = new Map<string, string>();
    for (const line of result.info) {
      const entry = parseVariableLine(line);
      if (entry) variables.set(...entry);
    }
    return variables;
  }

  getMaxDownloadSize(): Promise<number> {
    return this.exclusive(() => this.maxDownloadSizeUnlocked());
  }

  /** Whether the device is running fastbootd (userspace) rather than the bootloader. */
  async isUserspace(): Promise<boolean> {
    return this.getOptionalVariable("is-userspace").then((value) => value === "yes");
  }

  async getCurrentSlot(): Promise<Slot | null> {
    const slot = (await this.getOptionalVariable("current-slot"))?.replace(/^_/, "");
    return slot === "a" || slot === "b" ? slot : null;
  }

  async hasSlot(partition: string): Promise<boolean> {
    return (await this.getOptionalVariable(`has-slot:${partition}`)) === "yes";
  }

  async isLogical(partition: string): Promise<boolean> {
    return (await this.getOptionalVariable(`is-logical:${partition}`)) === "yes";
  }

  /** getvar that returns null instead of throwing when the device rejects the variable. */
  async getOptionalVariable(name: string): Promise<string | null> {
    try {
      return await this.getVariable(name);
    } catch (error) {
      if (error instanceof FastbootCommandError) return null;
      throw error;
    }
  }

  /**
   * Appends the slot suffix the way the fastboot CLI does: only when the partition is slotted
   * and the name does not already carry a suffix.
   */
  async resolvePartition(partition: string, slot: SlotSelector = "current"): Promise<string> {
    if (/_[ab]$/.test(partition) || !(await this.hasSlot(partition))) return partition;
    const current = await this.getCurrentSlot();
    if (!current) return partition;
    const other: Slot = current === "a" ? "b" : "a";
    const suffix = slot === "current" ? current : slot === "other" ? other : slot;
    return `${partition}_${suffix}`;
  }

  /** Sends a payload with the `download` command. */
  download(data: Blob, options: ProgressOptions = {}): Promise<void> {
    return this.exclusive(() => this.downloadUnlocked(data, options));
  }

  private async downloadUnlocked(data: Blob, { onProgress, signal }: ProgressOptions): Promise<void> {
    throwIfAborted(signal);
    const size = data.size;
    const command = `download:${size.toString(16).padStart(8, "0")}`;
    await this.send(command);
    const response = await this.receive(command);
    if (response.status !== "DATA") {
      throw new FastbootProtocolError(`Device answered "${command}" without DATA`);
    }
    const accepted = parseInt(response.value, 16);
    if (accepted !== size) {
      throw new FastbootProtocolError(`Device accepted ${accepted} bytes, expected ${size}`);
    }

    onProgress?.(0);
    let offset = 0;
    // Read the next chunk from disk while the current one is on the wire.
    let next = size > 0 ? data.slice(0, WRITE_CHUNK_SIZE).arrayBuffer() : null;
    while (next) {
      const chunk = await next;
      const end = offset + chunk.byteLength;
      next = end < size ? data.slice(end, end + WRITE_CHUNK_SIZE).arrayBuffer() : null;
      // Aborting mid-transfer would leave the device waiting for data, so only stop between downloads.
      await this.transport.write(chunk);
      offset = end;
      onProgress?.(offset / size);
    }

    const done = await this.receive(command);
    if (done.status !== "OKAY") {
      throw new FastbootProtocolError(`Unexpected response after download: ${done.status}`);
    }
  }

  /**
   * Flashes an image to an exact partition name (see {@link resolvePartition}). Images larger
   * than max-download-size are split into sparse images.
   */
  flash(partition: string, image: Blob, options: ProgressOptions = {}): Promise<void> {
    return this.exclusive(async () => {
      const payloads = await splitImage(image, await this.maxDownloadSizeUnlocked());
      const total = payloads.reduce((sum, payload) => sum + payload.size, 0);
      let sent = 0;
      for (const payload of payloads) {
        throwIfAborted(options.signal);
        await this.downloadUnlocked(payload, {
          signal: options.signal,
          onProgress: (fraction) => options.onProgress?.((sent + fraction * payload.size) / total)
        });
        sent += payload.size;
        await this.execute(`flash:${partition}`);
      }
      options.onProgress?.(1);
    });
  }

  private async maxDownloadSizeUnlocked(): Promise<number> {
    if (this.maxDownloadSize !== null) return this.maxDownloadSize;
    let size = NaN;
    try {
      size = Number((await this.execute("getvar:max-download-size")).value);
    } catch (error) {
      if (!(error instanceof FastbootCommandError)) throw error;
    }
    this.maxDownloadSize = Number.isFinite(size) && size > 0 ? size : FALLBACK_MAX_DOWNLOAD_SIZE;
    return this.maxDownloadSize;
  }

  /** Resizes a logical partition to fit the image, then flashes it. Only valid in fastbootd. */
  async flashLogical(partition: string, image: Blob, options: ProgressOptions = {}): Promise<void> {
    await this.command(`resize-logical-partition:${partition}:${await imageSize(image)}`);
    await this.flash(partition, image, options);
  }

  /** Downloads a kernel/boot image and boots it without flashing. */
  boot(image: Blob, options: ProgressOptions = {}): Promise<void> {
    return this.exclusive(async () => {
      await this.downloadUnlocked(image, options);
      await this.execute("boot");
    });
  }

  async erase(partition: string): Promise<void> {
    await this.command(`erase:${partition}`);
  }

  async setActiveSlot(slot: Slot): Promise<void> {
    await this.command(`set_active:${slot}`);
  }

  async reboot(target: RebootTarget = "system"): Promise<void> {
    try {
      await this.command(target === "system" ? "reboot" : `reboot-${target}`);
    } catch (error) {
      // Some bootloaders drop off the bus before acknowledging.
      if (!(error instanceof FastbootUsbError)) throw error;
    }
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

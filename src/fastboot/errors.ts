/** Base class for every error raised by the fastboot layer. */
export class FastbootError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The device answered a command with FAIL. */
export class FastbootCommandError extends FastbootError {
  constructor(
    readonly command: string,
    readonly reason: string
  ) {
    super(`"${command}" failed: ${reason || "(no reason given)"}`);
  }
}

/** The device sent something that does not follow the fastboot protocol. */
export class FastbootProtocolError extends FastbootError {}

/** A USB level failure: opening, claiming or transferring. */
export class FastbootUsbError extends FastbootError {}

/** The selected device is running Android (ADB) instead of fastboot. */
export class FastbootAdbModeError extends FastbootUsbError {
  constructor() {
    super("The device is booted into Android (ADB mode), not fastboot. Reboot it into the bootloader first.");
  }
}

/** The image is malformed or cannot be flashed as requested. */
export class FastbootImageError extends FastbootError {}

/** A factory image's android-info.txt does not match the device. */
export class FactoryRequirementError extends FastbootError {
  constructor(
    readonly variable: string,
    readonly expected: string[],
    readonly actual: string | null
  ) {
    super(`Image requires ${variable}=${expected.join("|")}, device reports ${actual ?? "(unavailable)"}`);
  }
}

/** The operation was cancelled by the caller. */
export class FastbootAbortError extends FastbootError {
  constructor() {
    super("Operation cancelled");
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new FastbootAbortError();
}

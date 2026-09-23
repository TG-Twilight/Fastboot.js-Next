import { FastbootUsbError } from "./errors";

/** A bidirectional, packet oriented channel to a fastboot device. */
export interface Transport {
  write(data: Uint8Array | ArrayBuffer): Promise<void>;
  /** Reads a single response packet. */
  read(): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** USB interface triple that identifies fastboot (both bootloader and fastbootd). */
export const FASTBOOT_USB_FILTER: USBDeviceFilter = {
  classCode: 0xff,
  subclassCode: 0x42,
  protocolCode: 0x03
};

/** ADB uses the same class and subclass; a device matching it is booted into Android, not fastboot. */
export const ADB_USB_FILTER: USBDeviceFilter = {
  classCode: 0xff,
  subclassCode: 0x42,
  protocolCode: 0x01
};

function hasInterface(device: USBDevice, filter: USBDeviceFilter): boolean {
  return device.configurations.some((configuration) =>
    configuration.interfaces.some((iface) =>
      iface.alternates.some(
        (alternate) =>
          alternate.interfaceClass === filter.classCode &&
          alternate.interfaceSubclass === filter.subclassCode &&
          alternate.interfaceProtocol === filter.protocolCode
      )
    )
  );
}

export function isAdbDevice(device: USBDevice): boolean {
  return hasInterface(device, ADB_USB_FILTER);
}

interface FastbootInterface {
  configuration: USBConfiguration;
  iface: USBInterface;
  alternate: USBAlternateInterface;
  endpointIn: USBEndpoint;
  endpointOut: USBEndpoint;
}

function findFastbootInterface(device: USBDevice): FastbootInterface | null {
  for (const configuration of device.configurations) {
    for (const iface of configuration.interfaces) {
      for (const alternate of iface.alternates) {
        if (
          alternate.interfaceClass !== FASTBOOT_USB_FILTER.classCode ||
          alternate.interfaceSubclass !== FASTBOOT_USB_FILTER.subclassCode ||
          alternate.interfaceProtocol !== FASTBOOT_USB_FILTER.protocolCode
        ) {
          continue;
        }
        const bulk = alternate.endpoints.filter((e) => e.type === "bulk");
        const endpointIn = bulk.find((e) => e.direction === "in");
        const endpointOut = bulk.find((e) => e.direction === "out");
        if (endpointIn && endpointOut) {
          return { configuration, iface, alternate, endpointIn, endpointOut };
        }
      }
    }
  }
  return null;
}

export function isFastbootDevice(device: USBDevice): boolean {
  return findFastbootInterface(device) !== null;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export class WebUsbTransport implements Transport {
  private constructor(
    readonly device: USBDevice,
    private readonly interfaceNumber: number,
    private readonly endpointIn: number,
    private readonly endpointOut: number,
    /** Reads must be a multiple of the max packet size or the host may report babble. */
    private readonly readLength: number
  ) {}

  static async open(device: USBDevice): Promise<WebUsbTransport> {
    const target = findFastbootInterface(device);
    if (!target) {
      throw new FastbootUsbError("The selected USB device does not expose a fastboot interface");
    }

    try {
      if (!device.opened) await device.open();
      if (device.configuration?.configurationValue !== target.configuration.configurationValue) {
        await device.selectConfiguration(target.configuration.configurationValue);
      }
      await device.claimInterface(target.iface.interfaceNumber);
      if (target.alternate.alternateSetting !== 0) {
        await device.selectAlternateInterface(target.iface.interfaceNumber, target.alternate.alternateSetting);
      }
    } catch (error) {
      await device.close().catch(() => {});
      throw new FastbootUsbError(`Unable to open the fastboot interface: ${describe(error)}`, { cause: error });
    }

    return new WebUsbTransport(
      device,
      target.iface.interfaceNumber,
      target.endpointIn.endpointNumber,
      target.endpointOut.endpointNumber,
      Math.max(512, target.endpointIn.packetSize)
    );
  }

  async write(data: Uint8Array | ArrayBuffer): Promise<void> {
    const expected = data.byteLength;
    let result: USBOutTransferResult;
    try {
      result = await this.device.transferOut(this.endpointOut, data as BufferSource);
    } catch (error) {
      throw new FastbootUsbError(`USB write failed: ${describe(error)}`, { cause: error });
    }
    if (result.status !== "ok" || result.bytesWritten !== expected) {
      if (result.status === "stall") await this.device.clearHalt("out", this.endpointOut).catch(() => {});
      throw new FastbootUsbError(`USB write failed: status=${result.status}, wrote ${result.bytesWritten}/${expected} bytes`);
    }
  }

  async read(): Promise<Uint8Array> {
    let result: USBInTransferResult;
    try {
      result = await this.device.transferIn(this.endpointIn, this.readLength);
    } catch (error) {
      throw new FastbootUsbError(`USB read failed: ${describe(error)}`, { cause: error });
    }
    if (result.status !== "ok" || !result.data) {
      if (result.status === "stall") await this.device.clearHalt("in", this.endpointIn).catch(() => {});
      throw new FastbootUsbError(`USB read failed: status=${result.status}`);
    }
    const { buffer, byteOffset, byteLength } = result.data;
    return new Uint8Array(buffer, byteOffset, byteLength);
  }

  async close(): Promise<void> {
    if (!this.device.opened) return;
    await this.device.releaseInterface(this.interfaceNumber).catch(() => {});
    await this.device.close().catch(() => {});
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

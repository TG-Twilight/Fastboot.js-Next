import { describe, expect, it } from "vitest";
import { FastbootAdbModeError, isAdbDevice, isFastbootDevice, openFastboot } from "../src/fastboot";

/** Just enough of a USBDevice to describe its interfaces. */
function usbDevice(protocolCode: number): USBDevice {
  const alternate = {
    alternateSetting: 0,
    interfaceClass: 0xff,
    interfaceSubclass: 0x42,
    interfaceProtocol: protocolCode,
    endpoints: [
      { endpointNumber: 1, direction: "in", type: "bulk", packetSize: 512 },
      { endpointNumber: 1, direction: "out", type: "bulk", packetSize: 512 }
    ]
  };
  const iface = { interfaceNumber: 0, alternate, alternates: [alternate], claimed: false };
  return { configurations: [{ configurationValue: 1, interfaces: [iface] }] } as unknown as USBDevice;
}

describe("USB device detection", () => {
  it("tells ADB and fastboot interfaces apart", () => {
    expect(isFastbootDevice(usbDevice(0x03))).toBe(true);
    expect(isAdbDevice(usbDevice(0x03))).toBe(false);
    expect(isAdbDevice(usbDevice(0x01))).toBe(true);
    expect(isFastbootDevice(usbDevice(0x01))).toBe(false);
  });

  it("explains that a device in Android must be rebooted", async () => {
    await expect(openFastboot(usbDevice(0x01))).rejects.toThrow(FastbootAdbModeError);
  });
});

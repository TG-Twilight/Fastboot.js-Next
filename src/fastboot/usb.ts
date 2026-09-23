import { FastbootDevice } from "./device";
import { FastbootAdbModeError } from "./errors";
import { ADB_USB_FILTER, FASTBOOT_USB_FILTER, WebUsbTransport, isAdbDevice, isFastbootDevice } from "./transport";

/**
 * Shows the browser's device picker. Needs a user gesture. ADB devices are listed too, so that
 * a phone still booted into Android shows up and can be told to reboot instead of silently
 * missing from the list.
 */
export function requestUsbDevice(): Promise<USBDevice> {
  return navigator.usb.requestDevice({ filters: [FASTBOOT_USB_FILTER, ADB_USB_FILTER] });
}

export async function openFastboot(usb: USBDevice): Promise<FastbootDevice> {
  if (!isFastbootDevice(usb) && isAdbDevice(usb)) throw new FastbootAdbModeError();
  return new FastbootDevice(await WebUsbTransport.open(usb));
}

/**
 * Waits for a device with the given serial to come back after a reboot. Only devices the page
 * already has permission for are reported, so this resolves null when, for example, fastbootd
 * enumerates with a different product ID and the user has to pick it again.
 */
export function waitForUsbDevice(serial: string | undefined, timeoutMs: number, signal?: AbortSignal): Promise<USBDevice | null> {
  return new Promise((resolve) => {
    const finish = (device: USBDevice | null) => {
      clearTimeout(timer);
      navigator.usb.removeEventListener("connect", onConnect);
      signal?.removeEventListener("abort", onAbort);
      resolve(device);
    };
    const onConnect = (event: USBConnectionEvent) => {
      const device = event.device;
      if (isFastbootDevice(device) && (!serial || device.serialNumber === serial)) finish(device);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.usb.addEventListener("connect", onConnect);
    signal?.addEventListener("abort", onAbort);
  });
}

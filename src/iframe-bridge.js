// @ts-check

import { isGameEvent, isIframeMessage, isSafeIframePayload } from "@aerobeat/web-contracts";

const MAX_BRIDGE_BYTES = 64 * 1024;

/** @typedef {{parentWindow:Window,instanceId:string,expectedOrigin:string,onConnect?:()=>void,onCommand:(command:import("@aerobeat/web-contracts").AeroGameCommand)=>void,onError?:(error:unknown)=>void}} IframeBridgeOptions */

/** Strict immediate-parent protocol adapter owned by one connected game. */
export function createAeroGameIframeBridge(options) {
  const { parentWindow, instanceId, expectedOrigin, onCommand } = options;
  if (!expectedOrigin || expectedOrigin === "*" || new URL(expectedOrigin).origin !== expectedOrigin) throw new TypeError("Iframe bridge requires one exact parent origin");
  let connected = false;
  let destroyed = false;
  let sequence = 0;
  const seenMessageIds = new Set(); const seenCommandIds = new Set();

  const onMessage = (event) => {
    if (destroyed || event.source !== parentWindow || event.origin !== expectedOrigin || !isAeroGameIframeValueWithinLimits(event.data) || !isIframeMessage(event.data) || event.data.instanceId !== instanceId) return;
    const message = event.data;
    if (message.kind === "handshake_request") {
      const firstConnection = !connected; connected = true; if (firstConnection) { seenMessageIds.clear(); seenCommandIds.clear(); }
      post("handshake_ack", { protocolVersion: 1, accepted: true }, message.messageId);
      if (firstConnection) { try { options.onConnect?.(); } catch (error) { report(error); } }
      return;
    }
    if (!connected) return;
    if (message.kind === "command" && message.payload && "command" in message.payload) {
      const command = message.payload.command;
      if (seenMessageIds.has(message.messageId) || seenCommandIds.has(command.commandId) || seenMessageIds.size >= 256 || seenCommandIds.size >= 256) return;
      seenMessageIds.add(message.messageId); seenCommandIds.add(command.commandId);
      try { onCommand(command); } catch (error) { report(error); }
    } else if (message.kind === "disconnect") {
      connected = false;
    }
  };
  globalThis.addEventListener("message", onMessage);

  function report(error) { try { options.onError?.(error); } catch { /* diagnostics are isolated */ } }
  /** @param {string} kind @param {Readonly<Record<string,unknown>>|null} payload @param {string} [messageId] */
  function post(kind, payload, messageId = `child-${++sequence}`) {
    if (destroyed || !isAeroGameIframeValueWithinLimits(payload) || !isSafeIframePayload(payload)) return false;
    const message = Object.freeze({ schema: "aerobeat/iframe_message", version: 1, kind, messageId, instanceId, payload });
    if (!isIframeMessage(message) || !isAeroGameIframeValueWithinLimits(message)) return false;
    parentWindow.postMessage(message, expectedOrigin);
    return true;
  }

  return Object.freeze({
    getSnapshot() { return Object.freeze({ schema: "aerobeat/iframe_bridge_snapshot", version: 1, framed: true, connected, parentOrigin: expectedOrigin }); },
    sendEvent(event) {
      if (!connected || !isGameEvent(event)) return false;
      return post("event", Object.freeze({ event }));
    },
    destroy() {
      if (destroyed) return;
      if (connected) post("disconnect", Object.freeze({ reason: "child_destroyed" }));
      destroyed = true; connected = false; globalThis.removeEventListener("message", onMessage);
    }
  });
}

/** Descriptor-safe 64 KiB/depth/item/string preflight for either bridge direction. @param {unknown} value */
export function isAeroGameIframeValueWithinLimits(value) { return withinBridgeLimits(value) && encodedSize(value) <= MAX_BRIDGE_BYTES; }

/** Descriptor-safe preflight prevents hostile depth/item work before contract validation. @param {unknown} value */
function withinBridgeLimits(value) {
  let items = 0;
  const seen = new Set();
  const visit = (entry, depth) => {
    items += 1; if (items > 2048 || depth > 12) return false;
    if (entry === null || typeof entry === "boolean") return true;
    if (typeof entry === "string") return entry.length <= 8192;
    if (typeof entry === "number") return Number.isFinite(entry);
    if (!entry || typeof entry !== "object" || seen.has(entry)) return false;
    const prototype = Object.getPrototypeOf(entry);
    if (Array.isArray(entry)) {
      if (prototype !== Array.prototype || entry.length > 256) return false;
      const keys = Reflect.ownKeys(entry); const expected = new Set(["length", ...Array.from({ length: entry.length }, (_, index) => String(index))]);
      if (keys.length !== expected.size || keys.some((key) => typeof key !== "string" || !expected.has(key))) return false;
      const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length"); if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== entry.length) return false;
      seen.add(entry);
      for (let index = 0; index < entry.length; index += 1) { const descriptor = Object.getOwnPropertyDescriptor(entry, String(index)); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !visit(descriptor.value, depth + 1)) { seen.delete(entry); return false; } }
      seen.delete(entry); return true;
    }
    if (prototype !== Object.prototype) return false;
    const keys = Reflect.ownKeys(entry); if (keys.length > 128 || keys.some((key) => typeof key !== "string" || key.length > 256)) return false;
    seen.add(entry);
    for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(entry, key); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !visit(descriptor.value, depth + 1)) { seen.delete(entry); return false; } }
    seen.delete(entry); return true;
  };
  return visit(value, 0);
}

/** @param {unknown} value */
function encodedSize(value) {
  try { return new TextEncoder().encode(JSON.stringify(cloneForEncoding(value))).byteLength; } catch { return Number.POSITIVE_INFINITY; }
}

/** The preflight has already rejected accessors/classes/cycles. @param {unknown} value @returns {unknown} */
function cloneForEncoding(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => cloneForEncoding(entry));
  const clone = Object.create(null);
  for (const key of Object.keys(value).sort(compareCodePoints)) clone[key] = cloneForEncoding(value[key]);
  return clone;
}
/** @param {string} left @param {string} right */
function compareCodePoints(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

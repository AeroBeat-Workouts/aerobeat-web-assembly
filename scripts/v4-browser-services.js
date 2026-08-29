// @ts-check

import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroWebContentAuthoringService, createMemoryPersistenceAdapter } from "@aerobeat/web-content-authoring";
import { createAeroBeatSaverVendorService } from "@aerobeat/web-vendor-beatsaver";

/**
 * Install actual vendor/authoring/content services around the production graph.
 * Fixture bytes stay browser-local and never enter snapshots or events.
 * @param {(options:Readonly<{instanceId:string}>)=>Readonly<Record<string,unknown>>} originalFactory Original assembly graph factory.
 * @returns {(options:Readonly<{instanceId:string}>)=>Readonly<Record<string,unknown>>} Fixture graph factory.
 */
export function actualV4GraphFactory(originalFactory) {
  return (options) => {
    const graph = originalFactory(options);
    graph.content.destroy(); graph.authoring.destroy();
    const persistence = createMemoryPersistenceAdapter({ quotaBytes: 64 * 1024 * 1024 });
    const authoring = createAeroWebContentAuthoringService({ persistence, now: () => 17 });
    const content = createAeroContentRuntime({ persistenceResolver: { loadPackage: (handle) => authoring.loadPackage(handle), readAsset: (handle, path) => authoring.readAsset(handle, path), exportPackage: (handle) => authoring.exportPackage(handle) } });
    const vendor = createAeroBeatSaverVendorService({ retryBaseMs: 1, fetch: async (input, init) => {
      init?.signal?.throwIfAborted(); const url = new URL(input.toString()); const state = globalThis.__v4AssemblyFixture;
      if (url.pathname === "/maps/id/V4GOLD") return Response.json(state.map);
      if (url.pathname.startsWith("/search/text/")) return Response.json({ docs: [state.map], info: { page: 0, perPage: 10, total: 1 } });
      if (url.href === "https://cdn.example.invalid/v4-golden.zip") return new Response(state.archive, { headers: { "content-length": String(state.archive.byteLength), "content-type": "application/zip" } });
      return new Response("not found", { status: 404 });
    } });
    return Object.freeze({ ...graph, vendor, authoring, content });
  };
}

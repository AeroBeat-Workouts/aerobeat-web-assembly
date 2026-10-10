// Separate development-only phone diagnostic config. Never used by build-release.
// The production Vite config enforces immutable release pins; keep that gate intact.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root=new URL("./",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("package.json",root),"utf8"));
const localPackages=Object.entries(manifest.dependencies).filter(([,spec])=>spec.startsWith("file:"));
const allowed=[fileURLToPath(root),...localPackages.map(([,spec])=>fileURLToPath(new URL(`${spec.slice(5)}/`,root)))];
// Vite follows linked package sources outside this package root. Explicit aliases keep
// nested UI/gameplay imports resolvable without weakening the production Vite config.
const aliases=localPackages.flatMap(([name,spec])=>{
  const source=fileURLToPath(new URL(`${spec.slice(5)}/src/`,root));
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/gu,"\\$&");
  return [{find:new RegExp(`^${escaped}/(.+)$`,"u"),replacement:`${source}$1.js`},{find:new RegExp(`^${escaped}$`,"u"),replacement:`${source}index.js`}];
});
export default {
  base:"/",
  resolve:{alias:aliases},
  optimizeDeps:{exclude:["@aerobeat/web-content-authoring","@aerobeat/web-contracts","@aerobeat/web-gameplay","@aerobeat/web-renderer","@aerobeat/web-ui"]},
  server:{host:"127.0.0.1",port:5174,strictPort:true,fs:{strict:true,allow:allowed}},
  build:{rollupOptions:{input:fileURLToPath(new URL("phone-performance.html",root))}}
};

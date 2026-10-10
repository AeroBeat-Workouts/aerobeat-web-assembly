// Standalone diagnostic build/preview config. Not used by the immutable release builder.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root=new URL("./",import.meta.url);
const revision=execFileSync("git",["-C",fileURLToPath(root),"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const manifest=JSON.parse(readFileSync(new URL("package.json",root),"utf8"));
const localPackages=Object.entries(manifest.dependencies).filter(([,spec])=>spec.startsWith("file:"));
const allowed=[fileURLToPath(root),...localPackages.map(([,spec])=>realpathSync(fileURLToPath(new URL(`${spec.slice(5)}/`,root))))];
// Linked packages have their own import roots. The explicit aliases are diagnostic
// only; the production configuration retains its strict dependency provenance.
const aliases=localPackages.flatMap(([name,spec])=>{
  const source=fileURLToPath(new URL(`${spec.slice(5)}/src/`,root));
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/gu,"\\$&");
  return [{find:new RegExp(`^${escaped}/(.+)$`,"u"),replacement:`${source}$1.js`},{find:new RegExp(`^${escaped}$`,"u"),replacement:`${source}index.js`}];
});

const modelPath=new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task",root);
const modelBytes=readFileSync(modelPath);
if(createHash("sha256").update(modelBytes).digest("hex")!=="59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a")throw new Error("Diagnostic MediaPipe model hash drifted");
const mediaRoot=new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/",root);
const mediaFiles=[
  ["assets/mediapipe/pose_landmarker_lite.task",modelBytes,"application/octet-stream"],
  ["assets/mediapipe/vision_bundle.js",readFileSync(new URL("vision_bundle.js",mediaRoot)),"text/javascript"],
  ...readdirSync(new URL("wasm/",mediaRoot)).map(name=>[`assets/mediapipe/wasm/${name}`,readFileSync(new URL(`wasm/${name}`,mediaRoot)),name.endsWith(".wasm")?"application/wasm":"text/javascript"])
];
const gameRoot=new URL("assets/gameplay/0.0.11/",root);
function walkAssets(directory,prefix=""){
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ? walkAssets(new URL(`${entry.name}/`,directory),`${prefix}${entry.name}/`)
    : [[`assets/gameplay/0.0.11/${prefix}${entry.name}`,readFileSync(new URL(entry.name,directory)),"application/octet-stream"]]);
}
const assets=[...mediaFiles,...walkAssets(gameRoot)];
export default {
  base:"/",
  define:{__AEROBEAT_PHONE_COMMIT__:JSON.stringify(revision)},
  resolve:{alias:aliases},
  optimizeDeps:{exclude:["@aerobeat/web-content-authoring","@aerobeat/web-contracts","@aerobeat/web-gameplay","@aerobeat/web-renderer","@aerobeat/web-ui"]},
  plugins:[{
    name:"phone-test-build-assets",apply:"build",
    buildStart(){for(const [fileName,bytes] of assets)this.emitFile({type:"asset",fileName,source:bytes});}
  },{
    name:"phone-test-dev-assets",apply:"serve",
    configureServer(server){server.middlewares.use((request,response,next)=>{
      const path=(request.url??"").split("?")[0];
      const asset=mediaFiles.find(([name])=>`/${name}`===path);
      if(!asset){next();return;}
      response.setHeader("Content-Type",asset[2]);response.setHeader("Cache-Control","no-store");response.end(asset[1]);
    });}
  }],
  server:{host:"127.0.0.1",port:5174,strictPort:true,allowedHosts:["derrick-legion-go-8apu1.tail613fcb.ts.net"],fs:{strict:true,allow:allowed}},
  preview:{host:"127.0.0.1",port:4174,strictPort:true,allowedHosts:["derrick-legion-go-8apu1.tail613fcb.ts.net"]},
  build:{assetsInlineLimit:0,rollupOptions:{input:fileURLToPath(new URL("phone-performance.html",root))}}
};

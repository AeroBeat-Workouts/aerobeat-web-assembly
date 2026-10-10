// @ts-check
// Non-release scored-Play visual oracle. Run against live production modules and
// exact pinned GLB bytes; never drive synthetic Visual Test feedback.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { gameplayAssets, gameplayAssetReleaseVersion } from "@aerobeat/web-renderer";
import { isExpectedPlaycanvasMeshWarning, isExpectedReadPixelsWarning } from "./readpixels-console-policy.js";

const root=fileURLToPath(new URL("../",import.meta.url));
const testRoot=process.env.AEROBEAT_PLAY_FEEDBACK_TEST_ROOT?.trim()||root;
const siblings=resolve(root,"..");
const packageVersion=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8")).version;
assert.match(packageVersion,/^\d+\.\d+\.\d+$/);
assert.equal(gameplayAssetReleaseVersion,"0.0.11");
assert.equal(gameplayAssets.length,9);
const assetBase=resolve(siblings,"aerobeat-web-renderer/assets/gameplay",gameplayAssetReleaseVersion);
const inventory=new Map(gameplayAssets.map(asset=>{
  const data=readFileSync(resolve(assetBase,asset.path));
  assert.equal(data.length,asset.bytes,`GLB byte length: ${asset.id}`);
  assert.equal(createHash("sha256").update(data).digest("hex"),asset.sha256,`GLB SHA-256: ${asset.id}`);
  return [`/assets/gameplay/${gameplayAssetReleaseVersion}/${asset.path}`,data];
}));
const assetPlugin={name:"qa-play-feedback-pinned-glbs",configureServer(server){server.middlewares.use((request,response,next)=>{
  const pathname=new URL(request.url??"/","http://127.0.0.1").pathname;
  if(!pathname.startsWith(`/assets/gameplay/${gameplayAssetReleaseVersion}/`))return next();
  const data=inventory.get(pathname);
  if(!data){response.writeHead(404).end();return;}
  response.writeHead(200,{"content-type":"model/gltf-binary","content-length":String(data.length),"cache-control":"no-store"}).end(data);
});}};
const vite=await createViteServer({root:testRoot,appType:"spa",configFile:false,logLevel:"error",plugins:[assetPlugin],
  resolve:{alias:[{find:/^@aerobeat\/web-ui$/,replacement:resolve(siblings,"aerobeat-web-ui/src/index.js")},{find:/^@aerobeat\/web-hash$/,replacement:resolve(siblings,"aerobeat-web-hash/src/index.js")}]},
  define:{__AEROBEAT_BUILD_STAMP__:JSON.stringify("play-feedback-local"),__AEROBEAT_CACHE_BUST__:JSON.stringify("play-feedback-local"),__AEROBEAT_PACKAGE_VERSION__:JSON.stringify(packageVersion)},
  server:{host:"127.0.0.1",port:0,hmr:false,fs:{allow:[siblings,testRoot]}}});
let browser;
try{
  await vite.listen();const url=vite.resolvedUrls?.local?.[0];assert.ok(url,"isolated Vite URL unavailable");
  browser=await chromium.launch();const evidence=[];
  for(const view of [{name:"phone_portrait",width:393,height:852,dpr:3},{name:"desktop_landscape",width:852,height:393,dpr:1}]){
    const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:view.dpr,isMobile:view.name==="phone_portrait",hasTouch:view.name==="phone_portrait"});
    const page=await context.newPage(),noise=[];
    page.on("console",message=>{const type=message.type(),text=message.text(),location=message.location();if(["warning","error"].includes(type)&&!isExpectedReadPixelsWarning(type,text,location.url,location.lineNumber,location.columnNumber,url)&&!isExpectedPlaycanvasMeshWarning(type,text))noise.push(`${type}:${text}`);});
    page.on("pageerror",error=>noise.push(`pageerror:${error.message}`));
    try{
      await page.goto(url,{waitUntil:"networkidle"});
      await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.renderer?.describe()?.gameplayAssets?.state==="ready",null,{timeout:30000});
      const proof=await page.evaluate(async ()=>{
        const element=document.querySelector("aero-game"),renderer=element?.graph?.renderer;
        if(!renderer)throw new Error("actual aero-game renderer unavailable");
        const {createSessionTargetIndex,projectSessionTargets}=await import("/src/session-render-projection.js");
        element.stopFrameLoop();renderer.setDebugCameraEnabled(false);renderer.setEnvironmentVisible(false);
        renderer.setBackgroundProjection({kind:"solid",colors:["#080D16"],angleDeg:180});
        const canvas=element.shadowRoot.querySelector("canvas");
        const sample=()=>{const out=new OffscreenCanvas(canvas.width,canvas.height),ctx=out.getContext("2d",{willReadFrequently:true});ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,out.width,out.height).data;};
        const summarize=(pixels,baseline)=>{
          let colored=0,gray=0,yellow=0,red=0,changed=0;
          for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],d=Math.abs(r-baseline[i])+Math.abs(g-baseline[i+1])+Math.abs(b-baseline[i+2]);if(d<35)continue;changed++;if(b>r+20&&b>g+6&&b>75)colored++;if(Math.abs(r-g)<13&&Math.abs(g-b)<17&&r>=25&&r<130)gray++;if(r>150&&g>105&&b<g*.65&&r>b*2)yellow++;if(r>115&&r>g*1.55&&r>b*1.35)red++;}
          return{colored,gray,yellow,red,changed};
        };
        const cases=[];
        for(const presentation of ["flow","boxing_collider"]){
          const beat=presentation==="flow"?{type:"note",hand:"left",placement:5,requiresDirection:false}:{type:"straight_left",hand:"left",spatialTarget:{targetCell:5,entryDirection:"up"}};
          const event={eventId:`play-feedback-${presentation}`,centerTimestampMs:5000,appearanceColor:"#2693FF",authoredBeat:beat},events=[event],index=createSessionTargetIndex(events,{normalSpawnLeadMs:2500,skyMode:"off",skyPreludeDurationMs:0});
          const empty={session:{purpose:"play",timelinePositionMs:0},judgements:[],selectedVariant:{modifierIds:[]}};
          const camera=renderer.cameraEntity?.camera;
          // Use the real assembly projection and renderer, not a fabricated
          // target or DOM text. All judgements below are scored Play records.
            const draw=(nowMs,judgements,scalePercent)=>{
              renderer.setVisualScales({noteScalePercent:scalePercent});
              const targets=projectSessionTargets(events,{...empty,session:{purpose:"play",timelinePositionMs:nowMs},judgements},nowMs,index,180,false,3);
              const frame={presentation,nowMs,targets,timingWindowBeforeMs:180,timingWindowAfterMs:180,showGameplayGrid:false,guidanceBandMode:"off",colliderSettings:{colliderVisible:false,colliderScale:1,colliderDepthForward:3,colliderDepthBackward:3}};
              renderer.renderGameplayFrameWithCursorsAndEquipment({...frame,targets:[]},[],null,[],null);const baseline=sample();
              const result=renderer.renderGameplayFrameWithCursorsAndEquipment(frame,[],null,[],null);
              if(result.status?.state==="error")throw new Error(`renderer failed: ${result.status.errorMessage}`);
              const pixels=sample(),icon=result.model.objects.find(object=>object.kind==="icon"&&object.targetId===event.eventId),feedback=result.model.objects.find(object=>object.kind==="feedback"&&object.targetId===event.eventId);
              const actualFeedback=renderer.feedbackPool.filter(entry=>entry.root.enabled).map(entry=>({text:entry.text,texture:entry.quad.findComponents("render")[0]?.meshInstances?.[0]?.material?.diffuseMap?.name??null}));
              const activeAssetEntities=icon?[...(renderer.assetPools.get(icon.assetId)??[])].filter(entity=>entity.enabled):[];
              const material=activeAssetEntities.flatMap(entity=>(renderer.assetMaterials.get(entity)??[]).map(record=>({name:record.name,r:record.meshInstance.material.diffuse.r,g:record.meshInstance.material.diffuse.g,b:record.meshInstance.material.diffuse.b})));
              const meshBounds=activeAssetEntities.flatMap(entity=>entity.findComponents("render").flatMap(component=>component.meshInstances.map(({aabb})=>({nearZ:aabb.center.z-aabb.halfExtents.z,farZ:aabb.center.z+aabb.halfExtents.z}))));
              const world=icon?.position,projected=world?camera.worldToScreen(world):null;
              return{nowMs,targets:targets.map(target=>({judgement:target.judgement,tier:target.tier})),icon:icon?{state:icon.state,z:icon.position.z,appearanceColor:icon.appearanceColor,assetId:icon.assetId}:null,feedback:feedback?.feedback?.text??null,drawnFeedback:actualFeedback,material,meshBounds,screen:projected?{x:projected.x,y:projected.y}:null,pixels:summarize(pixels,baseline),canvas:{width:canvas.width,height:canvas.height},renderDpr:renderer.devicePixelRatio,assetState:renderer.gameplayAssetLoader.describe().state};
            };
            for(const scalePercent of [100,200]){
              const pending540=draw(5540,[],scalePercent),pending999=draw(5999,[],scalePercent);
              const near=draw(5000,[{eventId:event.eventId,result:"miss",tier:"almost",diagnostics:["near_timing"],shadow:false,committedTimelinePositionMs:5000}],scalePercent);
              const miss=draw(6041,[{eventId:event.eventId,result:"miss",tier:"miss",shadow:false,committedTimelinePositionMs:6001}],scalePercent);
              const clearance={cameraZ:renderer.cameraEntity.getPosition().z,nearClip:camera.nearClip,centerZAtMiss:(6041-5000)*.006};
              cases.push({presentation,scalePercent,pending540,pending999,near,miss,clearance});
            }
        }
        return{cases,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},assetState:renderer.gameplayAssetLoader.describe().state};
      });
      assert.equal(proof.assetState,"ready");assert.deepEqual(proof.viewport,{width:view.width,height:view.height,dpr:view.dpr});
      for(const row of proof.cases){
        const key=`${view.name} ${row.presentation} ${row.scalePercent}%`;
        for(const [state,frame] of [["pending +540",row.pending540],["pending +999",row.pending999]]){
          assert.equal(frame.targets[0]?.judgement,"pending",`${key} ${state}: real scored Play remains pending`);
          assert.ok(frame.icon&&frame.icon.state!=="miss",`${key} ${state}: renderer must not cull or resolve pending target: ${JSON.stringify(frame)}`);
          assert.ok(frame.icon&&frame.icon.appearanceColor==="#2693FF",`${key} ${state}: authored blue cannot gray prematurely`);
          assert.equal(frame.feedback,null,`${key} ${state}: no premature Miss label`);
          assert.equal(frame.drawnFeedback.length,0,`${key} ${state}: no visible feedback glyph entity`);
          assert.ok(frame.meshBounds.length>0&&frame.material.length>0&&frame.material.some(part=>part.b>part.r+.05),`${key} ${state}: real GLB mesh and material remain blue: ${JSON.stringify(frame.material)}`);
          if(state==="pending +540")assert.ok(frame.pixels.colored>20,`${key} ${state}: actual framebuffer contains blue target pixels: ${JSON.stringify(frame.pixels)}`);
        }
        assert.equal(row.near.targets[0]?.tier,"almost",`${key}: real near_timing tier`);
        assert.equal(row.near.feedback,"Almost",`${key}: existing near target feedback`);
        assert.equal(row.near.icon?.appearanceColor,"#2693FF",`${key}: genuine near miss cannot gray its still-visible icon`);
        assert.ok(row.near.drawnFeedback.some(item=>item.text==="Almost"&&item.texture?.includes("almost")),`${key}: renderer actually submitted Almost texture`);
        assert.ok(row.near.pixels.yellow>15,`${key}: framebuffer actually contains yellow Almost glyph: ${JSON.stringify(row.near)}`);
        assert.equal(row.miss.targets[0]?.judgement,"miss",`${key}: genuine canonical-clearance Miss`);
        assert.equal(row.miss.feedback,"Miss",`${key}: full Miss label after clearance`);
        assert.equal(row.miss.icon?.appearanceColor,"#2a3038",`${key}: actual full Miss gray material authority`);
        assert.ok(row.miss.drawnFeedback.some(item=>item.text==="Miss"&&item.texture?.includes("miss")),`${key}: renderer actually submitted Miss texture`);
        assert.ok(row.clearance.cameraZ>=4.9&&row.clearance.cameraZ<=5.1&&row.miss.meshBounds.length>0&&row.miss.meshBounds.every(bounds=>bounds.nearZ>row.clearance.cameraZ+row.clearance.nearClip),`${key}: every real pinned GLB mesh must clear canonical camera before full Miss: ${JSON.stringify({clearance:row.clearance,bounds:row.miss.meshBounds})}`);
        assert.ok(row.miss.pixels.red>15,`${key}: framebuffer actually contains red Miss glyph: ${JSON.stringify(row.miss.pixels)}`);
        evidence.push({key,pending540:row.pending540.pixels,pending999:row.pending999.pixels,near:row.near.pixels,miss:row.miss.pixels,clearance:row.clearance});
      }
      assert.deepEqual(noise,[],`${view.name}: unexpected browser warnings/errors`);
    }finally{await context.close();}
  }
  console.log(`Scored Play renderer framebuffer oracle PASS: ${JSON.stringify(evidence)}`);
}finally{await browser?.close();await vite.close();}

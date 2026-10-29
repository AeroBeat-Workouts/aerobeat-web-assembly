// @ts-check
// Real shipped worker/persistence flow. Inputs are external archives, never committed audio:
// AEROBEAT_CACHE_VALID_ZIP: a valid map whose Expert difficulty is 3,874,764 bytes.
// AEROBEAT_CACHE_GAS_ZIP: exact BeatSaver b514 archive (unsupported custom walls are expected).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { loadSignedSnapshot,handlerForSnapshot } from "./serve-friend-game.js";

const validPath=process.env.AEROBEAT_CACHE_VALID_ZIP;
const gasPath=process.env.AEROBEAT_CACHE_GAS_ZIP;
assert(validPath&&gasPath,"Provide the valid large-entry archive and exact GAS GAS GAS archive");
let server,browser;
try {
  let base=process.env.AEROBEAT_CACHE_BASE;
  if(process.env.AEROBEAT_CACHE_SIGNED_DIR){
    const snapshot=loadSignedSnapshot(process.env.AEROBEAT_CACHE_SIGNED_DIR);
    assert.equal(snapshot.manifest.sourceManifest.packageVersion,"0.0.151");
    server=createServer(handlerForSnapshot(snapshot));
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    base=`http://127.0.0.1:${server.address().port}/`;
  }
  assert(base,"Provide AEROBEAT_CACHE_BASE or AEROBEAT_CACHE_SIGNED_DIR");
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const errors=[];let fileChoosers=0;
  page.on("pageerror",error=>errors.push(error.message));
  page.on("filechooser",()=>{fileChoosers+=1;});
  await page.goto(base,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>document.querySelector("aero-game")?.graph?.authoring?.getCapabilities?.().conversionWorker===true,null,{timeout:90000});
  assert.equal(await page.locator("meta[name='aerobeat-release-proof']").getAttribute("content"),"0.0.151");
  const before=await page.evaluate(async(base64)=>{
    const game=document.querySelector("aero-game");
    await game.importLocalZip(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))]));
    const collections=await game.graph.authoring.listCollections();
    const collection=collections[0];
    const stored=await game.graph.authoring.getCollectionStoredSource(collection.collectionId);
    return {id:collection.collectionId,createdAtMs:collection.createdAtMs,packages:collection.packages.length,collections:collections.length,expertBytes:stored.entries.find(entry=>entry.path.toLowerCase()==="expert.dat")?.bytes.byteLength};
  },readFileSync(validPath).toString("base64"));
  assert.equal(before.collections,1);assert.equal(before.packages,3);assert.equal(before.expertBytes,3874764);
  await page.evaluate(()=>{
    const walk=root=>{for(const el of root.querySelectorAll("*")){if(el.matches("button[data-intent='library-reimport']")){if(el.disabled)throw Error("Reimport is disabled");el.click();return true;}if(el.shadowRoot&&walk(el.shadowRoot))return true;}return false;};
    if(!walk(document))throw Error("Shipped Reimport button not found");
  });
  await page.waitForFunction(before=>document.querySelector("aero-game").graph.authoring.listCollections().then(entries=>entries.length===1&&entries[0].collectionId===before.id&&entries[0].createdAtMs!==before.createdAtMs),before,{timeout:120000,polling:250});
  const after=await page.evaluate(async(id)=>{
    const game=document.querySelector("aero-game");
    const collection=(await game.graph.authoring.listCollections())[0];
    const stored=await game.graph.authoring.getCollectionStoredSource(id);
    return {id:collection.collectionId,packages:collection.packages.length,expertBytes:stored.entries.find(entry=>entry.path.toLowerCase()==="expert.dat")?.bytes.byteLength};
  },before.id);
  assert.equal(after.id,before.id);assert.equal(after.packages,3);assert.equal(after.expertBytes,3874764);assert.equal(fileChoosers,0);
  const gas=await page.evaluate(async(base64)=>{
    const game=document.querySelector("aero-game");
    try{await game.importLocalZip(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))]));return {imported:true};}
    catch(error){return {imported:false,code:error.code,message:error.message,collections:(await game.graph.authoring.listCollections()).length};}
  },readFileSync(gasPath).toString("base64"));
  assert.equal(gas.imported,false);assert.equal(gas.code,"obstacle_type_unsupported");assert.match(gas.message,/v2 obstacle type/);assert.equal(gas.collections,1,"unsupported custom walls cannot partially persist a song");
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({before,after,fileChoosers,gas}));
  console.log("0.0.151 large-entry import and cached reimport passed; GAS custom-wall limitation retained explicitly");
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}

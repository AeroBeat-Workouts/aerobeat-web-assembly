// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createAeroBeatSaverVendorService } from '@aerobeat/web-vendor-beatsaver';
import { createPrivateBeatSaverFetch, requirePrivateBeatSaverUrl } from '../src/private-beatsaver-access.js';

const hash = 'a'.repeat(40);
const api = 'https://api.beatsaver.com/search/text/0?q=Linkin+Park&pageSize=20';
const zip = `https://r2cdn.beatsaver.com/${hash}.zip`;
const preview = `https://cfcdn.beatsaver.com/${hash}.mp3`;
for (const [url, kind] of [[api,'request'],['https://api.beatsaver.com/maps/latest','request'],['https://api.beatsaver.com/maps/id/1234','request'],['https://api.beatsaver.com/maps/hash/'+hash,'request'],[zip,'request'],[preview,'preview']]) {
  assert.equal(requirePrivateBeatSaverUrl(url,kind).href,url,`allowed ${kind}: ${url}`);
}
for (const [url,kind] of [
  ['https://evil.example/'+hash+'.zip','request'],['https://r2cdn.beatsaver.com.evil.example/'+hash+'.zip','request'],
  ['https://api.beatsaver.com/other','request'],['https://r2cdn.beatsaver.com/private/'+hash+'.zip','request'],
  [preview,'request'],[zip,'preview'],['https://evil.example/'+hash+'.mp3','preview'],
  ['https://cfcdn.beatsaver.com/other.mp3','preview'],['http://cfcdn.beatsaver.com/'+hash+'.mp3','preview'],
  ['https://user:password@cfcdn.beatsaver.com/'+hash+'.mp3','preview'],
  ['https://cfcdn.beatsaver.com:444/'+hash+'.mp3','preview']
]) assert.throws(()=>requirePrivateBeatSaverUrl(url,kind),/import it locally/u,`off-host/path ${kind} fails with local ZIP fallback`);

const calls=[];
const guardedFetch=createPrivateBeatSaverFetch(async (url,init)=>{
  calls.push({url:url.href,init});
  return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
});
const controller=new AbortController();
const vendor=createAeroBeatSaverVendorService({fetch:guardedFetch,maxRetries:0});
await vendor.searchMaps({text:'Linkin Park'}, {signal:controller.signal});
assert.equal(calls.length,1,'normal vendor search reaches guarded transport');
assert.match(calls[0].url,/^https:\/\/api\.beatsaver\.com\/search\/text\/0\?/u);
assert.equal(calls[0].init.credentials,'omit');
assert.equal(calls[0].init.referrerPolicy,'no-referrer');
assert.equal(calls[0].init.redirect,'error','browser must reject redirect before any off-host egress');
assert.equal(calls[0].init.signal.aborted,false,'AbortSignal survives wrapper and vendor transport');
await assert.rejects(()=>guardedFetch('https://evil.example/map.zip'),/import it locally/u);
assert.equal(calls.length,1,'off-host URL never reaches network');

const redirectCalls=[];
const redirectFetch=createPrivateBeatSaverFetch(async (url,init)=>{
  redirectCalls.push({url:url.href,redirect:init.redirect});
  if (init.redirect !== 'error') throw new Error('off-host redirect followed');
  throw new TypeError('fetch failed: redirect mode is error');
});
const redirectedVendor=createAeroBeatSaverVendorService({fetch:redirectFetch,maxRetries:0});
await assert.rejects(()=>redirectedVendor.searchMaps({text:'redirect'}),/redirect mode is error/u);
await assert.rejects(()=>redirectFetch(zip,{redirect:'follow'}),/redirect mode is error/u);
assert.equal(redirectCalls.length,2,'search and ZIP enforce redirect:error');
assert(redirectCalls.every(call=>call.redirect==='error'));

// Execute actual service graph declarations with injected vendor constructor to
// verify the candidate define, not merely the standalone URL helper.
const source=readFileSync(new URL('../src/service-graph.js',import.meta.url),'utf8');
const declarations=source.replace(/^import .*;\n/gmu,'').replace(/^export \{ lockedProductionCvProfile \};\n/mu,'').replaceAll('export function ','function ');
function graph(flag){
  const vendorOptions=[];
  const constructors={
    createAeroWebContentAuthoringService:()=>({loadPackage(){},readAsset(){},exportPackage(){}}),
    createAeroContentRuntime:()=>({}),createAeroBeatSaverVendorService:options=>{vendorOptions.push(options);return {};},
    createPrivateBeatSaverFetch,createBrowserVideoMediaFacade:()=>({}),createAeroWebAudioService:()=>({}),
    createLockedProductionCvService:()=>({}),createLockedProductionPoseAdapter:()=>({}),
    createPrivateGameplayCvService:()=>({}),createAeroBodyGridService:()=>({}),
    createAeroPrototypeProfileRegistry:()=>({}),createAeroGameplaySessionCoordinator:()=>({}),
    createAeroPlayCanvasRenderer:()=>({}),lockedProductionCvProfile:{},globalThis:{fetch:async()=>new Response('{}'),location:{pathname:'/index.html',search:''}},URLSearchParams
  };
  const context=vm.createContext({...constructors,...(flag === undefined ? {} : {__AEROBEAT_PRIVATE_BEATSAVER_ACCESS__:flag})});
  vm.runInContext(`${declarations.replace(/function createLockedProductionPoseAdapter\(\) \{[\s\S]*?\n\}/u,'function createLockedProductionPoseAdapter() { return {}; }')}\ncreateAeroGameServiceGraph`,context)();
  return vendorOptions[0];
}
assert.equal(graph(undefined),undefined,'old default retains unmodified vendor construction');
assert.equal(graph(false),undefined,'old signed GPU candidate retains unmodified vendor construction');
assert.equal(typeof graph(true).fetch,'function','only new candidate constructs guarded fetch');

// Remote HTMLAudioElement has no fetch redirect:error switch; its source URL
// is checked before audio.src assignment, while CSP media-src constrains hops.
const indexSource=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
assert.match(indexSource,/if \(privateBeatSaverAccess\) url = requirePrivateBeatSaverUrl\(url, "preview"\);\s*await this\.startPreview\(url\.href/u);
console.log('private BeatSaver search/ZIP/preview allowlist, off-host and redirect guards, old default graph passed');

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readCurrentSourceIdentity, validateTargetAbccbaEvidence } from "./validate-target-abccba-evidence.mjs";

const root=process.cwd(),validator=resolve(root,"scripts/validate-target-abccba-evidence.mjs"),generator=readFileSync(resolve(root,"scripts/profile-camera-abccba.mjs"),"utf8"),source=JSON.parse(readFileSync(resolve(root,".plans/evidence/2026-09-09-pre-release-0.0.48-failed-swiftshader-headless-diagnostic-target-abccba.json"),"utf8")),temporary=mkdtempSync(resolve(tmpdir(),"aerobeat-target-backend-")),currentSourceIdentity=readCurrentSourceIdentity(root);
try{
  const baseline=structuredClone(source);for(const run of baseline.profileRuns)if(run.label.startsWith("staged-"))run.displayRateFps=60;
  baseline.sourceFingerprint=currentSourceIdentity.sourceFingerprint;baseline.sourceInputCount=currentSourceIdentity.sourceInputCount;
  baseline.graphicsBackend={schema:"aerobeat/webgl_backend",version:1,authority:"target-hardware",launchMode:"headed-x11",api:"webgl2",vendor:"NVIDIA Corporation",renderer:"ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080/PCIe/SSE2, OpenGL 4.5.0)",webglVersion:"WebGL 2.0 (OpenGL ES 3.0 Chromium)",backend:"hardware",debugIdentity:true};
  baseline.backendVerification={checks:25,driftDetected:false};
  validateDirect(baseline,"hardware baseline",true);
  validateSpawn(baseline,"hardware baseline CLI",true);
  validateDirect(source,"historical evidence missing provenance",false);

  const provenanceAdversaries=[
    ["missing fingerprint",evidence=>{delete evidence.sourceFingerprint;}],
    ["missing input count",evidence=>{delete evidence.sourceInputCount;}],
    ["malformed fingerprint",evidence=>{evidence.sourceFingerprint="a".repeat(63);}],
    ["uppercase fingerprint",evidence=>{evidence.sourceFingerprint=currentSourceIdentity.sourceFingerprint.toUpperCase();}],
    ["mutated fingerprint",evidence=>{evidence.sourceFingerprint=`${currentSourceIdentity.sourceFingerprint[0]==="0"?"1":"0"}${currentSourceIdentity.sourceFingerprint.slice(1)}`;}],
    ["stale fingerprint",evidence=>{evidence.sourceFingerprint="0".repeat(64);}],
    ["wrong input count",evidence=>{evidence.sourceInputCount=currentSourceIdentity.sourceInputCount+1;}],
    ["unsafe input count",evidence=>{evidence.sourceInputCount=Number.MAX_SAFE_INTEGER+1;}],
    ["extra provenance",evidence=>{evidence.sourceCommit="0".repeat(40);}],
    ["own proto key",evidence=>{Object.defineProperty(evidence,"__proto__",{enumerable:true,value:{sourceFingerprint:currentSourceIdentity.sourceFingerprint}});}],
  ];
  for(const [label,mutate] of provenanceAdversaries){const evidence=structuredClone(baseline);mutate(evidence);validateDirect(evidence,label,false);}

  let hostileGetterCalls=0;
  const accessorFingerprint=structuredClone(baseline);Object.defineProperty(accessorFingerprint,"sourceFingerprint",{enumerable:true,get(){hostileGetterCalls+=1;return currentSourceIdentity.sourceFingerprint;}});validateDirect(accessorFingerprint,"accessor fingerprint",false);
  const getterLookalike=structuredClone(baseline);Object.defineProperty(getterLookalike,"SourceFingerprint",{enumerable:true,get(){hostileGetterCalls+=1;return currentSourceIdentity.sourceFingerprint;}});validateDirect(getterLookalike,"getter lookalike provenance",false);
  const nestedAccessor=structuredClone(baseline);Object.defineProperty(nestedAccessor.graphicsBackend,"renderer",{enumerable:true,get(){hostileGetterCalls+=1;return baseline.graphicsBackend.renderer;}});validateDirect(nestedAccessor,"nested accessor",false);
  const hostilePrototype={};Object.defineProperty(hostilePrototype,"sourceFingerprint",{enumerable:true,get(){hostileGetterCalls+=1;return currentSourceIdentity.sourceFingerprint;}});const inheritedData=structuredClone(baseline);delete inheritedData.sourceFingerprint;const inherited=Object.assign(Object.create(hostilePrototype),inheritedData);validateDirect(inherited,"inherited provenance",false);
  assert.equal(hostileGetterCalls,0,"hostile provenance and behavioral getters must never execute");

  const backendAdversaries=[
    ["swiftshader renderer",evidence=>{evidence.graphicsBackend.renderer="ANGLE (Google, Vulkan (SwiftShader Device), SwiftShader driver)";}],
    ["llvmpipe vendor",evidence=>{evidence.graphicsBackend.vendor="Mesa llvmpipe";}],
    ["software version",evidence=>{evidence.graphicsBackend.webglVersion="WebGL 2.0 Software Rasterizer";}],
    ["basic renderer",evidence=>{evidence.graphicsBackend.renderer="Microsoft Basic Renderer";}],
    ["software classification",evidence=>{evidence.graphicsBackend.backend="software";}],
    ["headless launch",evidence=>{evidence.graphicsBackend.launchMode="headless-software-diagnostic";}],
    ["diagnostic authority",evidence=>{evidence.graphicsBackend.authority="diagnostic-only";}],
    ["missing debug identity",evidence=>{delete evidence.graphicsBackend.debugIdentity;}],
    ["false debug identity",evidence=>{evidence.graphicsBackend.debugIdentity=false;}],
    ["backend check count drift",evidence=>{evidence.backendVerification.checks=24;}],
    ["backend drift flag",evidence=>{evidence.backendVerification.driftDetected=true;}],
    ["missing backend identity",evidence=>{delete evidence.graphicsBackend;}]
  ];
  for(const [label,mutate] of backendAdversaries){const evidence=structuredClone(baseline);mutate(evidence);validateSpawn(evidence,label,false);}

  const capture=generator.indexOf("sourceIdentity=readSourceIdentity(root)"),viteStart=generator.indexOf("createViteServer("),windowVerification=generator.indexOf("await globalThis.verifyAbccbaSourceIdentity()"),cleanup=generator.indexOf('[["page",page],["context",context],["browser",browser],["Vite",vite]]'),postCleanupVerification=generator.indexOf('assertSourceIdentityUnchanged(sourceIdentity,readSourceIdentity(root),"post-cleanup")'),mkdir=generator.indexOf("await mkdir("),write=generator.indexOf("await writeFile(");
  assert(capture>=0&&capture<viteStart,"generator captures source identity before Vite/browser/profile work");
  assert(windowVerification>viteStart,"generator verifies source identity after every profile window");
  assert(cleanup>windowVerification&&postCleanupVerification>cleanup,"generator verifies source identity after page/context/browser/Vite cleanup");
  assert(postCleanupVerification<mkdir&&mkdir<write,"generator writes only after unchanged post-cleanup verification");
  assert.equal((generator.match(/await globalThis\.verifyAbccbaSourceIdentity\(\)/gu)??[]).length,1,"the shared run path performs exactly one verification per each of twelve windows");
  console.log(`Target ABCCBA source/hardware adversaries passed: current=${currentSourceIdentity.sourceFingerprint}/${currentSourceIdentity.sourceInputCount}; baseline accepted; ${provenanceAdversaries.length+4} provenance/hostile and ${backendAdversaries.length} backend mutations rejected; generator ordering exact.`);
}finally{rmSync(temporary,{recursive:true,force:true});}

function validateDirect(evidence,label,accepted){let passed=true;try{validateTargetAbccbaEvidence(evidence,currentSourceIdentity);}catch{passed=false;}assert.equal(passed,accepted,`${label} direct validator disposition drifted`);}
function validateSpawn(evidence,label,accepted){const path=resolve(temporary,`${label.replaceAll(/[^a-z0-9]+/giu,"-")}.json`);writeFileSync(path,`${JSON.stringify(evidence)}\n`);let passed=true;try{execFileSync(process.execPath,[validator,path],{cwd:root,stdio:"pipe"});}catch{passed=false;}assert.equal(passed,accepted,`${label} CLI validator disposition drifted`);}

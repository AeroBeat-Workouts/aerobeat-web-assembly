import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root=process.cwd(),validator=resolve(root,"scripts/validate-target-abccba-evidence.mjs"),source=JSON.parse(readFileSync(resolve(root,".plans/evidence/2026-09-09-pre-release-0.0.48-failed-swiftshader-headless-diagnostic-target-abccba.json"),"utf8")),temporary=mkdtempSync(resolve(tmpdir(),"aerobeat-target-backend-"));
try{
  const baseline=structuredClone(source);for(const run of baseline.profileRuns)if(run.label.startsWith("staged-"))run.displayRateFps=60;
  baseline.graphicsBackend={schema:"aerobeat/webgl_backend",version:1,authority:"target-hardware",launchMode:"headed-x11",api:"webgl2",vendor:"NVIDIA Corporation",renderer:"ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080/PCIe/SSE2, OpenGL 4.5.0)",webglVersion:"WebGL 2.0 (OpenGL ES 3.0 Chromium)",backend:"hardware",debugIdentity:true};
  baseline.backendVerification={checks:25,driftDetected:false};
  validate(baseline,"hardware baseline",true);
  const adversaries=[
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
  for(const [label,mutate] of adversaries){const evidence=structuredClone(baseline);mutate(evidence);validate(evidence,label,false);}
  console.log(`Target ABCCBA hardware backend adversaries passed: baseline accepted; ${adversaries.length} software/headless/missing/drift mutations rejected.`);
}finally{rmSync(temporary,{recursive:true,force:true});}

function validate(evidence,label,accepted){const path=resolve(temporary,`${label.replaceAll(/[^a-z0-9]+/giu,"-")}.json`);writeFileSync(path,`${JSON.stringify(evidence)}\n`);let passed=true;try{execFileSync(process.execPath,[validator,path],{cwd:root,stdio:"pipe"});}catch{passed=false;}assert.equal(passed,accepted,`${label} validator disposition drifted`);}

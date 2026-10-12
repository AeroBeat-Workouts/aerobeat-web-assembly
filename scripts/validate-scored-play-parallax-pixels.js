// @ts-check
// Real scored Boxing Play, native Game Setup, measured nose, pinned GLB pixels.
// Run: node scripts/validate-scored-play-parallax-pixels.js
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const vite = await createViteServer({appType:'spa',configFile:'vite.config.js',logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
let browser, parent;
try {
  await vite.listen();
  const childUrl = vite.resolvedUrls?.local?.[0];
  assert.ok(childUrl, 'normal configured Vite child URL required');
  parent = createHttpServer((_request,response) => {
    response.setHeader('content-type','text/html; charset=utf-8');
    response.end(`<!doctype html><style>html,body{margin:0}iframe{display:block;width:390px;height:844px;border:0}</style><iframe id="game" allow="camera; fullscreen; autoplay; xr-spatial-tracking" src="${childUrl}"></iframe>`);
  });
  await new Promise(resolve => parent.listen(0,'127.0.0.1',resolve));
  const address = parent.address();
  assert.ok(address && typeof address !== 'string');
  browser = await chromium.launch({headless:true});
  const results = [];
  // Each stored setup has its own connected game: no same-element restart.
  for (const embedding of ['direct','cross-origin iframe']) {
    const measurements = {};
    for (const setting of [{name:'fresh'},{name:'legacy-off',on:false,x:.55,y:.55},{name:'legacy-custom',on:true,x:.8,y:.4}]) {
      const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
      try {
        const page = await context.newPage();
        await page.goto(embedding === 'direct' ? childUrl : `http://localhost:${address.port}/`,{waitUntil:'networkidle'});
        const target = embedding === 'direct' ? page.locator('aero-game') : page.frameLocator('#game').locator('aero-game');
        await target.waitFor();
        measurements[setting.name] = await target.evaluate(async (element,setting) => {
          const fail = message => { throw new Error(`${setting.name}: ${message}`); };
          const require = (condition,message) => { if (!condition) fail(message); };
          const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
          const {installScoredPlayHarness} = await import('/scripts/fixtures/scored-play-browser-harness.js');
          const event = {schema:'aerobeat/resolved_content_event',version:3,eventId:'parallax-guard',centerTimestampMs:6000,sourceEventIds:['parallax-author'],authoredBeat:{type:'guard',guardTarget:{leftCell:5,rightCell:6}}};
          const harness = await installScoredPlayHarness(element,{events:[event]});
          await harness.waitForAssets();
          await harness.selectChart();
          const {aeroGameSetupStorageKey,getGameSetupSnapshot,setGameSetupSnapshot,AeroGameSetupCoordinator}=await import('/src/game-setup-coordinator.js');
          const fixed = setup => setup.noseCameraParallaxEnabled===true && setup.noseCameraRangeXWorldUnits===1.1 && setup.noseCameraRangeYWorldUnits===1.1;
          require(fixed(getGameSetupSnapshot()),'fresh Game Setup must fix both camera axes on');
          require(!element.shadowRoot.querySelector('[data-game-setup-field="noseCameraParallaxEnabled"],[data-game-setup-field="noseCameraRangeYWorldUnits"]'),'retired camera controls still visible');
          require(element.shadowRoot.querySelector('[data-game-setup-field="noseMarkerVisible"]') instanceof HTMLInputElement,'independent nose marker control missing');
          if(setting.name!=='fresh'){
            const legacy={...getGameSetupSnapshot(),noseCameraParallaxEnabled:setting.on,noseCameraRangeXWorldUnits:setting.x,noseCameraRangeYWorldUnits:setting.y,noseMarkerVisible:false,guardSpacing:.75};
            localStorage.setItem(aeroGameSetupStorageKey,JSON.stringify(legacy));
            const migrated=new AeroGameSetupCoordinator({storageFactory:()=>localStorage,eventTarget:null});
            require(fixed(migrated.getSnapshot()) && migrated.getSnapshot().noseMarkerVisible===false && migrated.getSnapshot().guardSpacing===.75,'stored legacy camera migration lost unrelated fields');
            require(fixed(JSON.parse(localStorage.getItem(aeroGameSetupStorageKey))),'stored off/custom values were not migrated on disk');
            setGameSetupSnapshot(legacy);
            migrated.destroy();
            await element.lifecycleIntentTail;
          }
          // The fixture's generic field assertion does not understand the two
          // native spawn controls that commit into nested spawnDistanceOverride.
          for(const [name,value] of [['spawnDistanceOverrideEnabled',true],['spawnDistanceOverrideWorldUnits',20]]) {
            const input=element.shadowRoot.querySelector(`[data-game-setup-field='${name}']`);
            require(input instanceof HTMLInputElement,`native spawn control ${name} missing`);
            if(input.type==='checkbox'){if(input.checked!==value)input.click();}
            else {input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}
            await element.lifecycleIntentTail;
          }
          const setup=getGameSetupSnapshot(),stored=JSON.parse(localStorage.getItem(aeroGameSetupStorageKey));
          require(setup.spawnDistanceOverride.enabled && setup.spawnDistanceOverride.normalSpawnDistanceWorldUnits===20 && stored.spawnDistanceOverride.enabled && stored.spawnDistanceOverride.normalSpawnDistanceWorldUnits===20 && fixed(setup) && fixed(stored),'native setup did not persist fixed camera and other fields');
          await harness.startPlay();
          const locked = harness.element.activeSessionSetup;
          require(locked?.spawnDistanceOverride.enabled && locked.spawnDistanceOverride.normalSpawnDistanceWorldUnits === 20 && fixed(locked),'scored Play did not lock fixed camera and native setup');
          await harness.calibrate();
          const gloves = harness.assertGlovePixels();
          // Move the loaded audio device clock exactly once; every subsequent pose
          // retains 5000ms so the SAME production guard/world Z is compared.
          await harness.seekSong(5000);
          const renderer = harness.graph.renderer;
          const canvas = element.shadowRoot.querySelector("canvas[data-role='renderer']");
          require(canvas instanceof HTMLCanvasElement && canvas.width === 390 && canvas.height === 844,'phone renderer viewport differs');
          const readPixels = () => {
            const framebuffer = harness.capture();
            require(framebuffer.session.state === 'playing' && framebuffer.session.purpose === 'play','active scored Play required');
            return framebuffer.pixels;
          };
          const pose = (noseX,noseY) => {
            harness.feedPose({nose:{x:noseX,y:noseY}});
            const input = harness.graph.input.getSnapshot();
            require(input.latestEvidence?.provenance === 'measured' && !input.tracking.gameplayPaused,'fresh production measured input required');
            return input;
          };
          const sample = () => {
            // Production consumes this pose for rendererFrame; the three later
            // framebuffer captures/pixel scans are QA overhead, not pose age at use.
            const measuredBeforeFrame = harness.graph.input[Symbol.for('aerobeat.web-input.internal-measured-nose-parallax')]?.();
            const ageBeforeFrameMs = measuredBeforeFrame ? performance.now()-measuredBeforeFrame.measurementTimestampMs : null;
            const frame = element.rendererFrame();
            const guard = renderer.lastModel?.objects?.filter(object => object.kind === 'icon' && object.targetId === event.eventId && object.assetId === 'guard/outlined-shield-v1');
            require(guard?.length === 2 && frame.targets.some(target => target.id === event.eventId),'authored pinned guard not staged in scored Play');
            require(renderer.describe().gameplayAssets.state === 'ready','pinned GLB assets not loaded');
            const entity = renderer.assetPools.get('guard/outlined-shield-v1')?.find(candidate => candidate.enabled && Math.abs(candidate.getPosition().x - guard[0].position.x) < .01);
            require(entity && entity.enabled,'pinned guard GLB entity not visible');
            const world = entity.getPosition().clone();
            const withGuard = readPixels();
            // Pixel-only negative control: disable ONE exact GLB entity in the
            // already staged scene, repaint immediately, then restore. No new
            // model, gameplay input, transport advance or fake judgement.
            let withoutGuard;
            try { entity.enabled = false; withoutGuard = readPixels(); }
            finally { entity.enabled = true; renderer.manualTick(); }
            const restored=readPixels();
            let restorationDifference=0;
            for(let i=0;i<withGuard.length;i+=4)if(Math.abs(withGuard[i]-restored[i])+Math.abs(withGuard[i+1]-restored[i+1])+Math.abs(withGuard[i+2]-restored[i+2])>=36)restorationDifference++;
            require(restorationDifference<20,`guard GLB framebuffer not restored (${restorationDifference} pixels)`);
            let count = 0, sx = 0, sy = 0;
            for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
              const i = (y*canvas.width+x)*4;
              if (Math.abs(withGuard[i]-withoutGuard[i])+Math.abs(withGuard[i+1]-withoutGuard[i+1])+Math.abs(withGuard[i+2]-withoutGuard[i+2]) >= 36) { count++; sx+=x; sy+=y; }
            }
            require(count >= 100,`foreground anchored guard GLB mask has only ${count} changed pixels`);
            const input = harness.graph.input.getSnapshot();
            const measured = harness.graph.input[Symbol.for('aerobeat.web-input.internal-measured-nose-parallax')]?.();
            const gameplay = harness.graph.gameplay.getSnapshot();
            require(gameplay.session.state === 'playing' && gameplay.judgements.length === 0,'scored Play/judgements changed without a hit');
            return {pixels:count,x:sx/count,y:sy/count,world:[world.x,world.y,world.z],cameraX:renderer.cameraEntity.getPosition().x,cameraY:renderer.cameraEntity.getPosition().y,deflection:element.lastNoseCameraDeflection,measuredX:measured?.xDeflection ?? null,measuredY:measured?.yDeflection ?? null,ageMs:ageBeforeFrameMs,postCaptureAgeMs:measured ? performance.now()-measured.measurementTimestampMs : null,provenance:input.latestEvidence?.provenance,score:JSON.stringify(gameplay.scorePartitions),judgements:gameplay.judgements.length,session:gameplay.session.state,frameMs:frame.nowMs};
          };
          // Calibration's 15fps measured clock can initially lead wall time.
          // Catch up naturally before asking production's <=150ms freshness
          // gate to consume nose samples; never fabricate a future fresh pose.
          const initialLead=element.latestPoseTimestampMs-performance.now();
          if(initialLead>0)await delay(initialLead+20);
          // Both axes are rate-limited to 3 world units/sec; settle fresh measured
          // poses while keeping the same song frame and guard world position.
          const settle = async (noseX,noseY) => { for(let i=0;i<24;i++){pose(noseX,noseY);await delay(35);} pose(noseX,noseY);return sample(); };
          const standing = await settle(.5,.2);
          // The fixture supplies camera-preview X; production mirrors it into
          // athlete space. Moving preview nose left yields +athlete X travel.
          const horizontal = await settle(.2,.2);
          const squat = await settle(.2,.43);
          await delay(200);
          element.runDisplayFrame();
          const stale = sample();
          return {origin:location.origin,parentOrigin:document.referrer ? new URL(document.referrer).origin:null,locked:{on:locked.noseCameraParallaxEnabled,x:locked.noseCameraRangeXWorldUnits,y:locked.noseCameraRangeYWorldUnits,spawn:locked.spawnDistanceOverride.normalSpawnDistanceWorldUnits},gloves,standing,horizontal,squat,stale};
        },setting);
        const proof = measurements[setting.name];
        if (embedding !== 'direct') assert.notEqual(proof.origin,proof.parentOrigin,'iframe must be truly cross-origin');
        assert.equal(proof.locked.y,1.1);
        assert.equal(proof.locked.x,1.1);
        assert.equal(proof.locked.on,true);
        assert.equal(proof.locked.spawn,20);
        assert.ok(proof.gloves.changed >= 100,'real pinned glove pixels required');
        for (const name of ['standing','horizontal','squat']) {
          const row = proof[name];
          assert.equal(row.session,'playing');
          assert.equal(row.judgements,0);
          assert.equal(row.provenance,'measured');
          assert.ok(row.pixels >= 100 && Number.isFinite(row.y));
          assert.ok(row.ageMs >= 0 && row.ageMs < 150,`${embedding}/${setting.name}/${name}: input age at frame start ${row.ageMs} (after QA pixel capture ${row.postCaptureAgeMs})`);
        }
        assert.deepEqual(proof.standing.world,proof.horizontal.world,`${embedding}/${setting.name}: horizontal pose cannot move guard world anchor`);
        assert.deepEqual(proof.standing.world,proof.squat.world,`${embedding}/${setting.name}: squat cannot move guard world anchor`);
        assert.equal(proof.standing.score,proof.horizontal.score,'horizontal movement cannot fabricate score');
        assert.equal(proof.standing.score,proof.squat.score,'squat cannot fabricate score');
        assert.ok(proof.horizontal.measuredX > .2 && proof.squat.measuredY > .2,`${embedding}/${setting.name}: measured horizontal and squat deflections required`);
        assert.ok(proof.horizontal.cameraX>proof.standing.cameraX+.3 && proof.horizontal.x<proof.standing.x-4,`${embedding}/${setting.name}: measured horizontal camera and guard pixels must move: ${JSON.stringify(proof.horizontal)}`);
        assert.ok(proof.standing.cameraY>proof.squat.cameraY+.1 && proof.standing.y>proof.squat.y+4,`${embedding}/${setting.name}: measured squat camera and guard pixels must move: ${JSON.stringify(proof.squat)}`);
        assert.ok(proof.stale?.session==='playing' && proof.stale.pixels>=100 && !proof.stale.deflection?.active && proof.stale.cameraY>proof.squat.cameraY+.02 && proof.stale.cameraX<proof.squat.cameraX-.02,`${embedding}/${setting.name}: stale nose must recenter both axes with visible guard: ${JSON.stringify(proof.stale)}`);
      } finally { await context.close(); }
    }
    const fresh=measurements.fresh,legacyOff=measurements['legacy-off'],legacyCustom=measurements['legacy-custom'];
    const shifts=Object.fromEntries(Object.entries(measurements).map(([name,proof])=>[name,{x:proof.standing.x-proof.horizontal.x,y:proof.standing.y-proof.squat.y}]));
    for(const [name,shift] of Object.entries(shifts))assert.ok(shift.x>4&&shift.y>4,`${embedding}/${name}: fixed camera must visibly move pinned guard in both axes: ${JSON.stringify(shift)}`);
    assert.ok(Math.abs(fresh.squat.cameraY-1.64)<.18,`${embedding}: fixed 1.1 squat world target changed: ${fresh.squat.cameraY}`);
    for(const [name,proof] of [['legacy-off',legacyOff],['legacy-custom',legacyCustom]])assert.ok(Math.abs(proof.squat.cameraY-fresh.squat.cameraY)<.12&&Math.abs(proof.horizontal.cameraX-fresh.horizontal.cameraX)<.12,`${embedding}/${name}: saved off/custom must not change active camera travel`);
    results.push({embedding,shifts,standingCameraX:fresh.standing.cameraX,horizontalCameraX:fresh.horizontal.cameraX,squatCameraY:fresh.squat.cameraY,staleCameraY:fresh.stale.cameraY,guardPixels:fresh.squat.pixels,glovePixels:fresh.gloves.changed});
    console.log(`${embedding}: scored Play parallax PASS ${JSON.stringify(results.at(-1))}`);
  }
} finally {
  await browser?.close();
  await vite.close();
  if (parent) await new Promise(resolve => parent.close(resolve));
}

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
  // Each setting has its own connected game: no unsupported same-element restart.
  for (const embedding of ['direct','cross-origin iframe']) {
    const measurements = {};
    for (const setting of [{name:'high',on:true,y:1.1},{name:'low',on:true,y:.55},{name:'off',on:false,y:1.1}]) {
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
          // Fresh users must actually receive the stronger default; explicit
          // per-run tuning would otherwise conceal the old .55 regression.
          const {getGameSetupSnapshot: freshSetup}=await import('/src/game-setup-coordinator.js');
          require(freshSetup().noseCameraRangeYWorldUnits===1.1 && freshSetup().noseCameraParallaxEnabled===false,'fresh Game Setup Y default or opt-in toggle regressed');
          await harness.setSetup({noseCameraParallaxEnabled:setting.on,noseCameraRangeYWorldUnits:setting.y});
          // The fixture's generic field assertion does not understand the two
          // native UI fields that commit into nested spawnDistanceOverride.
          for(const [name,value] of [['spawnDistanceOverrideEnabled',true],['spawnDistanceOverrideWorldUnits',20]]) {
            const input=element.shadowRoot.querySelector(`[data-game-setup-field='${name}']`);
            require(input instanceof HTMLInputElement,`native spawn control ${name} missing`);
            if(input.type==='checkbox'){if(input.checked!==value)input.click();}
            else {input.focus();input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();}
            await element.lifecycleIntentTail;
          }
          const {aeroGameSetupStorageKey,getGameSetupSnapshot}=await import('/src/game-setup-coordinator.js');
          const setup=getGameSetupSnapshot(),stored=JSON.parse(localStorage.getItem(aeroGameSetupStorageKey));
          require(setup.spawnDistanceOverride.enabled && setup.spawnDistanceOverride.normalSpawnDistanceWorldUnits===20 && stored.spawnDistanceOverride.enabled && stored.spawnDistanceOverride.normalSpawnDistanceWorldUnits===20 && setup.noseCameraParallaxEnabled===setting.on && setup.noseCameraRangeYWorldUnits===setting.y,'native setup did not persist');
          await harness.startPlay();
          const locked = harness.element.activeSessionSetup;
          require(locked?.spawnDistanceOverride.enabled && locked.spawnDistanceOverride.normalSpawnDistanceWorldUnits === 20 && locked.noseCameraRangeYWorldUnits === setting.y && locked.noseCameraParallaxEnabled === setting.on,'fresh scored Play did not lock native setup');
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
          const pose = noseY => {
            harness.feedPose({nose:{x:.5,y:noseY}});
            const input = harness.graph.input.getSnapshot();
            require(input.latestEvidence?.provenance === 'measured' && !input.tracking.gameplayPaused,'fresh production measured input required');
            return input;
          };
          const sample = () => {
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
            return {pixels:count,x:sx/count,y:sy/count,world:[world.x,world.y,world.z],cameraY:renderer.cameraEntity.getPosition().y,deflection:element.lastNoseCameraDeflection,measured:measured?.yDeflection ?? null,ageMs:measured ? performance.now()-measured.measurementTimestampMs : null,provenance:input.latestEvidence?.provenance,score:JSON.stringify(gameplay.scorePartitions),judgements:gameplay.judgements.length,session:gameplay.session.state,frameMs:frame.nowMs};
          };
          // Calibration's 15fps measured clock can initially lead wall time.
          // Catch up naturally before asking production's <=150ms freshness
          // gate to consume nose samples; never fabricate a future fresh pose.
          const initialLead=element.latestPoseTimestampMs-performance.now();
          if(initialLead>0)await delay(initialLead+20);
          // Camera Y is rate-limited to 3 world units/sec; hold each fresh pose
          // long enough for convergence without moving the song clock.
          const settle = async (noseY) => { for(let i=0;i<24;i++){pose(noseY);await delay(35);} pose(noseY);return sample(); };
          const standing = await settle(.2);
          const squat = await settle(.43);
          let stale = null;
          if (setting.name === 'high') {
            await delay(200);
            element.runDisplayFrame();
            stale = sample();
          }
          return {origin:location.origin,parentOrigin:document.referrer ? new URL(document.referrer).origin:null,locked:{on:locked.noseCameraParallaxEnabled,y:locked.noseCameraRangeYWorldUnits,spawn:locked.spawnDistanceOverride.normalSpawnDistanceWorldUnits},gloves,standing,squat,stale};
        },setting);
        const proof = measurements[setting.name];
        if (embedding !== 'direct') assert.notEqual(proof.origin,proof.parentOrigin,'iframe must be truly cross-origin');
        assert.equal(proof.locked.y,setting.y);
        assert.equal(proof.locked.on,setting.on);
        assert.equal(proof.locked.spawn,20);
        assert.ok(proof.gloves.changed >= 100,'real pinned glove pixels required');
        for (const name of ['standing','squat']) {
          const row = proof[name];
          assert.equal(row.session,'playing');
          assert.equal(row.judgements,0);
          assert.equal(row.provenance,'measured');
          assert.ok(row.pixels >= 100 && Number.isFinite(row.y));
          assert.ok(row.ageMs >= 0 && row.ageMs < 150,`${embedding}/${setting.name}/${name}: stale measurement ${row.ageMs}`);
        }
        assert.deepEqual(proof.standing.world,proof.squat.world,`${embedding}/${setting.name}: guard world anchor must remain fixed`);
        assert.equal(proof.standing.score,proof.squat.score,'no fabricated score changes');
        assert.ok(proof.squat.measured > .2,`${embedding}/${setting.name}: actual measured squat deflection required`);
      } finally { await context.close(); }
    }
    const high = measurements.high, low = measurements.low, off = measurements.off;
    const shift = proof => proof.standing.y-proof.squat.y;
    const highShift = shift(high), lowShift = shift(low), offShift = shift(off);
    assert.ok(highShift >= 6 && highShift >= lowShift*1.7 && lowShift > 2,`${embedding}: pinned guard pixel shift must scale with locked Y: ${JSON.stringify({highShift,lowShift})}`);
    assert.ok(Math.abs(offShift)<1,`${embedding}: disabled camera must not shift GLB: ${offShift}`);
    assert.ok(high.standing.cameraY > high.squat.cameraY && low.standing.cameraY > low.squat.cameraY,`${embedding}: source Play camera Y did not respond to measured squat`);
    // Production camera pose has a +1 world-unit base, so the measured
    // deflection targets approximately 1.64/1.82 in world coordinates.
    assert.ok(Math.abs(high.squat.cameraY-1.64)<.18 && Math.abs(low.squat.cameraY-1.82)<.18,`${embedding}: measured source camera targets: ${JSON.stringify({high:high.squat.cameraY,low:low.squat.cameraY})}`);
    assert.ok(Math.abs(off.standing.cameraY-off.squat.cameraY)<.01,`${embedding}: disabled camera moved`);
    assert.ok(high.stale?.session === 'playing' && high.stale.pixels >= 100 && !high.stale.deflection?.active && high.stale.cameraY > high.squat.cameraY+.02,`${embedding}: stale measured sample must recenter while Play GLB stays visible: ${JSON.stringify(high.stale)}`);
    results.push({embedding,highShift,lowShift,offShift,highCameraY:high.squat.cameraY,lowCameraY:low.squat.cameraY,staleCameraY:high.stale.cameraY,guardPixels:high.squat.pixels,glovePixels:high.gloves.changed});
    console.log(`${embedding}: scored Play parallax PASS ${JSON.stringify(results.at(-1))}`);
  }
} finally {
  await browser?.close();
  await vite.close();
  if (parent) await new Promise(resolve => parent.close(resolve));
}

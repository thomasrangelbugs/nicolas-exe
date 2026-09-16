const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),checks=[],errors=[];
const chrome=process.env.TEST_CHROME || '/workspace/scratch/2cbd0ff63582/test-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(d)})});
let browser,base;
function pass(name,details){checks.push({name,status:'PASS',details});console.log('PASS',name,details||'')}
const scene=(p,name)=>p.waitForFunction(n=>window.__game?.scene.isActive(n),name,{timeout:15000});
async function boot(context){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});await p.goto(base+'/?test=1&renderer=canvas');await scene(p,'MenuScene');await p.waitForTimeout(500);return p}
async function tap(p,x,y){const r=await p.locator('canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720)}
async function start(p){await tap(p,520,318);await scene(p,'IntroScene');await tap(p,640,612);await scene(p,'GameScene');await p.waitForTimeout(500)}
async function clear(p){await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');for(const e of s.livingEnemies())s.hitEnemy({active:true,damage:10000,hitSet:new Set(),destroy(){}},e)})}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{}),args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720}}),p=await boot(ctx);await start(p);
 // Death and checkpoint through Arcade overlaps.
 await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');const c=s.checkpoints.getChildren()[0];s.player.body.reset(c.x,c.y);s.player.invuln=true});
 await p.waitForFunction(()=>window.__game.scene.getScene('GameScene').checkpoint===1110);
 await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.player.invuln=false;s.damagePlayer(999,s.player.x+20);s.killPlayer()});
 await p.waitForFunction(()=>{const s=window.__game.scene.getScene('GameScene');return !s.playerDying&&s.hp===100});
 let data=await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');return {deaths:s.deaths,x:s.player.x,invuln:s.player.invuln,enabled:s.player.body.enable}});
 assert.equal(data.deaths,1);assert.equal(data.x,1110);assert(data.invuln&&data.enabled);pass('Morte única e retorno seguro ao checkpoint');
 // Timer freezes together with gameplay.
 await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');window.timerFired=false;s.time.delayedCall(220,()=>window.timerFired=true)});
 await p.keyboard.press('Escape');await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>window.timerFired),false);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>window.timerFired);pass('Pausa congela também os temporizadores');
 // Recover a fallen enemy without counting it as killed.
 await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');window.fallen=s.livingEnemies()[0];window.fallen.body.reset(400,900)});
 await p.waitForFunction(()=>window.fallen.y<720&&window.fallen.body.enable);pass('Inimigo fora do cenário volta ao campo');
 const delta=await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene'),e=s.livingEnemies()[0],before=s.score;const b=()=>({active:true,damage:9999,hitSet:new Set(),destroy(){}});s.hitEnemy(b(),e);s.hitEnemy(b(),e);return s.score-before});assert.equal(delta,1);pass('Inimigo derrotado só conta uma vez');
 // Two complete campaign cycles using controlled kill fixtures, real scene transitions and portals.
 for(let cycle=0;cycle<2;cycle++){
  if(cycle){await p.keyboard.press('Enter');await scene(p,'MenuScene');await tap(p,520,294);await scene(p,'IntroScene');await p.keyboard.press('Enter');await scene(p,'GameScene')}
  for(let lv=1;lv<=4;lv++){
   await scene(p,'GameScene');
   const st=await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.player.invuln=true;return {lv:s.level,physics:s.physics.world.isPaused,cp:s.checkpoints.getLength(),pauseHandlers:s.keys.pause.listenerCount('down')}});
   assert.equal(st.lv,lv);assert.equal(st.physics,false);assert.equal(st.cp,3);assert.equal(st.pauseHandlers,1);
   await clear(p);
   if(lv>1){await p.waitForFunction(()=>window.__game.scene.getScene('GameScene').livingEnemies().some(e=>e.isBoss));
    const count=await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.spawnBoss();s.spawnBoss();return s.livingEnemies().filter(e=>e.isBoss).length});assert.equal(count,1);
    if(cycle===0){await p.waitForTimeout(500);await p.screenshot({path:path.join(root,'qa',`chefe-${lv}.png`)})}
    await clear(p);
   }
   await p.waitForFunction(()=>window.__game.scene.getScene('GameScene').exitOpen);
   const stillGame=await p.evaluate(()=>window.__game.scene.isActive('GameScene'));assert(stillGame);
   await p.evaluate(()=>window.__game.scene.getScene('GameScene').player.body.reset(3460,625));
   await scene(p,'InterludeScene');await p.waitForTimeout(400);
   await p.keyboard.press('Enter');await scene(p,lv<4?'GameScene':'CompleteScene');
  }
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('nicolasBirthdayBuildSaveV1')));
  assert.equal(saved.run.chapters,4);assert.equal(saved.run.bugs,42);assert(saved.completed);pass(`Ciclo completo ${cycle+1}: 4 fases, 3 chefes, portal e final`,{bugs:saved.run.bugs});
 }
 // Pause -> menu -> continue cannot leave the reusable scene frozen.
 await p.keyboard.press('Enter');await scene(p,'MenuScene');await tap(p,520,347);await scene(p,'GameScene');
 await p.keyboard.press('Escape');await tap(p,640,458);await scene(p,'MenuScene');await tap(p,520,347);await scene(p,'GameScene');
 assert.equal(await p.evaluate(()=>window.__game.scene.getScene('GameScene').physics.world.isPaused),false);pass('Menu durante pausa e Continuar');
 // A blocked storage write must not interrupt the completion transition.
 const blocked=await browser.newContext({viewport:{width:1280,height:720}});
 await blocked.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('blocked','SecurityError')}})});
 const bp=await boot(blocked);await start(bp);await clear(bp);await bp.waitForFunction(()=>window.__game.scene.getScene('GameScene').exitOpen);
 await bp.evaluate(()=>window.__game.scene.getScene('GameScene').player.body.reset(3460,625));await scene(bp,'InterludeScene');await bp.waitForTimeout(400);await bp.keyboard.press('Enter');await scene(bp,'GameScene');assert.equal(await bp.evaluate(()=>window.__game.scene.getScene('GameScene').level),2);pass('Armazenamento bloqueado não trava a passagem de fase');await blocked.close();
 const corrupt=await browser.newContext({viewport:{width:1280,height:720}});await corrupt.addInitScript(()=>localStorage.setItem('nicolasBirthdayBuildSaveV1','{bad json'));
 const cp=await boot(corrupt);await start(cp);pass('Save corrompido permite começar nova campanha');await corrupt.close();
 // Touch: actual simultaneous touch points, then portrait layout.
 const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36'});
 const mp=await boot(mobile);await start(mp);
 assert(await mp.locator('#rail-left').isVisible());assert(await mp.locator('#rail-right').isVisible());
 const dir=await mp.locator('[data-btn="right"]').boundingBox(),jump=await mp.locator('[data-btn="jump"]').boundingBox();
 const cdp=await mobile.newCDPSession(mp);
 const initial=await mp.evaluate(()=>{const p=window.__game.scene.getScene('GameScene').player;return{x:p.x,y:p.y}});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:dir.x+dir.width/2,y:dir.y+dir.height/2},{id:2,x:jump.x+jump.width/2,y:jump.y+jump.height/2}]});
 await mp.waitForFunction(x=>window.__game.scene.getScene('GameScene').player.x>x+15,initial.x);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert(await mp.evaluate(()=>window.__game.scene.getScene('GameScene').player.y<625));pass('Toque simultâneo: movimento e pulo');
 await mp.screenshot({path:path.join(root,'qa','mobile-horizontal.png')});
 await mp.setViewportSize({width:390,height:844});await mp.waitForTimeout(400);
 if(await mp.locator('#rotate-dismiss').isVisible())await mp.locator('#rotate-dismiss').click();
 const boxes=await mp.locator('[data-btn]').evaluateAll(els=>els.filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return {name:e.dataset.btn,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
 for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.right<=391&&b.bottom<=845,JSON.stringify(b))}
 const canvas=await mp.locator('canvas').boundingBox();assert(Math.abs(canvas.width/canvas.height-16/9)<0.02);await mp.screenshot({path:path.join(root,'qa','mobile-vertical.png')});pass('Controles dentro da tela vertical e canvas 16:9');
 await mobile.close();await ctx.close();
 assert.equal(errors.length,0,errors.join('\n'));pass('Regressões sem erros JavaScript ou recursos ausentes');
 fs.writeFileSync(path.join(root,'qa','regressions.json'),JSON.stringify({checks,errors},null,2));await browser.close();server.close();
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(root,'qa','regressions.json'),JSON.stringify({checks,errors,failure:e.message},null,2));await browser?.close();server.close();process.exitCode=1});

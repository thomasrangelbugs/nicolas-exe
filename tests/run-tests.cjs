const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const root=path.resolve(__dirname,'..');
const chrome=process.env.TEST_CHROME || '/workspace/scratch/2cbd0ff63582/test-browser/chrome-headless-shell-linux64/chrome-headless-shell';
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
const checks=[], errors=[]; let browser;
function pass(name,details){checks.push({name,status:'PASS',details});console.log('PASS',name,details||'')}
async function getState(page){return page.evaluate(()=>{
 const game=window.__game, active=game.scene.getScenes(true).map(s=>s.sys.settings.key);
 if(!active.includes('GameScene'))return {active};
 const s=game.scene.getScene('GameScene'),p=s.player;
 return {active,level:s.level,x:p.x,y:p.y,hp:s.hp,deaths:s.deaths,score:s.score,onGround:p.body.blocked.down,paused:s.paused,physicsPaused:s.physics.world.isPaused,exit:s.exitOpen,bossSpawned:s.bossSpawned,bossDefeated:s.bossDefeated,dying:s.playerDying,
 enemies:s.livingEnemies().map(e=>({x:e.x,y:e.y,hp:e.hp,boss:!!e.isBoss,type:e.slug||e.bossKey,cy:e.body.center.y,top:e.body.top,bottom:e.body.bottom})),checkpoints:s.checkpoints.getLength()};
});}
async function waitScene(p,name){await p.waitForFunction(n=>window.__game?.scene.isActive(n),name,{timeout:15000})}
async function press(p,key,ms){await p.keyboard.down(key);await p.waitForTimeout(ms);await p.keyboard.up(key)}
async function release(p){for(const k of ['ArrowLeft','ArrowRight','Space','KeyE','KeyF','ShiftLeft'])await p.keyboard.up(k)}
async function screenshot(p,name){await p.screenshot({path:path.join(root,'qa',name+'.png')})}
async function boot(context,base,query=''){
 const p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await p.goto(base+'/?test=1&renderer=canvas'+query);await waitScene(p,'MenuScene');
 await p.waitForTimeout(650);
 return p;
}
async function normalCampaign(page){
 await screenshot(page,'01-menu');
 await page.mouse.click(520,318);await waitScene(page,'IntroScene');
 await page.waitForTimeout(2700);await screenshot(page,'02-prologo');
 await page.keyboard.press('Enter');await waitScene(page,'GameScene');
 await page.waitForTimeout(900);
 let before=await getState(page);
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(x=>window.__game.scene.getScene('GameScene').player.x>x+40,before.x);
 await page.keyboard.up('ArrowRight');
 let after=await getState(page);assert(after.x>before.x+20);pass('Movimento por teclado');
 await page.keyboard.press('Escape');
 const frozen=await getState(page);await page.waitForTimeout(450);const still=await getState(page);
 assert(still.paused&&still.physicsPaused);assert.equal(still.x,frozen.x);pass('Pausa congela a física');
 await page.keyboard.press('Escape');assert.equal((await getState(page)).paused,false);
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>window.__game.scene.getScene('GameScene').player.x<125);
 await page.keyboard.up('ArrowLeft');
 await page.waitForTimeout(250);
 const jumpStart=await getState(page);
 await page.keyboard.down('Space');
 await page.waitForFunction(y=>window.__game.scene.getScene('GameScene').player.y<y-35,jumpStart.y);
 await page.keyboard.up('Space');
 assert((await getState(page)).y<jumpStart.y-25);pass('Pulo por teclado');
 await page.keyboard.press('Space');
 await page.waitForTimeout(300);
 // Full campaign uses ONLY keyboard movement and shots; no invulnerability or teleport.
 let lastLevel=0, started=Date.now(),lastShot=0,lastJump=0,loops=0,metrics=[],previousX=0,stuckSince=Date.now();
 while(Date.now()-started<240000){
  const state=await getState(page);loops++;
  if(state.active.includes('CompleteScene')){pass('Campanha inteira concluída com controles reais',metrics);await page.waitForTimeout(650);await screenshot(page,'09-final');return;}
  if(state.active.includes('InterludeScene')){
   await release(page);await page.waitForTimeout(650);await screenshot(page,`fase-${lastLevel}-concluida`);
   await page.keyboard.press('Enter');await waitScene(page,lastLevel<4?'GameScene':'CompleteScene');continue;
  }
  if(!state.active.includes('GameScene'))throw new Error('Unexpected scene '+JSON.stringify(state));
  if(state.level!==lastLevel){
   assert(!state.physicsPaused);assert.equal(state.checkpoints,3);
   lastLevel=state.level;metrics.push({level:lastLevel});console.log('PLAYING',lastLevel);await screenshot(page,`fase-${lastLevel}-inicio`);
  }
  if(state.dying){await release(page);await page.waitForTimeout(150);continue;}
  if(state.exit){
   await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowRight');
   await page.waitForTimeout(120);continue;
  }
  const target=state.enemies.reduce((b,e)=>!b||Math.abs(e.x-state.x)<Math.abs(b.x-state.x)?e:b,null);
  if(!target){await page.waitForTimeout(80);continue;}
  const dx=target.x-state.x;
  if(Math.abs(state.x-previousX)>5){previousX=state.x;stuckSince=Date.now();}
  if(Math.abs(dx)>310&&Date.now()-stuckSince>1300&&state.onGround){await press(page,'Space',220);stuckSince=Date.now();}
  let dir=0;
  if(Math.abs(dx)>310)dir=Math.sign(dx);
  else if(Math.abs(dx)<165 && (state.x>80&&dx>0 || state.x<3520&&dx<0))dir=-Math.sign(dx);
  // Turn toward target before firing; keep firing even when retreating.
  await page.keyboard.up(dir===1?'ArrowLeft':'ArrowRight');
  if(dir)await page.keyboard.down(dir===1?'ArrowRight':'ArrowLeft');
  else {await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');}
  if(Date.now()-lastShot>170){
   if(dir!==Math.sign(dx)){
    await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
    await press(page,dx>0?'ArrowRight':'ArrowLeft',22);
   }
   await press(page,'KeyE',40);lastShot=Date.now();
  }
  if(target.bottom<state.y-10 && state.onGround && Date.now()-lastJump>900){await press(page,'Space',180);lastJump=Date.now();}
  if(loops%60===0)console.log('combat',JSON.stringify({level:state.level,hp:state.hp,deaths:state.deaths,x:Math.round(state.x),left:state.enemies.length,enemy:target.type,hpEnemy:target.hp,paused:state.paused}));
  await page.waitForTimeout(80);
 }
 await screenshot(page,'timeout');throw new Error('Campaign timeout '+JSON.stringify(await getState(page)));
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 const page=await boot(context,base);
 const failures=await page.evaluate(()=>window.__game.scene.getScene('BootScene').failed);assert.deepEqual(failures,[]);pass('Todos os recursos locais carregados');
 await normalCampaign(page);
 assert.equal(errors.length,0,errors.join('\n'));pass('Nenhum erro JavaScript ou HTTP');
 fs.writeFileSync(path.join(root,'qa','results.json'),JSON.stringify({browser:'Chromium 134',checks,errors},null,2));
 await browser.close();server.close();
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(root,'qa','results.json'),JSON.stringify({checks,errors,failure:e.message},null,2));await browser?.close();server.close();process.exitCode=1});

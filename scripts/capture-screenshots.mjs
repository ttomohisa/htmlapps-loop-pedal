// Capture the real Loop Pedal UI on a fake-microphone Edge/Chromium session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
const html=fs.readFileSync('dist/index.html'),appPort=18765,devPort=18766;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const bin=process.env.LOOP_PEDAL_BROWSER||(
  process.platform==='win32'?[
    path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','Microsoft','Edge','Application','msedge.exe'),
    path.join(process.env.PROGRAMFILES||'C:\\Program Files','Microsoft','Edge','Application','msedge.exe'),
    path.join(process.env.PROGRAMFILES||'C:\\Program Files','Google','Chrome','Application','chrome.exe')
  ]:['/usr/bin/chromium','/usr/bin/google-chrome']
).find(fs.existsSync);
if(!bin)throw Error('Edge/Chromium executable missing');
let server,browser,ws,tmp;
class CDP {
  constructor(socket){
    this.socket=socket;this.id=0;this.waiting=new Map();
    socket.addEventListener('message',e=>{
      const m=JSON.parse(e.data),p=this.waiting.get(m.id);
      if(!p)return;
      this.waiting.delete(m.id);
      m.error?p.reject(Error(m.error.message)):p.resolve(m.result||{});
    });
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++this.id;this.waiting.set(id,{resolve,reject});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  async run(expression){
    const r=await this.send('Runtime.evaluate',{expression,userGesture:true,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
  async until(expression,ms=18000){
    const stop=Date.now()+ms;
    while(Date.now()<stop){
      if(await this.run(expression))return;
      await pause(150);
    }
    throw Error('Timed out: '+expression+'; '+await this.run("document.querySelector('#engineStatus')?.textContent"));
  }
}
async function setLocale(cdp,lang){
  if(await cdp.run('document.documentElement.lang')!==lang){
    await cdp.run("document.querySelector('#languageButton').click()");
    await cdp.until("document.documentElement.lang==='"+lang+"'");
  }
}
async function screenshot(cdp,name,width,height,mobile){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await cdp.run('window.scrollTo(0,0)');
  await pause(700);
  if(await cdp.run('document.documentElement.scrollWidth > document.documentElement.clientWidth+2'))
    throw Error('Horizontal overflow at '+width);
  const result=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  const bytes=Buffer.from(result.data,'base64');
  if(bytes.length<15000)throw Error(name+' appears empty');
  fs.mkdirSync('assets',{recursive:true});
  fs.writeFileSync(path.join('assets',name),bytes);
  console.log(name+': '+width+'x'+height+', '+bytes.length+' bytes');
}
try {
  server=http.createServer((req,res)=>{
    if(req.url==='/'||req.url==='/index.html'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end(html);
    }else{res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(appPort,'127.0.0.1',resolve));
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'loop-pedal-shots-'));
  const args=[
    '--headless=new','--disable-gpu','--disable-extensions',
    '--no-first-run','--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
    '--remote-allow-origins=*','--remote-debugging-port='+devPort,
    '--user-data-dir='+tmp,'--window-size=1360,900','about:blank'
  ];
  if(process.platform!=='win32')args.push('--no-sandbox');
  browser=spawn(bin,args,{stdio:'ignore',windowsHide:true});
  let target;
  for(let i=0;i<110;i++){
    try{
      const tabs=await (await fetch('http://127.0.0.1:'+devPort+'/json')).json();
      target=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
      if(target)break;
    }catch{}
    if(browser.exitCode!==null)throw Error('Browser exited before debugging startup');
    await pause(200);
  }
  if(!target)throw Error('Debugging endpoint unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  const cdp=new CDP(ws);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1360,height:900,deviceScaleFactor:1,mobile:false});
  const nav=await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+appPort+'/'});
  if(nav.errorText)throw Error('Cannot load local app: '+nav.errorText);
  await cdp.until("document.readyState==='complete' && !!document.querySelector('#micButton')");
  await cdp.run("(()=>{const bpm=document.querySelector('#bpmInput');bpm.value='200';bpm.dispatchEvent(new Event('change',{bubbles:true}));const bars=document.querySelector('#barsSelect');bars.value='1';bars.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await cdp.run("document.querySelector('#micButton').click()");
  await cdp.until("document.querySelector('#pad0').disabled===false");
  await cdp.run("document.querySelector('#pad0').click()");
  await cdp.until("document.querySelector('#pad0').classList.contains('has-take')");
  await cdp.run("document.querySelector('#pad1').click()");
  await cdp.until("document.querySelector('#pad1').classList.contains('has-take')");
  // Browser-level WAV smoke: a real AudioWorklet snapshot must yield a WAV
  // that is available for local playback and a user-tapped re-download.
  await cdp.run("document.querySelector('#downloadButton').click()");
  await cdp.until("document.querySelector('#exportPreviewBlock').hidden===false",15000);
  if(!await cdp.run("document.querySelector('#exportPreviewAudio').src.startsWith('blob:')"))
    throw Error('WAV preview was not created');
  if(!await cdp.run("document.querySelector('#exportDownloadAgain').href.startsWith('blob:')"))
    throw Error('Explicit WAV download fallback is missing');
  console.log('Browser WAV export and local preview: PASS');
  await setLocale(cdp,'ja');
  await screenshot(cdp,'screenshot.png',1360,900,false);
  await setLocale(cdp,'en');
  await screenshot(cdp,'screenshot-en.png',1360,900,false);
  await setLocale(cdp,'ja');
  await screenshot(cdp,'screenshot-mobile.png',390,844,true);
  console.log('Captured actual UI with two genuine synthetic-mic recordings.');
  // file:// direct-open compatibility is browser-specific. Record the
  // observation, but do not turn a screenshot build into a release waiver.
  try{
    const fileUrl='file:///'+path.resolve('dist/index.html').replace(/\\/g,'/');
    const result=await cdp.send('Page.navigate',{url:fileUrl});
    if(result.errorText)throw Error(result.errorText);
    await cdp.until("document.readyState==='complete' && !!document.querySelector('#micButton')",7000);
    await cdp.run("document.querySelector('#micButton').click()");
    await cdp.until("document.querySelector('#pad0').disabled===false",10000);
    console.log('Direct file:// microphone initialization in Edge: PASS (fake input)');
  }catch(error){
    console.warn('Direct file:// microphone initialization: NOT VERIFIED/BLOCKED: '+String(error));
  }
} finally {
  if(ws)try{ws.close()}catch{}
  if(browser)try{browser.kill()}catch{}
  if(server)await new Promise(r=>server.close(r));
  if(tmp)try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
}

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.template.html'), 'utf8');
const worklet = html.match(/<script type="text\/plain" id="loopWorkletSource">([\s\S]*?)<\/script>/);
const app = html.match(/<script>\s*([\s\S]*?)<\/script>/);

test('embedded app and worklet scripts have valid JavaScript syntax', () => {
  assert.ok(worklet, 'inline worklet source missing');
  assert.ok(app, 'application script missing');
  new vm.Script(worklet[1], {filename: 'loop-worklet.js'});
  new vm.Script(app[1], {filename: 'loop-app.js'});
});

test('single HTML template contract remains intact', () => {
  for (const placeholder of ['__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__']) {
    assert.equal(html.split(placeholder).length - 1, 1, placeholder);
  }
  assert.equal(html.split('__APP_ICON_DATA_URI__').length - 1, 2);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /APP:HELP:BEGIN/);
  assert.match(html, /APP:HELP:END/);
  assert.doesNotMatch(html, /<script[^>]*src=["']https?:/);
});

function fixture(rate = 1000) {
  const messages = [];
  let Registered = null;
  class FakeWorklet {
    constructor() {
      this.port = {onmessage:null, postMessage:(message) => messages.push(message)};
    }
  }
  vm.runInNewContext(worklet[1], {
    sampleRate:rate,
    AudioWorkletProcessor:FakeWorklet,
    registerProcessor:(name, ctor) => {
      assert.equal(name, 'loop-pedal-processor');
      Registered = ctor;
    }
  });
  const processor = new Registered();
  const send = data => processor.port.onmessage({data});
  const processFrames = (frameCount, amplitude=0.5) => {
    const audible = [];
    while(frameCount > 0) {
      const size = Math.min(128,frameCount);
      const input = new Float32Array(size).fill(amplitude);
      const output = new Float32Array(size);
      const keep = processor.process([[input]],[[output]]);
      assert.equal(keep,true);
      audible.push(output);
      frameCount -= size;
    }
    return audible;
  };
  return {processor,send,processFrames,messages};
}

test('tempo and bar count produce the specified integer sample length', () => {
  const {processor,send}=fixture(48000);
  for (const bpm of [40,100,127,200]) {
    for (const bars of [1,2,4]) {
      send({type:'configure',bpm,bars});
      assert.equal(processor.length,Math.round(48000*60/bpm*4*bars));
    }
  }
});

test('count-in records exactly one loop, auto-commits, and retains phase', () => {
  const {processor,send,processFrames}=fixture();
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  assert.equal(N,2400);
  send({type:'queue',index:0,mode:'speaker'});
  assert.equal(processor.state,'count-in');
  processFrames(2399);
  assert.equal(processor.state,'count-in');
  processFrames(1);
  assert.equal(processor.state,'recording');
  assert.equal(processor.phase,0);
  processFrames(N,0.25);
  assert.equal(processor.state,'playing');
  assert.equal(processor.phase,0);
  assert.equal(processor.tracks[0].pcm.length,N);
  assert.equal(processor.tracks[0].pcm[0],0.25);
  processFrames(N*20);
  assert.equal(processor.phase,0);
});

test('second take queues on next boundary, phone-only is silent during capture', () => {
  const {processor,send,processFrames}=fixture();
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.2);
  send({type:'queue',index:1,mode:'speaker'});
  assert.equal(processor.state,'queued');
  processFrames(N);
  assert.equal(processor.state,'recording');
  const speakerOutput=processFrames(128,0.3);
  assert.ok(speakerOutput.every(block=>block.every(value=>value===0)));
  processFrames(N-128,0.3);
  assert.equal(processor.state,'playing');
  assert.equal(processor.tracks[1].pcm.length,N);
  assert.equal(processor.tracks[0].pcm[0],Math.fround(0.2));
  send({type:'undo'});
  assert.equal(processor.tracks[1],null);
  assert.ok(processor.tracks[0]);
});

test('queue boundary skips an almost elapsed loop (<250ms lead)', () => {
  const {processor,send,processFrames}=fixture();
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.4);
  processor.phase=N-100;
  send({type:'queue',index:1,mode:'speaker'});
  assert.equal(processor.pending.loops,2);
  processFrames(100);
  assert.equal(processor.state,'queued');
  processFrames(N);
  assert.equal(processor.state,'recording');
});

test('headphone mode monitors only completed tracks and re-record Undo restores PCM', () => {
  const {processor,send,processFrames}=fixture();
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.4);
  const original=processor.tracks[0].pcm;
  send({type:'queue',index:1,mode:'headphones'});
  processFrames(N,0);
  assert.equal(processor.state,'recording');
  const audible=processFrames(128,0.1);
  assert.ok(audible.some(block=>block.some(value=>value>0.05)));
  processFrames(N-128,0.1);
  send({type:'queue',index:0,mode:'headphones'});
  processFrames(N);
  assert.equal(processor.state,'recording');
  processFrames(N,0.8);
  assert.notEqual(processor.tracks[0].pcm,original);
  assert.equal(processor.tracks[0].pcm[0],Math.fround(0.8));
  send({type:'undo'});
  assert.equal(processor.tracks[0].pcm,original);
  assert.ok(processor.tracks[1]);
});

test('cancel and clear discard uncommitted data, and generation advances', () => {
  const {processor,send,processFrames}=fixture();
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.4);
  send({type:'queue',index:1,mode:'speaker'});
  send({type:'abort'});
  processFrames(N*2);
  assert.equal(processor.tracks[1],null);
  assert.ok(processor.tracks[0]);
  send({type:'clear',generation:1});
  assert.equal(processor.generation,1);
  assert.deepEqual(Array.from(processor.tracks),[null,null,null,null]);
  assert.equal(processor.state,'ready');
});

test('snapshot keeps original audio and timing settings unchanged', () => {
  const {processor,send,processFrames,messages}=fixture();
  send({type:'configure',bpm:100,bars:1});
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+processor.length,0.4);
  send({type:'adjust',index:0,muted:true,gain:0.3,shiftMs:-125});
  send({type:'snapshot',requestId:42});
  const snapshot=messages.find(message=>message.kind==='snapshot');
  assert.ok(snapshot);
  assert.equal(snapshot.requestId,42);
  assert.equal(snapshot.tracks[0].shiftMs,-125);
  assert.equal(snapshot.tracks[0].muted,true);
  assert.equal(snapshot.tracks[0].gain,0.3);
  assert.equal(snapshot.tracks[0].pcm.length,processor.length);
});


test('mobile and bilingual UX fixes retain help modal scrolling but lock its background', () => {
  assert.match(html, /"localBadge": "完全ローカル処理"/);
  assert.match(html, /"brandMeta": "録音・ループ再生・音を重ねる"/);
  assert.match(html, /"brandMeta": "Record · Loop · Layer"/);
  assert.match(html, /language === 'ja' \? 'EN' : 'JA'/);
  assert.match(html, /@media \(max-width: 767px\)[\s\S]*?footer \{ display: none; \}/);
  assert.match(html, /function lockHelpBackground\(\)/);
  assert.match(html, /body\.style\.position = 'fixed'/);
  assert.match(html, /root\.style\.overflow = 'hidden'/);
  assert.match(html, /helpDialog\.addEventListener\('close',unlockHelpBackground\)/);
  assert.match(html, /window\.scrollTo\(0, lock\.y\)/);
  assert.match(html, /\.dialog-body \{[\s\S]*?overflow: auto;/);
});

function offlineSample() {
  const source = app[1].match(/function playbackSample\(take, frame, loopFrames, rate\) \{[\s\S]*?\n      \}/);
  assert.ok(source, 'offline loop playback function missing');
  return vm.runInNewContext(source[0] + '\nplaybackSample;');
}

test('selective seam micro-fades preserve source PCM, downbeat timing, and WAV parity', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4);
  processFrames(128,0.9);
  processFrames(N-256,0);
  processFrames(128,-0.9);
  const track=processor.tracks[0];
  assert.ok(track && track.seamFix);
  assert.equal(track.pcm[0],Math.fround(0.9));
  assert.equal(track.pcm[N-1],Math.fround(-0.9));
  assert.equal(processor.loopSample(track,0),0,'Downbeat begins with a micro-fade, not a shifted frame');
  assert.ok(Math.abs(processor.loopSample(track,N-1))<1e-12,'Tail ends at silence');
  assert.equal(processor.loopSample(track,track.seamHead),track.pcm[track.seamHead],
    'Head is unchanged after the first millisecond');
  assert.equal(processor.loopSample(track,track.seamStart-1),track.pcm[track.seamStart-1]);
  assert.equal(processor.loopSample(track,track.seamStart),track.pcm[track.seamStart]);
  const offline=offlineSample();
  const exported={
    pcm:track.pcm,gain:track.gain,shiftMs:0,
    seamStart:track.seamStart,seamHead:track.seamHead,seamFix:track.seamFix
  };
  for(const i of [0,1,2,5,N-8,N-4,N-3,N-2,N-1]) {
    const realtime=processor.loopSample(track,i);
    const sampled=offline(exported,i,N,1000);
    assert.ok(Math.abs(realtime-sampled)<1e-6, String(i));
  }
});

test('quiet tails stay quiet: seam treatment must not invent a DC swell',()=>{
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4);
  processFrames(100,0.7);
  processFrames(N-200,0);
  processFrames(100,0.006);
  const track=processor.tracks[0];
  assert.ok(track.seamFix);
  for(let i=track.seamStart;i<N;i++) {
    assert.ok(Math.abs(processor.loopSample(track,i))<=0.0061,
      'Previous implementation bent a quiet tail up to the first attack');
  }
  assert.ok(Math.abs(processor.loopSample(track,N-1))<1e-12);
  assert.equal(track.pcm[0],Math.fround(0.7));
  assert.equal(track.pcm[N-1],Math.fround(0.006));
});

test('matching periodic endpoints are unaltered by seam treatment',()=>{
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.65);
  const track=processor.tracks[0];
  assert.equal(track.seamFix,false);
  assert.equal(processor.loopSample(track,0),track.pcm[0]);
  assert.equal(processor.loopSample(track,N-1),track.pcm[N-1]);
});

test('per-track positive and negative timing compensation agrees with WAV render', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.4);
  const offline=offlineSample();
  for (const shift of [-200,-25,0,50,200]) {
    send({type:'adjust',index:0,shiftMs:shift});
    const take=processor.tracks[0];
    // Crossfade the transient shift update before comparing steady-state playback.
    processor.process([[new Float32Array(256)]],[[new Float32Array(256)]]);
    const data={pcm:take.pcm,gain:take.gain,shiftMs:take.shiftMs,
      seamFix:take.seamFix,seamStart:take.seamStart,seamHead:take.seamHead};
    for (const f of [0,1,4,50,N-1]) {
      const real=processor.loopSample(take,(f-take.targetShift+N)%N)*take.gain;
      const saved=offline(data,f,N,1000);
      assert.ok(Math.abs(real-saved)<1e-6, 'shift '+shift+', frame '+f);
    }
    assert.equal(take.shiftMs,shift);
  }
});

test('interruption discards partial replacement take but never the previous take', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.2);
  const saved=processor.tracks[0].pcm;
  send({type:'queue',index:0,mode:'headphones'});
  processFrames(N+64,0.8);
  assert.equal(processor.state,'recording');
  send({type:'interrupt'});
  assert.equal(processor.pending,null);
  assert.equal(processor.state,'paused');
  send({type:'resume'});
  processFrames(N*3,0.7);
  assert.equal(processor.tracks[0].pcm,saved);
});

test('loop phase remains exact after one thousand consecutive turns', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:127,bars:1});
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+processor.length,0.35);
  assert.equal(processor.phase,0);
  let remaining=processor.length*1000;
  const silent=new Float32Array(128);
  while(remaining>0) {
    const n=Math.min(128,remaining);
    const input=n===128?silent:new Float32Array(n);
    const output=new Float32Array(n);
    processor.process([[input]],[[output]]);
    remaining-=n;
  }
  assert.equal(processor.phase,0);
  assert.equal(processor.state,'playing');
  assert.equal(processor.tracks[0].pcm.length,processor.length);
});


test('completed takes remain exportable while the microphone requires reconnection', () => {
  assert.ok(app[1].includes("$('#downloadButton').disabled = !any || busy || exporting || !engine || processorFailed;"));
  assert.ok(app[1].includes("send({type:needsResume ? 'interrupt' : 'pause'});"));
  assert.ok(app[1].includes("if (wasSuspended && context.state === 'running')"));
  assert.ok(app[1].includes("pendingPad = -1;"));
  assert.ok(app[1].includes("state = hasTakes() ? 'paused' : 'ready';"));
});


test('canonical favicon exactly matches the user-approved SVG bytes', () => {
  const icon = fs.readFileSync(path.join(__dirname, '..', 'assets', 'favicon.svg'));
  const header = Buffer.from('blob ' + icon.length + '\0');
  const blobSha = crypto.createHash('sha1').update(header).update(icon).digest('hex');
  assert.equal(blobSha, '0fcbdb4495be37044c4fb31d27ba55142e00dcd4');
  assert.match(icon.toString('utf8'), /<rect width="64" height="64" rx="16" fill="#16624f"\/>/);
});

test('four pads commit independent takes with one shared loop frame count', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  for(let i=0;i<4;i++){
    send({type:'queue',index:i,mode:'speaker'});
    if(i===0) processFrames(processor.beat*4);
    else processFrames(N,0);
    processFrames(N,0.25+i*0.1);
    assert.equal(processor.phase,0);
    assert.equal(processor.state,'playing');
  }
  for(let i=0;i<4;i++){
    assert.equal(processor.tracks[i].pcm.length,N);
    assert.ok(Math.abs(processor.tracks[i].pcm[0]-(0.25+i*0.1))<1e-6);
  }
});

test('canceled re-recording leaves the original take and its mix settings intact', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.2);
  send({type:'adjust',index:0,gain:0.42,shiftMs:-25,muted:true});
  const old=processor.tracks[0];
  send({type:'queue',index:0,mode:'headphones'});
  assert.equal(processor.state,'queued');
  processFrames(N+300,0.8);
  assert.equal(processor.state,'recording');
  send({type:'abort'});
  assert.equal(processor.tracks[0],old);
  assert.equal(processor.tracks[0].gain,0.42);
  assert.equal(processor.tracks[0].muted,true);
  assert.equal(processor.tracks[0].shiftMs,-25);
});

test('Undo of a re-record restores PCM, mute, gain and offset from before the take', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.3);
  send({type:'adjust',index:0,muted:true,gain:0.45,shiftMs:50});
  const old=processor.tracks[0];
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(N*2,0.8);
  assert.equal(processor.tracks[0].muted,false);
  assert.equal(processor.tracks[0].gain,0.45);
  assert.equal(processor.tracks[0].shiftMs,50);
  send({type:'undo'});
  assert.equal(processor.tracks[0],old);
  assert.equal(processor.tracks[0].muted,true);
  assert.equal(processor.tracks[0].gain,0.45);
  assert.equal(processor.tracks[0].shiftMs,50);
});

test('paused recording discards only the in-progress take and retains loop phase', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.2);
  send({type:'queue',index:1,mode:'headphones'});
  processFrames(N+120,0.5);
  const phaseBefore=processor.phase;
  send({type:'pause'});
  assert.equal(processor.state,'paused');
  assert.equal(processor.phase,phaseBefore);
  assert.equal(processor.pending,null);
  assert.ok(processor.tracks[0]);
  assert.equal(processor.tracks[1],null);
  processFrames(N*2,0.7);
  assert.equal(processor.phase,phaseBefore);
  send({type:'resume'});
  processFrames(N,0.7);
  assert.equal(processor.phase,phaseBefore);
  assert.equal(processor.tracks[1],null);
});

test('queued second pad cannot interrupt or stack a different queued take', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  send({type:'queue',index:0,mode:'speaker'});
  processFrames(processor.beat*4+N,0.3);
  send({type:'queue',index:1,mode:'speaker'});
  send({type:'queue',index:2,mode:'speaker'});
  assert.equal(processor.pending.index,1);
  processFrames(N*2,0.6);
  assert.ok(processor.tracks[1]);
  assert.equal(processor.tracks[2],null);
});

test('v0.4 UI exposes state-specific SVG and safe recovery affordances', () => {
  assert.match(html,/const PAD_SYMBOLS = Object\.freeze/);
  for(const state of ['record','playing','muted','paused','queued','recording'])
    assert.match(html,new RegExp(state+':'));
  assert.match(html,/pad\.setAttribute\('aria-pressed'/);
  assert.match(html,/pad\.removeAttribute\('aria-pressed'\)/);
  assert.match(html,/trackDialog\.addEventListener\('close',unlockHelpBackground\)/);
  assert.match(html,/dialog\.addEventListener\('close', unlockHelpBackground\)/);
  assert.match(html,/requestGeneration !== generation/);
  assert.match(html,/if \(processorFailed\) \{/);
  assert.match(html,/window\.location\.reload\(\)/);
  assert.match(html,/track\.readyState !== 'live' \|\| track\.muted/);
});


// Extract the exact production WAV functions, rather than testing a reimplementation.
function appFunction(name, async = false) {
  const start = app[1].indexOf('      ' + (async ? 'async ' : '') + 'function ' + name + '(');
  assert.ok(start >= 0, 'Function not found: ' + name);
  const end = app[1].indexOf('\n      }\n', start);
  assert.ok(end > start, 'End of function not found: ' + name);
  return app[1].slice(start,end + '\n      }'.length);
}
function loadWavCode() {
  const code = [
    appFunction('wavHeader'),appFunction('playbackSample'),
    appFunction('canceledExportError'),
    appFunction('encodeWav',true),
    '({encodeWav,playbackSample,wavHeader})'
  ].join('\n');
  return vm.runInNewContext(code,{setTimeout});
}
function fakeSnapshot({length=600,rate=1000,takes=[]}={}) {
  return {length,rate,tracks:Array.from({length:4},(_,i)=>takes[i] || null)};
}
function fakeTake(samples,extra={}) {
  return {pcm:Float32Array.from(samples),gain:1,muted:false,shiftMs:0,...extra};
}
function pcmInt16Sample(wav,frame) {
  return new DataView(wav).getInt16(44+frame*2,true);
}

test('WAV one-loop output has correct RIFF/PCM headers and exact sample length', async () => {
  const {encodeWav}=loadWavCode();
  const rate=1000, length=600;
  const pcm=new Float32Array(length).fill(.5);
  const wav=await encodeWav(fakeSnapshot({rate,length,takes:[fakeTake(pcm)]}),'loop',{cancelled:false});
  const bytes=Buffer.from(wav);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.readUInt32LE(4),bytes.length-8);
  assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.toString('ascii',12,16),'fmt ');
  assert.equal(bytes.readUInt16LE(20),1);
  assert.equal(bytes.readUInt16LE(22),1);
  assert.equal(bytes.readUInt32LE(24),rate);
  assert.equal(bytes.readUInt32LE(28),rate*2);
  assert.equal(bytes.readUInt16LE(32),2);
  assert.equal(bytes.readUInt16LE(34),16);
  assert.equal(bytes.toString('ascii',36,40),'data');
  assert.equal(bytes.readUInt32LE(40),length*2);
  assert.equal(wav.byteLength,44+length*2);
  const expected=Math.round(Math.tanh(.5*.7)*32767);
  assert.ok(Math.abs(pcmInt16Sample(wav,0)-expected)<=1);
  assert.ok(Math.abs(pcmInt16Sample(wav,length-1)-expected)<=1);
});

test('WAV export respects mute, gain, timing and seam correction at every frame', async () => {
  const {encodeWav}=loadWavCode();
  const rate=1000,length=250;
  const waveform=new Float32Array(length);
  waveform[0]=1;waveform[30]=.8;waveform[length-1]=-.5;
  const a=fakeTake(waveform,{gain:.55,shiftMs:-50});
  const b=fakeTake(new Float32Array(length).fill(1),{muted:true});
  const snapshot=fakeSnapshot({rate,length,takes:[a,b]});
  const wav=await encodeWav(snapshot,'loop',{cancelled:false});
  const seamStart=length-Math.min(Math.max(2,Math.round(rate*.004)),Math.floor(length/4));
  const seamHead=Math.min(Math.max(2,Math.round(rate*.001)),Math.floor(length/4));
  const take={...a,seamStart,seamHead,seamFix:true};
  const {playbackSample}=loadWavCode();
  for(let i=0;i<length;i++) {
    const expected=Math.tanh(playbackSample(take,i,length,rate)*.7);
    const q=expected<0?Math.round(expected*32768):Math.round(expected*32767);
    assert.ok(Math.abs(pcmInt16Sample(wav,i)-q)<=1,'Frame '+i);
  }
  const original=await encodeWav(fakeSnapshot({rate,length,takes:[b]}),'loop',{cancelled:false});
  assert.equal(pcmInt16Sample(original,0),0,'Muting must produce silence');
  assert.equal(waveform[0],1,'Original PCM must not be edited');
  assert.equal(waveform[length-1],-.5,'Source loop seam must remain unchanged');
});

test('30 s and 60 s WAV exports have exact durations and end with zero fade', async () => {
  const {encodeWav}=loadWavCode();
  const rate=1000,length=400;
  const take=fakeTake(new Float32Array(length).fill(.7));
  for(const seconds of [30,60]) {
    const percentages=[];
    const wav=await encodeWav(fakeSnapshot({length,rate,takes:[take]}),
      String(seconds),{cancelled:false},v=>percentages.push(v));
    assert.equal(wav.byteLength,44+seconds*rate*2);
    assert.ok(pcmInt16Sample(wav,0)>5000);
    assert.ok(pcmInt16Sample(wav,seconds*rate-180)>0,'Fade should not be instantaneous');
    assert.equal(pcmInt16Sample(wav,seconds*rate-1),0);
    assert.equal(Math.round(percentages.at(-1)),100);
    assert.ok(percentages.length>1,'Progress callback should report more than completion');
  }
});

test('mix limiter keeps 4-loud-track WAV in signed 16-bit range without wraparound',async()=>{
  const {encodeWav}=loadWavCode();
  const pcm=new Float32Array(600).fill(1);
  const snapshot=fakeSnapshot({rate:1000,length:600,takes:
    [fakeTake(pcm),fakeTake(pcm),fakeTake(pcm),fakeTake(pcm)]});
  const wav=await encodeWav(snapshot,'loop',{cancelled:false});
  const peak=pcmInt16Sample(wav,0);
  assert.ok(peak>0 && peak<=32767,'All-positive input must never wrap negative');
});

test('export cancellation stops after a processing slice without damaging source tracks',async()=>{
  const {encodeWav}=loadWavCode();
  const pcm=new Float32Array(500).fill(.35);
  const job={cancelled:false};
  const values=[];
  await assert.rejects(encodeWav(fakeSnapshot({rate:1000,length:500,takes:[fakeTake(pcm)]}),
    '60',job,percent=>{values.push(percent);if(percent>5)job.cancelled=true;}),
    error=>error.name==='AbortError');
  assert.ok(values.length>=1);
  assert.equal(pcm[0],Math.fround(.35));
});

test('malformed WAV snapshots are rejected before allocating or encoding output',async()=>{
  const {encodeWav}=loadWavCode();
  await assert.rejects(encodeWav({rate:1000,length:20,tracks:[null,null]},'loop',{cancelled:false}),/Invalid track snapshot/);
  await assert.rejects(encodeWav(fakeSnapshot({rate:1000,length:200,
    takes:[fakeTake(new Float32Array(199))]}),'loop',{cancelled:false}),/Invalid track snapshot/);
  await assert.rejects(encodeWav(fakeSnapshot({rate:0,length:200}), 'loop',{cancelled:false}),/Invalid output size/);
});

test('generated download stays available via explicit fallback, but becomes stale after a pad edit',()=>{
  assert.match(html,/<audio id="exportPreviewAudio" controls preload="metadata"/);
  assert.match(html,/<a class="lp-export-download" id="exportDownloadAgain"/);
  assert.match(html,/<progress id="exportProgress" max="100"/);
  assert.match(html,/id="cancelExportButton"/);
  assert.match(app[1],/URL\.revokeObjectURL\(exportedUrl\)/);
  assert.match(app[1],/\['adjusted','committed','undone','deleted','cleared'\]\.includes\(message.kind\)/);
  assert.match(app[1],/exportDuration'\)\.addEventListener\('change',markExportStale\)/);
  assert.match(app[1],/job\.cancelled = true/);
});

function normalizedFilenameFor(raw) {
  const fields = {'#outputFilename':{value:raw}};
  const code = [appFunction('defaultFilename'), appFunction('normalizedFilename'), 'normalizedFilename()'].join('\n');
  const answer=vm.runInNewContext(code, {$:selector=>fields[selector]});
  return {name:answer,input:fields['#outputFilename'].value};
}
test('WAV filename handles invalid separators, reserved names, controls and repeats',()=>{
  const choices=[
    ['song.wav','song'],
    ['SONG.wav.wav','SONG'],
    ['folder/notes','folder-notes'],
    ['CON.wav','CON-audio'],
    ['Aux.wav','Aux-audio'],
    ['CON.txt.wav','CON-audio.txt'],
    ['my\u202eevil.wav','my-evil'],
    ['a'.repeat(250),'a'.repeat(110)]
  ];
  for(const [raw,expected] of choices) {
    const x=normalizedFilenameFor(raw);
    assert.equal(x.name,expected,raw);
    assert.equal(x.input,expected);
  }
  assert.match(normalizedFilenameFor('   ').name,/^loop-pedal-\d{8}-\d{6}$/);
});


test('suspended audio context export can be canceled before a late resume settles',async()=>{
  const context={resume:()=>new Promise(()=>{})};
  const source=[
    appFunction('canceledExportError'),appFunction('resumeForExport'),
    'resumeForExport'
  ].join('\n');
  const resume=vm.runInNewContext(source,{context,setTimeout,clearTimeout,Promise});
  const job={cancelled:false,cancelWait:null};
  const pending=resume(job);
  assert.equal(typeof job.cancelWait,'function');
  job.cancelled=true;
  job.cancelWait();
  await assert.rejects(pending,err=>err.name==='AbortError');
  assert.equal(job.cancelWait,null);
});

test('suspended audio context resume settles cleanly when audio becomes available',async()=>{
  const context={resume:()=>Promise.resolve()};
  const source=[
    appFunction('canceledExportError'),appFunction('resumeForExport'),
    'resumeForExport'
  ].join('\n');
  const resume=vm.runInNewContext(source,{context,setTimeout,clearTimeout,Promise});
  const job={cancelled:false,cancelWait:null};
  await resume(job);
  assert.equal(job.cancelWait,null);
});


test('regression: first downbeat is at the sample AFTER exactly four count-in beats', () => {
  const {processor,send,processFrames}=fixture(1000);
  send({type:'configure',bpm:100,bars:1});
  const beat=processor.beat, length=processor.length;
  assert.equal(beat,600); assert.equal(length,2400);
  send({type:'queue',index:0,mode:'speaker'});
  const clicks=Float32Array.from(processFrames(beat*4,0).flatMap(block=>Array.from(block)));
  for(let k=0;k<4;k++){
    assert.ok(Array.from(clicks.subarray(k*beat,k*beat+18)).some(x=>Math.abs(x)>0.005),
      'Count-in click '+(k+1)+' is missing');
  }
  assert.equal(processor.state,'recording');
  assert.equal(processor.phase,0);
  assert.equal(processor.pending.position,0);
  // The first actual capture frame must be exactly the first audio frame
  // after 4 count-in beats, not the start of beat 2.
  processor.process([[Float32Array.from([0.9])]],[[new Float32Array(1)]]);
  assert.equal(processor.pending.buffer[0],Math.fround(0.9));
  assert.equal(processor.pending.position,1);
  assert.equal(processor.phase,1);
  processFrames(length-1,0);
  assert.equal(processor.state,'playing');
  assert.equal(processor.phase,0);
  assert.equal(processor.tracks[0].pcm[0],Math.fround(0.9));
  assert.equal(processor.tracks[0].pcm[beat],0);

  send({type:'queue',index:1,mode:'speaker'});
  assert.equal(processor.state,'queued');
  processFrames(length,0);
  assert.equal(processor.state,'recording');
  assert.equal(processor.phase,0);
  processor.process([[Float32Array.from([0.8])]],[[new Float32Array(1)]]);
  processFrames(length-1,0);
  assert.equal(processor.tracks[1].pcm[0],Math.fround(0.8));
  assert.equal(processor.tracks[1].pcm[beat],0);
  assert.equal(processor.phase,0);
});

test('regression: beat rounding differs by at most two samples, never a whole beat', () => {
  for(const rate of [44100,48000]){
    const {processor,send}=fixture(rate);
    for(const bpm of [40,60,100,127,160,200]){
      send({type:'configure',bpm,bars:1});
      const expected=Math.round(4*rate*60/bpm);
      assert.ok(Math.abs(processor.beat*4-expected)<=2,
        'Count-in boundary discrepancy at '+rate+' Hz / '+bpm+' BPM');
    }
  }
});

test('regression: steady-state live mix and WAV differ only by 16-bit quantization',async()=>{
  const rate=1000;
  const {processor,send}=fixture(rate);
  send({type:'configure',bpm:100,bars:1});
  const N=processor.length;
  function take(freq,amplitude,gain,shiftMs,muted){
    const pcm=Float32Array.from({length:N},(_,i)=>
      amplitude*Math.sin(2*Math.PI*freq*i/rate));
    const shift=Math.round(shiftMs*rate/1000);
    const seamStart=N-Math.min(processor.seamSamples,Math.floor(N/4));
    const seamHead=Math.min(processor.seamHeadSamples,Math.floor(N/4));
    const seamFix=Math.abs(pcm[0]-pcm[N-1])>=0.02;
    return {pcm,gain,shiftMs,shift,targetShift:shift,shiftFade:0,
      smooth:muted?0:gain,muted,seamStart,seamHead,seamFix};
  }
  processor.tracks=[
    take(20,.45,.75,-25,false),take(12,.3,1,50,false),
    take(15,.7,.8,0,true),null
  ];
  const snapshot={length:N,rate,tracks:processor.tracks.map(t=>t?{
    pcm:t.pcm,gain:t.gain,muted:t.muted,shiftMs:t.shiftMs
  }:null)};
  const {encodeWav}=loadWavCode();
  const wav=await encodeWav(snapshot,'loop',{cancelled:false});
  let largestDifference=0;
  for(let i=0;i<N;i++){
    const live=processor.mix(i,-1);
    const pcm16=pcmInt16Sample(wav,i)/32768;
    largestDifference=Math.max(largestDifference,Math.abs(live-pcm16));
  }
  assert.ok(largestDifference<2/32768,
    'Live and WAV signal paths diverged: '+largestDifference);
});

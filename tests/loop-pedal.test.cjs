'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  assert.deepEqual(processor.tracks,[null,null,null,null]);
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

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p));
const source = read('src/index.template.html').toString('utf8');
const config = JSON.parse(read('app.config.json').toString('utf8'));
function dimensions(file) {
  const png = read(file);
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.toString('ascii',12,16),'IHDR');
  return {width:png.readUInt32BE(16),height:png.readUInt32BE(20),bytes:png.length};
}
test('release candidate uses the template-supported SemVer prerelease',()=>{
  assert.match(config.version,/^1\.0\.0-rc\.\d+$/);
  assert.equal(config.repository.owner,'ttomohisa');
  assert.equal(config.repository.name,'htmlapps-loop-pedal');
  assert.equal(config.build.blockRuntimeNetwork,true);
  assert.equal(config.build.selfExtract.enabled,true);
});
test('all rendered localized strings exist in both Japanese and English',()=>{
  const from='      const translations = ';
  const fromAt=source.indexOf(from), toAt=source.indexOf('      const storageKeys =',fromAt);
  assert.ok(fromAt>0 && toAt>fromAt);
  const translations=JSON.parse(source.slice(fromAt+from.length,toAt).trim().replace(/;\s*$/,''));
  const attrs=[...source.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)].map(m=>m[1]);
  for(const locale of ['ja','en']) {
    for(const key of attrs)assert.ok(
      Object.prototype.hasOwnProperty.call(translations[locale],key),locale+': '+key
    );
  }
  assert.deepEqual(
    Object.keys(translations.ja).sort(),Object.keys(translations.en).sort()
  );
  assert.equal(translations.ja.localBadge,'完全ローカル処理');
});
test('runtime has a strict network boundary without remote resources',()=>{
  assert.match(source,/connect-src 'none'/);
  assert.match(source,/worker-src 'self' blob:/);
  assert.match(source,/media-src 'self' data: blob:/);
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(source,/https?:\/\//i);
  assert.doesNotMatch(source,/<script[^>]+src\s*=/i);
  assert.doesNotMatch(source,/<iframe\b/i);
  assert.doesNotMatch(source,/@import\s/i);
  assert.match(source,/const PAD_SYMBOLS = Object\.freeze/);
  assert.match(source,/getUserMedia/);
});
test('user-provided SVG remains the single canonical icon',()=>{
  const svg=read('assets/favicon.svg');
  const prefix=Buffer.from('blob '+svg.length+'\0');
  const sha=crypto.createHash('sha1').update(prefix).update(svg).digest('hex');
  assert.equal(svg.length,1321);
  assert.equal(sha,'0fcbdb4495be37044c4fb31d27ba55142e00dcd4');
  assert.equal(source.split('__APP_ICON_DATA_URI__').length-1,2);
});
test('real-browser screenshot assets have the required dimensions',()=>{
  for(const [file,w,h] of [
    ['assets/screenshot.png',1360,900],
    ['assets/screenshot-en.png',1360,900],
    ['assets/screenshot-mobile.png',390,844]
  ]) {
    const result=dimensions(file);
    assert.equal(result.width,w,file);
    assert.equal(result.height,h,file);
    assert.ok(result.bytes>15000,'Screenshot looks blank: '+file);
  }
  const ja=read('assets/screenshot.png'),en=read('assets/screenshot-en.png');
  assert.notEqual(crypto.createHash('sha256').update(ja).digest('hex'),
                  crypto.createHash('sha256').update(en).digest('hex'));
});
test('README screenshots and release notes reflect current product',()=>{
  for(const [readme,file] of [
    ['README.md','assets/screenshot-en.png'],
    ['README.ja.md','assets/screenshot.png']
  ]) {
    const text=read(readme).toString('utf8');
    assert.ok(text.includes(file),readme+' missing '+file);
    assert.ok(text.includes('v1.0.0-rc.1'),readme+' prerelease missing');
  }
  assert.ok(read('CHANGELOG.md').toString('utf8').includes('1.0.0-rc.1'));
});

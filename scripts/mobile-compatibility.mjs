import {createHash} from 'node:crypto';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function nativeFingerprint(){
 const files=execFileSync('git',['ls-files','android','ios','capacitor.config.ts'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(p=>!p.endsWith('capacitor.config.json'));
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 const plugins=Object.fromEntries(Object.entries(pkg.dependencies||{}).filter(([name])=>name.includes('capacitor')).sort(([a],[b])=>a.localeCompare(b)));
 const hash=createHash('sha256');hash.update(JSON.stringify(plugins));for(const file of files.sort()){hash.update(file);hash.update(readFileSync(file));}
 return hash.digest('hex');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const path='native-release.json',current=nativeFingerprint();
 if(process.argv.includes('--record')){
  if(process.env.AYAH_CONFIRM_NATIVE_RELEASE!=='yes')throw Error('Record only after installing and verifying the signed native binaries. Set AYAH_CONFIRM_NATIVE_RELEASE=yes.');
  writeFileSync(path,JSON.stringify({version:1,fingerprint:current,publicKeyHash:createHash('sha256').update((process.env.AYAH_CAPGO_PUBLIC_KEY||'').replace(/\\n/g,'\n').trim()).digest('hex')},null,2)+'\n');
 }else{
  if(!existsSync(path))throw Error('No approved native baseline. Build, device-test and release the native app first; see docs/native/updates.md.');
  const baseline=JSON.parse(readFileSync(path));if(baseline.version!==1||baseline.fingerprint!==current)throw Error('Native runtime changed: a new store binary and baseline are required, not an OTA update.');
  const key=(process.env.AYAH_CAPGO_PUBLIC_KEY||'').replace(/\\n/g,'\n').trim();if(!key.startsWith('-----BEGIN ')||baseline.publicKeyHash!==createHash('sha256').update(key).digest('hex'))throw Error('Capgo public key differs from the released binary.');
  console.log('Native compatibility and public key match the approved binary.');
 }
}

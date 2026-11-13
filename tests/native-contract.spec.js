import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {callbackCode,createAuthReturnHandler,installNativeAuth} from '../src/native/auth.js';
import {shareJson} from '../src/native/downloads.js';
const code='11111111-1111-4111-8111-111111111111',url='com.ayahaday.app://auth/callback?code='+code;
test('native callbacks accept only exact owned routes and PKCE codes, never tokens or arbitrary redirects',()=>{
 expect(callbackCode(url)).toBe(code);expect(callbackCode('https://ayah-a-day.up.railway.app/native/auth/callback?code='+code)).toBe(code);
 for(const input of ['https://evil.example/native/auth/callback?code='+code,url+'&code=second-code',url+'#access_token=secret',url+'&redirect=https://evil.example','com.ayahaday.app://evil/callback?code='+code,'com.ayahaday.app://auth/callback?access_token=secret'])expect(callbackCode(input)).toBeNull();
});
test('cold and warm return share one deduplicated PKCE exchange and failed exchange never grants local identity',async()=>{
 const calls=[],messages=[];let listener,closed=0;const client={auth:{exchangeCodeForSession:async value=>{calls.push(value);return {error:null};}}};
 const dispose=await installNativeAuth(client,{native:true,app:{addListener:async(_,fn)=>{listener=fn;return {remove(){closed++;}};},getLaunchUrl:async()=>({url})},close:async()=>{},notify:m=>messages.push(m)});
 await listener({url});await listener({url:'https://evil.example/?code='+code});await new Promise(r=>setTimeout(r,0));expect(calls).toEqual([code]);expect(messages[0]).toContain('completed');dispose();expect(closed).toBe(1);
 const failed=createAuthReturnHandler({auth:{exchangeCodeForSession:async()=>({error:{message:'TEST_SECRET_DO_NOT_DISPLAY'}})}},{close:async()=>{throw Error('unsupported');},notify:m=>messages.push(m)});await failed(url);expect(messages.at(-1)).toContain('could not finish');expect(messages.join()).not.toContain('TEST_SECRET');
});
test('native JSON export uses only temporary app cache and deletes its copy after share or failure',async()=>{
 const writes=[],deleted=[];const files={writeFile:async args=>{writes.push(args);return {uri:'file:///private/cache/test.json'};},deleteFile:async args=>deleted.push(args)};
 await shareJson(new Blob(['{"progress":"unchanged"}']),'backup.json',{files,share:{share:async args=>expect(args.files).toEqual(['file:///private/cache/test.json'])}});
 expect(writes[0].directory).toBe('CACHE');expect(deleted[0].path).toBe(writes[0].path);
 await expect(shareJson(new Blob(['{}']),'backup.json',{files,share:{share:async()=>{throw Error('TEST_CANCELLED');}}})).rejects.toThrow();expect(deleted).toHaveLength(2);
});
test('native projects bundle actual dist, target supported SDKs, retain RTL and request microphone only as needed',()=>{
 const config=readFileSync('capacitor.config.ts','utf8'),android=readFileSync('android/app/src/main/AndroidManifest.xml','utf8'),ios=readFileSync('ios/App/App/Info.plist','utf8');expect(config).toContain("webDir: 'dist'");expect(config).not.toMatch(/server:\s*\{[^}]*url:/);expect(config).toContain("appId: 'com.ayahaday.app'");expect(config).not.toContain('resizeOnFullScreen');expect(readFileSync('android/variables.gradle','utf8')).toContain('targetSdkVersion = 36');expect(android).toContain('android:supportsRtl="true"');expect(android).toContain('android.permission.RECORD_AUDIO');expect(android).not.toContain('android.permission.CAMERA');expect(android).toContain('android:allowBackup="false"');expect(ios).toContain('NSMicrophoneUsageDescription');expect(ios).not.toContain('NSAllowsArbitraryLoads');
});
test('association endpoints serve real JSON and missing proof files never masquerade as SPA HTML',async()=>{
 const {mkdtemp,writeFile,mkdir,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createStaticServer}=await import('../scripts/serve.mjs');const root=await mkdtemp(join(tmpdir(),'ayah-native-links-'));const server=createStaticServer({root});try{await writeFile(join(root,'index.html'),'<html>APP_FIXTURE</html>');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;expect((await fetch(origin+'/.well-known/apple-app-site-association')).status).toBe(404);await mkdir(join(root,'.well-known'));await writeFile(join(root,'.well-known/apple-app-site-association'),'{"applinks":{"details":[]}}');const r=await fetch(origin+'/.well-known/apple-app-site-association');expect(r.headers.get('content-type')).toBe('application/json');expect((await r.json()).applinks.details).toEqual([]);}finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});

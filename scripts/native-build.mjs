import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const command=process.argv[2]||'doctor';
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{stdio:'inherit',shell:process.platform==='win32',...options});if(r.error||r.status!==0)throw Error(`${cmd} failed. Check the native build guide and installed toolchain.`);}
function capture(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});return r.status===0?(r.stdout||r.stderr).trim():'';}
function checkBundle(){
 if(!existsSync('dist/index.html'))throw Error('Run npm run build first.');
 for(const platform of ['android','ios']){const path=platform==='android'?'android/app/src/main/assets/capacitor.config.json':'ios/App/App/capacitor.config.json';if(!existsSync(path))continue;const c=JSON.parse(readFileSync(path));const index=platform==='android'?'android/app/src/main/assets/public/index.html':'ios/App/App/public/index.html';if(!existsSync(index)||!readFileSync(index).equals(readFileSync('dist/index.html')))throw Error('Native web assets are stale. Run npm run native:sync.');if(c.appId!=='com.ayahaday.app'||c.webDir!=='dist'||c.server?.url||c.server?.cleartext)throw Error('Unsafe native configuration: require approved bundled frontend, HTTPS and no remote server.url.');}
 for(const file of readdirSync('dist/assets')){if(!/\.(js|json)$/.test(file))continue;const source=readFileSync(`dist/assets/${file}`,'utf8');if(/(?:sb_secret_|sk_live_|sk_test_|sk-proj-)[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|-----BEGIN (?:RSA )?PRIVATE KEY/.test(source))throw Error('Potential secret in bundle. Remove it before syncing.');for(const token of source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){try{if(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role==='service_role')throw Error('service-role');}catch(e){if(e.message==='service-role')throw Error('A Supabase service-role token cannot enter a native bundle.');}}}
 console.log('Bundled frontend/configuration checks passed.');
}
if(command==='check'){checkBundle();}
else if(command==='sync'){run('npm',['run','build']);run('npx',['--no-install','cap','sync']);checkBundle();}
else if(command==='doctor'){
 console.log('Node '+process.version);console.log(capture('java',['-version'])||'Java: use JDK 21 (java prints version to stderr).');
 console.log('Android SDK: '+(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'not configured'));
 console.log(process.platform==='darwin'?(capture('xcodebuild',['-version'])||'Xcode unavailable'):'iOS builds require macOS with Xcode 26+ and iOS SDK 26+.');
}
else if(command.startsWith('android-')){
 const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
 if(!sdk||!existsSync(resolve(sdk,'platforms/android-36/android.jar')))throw Error('Android SDK platform 36 is unavailable. Set ANDROID_HOME and install platform/build tools 36 before compiling.');
 const release=command==='android-release';if(release){for(const key of ['AYAH_ANDROID_KEYSTORE','AYAH_ANDROID_KEYSTORE_PASSWORD','AYAH_ANDROID_KEY_ALIAS','AYAH_ANDROID_KEY_PASSWORD'])if(!process.env[key])throw Error(`Configure ${key} securely outside Git before a signed release.`);if(!existsSync(process.env.AYAH_ANDROID_KEYSTORE))throw Error('Release keystore file not found.');}
 run(process.platform==='win32'?'gradlew.bat':'./gradlew',[release?':app:bundleRelease':':app:assembleDebug'],{cwd:resolve('android')});
}
else if(command.startsWith('ios-')){
 if(process.platform!=='darwin')throw Error('iOS compilation requires macOS/Xcode. This environment cannot build an IPA.');
 const version=capture('xcodebuild',['-version']).match(/Xcode (\d+)/),sdk=Number(capture('xcrun',['--sdk','iphoneos','--show-sdk-version']).split('.')[0]);
 if(!version||Number(version[1])<26||sdk<26)throw Error('Use Xcode 26+ and iOS SDK 26+; verify current App Store requirements before uploading.');
 const common=['-project','ios/App/App.xcodeproj','-scheme','App'];
 if(command==='ios-debug')run('xcodebuild',[...common,'-configuration','Debug','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator','CODE_SIGNING_ALLOWED=NO','build']);
 else{if(!/^[A-Z0-9]{10}$/.test(process.env.AYAH_APPLE_TEAM_ID||'')||!existsSync(process.env.AYAH_IOS_EXPORT_OPTIONS||''))throw Error('Provide real AYAH_APPLE_TEAM_ID and AYAH_IOS_EXPORT_OPTIONS path; configure signing in Xcode first.');run('xcodebuild',[...common,'-configuration','Release','-destination','generic/platform=iOS','-archivePath','native-output/AyahADay.xcarchive',`DEVELOPMENT_TEAM=${process.env.AYAH_APPLE_TEAM_ID}`,'archive']);run('xcodebuild',['-exportArchive','-archivePath','native-output/AyahADay.xcarchive','-exportPath','native-output/ios','-exportOptionsPlist',process.env.AYAH_IOS_EXPORT_OPTIONS]);}
}else throw Error('Unknown native build command.');

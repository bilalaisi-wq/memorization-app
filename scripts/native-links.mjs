import {mkdir,writeFile} from 'node:fs/promises';
const team=process.env.AYAH_APPLE_TEAM_ID,cert=process.env.AYAH_ANDROID_CERT_SHA256;
if(!/^[A-Z0-9]{10}$/.test(team||'')||!/^([a-f0-9]{2}:){31}[a-f0-9]{2}$/i.test(cert||''))throw Error('Provide actual AYAH_APPLE_TEAM_ID (10 characters) and AYAH_ANDROID_CERT_SHA256 (colon-separated release certificate fingerprint). No signing secrets are needed.');
await mkdir('public/.well-known',{recursive:true});
await writeFile('public/.well-known/apple-app-site-association',JSON.stringify({applinks:{apps:[],details:[{appID:`${team}.com.ayahaday.app`,paths:['/native/auth/callback']}]}}));
await writeFile('public/.well-known/assetlinks.json',JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.ayahaday.app',sha256_cert_fingerprints:[cert.toUpperCase()]}}]));
console.log('Generated real domain association files. Build/deploy the website, then verify them on HTTPS before claiming verified app links.');

import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Never log private keys or put them in arguments, config, artifacts, or the app bundle.
for(const key of ['CAPGO_API_KEY','CAPGO_PRIVATE_KEY','AYAH_CAPGO_PUBLIC_KEY'])if(!process.env[key])throw Error(`Missing protected CI secret: ${key}`);
const check=spawnSync(process.execPath,['scripts/mobile-compatibility.mjs'],{stdio:'inherit'});if(check.status!==0)process.exit(1);
const revision=process.env.GITHUB_RUN_NUMBER;if(!/^\d+$/.test(revision||''))throw Error('Use the versioned GitHub Actions release workflow.');
const dir=mkdtempSync(join(tmpdir(),'ayah-capgo-')),keyPath=join(dir,'signing.pem');
try{
 writeFileSync(keyPath,process.env.CAPGO_PRIVATE_KEY.replace(/\\n/g,'\n'),{mode:0o600});
 const args=['--no-install','@capgo/cli','bundle','upload','com.ayahaday.app','--path','dist','--channel','mobile','--bundle',`1.0.${revision}`,'--key-v2',keyPath,'--delta','--fail-on-incompatible','--min-update-version','1.0.0'];
 const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',args,{stdio:'inherit',shell:false});if(result.status!==0)throw Error('Signed upload failed; the channel was not verified updated.');
}finally{rmSync(dir,{recursive:true,force:true});}

import {rememberVerifiedDevice,offlineDeviceOwner,forgetDeviceIdentity} from "../offline/identity.js";
import {createLocalNatureStore} from "../rewards/shop.js";
import {companionDetails,validCompanion} from "../rewards/companion.js";
import {CosmicCloud} from '../quest/cosmic/cloud.js';
import {mountAccountPhoto} from "../rewards/account-photo.js";
import {receiveRemoteRewards} from "../rewards/store.js";
import { avatarSvg,items } from "../rewards/catalog.js";
import { RewardPublisher } from "../rewards/publisher.js";
import { mountBillingControls } from "../billing/ui.js";
import { leaderboardMarkup } from "./leaderboard.js";
import { setDeveloperUser, configureDeveloperClient } from "../developer/access.js";
import { accountDefaults } from "./account-config.js";
import { RESTORE_KEY, CloudProgress } from "./cloud-progress.js";
import {
  profileStorage,
  selectProfile,
  profileBackup,
  progressKeys,
  scopedStorage,
  activeProfileId,
  profileRevision,
  exportKeys,
  onProfileChange,
} from "./profile-storage.js";
import { esc } from "../ui/dom.js";
let rewardPublisher=null, rewardReady=null, natureProfile=null, natureLoaded=false,natureRequest=0;
function drawAccountAvatar(){
 const node=document.querySelector('.avatar');if(!node)return;
 const photo=natureProfile?.photo;
 if(typeof photo==='string'&&photo.length<=70000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)){node.replaceChildren();const img=document.createElement('img');img.src=photo;img.alt='Your private profile picture';node.append(img);}else node.textContent='Y';
 let mascot=document.querySelector('[data-header-companion]');
 if(!mascot){mascot=document.createElement('span');mascot.dataset.headerCompanion='';mascot.className='profile-companion';node.after(mascot);}
 mascot.innerHTML=validCompanion(natureProfile)?avatarSvg(natureProfile,'header-companion'):'';
 mascot.hidden=!validCompanion(natureProfile);mascot.dataset.creature=validCompanion(natureProfile)?natureProfile.creature:'';mascot.title=validCompanion(natureProfile)?(items.find(i=>i.id===natureProfile.creature)?.name||'Your companion'):'';if(mascot.firstElementChild)mascot.firstElementChild.setAttribute('aria-label',mascot.title);
 document.querySelectorAll('[data-my-companion-preview]').forEach(el=>el.innerHTML=companionDetails(natureProfile));
}
window.addEventListener('ayahnaturechange',event=>{if(event.detail?.owner!==activeProfileId()||event.detail?.identityRevision!==profileRevision()||!validCompanion(event.detail))return;natureRequest++;natureProfile=event.detail;drawAccountAvatar();});
window.addEventListener('ayahprofilechange',()=>{natureRequest++;natureProfile=null;natureLoaded=false;drawAccountAvatar();});
let offlineOwner=null;
let client = null,
  user = null,
  accountError = "",
  cloud = null,
  cosmicCloud = null,
  projectUrl = "",
  projectKey = "";
export async function initializeAccounts(config = {}) {
  const url =
      config.url ?? (import.meta.env.VITE_SUPABASE_URL || accountDefaults.url),
    key =
      config.key ??
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || accountDefaults.key);
  if (!url || !key) return;
  try {
    if (!url.startsWith("https://"))
      throw new Error("HTTPS account service required.");
    projectUrl = url;
    projectKey = key;
    const authStorageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    for (const storageKey of [
      authStorageKey,
      `${authStorageKey}-code-verifier`,
    ]) {
      try {
        if (
          !localStorage.getItem(storageKey) &&
          sessionStorage.getItem(storageKey)
        ) {
          localStorage.setItem(storageKey, sessionStorage.getItem(storageKey));
          sessionStorage.removeItem(storageKey);
        }
      } catch {}
    }
    if(navigator.onLine===false){
      offlineOwner=offlineDeviceOwner(url);client=null;user=null;configureDeveloperClient(null);setDeveloperUser(null);selectProfile(offlineOwner);
      accountError=offlineOwner?'Offline device profile: saved learning is available; reconnect to verify your account.':'Offline guest study: connect to sign in.';
      if(offlineOwner){cloud=new CloudProgress(null,offlineOwner,scopedStorage(offlineOwner),()=>{});await cloud.initialize();onProfileChange(id=>{if(id===offlineOwner)cloud?.changed();});}
      window.addEventListener('online',()=>location.reload(),{once:true});return;
    }
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url, key, {
      global: {
        fetch: async (input, init = {}) => {
          const controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), 10000);
          const relay = () => controller.abort();
          if (init.signal?.aborted) controller.abort();
          else init.signal?.addEventListener("abort", relay, { once: true });
          try {
            return await fetch(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timer);
            init.signal?.removeEventListener("abort", relay);
          }
        },
      },
      auth: {
        flowType: "pkce",
        persistSession: true,
        storage: localStorage,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    });
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session) {
      const result = await client.auth.getUser();
      if (result.error) throw result.error;
      user = result.data.user;
      rememberVerifiedDevice(user,url);
    }
    configureDeveloperClient(client);
    setDeveloperUser(user);
    selectProfile(user?.id);
    if (user) {
      cloud = new CloudProgress(client, user.id, scopedStorage(user.id), () => {
        document
          .querySelectorAll("[data-sync-status]")
          .forEach((el) => (el.textContent = cloud.status));
      });
      await cloud.initialize();
      cosmicCloud=new CosmicCloud(client,user.id,{onStatus:message=>{document.querySelectorAll('[data-cosmic-sync-status]').forEach(n=>n.textContent=message);}});
      void cosmicCloud.initialize();
      window.addEventListener('ayahcosmicchange',e=>{if(e.detail.owner===user?.id)cosmicCloud?.schedule();});
      window.addEventListener('online',()=>cosmicCloud?.schedule());
      onProfileChange((id) => {
        if (id === user?.id) cloud?.changed();
      });
      window.addEventListener("online", () => {
        if (cloud?.enabled && !cloud.conflict) cloud.changed();
      });
    }
    client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((session?.user?.id || null) !== (user?.id || null)) {
        cloud?.dispose();
        cosmicCloud?.dispose();
        rewardPublisher?.dispose();
        setDeveloperUser(null);
        selectProfile(null);
        forgetDeviceIdentity();
        user=null;natureProfile=null;
        document.querySelector('.avatar')?.replaceChildren(document.createTextNode('✦'));
        document.querySelectorAll('dialog[open]').forEach(d=>{d.querySelector('[data-close]')?.click();if(d.isConnected){d.close();d.remove();}});
        const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Changing account safely…';document.querySelector('#app')?.replaceChildren(message);
        location.reload();
      }
    });
  } catch {
    accountError =
      "The account service is unavailable. Guest learning remains available.";
    cosmicCloud?.dispose();
    user = null;
    setDeveloperUser(null);
    selectProfile(null);
  }
}
async function refreshNatureProfile(){
 if(!client||!user||user.id!==activeProfileId())return;const owner=activeProfileId(),revision=profileRevision(),request=++natureRequest;
 try{const {data,error}=await client.rpc('my_nature_profile',{expected_user:owner});if(!error&&data&&owner===activeProfileId()&&revision===profileRevision()&&request===natureRequest){natureProfile=data;receiveRemoteRewards(data,{owner,revision});drawAccountAvatar();}}catch{}
}
window.addEventListener('focus',()=>{if(user)void refreshNatureProfile();});
export function mountAccountControls(main, learning, callbacks = {}) {
  const nav = main.querySelector(".explore-nav");
  if (!nav) return;
  if(!natureLoaded){natureLoaded=true;if(client&&user)void refreshNatureProfile();else if(!offlineOwner)try{natureProfile=createLocalNatureStore().snapshot();}catch{}}
  drawAccountAvatar();
  if(client&&user&&!rewardPublisher){
    rewardPublisher=new RewardPublisher(client,learning,scopedStorage(user.id),user.id,{getUserId:activeProfileId});
    rewardReady=client.from("leaderboard_preferences").select("enabled").eq("user_id",user.id).maybeSingle().then(({data})=>{rewardPublisher.enabled=data?.enabled===true;rewardPublisher.schedule();}).catch(()=>{});
    onProfileChange(id=>{if(id===user?.id)rewardPublisher.schedule();});
    window.addEventListener("ayahrewardschanged",()=>rewardPublisher.schedule());
    window.addEventListener("online",()=>rewardPublisher.schedule());
  }
  for (const [label, action] of [
    ["My companion & shop", () => offlineOwner?showAccount(learning):import("../rewards/shop.js").then(m=>m.openNatureShop({client,user,learning,publisher:rewardPublisher}))],
    [user||offlineOwner ? "My account" : "Sign in", () => showAccount(learning)],
    ["Leaderboard", () => showLeaderboard(learning)],
  ]) {
    const button = document.createElement("button");
    button.className = "text-button";
    button.textContent = label;
    button.onclick = action;
    button.dataset.accountControl = "true";
    nav.append(button);
  }
  mountBillingControls(nav, {client,user,learning,signIn:()=>showAccount(learning),...callbacks});
}
function dialogShell(title) {
  const dialog = document.createElement("dialog");
  dialog.className = "account-dialog";
  dialog.innerHTML = `<button class="text-button" data-close>Close ×</button><h2>${esc(title)}</h2><div data-content></div><p data-account-status role="status"></p>`;
  document.body.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector("[data-close]").onclick = close;
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  dialog.showModal();
  return dialog;
}
function showAccount(learning) {
  if(user)void refreshNatureProfile();
  const dialog = dialogShell(offlineOwner?"Offline device profile":user ? "My account" : "Sign in to Ayah"),
    area = dialog.querySelector("[data-content]"),
    status = dialog.querySelector("[data-account-status]");
  if(!offlineOwner)mountAccountPhoto(dialog,{client,user});
  const companion=document.createElement('section');companion.className='my-companion';companion.setAttribute('aria-label','My Companion');companion.innerHTML='<span class="eyebrow">MY COMPANION</span><div data-my-companion-preview></div><button class="text-button" data-change-companion>Change Companion</button><button class="primary small" data-open-companion-shop>Open Companion Shop</button>';area.before(companion);drawAccountAvatar();
  companion.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(offlineOwner)return;dialog.querySelector('[data-close]').click();void import('../rewards/shop.js').then(m=>m.openNatureShop({client,user,learning,publisher:rewardPublisher}));});
  if(offlineOwner){companion.innerHTML='<h3>MY COMPANION</h3><p>Reconnect to load your authoritative account wardrobe. No Seeds can be spent offline for this account.</p>';}
  const run = async (action) => {
    const buttons = [...dialog.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    status.dataset.tone = "info";
    try {
      await action();
    } catch (e) {
      status.textContent = e.message || "The request could not be completed.";
      status.dataset.tone = "error";
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
  if(!user){
    const exportButton=document.createElement('button');exportButton.className='text-button';exportButton.textContent='Download device progress';exportButton.dataset.exportDevice='';exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(profileBackup(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ayah-device-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};dialog.insertBefore(exportButton,area);
  }
  if(offlineOwner){
    area.innerHTML='<p>You are studying the saved progress for this device profile. This is local access only: premium content, developer access, account purchases and private account services require online verification.</p><p data-sync-status></p><button class="text-button" data-offline-verify>Reconnect and verify account</button><button class="text-button" data-offline-guest>Use guest mode · sign out on this device</button>';
    area.querySelector('[data-sync-status]').textContent=cloud?.status||accountError;
    area.querySelector('[data-offline-verify]').onclick=()=>location.reload();
    area.querySelector('[data-offline-guest]').onclick=()=>{forgetDeviceIdentity();const key=`sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;localStorage.removeItem(key);sessionStorage.removeItem(key);location.reload();};return;
  }
  if (!client) {
    area.innerHTML = `<p>Keep learning as a guest. Your goals and progress stay in this browser.</p><p>Online accounts and shared rankings are not activated yet. A secure account service must be configured by the site owner first.</p><p>${esc(accountError)}</p><p>Microphone recordings stay in your current tab and are never uploaded.</p><button class="text-button" data-privacy>Privacy information</button>`;
    area.querySelector("[data-privacy]").onclick = showPrivacy;
    return;
  }
  if (!user) {
    area.innerHTML = `<div class="account-auth-tabs" role="group" aria-label="Account access"><button class="text-button" data-auth-mode="signin" aria-pressed="true">Sign in</button><button class="text-button" data-auth-mode="signup" aria-pressed="false">Create account</button></div><p data-auth-intro>Sign in without a password. Guest learning is always available. Accounts are for adults and parents managing their own learning; children should use guest mode with a parent. You stay signed in on this device until you sign out; use a private device.</p><form><label><input type="checkbox" name="adult" required> I am 18 or older and understand the privacy information.</label><label>Email <input name="email" type="email" autocomplete="email" required maxlength="254"></label><button class="primary" type="submit">Email me a sign-in code</button></form><form data-verify hidden><label>Sign-in code <input name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required></label><button class="primary" type="submit">Verify code</button></form><button class="text-button" data-google>Continue with Google</button><button class="text-button" data-privacy>Privacy information</button>`;
    let email = "",
      authMode = "signin";
    area.querySelectorAll("[data-auth-mode]").forEach(
      (button) =>
        (button.onclick = () => {
          authMode = button.dataset.authMode;
          area
            .querySelectorAll("[data-auth-mode]")
            .forEach((tab) =>
              tab.setAttribute("aria-pressed", String(tab === button)),
            );
          dialog.querySelector("h2").textContent =
            authMode === "signup"
              ? "Create your Ayah account"
              : "Welcome back to Ayah";
          area.querySelector("[data-verify]").hidden = true;
          status.textContent = "";
        }),
    );
    const form = area.querySelector("form");
    form.onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        email = form.elements.email.value.trim();
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: authMode === "signup",
            emailRedirectTo:
              import.meta.env.VITE_AUTH_REDIRECT_URL || accountDefaults.siteUrl,
          },
        });
        if (error) throw error;
        area.querySelector("[data-verify]").hidden = false;
        status.textContent =
          "If an eligible account exists, check your email for the code. New here? Choose Create account. Never share the code.";
      });
    };
    area.querySelector("[data-verify]").onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        const { error } = await client.auth.verifyOtp({
          email,
          token: e.target.elements.token.value.trim(),
          type: "email",
        });
        if (error) throw error;
      });
    };
    area.querySelector("[data-google]").onclick = () =>
      run(async () => {
        if (!form.elements.adult.checked)
          throw new Error("Adult or parent account confirmation is required.");
        let settings = null;
        try {
          const response = await fetch(`${projectUrl}/auth/v1/settings`, {
            headers: { apikey: projectKey },
            signal: AbortSignal.timeout(8000),
          });
          if (response.ok) settings = await response.json();
        } catch {}
        if (settings?.external?.google === false)
          throw new Error(
            "Google sign-in is not enabled yet. Use email, or ask the site owner to enable Google in Supabase.",
          );
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            // Supabase supplies Google email/profile scopes. Avoid duplicate scopes.
            queryParams: { prompt: "select_account" },
            redirectTo:
              import.meta.env.VITE_AUTH_REDIRECT_URL || accountDefaults.siteUrl,
          },
        });
        if (error) throw error;
      });
    area.querySelector("[data-privacy]").onclick = showPrivacy;
    return;
  }
  area.innerHTML = `<p>You’re signed in. Your progress is separate from guest and other accounts on this browser. You stay signed in on each device until you sign out. Core learning progress can load on a new device. Cosmic Rush checkpoints and passage reviews have separate private sync controls below. Other Quest journeys and workspace drafts remain on this device; account downloads include them for backup.</p><label><input type="checkbox" data-sync-enabled> Automatically sync my learning progress across devices</label><p data-sync-status role="status"></p><div class="account-actions"><button class="primary" data-save>Save private cloud backup</button><button class="text-button" data-restore>Restore cloud backup</button><button class="text-button" data-copy>Copy guest core progress into empty account</button><button class="text-button" data-export>Download my account data</button><button class="text-button" data-signout>Sign out on this device</button><button class="text-button" data-signout-all>Sign out on all devices</button></div><h3>Optional weekly leaderboard</h3><p>Share only a made-up alias and weekly learning totals. No email, ayah details, goals, or recordings are public. Rankings are self-reported practice, not verified recitation. Opting in automatically syncs dated XP receipts without Quran references to keep totals up to date; profile photos remain private.</p><label>Public alias <input data-alias maxlength="24" placeholder="e.g. Cedar42" pattern="[A-Za-z0-9 _-]{3,24}"></label><label><input data-opt-in type="checkbox"> Share my alias, companion and this week’s totals publicly</label><button class="primary small" data-publish>Update leaderboard preference</button><button class="text-button" data-privacy>Privacy information</button><hr><p>Deleting your account removes server backups, public rankings, and this account’s progress on this browser. Download a copy first if wanted.</p><button class="text-button" data-delete>Delete my account and data</button>`;
  if(profileStorage.getItem(RESTORE_KEY)){
    const recover=document.createElement('button');recover.className='text-button';recover.textContent='Recover pre-restore device copy';recover.dataset.cloudRecover='';recover.onclick=()=>run(async()=>{cloud.recover();location.reload();});area.querySelector('.account-actions').append(recover);
  }
  const cosmicSection=document.createElement('section');cosmicSection.innerHTML='<h3>Cosmic Rush private sync</h3><p>Checkpoints, errors, hints and difficulty evidence sync separately from core progress. Actual passage recall uses the existing private passage review table. No recordings are uploaded.</p><label><input type="checkbox" data-cosmic-auto> Automatically sync Cosmic Rush and passage reviews</label><p data-cosmic-sync-status role="status"></p><button class="primary" data-cosmic-save>Sync Cosmic Rush now</button><button class="text-button" data-cosmic-restore>Restore Cosmic cloud copy</button><button class="text-button" data-cosmic-keep-device>Keep this device Cosmic copy after conflict</button><button class="text-button" data-cosmic-download>Download Cosmic cloud copy</button><button class="text-button" data-cosmic-recover>Recover original device Cosmic copy</button>';
  area.querySelector('.account-actions').after(cosmicSection);cosmicSection.querySelector('[data-cosmic-sync-status]').textContent=cosmicCloud?.status||'Cosmic sync is unavailable.';cosmicSection.querySelector('[data-cosmic-auto]').checked=cosmicCloud?.meta.enabled||false;
  cosmicSection.querySelector('[data-cosmic-auto]').onchange=e=>run(async()=>{cosmicCloud.setEnabled(e.target.checked);});
  cosmicSection.querySelector('[data-cosmic-save]').onclick=()=>run(()=>cosmicCloud.sync());
  cosmicSection.querySelector('[data-cosmic-restore]').onclick=()=>run(async()=>{if(!confirm('Restore the private Cosmic cloud copy? Your current device copy will remain in the recovery backup. Download both copies first if they differ.'))return;await cosmicCloud.restore();location.reload();});
  cosmicSection.querySelector('[data-cosmic-recover]').onclick=()=>run(async()=>{cosmicCloud.recover();location.reload();});
  cosmicSection.querySelector('[data-cosmic-keep-device]').onclick=()=>run(async()=>{if(!confirm('Keep this device Cosmic copy? Download both copies first. The cloud copy will be backed up locally and a fresh revision check will protect concurrent changes. Passage FSRS history will not be forcibly replaced.'))return;await cosmicCloud.replaceRemote();});
  cosmicSection.querySelector('[data-cosmic-download]').onclick=()=>run(async()=>{const remote=await cosmicCloud.read();if(!remote)throw Error('No Cosmic cloud backup exists.');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(remote,null,2)],{type:'application/json'}));a.href=url;a.download='ayah-cosmic-cloud.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const syncToggle = area.querySelector("[data-sync-enabled]");
  syncToggle.checked = cloud?.enabled || false;
  area.querySelector("[data-sync-status]").textContent =
    cloud?.status || "Cloud sync is unavailable.";
  syncToggle.onchange = () =>
    run(async () => {
      await cloud.setEnabled(syncToggle.checked);
    });
  area.querySelector("[data-save]").onclick = () =>
    run(async () => {
      if (
        cloud.conflict &&
        !confirm(
          "Replace the cloud copy with this device’s progress? Download your account data first if you want to keep both copies.",
        )
      )
        return;
      await cloud.save({ replace: cloud.conflict });
      status.textContent =
        "Private cloud backup saved. No recordings were included.";
    });
  area.querySelector("[data-restore]").onclick = () =>
    run(async () => {
      if (
        !confirm(
          "Replace this device’s account progress with the cloud copy? Download local data first if needed.",
        )
      )
        return;
      await cloud.restore();
      location.reload();
    });
  area.querySelector("[data-copy]").onclick = () =>
    run(async () => {
      if (
        learning.snapshot().records &&
        (Object.keys(learning.snapshot().records).length || JSON.parse(profileStorage.getItem("ayah-rewards-v1")||"{}").events?.length)
      )
        throw new Error(
          "This account already has progress. Guest records will not overwrite it.",
        );
      if (
        !confirm(
          "Copy guest goals and core learning progress into this empty account? Quest journeys and passage drafts stay in the original guest profile. Guest data stays unchanged.",
        )
      )
        return;
      for (const key of [...progressKeys,"ayah-rewards-v1"]) {
        const value = localStorage.getItem(key);
        if (value !== null) profileStorage.setItem(key, value);
      }
      location.reload();
    });
  area.querySelector("[data-export]").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({...profileBackup(),"ayah-rewards-v1":profileStorage.getItem("ayah-rewards-v1"),"nature-profile":natureProfile||profileStorage.getItem("ayah-nature-profile-v1")}, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ayah-account-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  area.querySelector("[data-signout]").onclick = () =>
    run(async () => {
      cloud?.dispose();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    });
  area.querySelector("[data-signout-all]").onclick = () =>
    run(async () => {
      if (
        !confirm(
          "Sign out on all devices? Other sessions will end when their access tokens expire.",
        )
      )
        return;
      cloud?.dispose();
      const { error } = await client.auth.signOut({ scope: "global" });
      if (error) throw error;
    });
  area.querySelector("[data-publish]").onclick = () =>
    run(async () => {
      await rewardReady;
      const enabled = area.querySelector("[data-opt-in]").checked,
        alias = area.querySelector("[data-alias]").value.trim();
      if (enabled && !/^[A-Za-z0-9 _-]{3,24}$/.test(alias))
        throw new Error(
          "Use a made-up alias of 3–24 letters, numbers, spaces, dashes, or underscores.",
        );
      const { error } = await client.rpc("set_leaderboard_preference", {
        enabled,
        chosen_alias: enabled ? alias : null,
      });
      if (error) throw error;
      if(rewardPublisher)rewardPublisher.enabled=enabled;
      if(enabled&&rewardPublisher)await rewardPublisher.flush();
      status.textContent = enabled
        ? "Your weekly XP updates automatically across learning modes while you are opted in."
        : "You are opted out and your public ranking has been removed.";
    });
  area.querySelector("[data-delete]").onclick = () =>
    run(async () => {
      if (
        !confirm(
          "Permanently delete your account, server backups, and public rankings? This cannot be undone.",
        )
      )
        return;
      const { error } = await client.rpc("delete_my_account");
      if (error) throw error;
      for (const key of exportKeys) profileStorage.removeItem(key);
      await client.auth.signOut({ scope: "local" });
      location.reload();
    });
  area.querySelector("[data-privacy]").onclick = showPrivacy;
  client
    .from("leaderboard_preferences")
    .select("alias,enabled")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(({ data }) => {
      if (data && dialog.isConnected) {
        area.querySelector("[data-alias]").value = data.alias || "";
        area.querySelector("[data-opt-in]").checked = data.enabled;
      }
    });
}
function showPrivacy() {
  const dialog = dialogShell("Privacy and your choices");
  dialog.querySelector("[data-content]").innerHTML =
    `<p>Guest progress stays in this browser. Adult accounts use Supabase authentication and optional Google sign-in. The authentication provider receives your email and sign-in information. Do not enter a child’s information or use a real name as a public alias.</p><p>Goals, learning history, and progress are saved locally per account. Saved private progress is loaded when signing in on a new device. You can save manually or opt in to automatic sync; only then are subsequent changes uploaded to private account storage. Recordings stay in memory in the tab and are never included in progress backups or published. Approved adult pilot users may explicitly send their own recording to the experimental transcription provider; the AI panel explains processing, deletion, and limits.</p><p>Public leaderboard participation is off by default. Opting in publishes a chosen alias and weekly totals only. You can opt out, export your progress, or delete your account in account settings.</p><p>Sign-in sessions persist on this device until sign-out. On shared devices, browser storage can be accessed by someone with access to the browser. Sign out and clear site data after exporting or backing up if needed. No advertising trackers are included.</p><p>The site operator must publish their identity, privacy contact, retention policy, provider terms, and applicable regional notices before enabling public registration. Legal compliance depends on the deployment and jurisdiction; this interface is not a legal certification.</p>`;
}
async function showLeaderboard(learning) {
  const dialog = dialogShell("Weekly practice leaderboard"),
    area = dialog.querySelector("[data-content]");
  dialog.classList.add("leaderboard-dialog");
  if(!user){
    const exportButton=document.createElement('button');exportButton.className='text-button';exportButton.textContent='Download device progress';exportButton.dataset.exportDevice='';exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(profileBackup(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ayah-device-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};dialog.insertBefore(exportButton,area);
  }
  if (!client) {
    area.innerHTML =
      "<p>The shared leaderboard is not activated yet. No sample users or invented scores are shown. You can track your personal progress in Daily Quests.</p>";
    return;
  }
  area.textContent = "Loading this week’s opt-in activity…";
  try {
    await rewardReady;
    let rewardError="";
    if(rewardPublisher?.enabled)try{await rewardPublisher.flush();}catch(e){rewardError=e.message;}
    const { data, error } = await client.rpc("get_weekly_leaderboard");
    if (error) throw error;
    area.innerHTML = leaderboardMarkup(data);
    if(rewardError)dialog.querySelector("[data-account-status]").textContent=rewardError;
  } catch {
    area.textContent =
      "The shared leaderboard could not load. Your personal learning still works.";
  }
}

export const appearanceAccount = () => ({client, userId:user?.id || null});

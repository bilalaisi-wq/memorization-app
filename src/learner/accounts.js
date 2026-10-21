import { mountBillingControls } from "../billing/ui.js";
import { leaderboardMarkup } from "./leaderboard.js";
import { setDeveloperUser } from "../developer/access.js";
import { accountDefaults } from "./account-config.js";
import { CloudProgress } from "./cloud-progress.js";
import {
  profileStorage,
  selectProfile,
  profileBackup,
  progressKeys,
  scopedStorage,
  onProfileChange,
} from "./profile-storage.js";
import { esc } from "../ui/dom.js";
let client = null,
  user = null,
  accountError = "",
  cloud = null,
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
    }
    setDeveloperUser(user);
    selectProfile(user?.id);
    if (user) {
      cloud = new CloudProgress(client, user.id, scopedStorage(user.id), () => {
        document
          .querySelectorAll("[data-sync-status]")
          .forEach((el) => (el.textContent = cloud.status));
      });
      await cloud.initialize();
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
        location.reload();
      }
    });
  } catch {
    accountError =
      "The account service is unavailable. Guest learning remains available.";
    user = null;
    setDeveloperUser(null);
    selectProfile(null);
  }
}
export function mountAccountControls(main, learning, callbacks = {}) {
  const nav = main.querySelector(".explore-nav");
  if (!nav) return;
  for (const [label, action] of [
    [user ? "My account" : "Sign in", () => showAccount(learning)],
    ["Leaderboard", () => showLeaderboard()],
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
  const dialog = dialogShell(user ? "My account" : "Sign in to Ayah"),
    area = dialog.querySelector("[data-content]"),
    status = dialog.querySelector("[data-account-status]");
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
  area.innerHTML = `<p>You’re signed in. Your progress is separate from guest and other accounts on this browser. You stay signed in on each device until you sign out. Saved private progress loads on a new device; enable automatic sync below to keep future changes backed up.</p><label><input type="checkbox" data-sync-enabled> Automatically sync my learning progress across devices</label><p data-sync-status role="status"></p><div class="account-actions"><button class="primary" data-save>Save private cloud backup</button><button class="text-button" data-restore>Restore cloud backup</button><button class="text-button" data-copy>Copy guest progress into empty account</button><button class="text-button" data-export>Download my account data</button><button class="text-button" data-signout>Sign out on this device</button><button class="text-button" data-signout-all>Sign out on all devices</button></div><h3>Optional weekly leaderboard</h3><p>Share only a made-up alias and weekly game/recall totals. No email, ayah details, goals, or recordings are public. Rankings are self-reported practice, not verified recitation.</p><label>Public alias <input data-alias maxlength="24" placeholder="e.g. Cedar42" pattern="[A-Za-z0-9 _-]{3,24}"></label><label><input data-opt-in type="checkbox"> Share my alias and this week’s totals publicly</label><button class="primary small" data-publish>Update leaderboard preference</button><button class="text-button" data-privacy>Privacy information</button><hr><p>Deleting your account removes server backups, public rankings, and this account’s progress on this browser. Download a copy first if wanted.</p><button class="text-button" data-delete>Delete my account and data</button>`;
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
        Object.keys(learning.snapshot().records).length
      )
        throw new Error(
          "This account already has progress. Guest records will not overwrite it.",
        );
      if (
        !confirm(
          "Copy guest goals and progress into this empty account? Guest data stays unchanged.",
        )
      )
        return;
      for (const key of progressKeys) {
        const value = localStorage.getItem(key);
        if (value !== null) profileStorage.setItem(key, value);
      }
      location.reload();
    });
  area.querySelector("[data-export]").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(profileBackup(), null, 2)], {
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
      if (enabled) {
        const result = await client.rpc("publish_weekly_activity", {
          learning: learning.snapshot(),
        });
        if (result.error) throw result.error;
      }
      status.textContent = enabled
        ? "Your weekly totals are shared under your alias. Update here after future practice."
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
      for (const key of [...progressKeys,"ayah-appearance-v1","ayah-sky-celebrations-v1"]) profileStorage.removeItem(key);
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
    `<p>Guest progress stays in this browser. Adult accounts use Supabase authentication and optional Google sign-in. The authentication provider receives your email and sign-in information. Do not enter a child’s information or use a real name as a public alias.</p><p>Goals, learning history, and progress are saved locally per account. Saved private progress is loaded when signing in on a new device. You can save manually or opt in to automatic sync; only then are subsequent changes uploaded to private account storage. Recordings stay in memory in the tab; they are never backed up or published.</p><p>Public leaderboard participation is off by default. Opting in publishes a chosen alias and weekly totals only. You can opt out, export your progress, or delete your account in account settings.</p><p>Sign-in sessions persist on this device until sign-out. On shared devices, browser storage can be accessed by someone with access to the browser. Sign out and clear site data after exporting or backing up if needed. No advertising trackers are included.</p><p>The site operator must publish their identity, privacy contact, retention policy, provider terms, and applicable regional notices before enabling public registration. Legal compliance depends on the deployment and jurisdiction; this interface is not a legal certification.</p>`;
}
async function showLeaderboard() {
  const dialog = dialogShell("Weekly practice leaderboard"),
    area = dialog.querySelector("[data-content]");
  dialog.classList.add("leaderboard-dialog");
  if (!client) {
    area.innerHTML =
      "<p>The shared leaderboard is not activated yet. No sample users or invented scores are shown. You can track your personal progress in Daily Quests.</p>";
    return;
  }
  area.textContent = "Loading this week’s opt-in activity…";
  try {
    const { data, error } = await client.rpc("get_weekly_leaderboard");
    if (error) throw error;
    area.innerHTML = leaderboardMarkup(data);
  } catch {
    area.textContent =
      "The shared leaderboard could not load. Your personal learning still works.";
  }
}

export const appearanceAccount = () => ({client, userId:user?.id || null});

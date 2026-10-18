import { createClient } from "@supabase/supabase-js";
import {
  profileStorage,
  selectProfile,
  profileBackup,
  progressKeys,
} from "./profile-storage.js";
import { esc } from "../ui/dom.js";
let client = null,
  user = null,
  accountError = "";
export async function initializeAccounts() {
  const url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  try {
    if (!url.startsWith("https://"))
      throw new Error("HTTPS account service required.");
    client = createClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        storage: sessionStorage,
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
    selectProfile(user?.id);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((session?.user?.id || null) !== (user?.id || null)) location.reload();
    });
  } catch {
    accountError =
      "The account service is unavailable. Guest learning remains available.";
    user = null;
    selectProfile(null);
  }
}
export function mountAccountControls(main, learning) {
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
    nav.append(button);
  }
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
    try {
      await action();
    } catch (e) {
      status.textContent = e.message || "The request could not be completed.";
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
    area.innerHTML = `<p>Sign in without a password. Guest learning is always available. Accounts are for adults and parents managing their own learning; children should use guest mode with a parent.</p><form><label><input type="checkbox" name="adult" required> I am 18 or older and understand the privacy information.</label><label>Email <input name="email" type="email" autocomplete="email" required maxlength="254"></label><button class="primary" type="submit">Email me a sign-in code</button></form><form data-verify hidden><label>Sign-in code <input name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required></label><button class="primary" type="submit">Verify code</button></form><button class="text-button" data-google>Continue with Google</button><button class="text-button" data-privacy>Privacy information</button>`;
    let email = "";
    const form = area.querySelector("form");
    form.onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        email = form.elements.email.value.trim();
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        area.querySelector("[data-verify]").hidden = false;
        status.textContent =
          "Check your email for the code. Never share it with anyone.";
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
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            scopes: "openid email",
            redirectTo: location.origin + location.pathname,
          },
        });
        if (error) throw error;
      });
    area.querySelector("[data-privacy]").onclick = showPrivacy;
    return;
  }
  area.innerHTML = `<p>You’re signed in. Your progress is separate from guest and other accounts on this browser. Cloud backups are explicit: save before switching devices, then restore on the other device.</p><div class="account-actions"><button class="primary" data-save>Save private cloud backup</button><button class="text-button" data-restore>Restore cloud backup</button><button class="text-button" data-copy>Copy guest progress into empty account</button><button class="text-button" data-export>Download my account data</button><button class="text-button" data-signout>Sign out</button></div><h3>Optional weekly leaderboard</h3><p>Share only a made-up alias and weekly game/recall totals. No email, ayah details, goals, or recordings are public. Rankings are self-reported practice, not verified recitation.</p><label>Public alias <input data-alias maxlength="24" placeholder="e.g. Cedar42" pattern="[A-Za-z0-9 _-]{3,24}"></label><label><input data-opt-in type="checkbox"> Share my alias and this week’s totals publicly</label><button class="primary small" data-publish>Update leaderboard preference</button><button class="text-button" data-privacy>Privacy information</button><hr><p>Deleting your account removes server backups, public rankings, and this account’s progress on this browser. Download a copy first if wanted.</p><button class="text-button" data-delete>Delete my account and data</button>`;
  area.querySelector("[data-save]").onclick = () =>
    run(async () => {
      const { error } = await client
        .from("learner_progress")
        .upsert({
          user_id: user.id,
          payload: profileBackup(),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      status.textContent =
        "Private cloud backup saved. No recordings were included.";
    });
  area.querySelector("[data-restore]").onclick = () =>
    run(async () => {
      const { data, error } = await client
        .from("learner_progress")
        .select("payload")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No cloud backup found.");
      const entries = Object.entries(data.payload || {});
      if (
        entries.some(
          ([k, v]) => !progressKeys.includes(k) || typeof v !== "string",
        )
      )
        throw new Error("Backup format is not supported.");
      if (
        !confirm(
          "Replace this account’s local progress with its cloud backup? Export your local data first if needed.",
        )
      )
        return;
      for (const key of progressKeys) profileStorage.removeItem(key);
      for (const [key, value] of entries) profileStorage.setItem(key, value);
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
      const { error } = await client.auth.signOut({ scope: "local" });
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
      for (const key of progressKeys) profileStorage.removeItem(key);
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
    `<p>Guest progress stays in this browser. Adult accounts use Supabase authentication and optional Google sign-in. The authentication provider receives your email and sign-in information. Do not enter a child’s information or use a real name as a public alias.</p><p>Goals, learning history, and progress are saved locally per account. Only an explicit cloud-backup action sends them to your private account storage. Recordings stay in memory in the tab; they are never backed up or published.</p><p>Public leaderboard participation is off by default. Opting in publishes a chosen alias and weekly totals only. You can opt out, export your progress, or delete your account in account settings.</p><p>On shared devices, browser storage can be accessed by someone with access to the browser. Sign out and clear site data after exporting or backing up if needed. No advertising trackers are included.</p><p>The site operator must publish their identity, privacy contact, retention policy, provider terms, and applicable regional notices before enabling public registration. Legal compliance depends on the deployment and jurisdiction; this interface is not a legal certification.</p>`;
}
async function showLeaderboard() {
  const dialog = dialogShell("Weekly practice leaderboard"),
    area = dialog.querySelector("[data-content]");
  if (!client) {
    area.innerHTML =
      "<p>The shared leaderboard is not activated yet. No sample users or invented scores are shown. You can track your personal progress in Daily Quests.</p>";
    return;
  }
  area.textContent = "Loading this week’s opt-in activity…";
  try {
    const { data, error } = await client.rpc("get_weekly_leaderboard");
    if (error) throw error;
    area.innerHTML = `<p>Opt-in, self-reported practice totals for the current UTC week. Recitation is not automatically verified. Your own pace matters more than rank.</p><ol class="leaderboard-list">${data.map((row) => `<li><strong>${esc(row.alias)}</strong><span>${row.xp} XP · ${row.stars} stars · ${row.recalls} independent recall attempts</span></li>`).join("") || "<li>No learners have opted in this week yet.</li>"}</ol>`;
  } catch {
    area.textContent =
      "The shared leaderboard could not load. Your personal learning still works.";
  }
}

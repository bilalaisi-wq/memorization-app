import { avatarSvg, items, starter } from "./catalog.js";
import { receiveRemoteRewards, rewardSummary } from "./store.js";
import { profileStorage } from "../learner/profile-storage.js";
import { esc } from "../ui/dom.js";
import { versionedStore } from "../ui/versioned-store.js";
import "./shop.css";
export const LOCAL_SHOP = "ayah-nature-profile-v1";
export async function compressPhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) throw Error("Choose a JPEG, PNG or WebP image under 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width > 6000 || bitmap.height > 6000 || bitmap.width < 1 ||
      bitmap.height < 1
    ) throw Error("Choose an image smaller than 6000 × 6000 pixels.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const c = canvas.getContext("2d");
    c.fillStyle = "#f2eee8";
    c.fillRect(0, 0, 160, 160);
    const side = Math.min(bitmap.width, bitmap.height);
    c.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      160,
      160,
    );
    const data = canvas.toDataURL("image/jpeg", 0.8);
    if (data.length > 70000) {
      throw Error("Image could not be reduced enough. Try a simpler image.");
    }
    return data;
  } finally {
    bitmap.close();
  }
}
export function openNatureShop({ client, user, learning, publisher }) {
  const dialog = document.createElement("dialog");
  dialog.className = "account-dialog nature-shop";
  dialog.innerHTML =
    '<button class="text-button" data-close>Close ×</button><div data-shop></div><p data-shop-status role="status" aria-live="polite"></p>';
  const root = dialog.querySelector("[data-shop]");
  let profile = null,
    pending = false,
    disposed = false,
    filter = "all",
    market = items;
  const local = versionedStore(
    profileStorage,
    LOCAL_SHOP,
    () => ({
      version: 1,
      owned: [...starter],
      creature: "sprout",
      outfit: null,
      scene: "garden",
      photo: null,
      spent: 0,
    }),
    (v) =>
      v?.version === 1 && Array.isArray(v.owned) && v.owned.every((id) =>
        items.some((i) => i.id === id)
      ) && Number.isInteger(v.spent) && v.spent >= 0 &&
      (v.photo === null ||
        typeof v.photo === "string" && v.photo.length <= 70000 &&
          /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.photo)),
  );
  const status = (text) =>
    dialog.querySelector("[data-shop-status]").textContent = text;
  const close = () => {
    disposed = true;
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector("[data-close]").onclick = close;
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  const readLocal = () => {
    const p = local.snapshot(), summary = rewardSummary(learning);
    return {
      ...p,
      balance: Math.max(0, summary.xp + 5 * summary.stars - p.spent),
    };
  };
  const rpc = async (name, args) => {
    const r = await client.rpc(name, { ...args, expected_user: user.id });
    if (r.error) {
      throw Error(
        ["PGRST202", "42883"].includes(r.error.code)
          ? "Account customization is temporarily unavailable. Your XP is saved; please try again later."
          : r.error.message ||
            "Account customization is unavailable. Your progress is safe.",
      );
    }
    return r.data;
  };
  async function action(fn) {
    if (pending) return;
    pending = true;
    root.querySelectorAll("button,input").forEach((b) => b.disabled = true);
    try {
      await fn();
      if (!disposed) {
        draw();
        status("Your companion is ready. Keep growing at your own pace.");
      }
    } catch (e) {
      if (!disposed) {
        draw();
        status(e.message);
      }
    } finally {
      pending = false;
    }
  }
  function draw() {
    if (disposed) return;
    if (user) receiveRemoteRewards(profile);
    window.dispatchEvent(
      new CustomEvent("ayahnaturechange", { detail: profile }),
    );
    root.innerHTML =
      `<header class="shop-heading"><span class="eyebrow">A LITTLE GARDEN OF REWARDS</span><h2>Nature Companions</h2><p>Grow a companion with the practice you already do. No purchases with money, random prizes, or expiring ownership.</p></header><section class="companion-home">${
        avatarSvg(profile)
      }<div><h3>Your space to grow</h3><strong class="seed-balance">✿ ${profile.balance} Seeds</strong><p>1 earned XP = 1 Seed · 1 earned star = 5 Seeds. Spending Seeds never removes XP, stars or memorization progress.</p>${
        profile.photo
          ? `<img class="profile-photo" src="${
            esc(profile.photo)
          }" alt="Your private profile picture">`
          : ""
      }<label>Private profile picture<input data-photo type="file" accept="image/jpeg,image/png,image/webp"></label><p>Your picture is private to your account; leaderboards show your nature companion instead. Images are cropped, resized and re-encoded before saving. Avoid sensitive photos.</p><button class="text-button" data-remove-photo>Remove picture</button><button class="text-button" data-no-outfit>Remove outfit</button>${
        user
          ? '<button class="primary small" data-sync-earnings>Sync my earned rewards</button><p>The displayed balance is your synced account balance. Tap Sync to include learning saved on this device. Syncing sends dated XP receipts without ayah references to your private account. Your chosen companion appears beside your alias only if you opt into the leaderboard.</p>'
          : "<p>Guest customization stays in this browser. Sign in to keep a separate account wardrobe across devices.</p>"
      }</div></section><div class="shop-categories" role="group" aria-label="Shop categories">${
        [["all", "All treasures"], ["creature", "Companions"], [
          "outfit",
          "Outfits",
        ], ["scene", "Homes"]].map(([id, label]) =>
          `<button class="text-button" data-filter="${id}" aria-pressed="${
            filter === id
          }">${label}</button>`
        ).join("")
      }</div><div class="shop-items">${
        market.filter((i) =>
          i.available !== false || profile.owned.includes(i.id)
        ).filter((i) => filter === "all" || i.kind === filter).map((item) => {
          const owned = profile.owned.includes(item.id),
            equipped = profile[
              item.kind === "creature"
                ? "creature"
                : item.kind === "outfit"
                ? "outfit"
                : "scene"
            ] === item.id;
          const preview = {
            ...profile,
            [
              item.kind === "creature"
                ? "creature"
                : item.kind === "outfit"
                ? "outfit"
                : "scene"
            ]: item.id,
          };
          return `<article data-item="${item.id}">${avatarSvg(preview)}<h3>${
            esc(item.name)
          }</h3><p>${esc(item.description)}</p><strong>${
            owned ? "In your wardrobe" : `${item.price} Seeds`
          }</strong><button class="${
            owned ? "text-button" : "primary small"
          }" data-shop-item="${item.id}" ${
            equipped || !owned && profile.balance < item.price ? "disabled" : ""
          }>${
            equipped
              ? "Equipped"
              : owned
              ? "Equip"
              : `Adopt / unlock · ${item.price}`
          }</button>${
            !owned && profile.balance < item.price
              ? `<small>${
                item.price - profile.balance
              } more Seeds to grow toward</small>`
              : ""
          }</article>`;
        }).join("")
      }</div><footer><p>The collection can grow with new companions, outfits and homes. Items you already own stay yours.</p><p>Study XP rewards meaningful learning actions across every mode, with daily repeat limits. Opening menus, buying items and AI output do not prove memorization or earn extra XP.</p><button class="text-button" data-export-profile>Download my customization</button></footer>`;
    root.querySelectorAll("[data-filter]").forEach((b) =>
      b.onclick = () => {
        filter = b.dataset.filter;
        draw();
      }
    );
    root.querySelectorAll("[data-shop-item]").forEach((b) =>
      b.onclick = () =>
        action(async () => {
          const id = b.dataset.shopItem,
            item = market.find((i) => i.id === id),
            owned = profile.owned.includes(id);
          if (user) {
            profile = await rpc(
              owned ? "equip_nature_item" : "buy_nature_item",
              {
                item_id: id,
                ...(!owned ? { expected_price: item.price } : {}),
              },
            );
            if (!owned) {
              profile = await rpc("equip_nature_item", { item_id: id });
            }
          } else {
            local.transact((p) => {
              if (!p.owned.includes(id)) {
                const summary = rewardSummary(learning);
                if (
                  summary.xp + summary.stars * 5 - p.spent < item.price
                ) throw Error("Keep practicing to earn more Seeds.");
                p.owned.push(id);
                p.spent += item.price;
              }
              p[
                item.kind === "creature"
                  ? "creature"
                  : item.kind === "outfit"
                  ? "outfit"
                  : "scene"
              ] = id;
            });
            profile = readLocal();
          }
        })
    );
    root.querySelector("[data-photo]").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      action(async () => {
        const photo = await compressPhoto(f);
        if (user) await rpc("set_my_profile_photo", { photo_data: photo });
        else local.transact((p) => p.photo = photo);
        profile = user ? await rpc("my_nature_profile") : readLocal();
      });
    };
    root.querySelector("[data-remove-photo]").onclick = () =>
      action(async () => {
        if (user) {
          await rpc("set_my_profile_photo", { photo_data: null });
          profile = await rpc("my_nature_profile");
        } else {
          local.transact((p) => p.photo = null);
          profile = readLocal();
        }
      });
    root.querySelector("[data-no-outfit]").onclick = () =>
      action(async () => {
        if (user) {
          profile = await rpc("equip_nature_item", { item_id: "no-outfit" });
        } else {
          local.transact((p) => p.outfit = null);
          profile = readLocal();
        }
      });
    root.querySelector("[data-sync-earnings]")?.addEventListener(
      "click",
      () =>
        action(async () => {
          await publisher.flush();
          profile = await rpc("my_nature_profile");
        }),
    );
    root.querySelector("[data-export-profile]").onclick = () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(profile, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "ayah-nature-companion.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  document.body.append(dialog);
  dialog.showModal();
  root.textContent = "Preparing your garden…";
  (async () => {
    try {
      profile = user ? await rpc("my_nature_profile") : readLocal();
      if (user) {
        const response = await client.from("avatar_catalog").select(
          "id,kind,price,active",
        );
        if (response.error) {
          throw Error("The collection could not load. Retry when connected.");
        }
        market = items.map((i) => {
          const row = response.data.find((r) => r.id === i.id);
          return { ...i, price: row?.price ?? i.price, available: !!row };
        });
      }
      draw();
      if (local.warning && !user) status(local.warning);
    } catch (e) {
      if (!disposed) {
        root.innerHTML =
          "<h2>Nature Companions</h2><p>Account customization is temporarily unavailable. Learning rewards remain saved locally; please try again later.</p>";
        status(e.message);
      }
    }
  })();
}

import {activeProfileId} from '../learner/profile-storage.js';
const observedAccess=new WeakMap();
// Entitlements are intentionally never accepted from localStorage or URL params.
export function billingClient(client) {
  const fail = () => {
    throw new Error(
      "Billing is unavailable. All existing free learning remains available.",
    );
  };
  return {
    async entitlements() {
      if (!client) return fail();
      const owner=activeProfileId();
      const { data, error } = await client.rpc("my_billing_entitlements");
      if(owner!==activeProfileId())throw Error("Account changed while loading entitlements.");
      if (
        error || !data?.features ||
        !["free", "explorer", "pathfinder", "guardian"].includes(data.plan)
      ) return fail();
      const signature=JSON.stringify([activeProfileId(),data.plan,data.selectedJuz,data.developer,data.features,data.accessUntil]);
      const previous=observedAccess.get(client);observedAccess.set(client,signature);
      if(previous&&previous!==signature&&typeof window!=="undefined")window.dispatchEvent(new CustomEvent("ayah-content-access-changed",{detail:{owner:activeProfileId()}}));
      return data;
    },
    async invoke(name, body = {}) {
      if (!client) return fail();
      const { data, error } = await client.functions.invoke(`billing-${name}`, {
        body,
      });
      if (error) {
        let message =
          "Billing could not be completed. Please retry; free learning is unaffected.";
        try {
          const json = await error.context?.json();
          if (typeof json?.error === "string") message = json.error;
        } catch {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    async chooseJuz(choices) {
      const { data, error } = await client.rpc("choose_my_juz", { choices });
      if (error) {
        throw new Error(
          "Unable to save. Choose up to five additional juz with an active Explorer subscription.",
        );
      }
      return data;
    },
  };
}
export function stripeRedirect(value, kind) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    url.hostname !==
      (kind === "portal" ? "billing.stripe.com" : "checkout.stripe.com")
  ) throw new Error("Invalid billing destination.");
  return url.href;
}

export const billingUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "learner@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
export const freeEntitlements = {
  plan: "free",
  mode: "test",
  checkoutEnabled: true,
  guardianEnabled: false,
  selectedJuz: [],
  accessUntil: null,
  cancelAtPeriodEnd: false,
  features: {
    juzAmma: true,
    existingFreeFeatures: true,
    basicRevision: true,
    passageBuilder: false,
    allQuran: false,
    advancedRevision: false,
    memoryAnalytics: false,
    ai: false,
    advancedAi: false,
  },
};
export async function mockBilling(
  page,
  { signed = true, plan = "free", cancel = false } = {},
) {
  const state = {
    ent: {
      ...freeEntitlements,
      plan,
      accessUntil: plan === "free" ? null : "2099-01-01T00:00:00Z",
      cancelAtPeriodEnd: cancel,
      features: {
        ...freeEntitlements.features,
        passageBuilder: plan !== "free",
        advancedRevision: ["pathfinder", "guardian"].includes(plan),
        memoryAnalytics: ["pathfinder", "guardian"].includes(plan),
        allQuran: ["pathfinder", "guardian"].includes(plan),
      },
    },
    calls: [],
    passages: [],
    failCheckout: false,
  };
  if (signed) {
    await page.addInitScript((user) => {
      const payload = {
        sub: user.id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const b64 = (v) =>
        btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_")
          .replaceAll("=", "");
      localStorage.setItem(
        "sb-ycgyuatjgdbhiakqourg-auth-token",
        JSON.stringify({
          access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${
            b64(payload)
          }.fixture`,
          refresh_token: "fixture-refresh",
          expires_at: payload.exp,
          token_type: "bearer",
          user,
        }),
      );
    }, billingUser);
  }
  await page.route(
    "https://ycgyuatjgdbhiakqourg.supabase.co/**",
    async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {}
      state.calls.push({ path, body });
      if (path.endsWith("/auth/v1/user")) {
        return route.fulfill({
          json: billingUser,
        });
      }
      if (path.endsWith("/my_billing_entitlements")) {
        return route.fulfill({
          json: state.ent,
        });
      }
      if (path.endsWith("/choose_my_juz")) {
        if (body.choices.length > 5) {
          return route.fulfill({
            status: 400,
            json: { message: "Too many" },
          });
        }
        state.ent.selectedJuz = body.choices;
        return route.fulfill({ json: state.ent });
      }
      if (path.endsWith("/billing-checkout")) {
        return state.failCheckout
          ? route.fulfill({
            status: 503,
            json: { error: "Checkout is temporarily unavailable." },
          })
          : route.fulfill({
            json: { url: "https://checkout.stripe.com/c/pay/test_fixture" },
          });
      }
      if (path.endsWith("/billing-portal")) {
        return route.fulfill({
          json: { url: "https://billing.stripe.com/p/session/test_fixture" },
        });
      }
      if (path.endsWith("/billing-refresh")) {
        return route.fulfill({
          json: state.ent,
        });
      }
      if (path.endsWith("/billing-passages")) {
        if (body.action === "save") {
          if (!state.ent.features.passageBuilder) {
            return route.fulfill({
              status: 403,
              json: { error: "Explorer subscription required." },
            });
          }
          const saved = {
            id: "00000000-0000-0000-0000-000000000098",
            title: body.title,
            surah: body.surah,
            first_ayah: body.firstAyah,
            last_ayah: body.lastAyah,
          };
          state.passages.push(saved);
          return route.fulfill({ json: saved });
        }
        if (body.action === "delete") {
          state.passages = state.passages.filter((p) => p.id !== body.id);
          return route.fulfill({ json: { deleted: true } });
        }
        return route.fulfill({ json: state.passages });
      }
      if (
        path.endsWith("/learner_progress") ||
        path.endsWith("/learner_appearance") ||
        path.endsWith("/leaderboard_preferences")
      ) return route.fulfill({ json: [] });
      return route.fulfill({
        status: 404,
        json: { message: "Fixture endpoint not configured" },
      });
    },
  );
  return state;
}

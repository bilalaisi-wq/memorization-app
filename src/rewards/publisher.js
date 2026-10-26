import { receiveRemoteRewards, rewardSummary } from "./store.js";
const digest = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
// Only opt-in leaderboard users automatically publish. Shop sync is an explicit action.
export class RewardPublisher {
  constructor(client, learning, storage, userId = null) {
    Object.assign(this, {
      client,
      learning,
      storage,
      userId,
      enabled: false,
      pending: false,
      again: false,
      sent: new Set(),
      status:
        "Learning rewards stay on this device until you opt in or sync earnings.",
      lastError: null,
    });
  }
  schedule() {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush().catch(() => {}), 1200);
  }
  async flush() {
    if (this.pending) {
      this.again = true;
      return this.pending;
    }
    this.pending = this.send();
    try {
      return await this.pending;
    } finally {
      this.pending = false;
      if (this.again) {
        this.again = false;
        this.schedule();
      }
    }
  }
  async send() {
    try {
      const summary = rewardSummary(this.learning, this.storage),
        events = await Promise.all(
          summary.events.filter((e) => !this.sent.has(e.id)).map(async (e) => ({
            ...e,
            at: e.at.slice(0, 10) + "T00:00:00.000Z",
            id: await digest(e.id),
          })),
        );
      let data;
      for (let offset = 0; offset < Math.max(events.length, 1); offset += 500) {
        const batch = events.slice(offset, offset + 500),
          response = await this.client.rpc("sync_learning_rewards", {
            events: batch,
            ...(this.userId ? { expected_user: this.userId } : {}),
            legacy_basis: Math.min(
              1000000,
              summary.legacyXP + summary.legacyStars * 5,
            ),
            legacy_xp: summary.legacyXP,
            legacy_stars: summary.legacyStars,
          });
        if (response.error) {
          if (
            response.status === 404 ||
            ["PGRST202", "42883"].includes(response.error.code)
          ) {
            const start = new Date();
            start.setUTCHours(0, 0, 0, 0);
            start.setUTCDate(
              start.getUTCDate() - ((start.getUTCDay() + 6) % 7),
            );
            const weekly = summary.events.filter((e) =>
              Date.parse(e.at) >= +start
            );
            const history = weekly.map((e) => ({
              at: e.at,
              xp: e.xp,
              stars: e.stars,
            }));
            const memory = weekly.filter((e) => e.recalls).map((e) => ({
              at: e.at,
              independent: true,
              reward: { xp: 0, stars: 0 },
            }));
            const fallback = await this.client.rpc("publish_weekly_activity", {
              learning: {
                records: {
                  learning_rewards: {
                    game: { history },
                    memory: { history: memory },
                  },
                },
              },
            });
            if (fallback.error) {
              throw Error(
                "Leaderboard updates could not sync. Earned XP is saved locally; retry when connected.",
              );
            }
            summary.events.forEach((e) => this.sent.add(e.id));
            this.status =
              "Weekly learning XP updated. Account shop setup is separate.";
            return { legacyOnly: true };
          }
          throw Error(
            "Rewards could not sync. Your earned XP is saved locally; retry when connected.",
          );
        }
        data = response.data;
      }
      summary.events.forEach((e) => this.sent.add(e.id));
      this.lastError = null;
      this.status = "Learning XP is up to date across modes.";
      receiveRemoteRewards(data);
      return data;
    } catch (error) {
      this.lastError = error;
      this.status = error.message;
      throw error;
    }
  }
  dispose() {
    clearTimeout(this.timer);
    this.enabled = false;
  }
}

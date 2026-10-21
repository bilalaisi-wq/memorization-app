import { webhookHandler } from "../_shared/webhook.ts";
Deno.serve(webhookHandler());

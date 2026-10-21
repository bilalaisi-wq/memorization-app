import { protectedEndpoint } from "../_shared/runtime.ts";
import { closeBilling } from "../_shared/actions.ts";
Deno.serve(protectedEndpoint(closeBilling));

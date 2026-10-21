import { protectedEndpoint } from "../_shared/runtime.ts";
import { refresh } from "../_shared/actions.ts";
Deno.serve(protectedEndpoint(refresh));

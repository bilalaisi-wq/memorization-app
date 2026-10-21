import { protectedEndpoint } from "../_shared/runtime.ts";
import { portal } from "../_shared/actions.ts";
Deno.serve(protectedEndpoint(portal));

import { protectedEndpoint } from "../_shared/runtime.ts";
import { passages } from "../_shared/actions.ts";
Deno.serve(protectedEndpoint(passages));

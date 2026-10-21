import { protectedEndpoint } from "../_shared/runtime.ts";
import { checkout } from "../_shared/actions.ts";
Deno.serve(protectedEndpoint(checkout));

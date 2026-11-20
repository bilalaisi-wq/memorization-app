import {protectedEndpoint} from '../_shared/runtime.ts';
import {nativeAction} from '../_shared/native-billing/service.ts';
Deno.serve(protectedEndpoint(nativeAction));

import {notificationEndpoint} from '../_shared/native-billing/notifications.ts';
Deno.serve(notificationEndpoint('google'));

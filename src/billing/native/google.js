import {purchaseAdapter} from './adapter.js';
export const googlePurchasing=options=>purchaseAdapter({...options,provider:'google'});

import {purchaseAdapter} from './adapter.js';
export const applePurchasing=options=>purchaseAdapter({...options,provider:'apple'});

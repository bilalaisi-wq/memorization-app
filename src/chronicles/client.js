import {appearanceAccount} from '../learner/accounts.js';
export async function chroniclesRequest(input,client=appearanceAccount().client){
 if(!client)throw Error("QUR'AN CHRONICLES content service is not configured.");
 const {data,error}=await client.functions.invoke('chronicles-content',{body:input});
 if(error||data?.error){let message=data?.error;try{message=(await error?.context?.json())?.error||message;}catch{/* The response may already be consumed. */}throw Error(message||"QUR'AN CHRONICLES could not load. Check the editorial setup or your content access.");}
 return data;
}

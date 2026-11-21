/** One queued handoff per completed checkpoint. No timer, scheduler or reward writes.
 * The engine still validates the action and the host still authorizes/exposes content. */
export function automaticContinuation() {
 let disposed=false,pending=null,last=null;
 return {update(key,ready,advance){if(!ready){last=null;pending=null;return;}if(disposed||pending!==null||last===key)return;last=key;pending=key;
  queueMicrotask(()=>{const token=pending;pending=null;if(!disposed&&token===key)advance();});
 },dispose(){disposed=true;pending=null;}};
}

// A mounted game's RAF queue stops while the native app or browser is hidden.
// Foregrounding delivers pending callbacks; the game's own paused state still requires Resume.
export function backgroundFrames({target=window,documentRef=document,request=callback=>window.requestAnimationFrame(callback),cancel=id=>window.cancelAnimationFrame(id)}={}){
 let paused=documentRef.hidden,disposed=false,sequence=0;const tasks=new Map();
 const arm=(id,task)=>{if(!paused&&!disposed)task.native=request(time=>{task.native=null;tasks.delete(id);if(!disposed&&!paused)task.callback(time);});};
 const suspend=()=>{paused=true;for(const task of tasks.values()){if(task.native!==null)cancel(task.native);task.native=null;}};
 const resume=()=>{if(documentRef.hidden||disposed)return;paused=false;for(const [id,task]of tasks)if(task.native===null)arm(id,task);};
 const visibility=()=>documentRef.hidden?suspend():resume();
 target.addEventListener('ayah-native-background',suspend);target.addEventListener('ayah-native-foreground',resume);documentRef.addEventListener('visibilitychange',visibility);
 return {request:callback=>{if(disposed)return 0;const id=++sequence,task={callback,native:null};tasks.set(id,task);arm(id,task);return id;},cancel:id=>{const task=tasks.get(id);if(task?.native!==null&&task?.native!==undefined)cancel(task.native);tasks.delete(id);},dispose:()=>{disposed=true;suspend();tasks.clear();target.removeEventListener('ayah-native-background',suspend);target.removeEventListener('ayah-native-foreground',resume);documentRef.removeEventListener('visibilitychange',visibility);}};
}

// Pure reducer. Games map their own mechanics into these learning events.
export function createSession({id,game,config}) {
  if (!id || !game || !config?.keys?.length || !['classic','practice'].includes(config.chainMode)) throw Error('Invalid session');
  return {id,game,config:structuredClone(config),status:'ready',checkpoint:0,completed:[],strikes:0,mistakes:[],motorErrors:[],assistance:[],events:0};
}
export function reduceSession(previous, action) {
  if (previous.status==='disposed') return previous;
  const s=structuredClone(previous), key=s.config.keys[s.checkpoint];
  if (action.type==='dispose') {s.status='disposed';return s;}
  if (action.type==='start' && s.status==='ready') s.status='playing';
  else if (action.type==='pause' && s.status==='playing') s.status='paused';
  else if (action.type==='resume' && s.status==='paused') s.status='playing';
  else if (action.type==='retry' && s.status==='lost') {
    s.checkpoint=s.config.chainMode==='practice'?s.checkpoint:0;
    if(s.config.chainMode==='classic') s.completed=[];
    s.strikes=0;s.status='playing';
  } else if (s.status==='playing') {
    if (action.type==='mistake') {
      s.mistakes.push({key,kind:'sequence',event:s.events});
      s.strikes++;
      if(s.strikes===3) s.status='lost';
    } else if(action.type==='motor-error') s.motorErrors.push({key,event:s.events});
    else if(action.type==='assist') s.assistance.push({key,kind:['audio','hint','reference'].includes(action.kind)?action.kind:'hint',event:s.events});
    else if(action.type==='checkpoint') {
      s.completed.push(key);
      if(s.checkpoint===s.config.keys.length-1) s.status='won';
      else { s.checkpoint++; if(s.config.chainMode==='practice') s.strikes=0; }
    } else return previous;
  } else return previous;
  s.events++;return s;
}
export function createController({initial,render=()=>{},onDispose=()=>{}}) {
  let state=structuredClone(initial);
  const dispatch=action=>{state=reduceSession(state,action);render(structuredClone(state));return structuredClone(state);};
  return {start:()=>dispatch({type:'start'}),pause:()=>dispatch({type:'pause'}),resume:()=>dispatch({type:'resume'}),dispatch,getSnapshot:()=>structuredClone(state),dispose(){if(state.status==='disposed')return;dispatch({type:'dispose'});onDispose();}};
}

// Pure, deterministic motor-only simulation. No Quran, storage, rewards or FSRS.
export const WORLD = Object.freeze({ width: 600, height: 720, shipY: 595, lanes: [120, 300, 480] });
export const PATTERNS = Object.freeze(['twin-rocks', 'drift', 'slalom', 'pinch', 'star-pocket', 'sweep']);
const clone = value => structuredClone(value);

export function buildRunnerWaves(seed = 1, difficulty = 0, slow = false) {
  let n = seed >>> 0;
  const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  const level = Math.min(6, Math.max(0, difficulty));
  const speed = (slow ? 105 : 150) + level * (slow ? 4 : 7);
  const spacing = (slow ? 3.3 : 2.8) - level * .08;
  const shift = Math.floor(random() * 3);
  return Array.from({length:6}, (_,i) => {
    const safeLane = ([0,2,1,0,2,1][i] + shift) % 3;
    const blocked = [0,1,2].filter(lane=>lane!==safeLane);
    const pattern = PATTERNS[(i + (seed >>> 0) % PATTERNS.length) % PATTERNS.length];
    return { id:`wave:${i}`, pattern, safeLane, arrival:5+i*spacing, speed,
      objects:[...blocked.map((lane,j)=>({id:`wave:${i}:rock:${j}`,kind:'asteroid',lane,radius:pattern==='pinch'?36:29,
        lead:pattern==='slalom'?-j*.7:pattern==='star-pocket'?-.6+j*.3:0,
        drift:pattern==='sweep'?45:['drift','pinch'].includes(pattern)?32:0,
        frequency:pattern==='sweep'?2.3:1.7,phase:random()*Math.PI*2})),
      {id:`wave:${i}:star`,kind:'star',lane:safeLane,radius:21,drift:0,phase:0}] };
  });
}

export function createRunner({ seed = 1, stageId = 'runner:stage:1', difficulty = 0, slow = false, onEvent = () => {} } = {}) {
  const waves = buildRunnerWaves(seed, difficulty, slow);
  let state;
  function reset() {
    state = { status:'ready', stageId, elapsed:0, lane:1, x:WORLD.lanes[1], shield:3, stars:0, motorErrors:0,
      laneChanges:0, invulnerable:0, impact:0, resolved:[], reason:'', checkpointId:null };
  }
  reset();
  const emit = (type, detail={}) => onEvent({type:`runner:${type}`,stageId,elapsed:state.elapsed,...detail});
  function objects() {
    return waves.flatMap(w=>w.objects.map(o=>({...o,waveId:w.id,pattern:w.pattern,safeLane:w.safeLane,
      x:WORLD.lanes[o.lane]+(o.drift ? Math.sin(state.elapsed*(o.frequency||1.7)+o.phase)*o.drift : 0),
      y:WORLD.shipY+(state.elapsed-w.arrival-(o.lead||0))*w.speed,
    }))).filter(o=>!state.resolved.includes(o.id)&&o.y>=-80&&o.y<=WORLD.height+80);
  }
  function snapshot() {
    const upcoming = waves.find(w=>w.arrival >= state.elapsed-.4);
    return clone({...state,objects:objects(),waves: waves.map(({id,pattern,safeLane,arrival})=>({id,pattern,safeLane,arrival})),
      duration:waves.at(-1).arrival+1.5, nextSafeLane:upcoming?.safeLane ?? null,
      progress:Math.min(1,state.elapsed/(waves.at(-1).arrival+1.5)),slow });
  }
  function advance(dt) {
    state.elapsed += dt * .7;
    state.invulnerable = Math.max(0,state.invulnerable-dt);
    state.impact = Math.max(0,state.impact-dt);
    const delta = WORLD.lanes[state.lane]-state.x;
    state.x += Math.sign(delta)*Math.min(Math.abs(delta),dt*1400);
    for (const o of objects()) {
      const radius = o.radius + (o.kind==='star'?24:17);
      if ((o.x-state.x)**2+(o.y-WORLD.shipY)**2 > radius**2) continue;
      state.resolved.push(o.id);
      if(o.kind==='star') { state.stars++; emit('star',{objectId:o.id,stars:state.stars}); }
      else if(state.invulnerable===0) {
        state.shield--; state.motorErrors++; state.invulnerable=1.5; state.impact=.55;
        emit('collision',{objectId:o.id,shield:state.shield,category:'motor-control'});
        if(state.shield===0) { state.status='recovery'; state.reason='Shield depleted. Retry this flight stage from its safe start.'; emit('recovery',{motorErrors:state.motorErrors}); return; }
      }
    }
    if(state.elapsed >= waves.at(-1).arrival+1.5) {
      if(state.stars>=3 && state.laneChanges>=2) {
        state.status='checkpoint'; state.shield=3; state.checkpointId=`${stageId}:runner-clear`;
        state.reason='Safe checkpoint reached. Shield restored.';
        emit('checkpoint',{checkpointId:state.checkpointId,stars:state.stars,motorErrors:state.motorErrors,category:'motor-control'});
      } else {
        state.status='recovery'; state.reason='Collect at least 3 navigation stars and change lanes at least twice to clear this stage. Try again at your own pace.';
        emit('recovery',{motorErrors:state.motorErrors,reason:'navigation-objective'});
      }
    }
  }
  const api = {
    start() { if(state.status==='ready') {state.status='running';emit('start');} return snapshot(); },
    pause(reason='Flight paused.') { if(state.status==='running') {state.status='paused';state.reason=reason;emit('pause');} return snapshot(); },
    resume() { if(state.status==='paused') {state.status='running';state.reason='';emit('resume');} return snapshot(); },
    dispatch(action) {
      if(state.status==='disposed')return snapshot();
      if(action.type==='start')return api.start();
      if(action.type==='pause')return api.pause(action.reason);
      if(action.type==='resume')return api.resume();
      if(action.type==='restart') { reset();emit('restart');return api.start(); }
      if(state.status!=='running')return snapshot();
      if(action.type==='lane' && [-1,1].includes(action.direction)) {
        const next=Math.max(0,Math.min(2,state.lane+action.direction));
        if(next!==state.lane){state.lane=next;state.laneChanges++;emit('lane',{lane:next});}
      }
      if(action.type==='tick' && Number.isFinite(action.dt) && action.dt>0) {
        // No catch-up damage after a suspended tab or stalled frame.
        if(action.dt>.25)return api.pause('Flight paused after an interruption. Resume when ready.');
        let remaining=action.dt;
        while(remaining>1e-8&&state.status==='running'){const step=Math.min(remaining,1/120);advance(step);remaining-=step;}
      }
      return snapshot();
    },
    getSnapshot:snapshot,
    dispose() { if(state.status!=='disposed'){state.status='disposed';emit('dispose');} },
  };
  return api;
}

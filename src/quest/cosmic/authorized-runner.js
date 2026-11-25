import {passageRun} from '../../revision/continuous/model.js';
import {profileStorage} from '../../learner/profile-storage.js';
import {
  catalog,
  availability,
  freeReference,
  loadAudio,
  loadBundle,
  sha256,
} from "../../content/library.js";
import { activeProfileId } from "../../learner/profile-storage.js";
import { fingerprints, validateRefs } from "../../passage-context/model.js";
import { createFlowUnits, flowChoices, flowTransliteration } from "./flow-content.js";
import { createFlowRunner } from "../../puzzles/arcade/cosmic/flow-runner.js";
const trusted = new WeakSet();
export function assertRunnerContent(source) {
  if (!trusted.has(source)) {
    throw Error("Authorize runner content through the shared loader.");
  }
  source.assertCurrent();
  return source;
}
// Each stage owns at most five ayahs. Source text is never placed in campaign storage.
export async function prepareRunnerContent(
  refs,
  client,
  {
    isCurrent = () => true,
    verifyBundle = () => {},
    loader = loadBundle,
    audioLoader = loadAudio,
  } = {},
) {
  validateRefs(refs);
  if (refs.length > 5) throw Error("Runner stages support up to five ayahs.");
  const owner = activeProfileId(),
    bundles = new Map(),
    resources = new Map(),
    pins = {};
  let disposed = false;
  const assertCurrent = () => {
    if (disposed || owner !== activeProfileId() || !isCurrent()) {
      throw Error("Runner content authorization changed.");
    }
  };
  try {
    for (const key of refs) {
      const b = await loader(key, client);
      assertCurrent();
      await verifyBundle(b);
      pins[key] = await fingerprints(b);
      assertCurrent();
      bundles.set(key, b);
    }
  } catch (error) {
    bundles.clear();
    throw error;
  }
  const source = {
    refs: [...refs],
    pins,
    private: refs.some((k) => !freeReference(k)),
    assertCurrent,
    ayah(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Reference outside the authorized stage.");
      return {
        ref,
        name: catalog.chapters.find((c) => c.id === b.surah).name,
        text: b.textUthmani,
        surah: b.surah,
        ayah: b.ayah,
      };
    },
    words(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Word reference outside the authorized stage.");
      return b.words.map((w) => ({
        id: `${ref}:${w.position - 1}`,
        key: ref,
        index: w.position - 1,
        text: w.text,
        sourcePositions: [w.position],
      }));
    },
    transliteration(unit) {
      assertCurrent();
      if (freeReference(unit.key) && !bundles.has(unit.key)) return flowTransliteration(unit);
      const b = bundles.get(unit.key);
      if (!b) return "";
      const first = unit.kind === "ayah" ? 0 : unit.index,
        last = unit.kind === "ayah"
          ? b.words.length
          : unit.kind === "chunk"
          ? unit.endIndex
          : first + 1;
      return b.words.slice(first, last).map((w) => w.transliteration || "")
        .join(" ");
    },
    async audio(ref) {
      assertCurrent();
      const b = bundles.get(ref);
      if (!b) throw Error("Audio outside the authorized stage.");
      if (!resources.has(ref)) {
        const lease = await audioLoader(b, client);
        try {
          assertCurrent();
        } catch (e) {
          lease.revoke();
          throw e;
        }
        if (resources.has(ref)) lease.revoke();
        else resources.set(ref, lease);
      }
      return resources.get(ref).url;
    },
    async revalidate() {
      for (const ref of refs) {
        const b = await loader(ref, client);
        assertCurrent();
        await verifyBundle(b);
        if (
          JSON.stringify(await fingerprints(b)) !== JSON.stringify(pins[ref])
        ) {
          throw Error(
            "Runner source/review revision changed. Saved checkpoints are preserved.",
          );
        }
      }
    },
    dispose() {
      disposed = true;
      resources.forEach((r) => r.revoke());
      resources.clear();
      bundles.clear();
    },
  };
  trusted.add(source);
  return source;
}
async function mountRunnerWindow(
  root,
  {
    refs,
    client,
    isCurrent = () => true,
    verifyBundle,
    onComplete = null,
    onExit = () => {},
    rounds = 1,
    onWindowEvent = () => {},
    memoryDifficulty='guided',motorDifficulty='relaxed',
  } = {},
) {
  const content = await prepareRunnerContent(refs, client, {
    isCurrent,
    verifyBundle,
  });
  let owned = null;
  try {
    const sourceHash = await sha256(JSON.stringify(content.pins)),
      id = `cosmic-authorized:${await sha256(
        JSON.stringify([refs, sourceHash]),
      )}`;
    const mission = {
      schema: 2,
      policy: "cosmic-authorized-v1",
      id,
      sourceHash,
      refs: [...refs],
      surah: Number(refs[0].split(":")[0]),
      first: Number(refs[0].split(":")[1]),
      last: Number(refs.at(-1).split(":")[1]),
      stages: [{ id: id + ":stage:1", refs: [...refs],first:Number(refs[0].split(":")[1]),last:Number(refs.at(-1).split(":")[1]) }],
    };
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
      throw Error("Choose one to ten revision rounds.");
    }
    const lifecycle = new AbortController();
    const listeners = new Set();
    let round = 0, disposed = false, engine;
    const emit = (e) =>
      listeners.forEach((fn) =>
        fn({
          ...e,
          targetRef: e.targetRef || refs[0],
          stageIndex: 0,
          roundIndex: round,
          roundCount: rounds,
          missionId: id,
          sourceHash,
        })
      );
    const make = () =>
      createFlowRunner({
        units: createFlowUnits(refs, "mixed", round, content),
        choices: (u, seed) => flowChoices(u, seed, content),
        seed: parseInt(sourceHash.slice(0, 8), 16),
        stageId: mission.stages[0].id,
        roundIndex: round,
        slow: motorDifficulty==='relaxed',
        motorDifficulty,
        onEvent: emit,
      });
    engine = make();
    const controller = {
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getSnapshot() {
        content.assertCurrent();
        return {
          ...engine.getSnapshot(),
          runId: id,
          stageIndex: 0,
          stageCount: 1,
          stageNumber: 1,
          roundIndex: round,
          roundCount: rounds,
          atRouteEnd: round === rounds - 1,
          routeComplete: round === rounds - 1 &&
            engine.getSnapshot().status === "checkpoint",
          gateway: null,
        };
      },
      dispatch(a) {
        content.assertCurrent();
        if(a.type==='continuous-next'){controller.nextStage();return;}return engine.dispatch(a);
      },
      pause(reason) {
        return engine.pause(reason);
      },
      nextStage() {
        if (round >= rounds - 1) return false;
        engine.dispose();
        round++;
        engine = make();
        engine.start();
        return true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        lifecycle?.abort();
        engine.dispose();
        listeners.clear();
        content.dispose();
      },
    };
    owned = controller;
    let checking = false;
    const invalidate = () => {
      lifecycle.abort();
      controller.dispose();
      root.replaceChildren(
        Object.assign(document.createElement("p"), {
          textContent:
            "Passage authorization changed. Reopen the saved mission to reauthorize.",
        }),
      );
    };
    const check = async () => {
      if (checking || disposed || !content.private) return;
      checking = true;
      try {
        await content.revalidate();
      } catch {
        if (!disposed) {
          game.dispose();
          invalidate();
        }
      } finally {
        checking = false;
      }
    };
    const { mountStarRunner } = await import(
      "../../puzzles/arcade/cosmic/ui.js"
    );
    const game = await mountStarRunner(root, mission, {
      controller,
      onEvent:onWindowEvent,
      content,
      isCurrent,
      disposeController: true,
      guidance: memoryDifficulty!=='expert',
      onExit,
      onCheckpoint: !onComplete&&rounds===1?null:(s) => {
        if (round < rounds - 1) {
          controller.nextStage();
          game.dispatch({ type: "resume" });
        } else onComplete?.(s);
      },
    });
    if (!game) {
      controller.dispose();
      return null;
    }
    for (
      const event of [
        "ayahprofilechange",
        "ayah-content-access-changed",
        "ayah-private-content-denied",
      ]
    ) {
      window.addEventListener(event, () => {
        if (content.private) {
          game.dispose();
          invalidate();
        }
      }, { signal: lifecycle.signal });
    }
    window.addEventListener("focus", () => void check(), {
      signal: lifecycle.signal,
    });
    const timer = setInterval(() => void check(), 60000);
    lifecycle.signal.addEventListener("abort", () => clearInterval(timer));
    return {
      ...game,
      dispose() {
        lifecycle.abort();
        game.dispose();
        controller.dispose();
      },
    };
  } catch (e) {
    owned?.dispose();
    content.dispose();
    throw e;
  }
}

// Full selection stays in metadata; the existing runner owns one authorized window.
export async function mountAuthorizedRunner(root,options={}){
 const {refs,client,isCurrent=()=>true,verifyBundle=()=>{},onComplete,onExit=()=>{},rounds=1}=options;
 let presentation={memory:options.memoryDifficulty||'guided',motor:options.motorDifficulty||'relaxed'};
 const owner=activeProfileId(),abort=new AbortController();let disposed=false,current=null,busy=false,epoch=0,finished=false;
 const alive=()=>!disposed&&root.isConnected&&owner===activeProfileId()&&isCurrent();
 const sourceRevision=await sha256(JSON.stringify(refs.map(ref=>[ref,availability.premium.find(p=>p.key===ref)||'existing-free'])));if(!alive())throw Error('Learning account changed.');const run=await passageRun(refs,{activity:'runner',settings:{rounds,sourceRevision},storage:profileStorage,guard:()=>{if(!alive())throw Error('Learning account changed.');}});if(options.restart===true)run.restart();presentation=run.presentation||presentation;
 function notice(error,retry){if(!alive())return;root.replaceChildren();const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=error;const b=document.createElement('button');b.textContent='Retry saved passage';b.onclick=retry;const exit=document.createElement('button');exit.textContent='Save and exit';exit.onclick=()=>{dispose();onExit();};root.append(p,b,exit);}
 async function open(){if(!alive())return;const ticket=++epoch,stage=run.next;if(stage>=run.windows.length){notice('Selected passage completed. Recognition is separate from independent recall.',async()=>{run.restart();finished=false;await open();});return;}
 const windowRefs=run.windows[stage];let pins={};current?.dispose();current=null;root.textContent='Preparing the next authorized ayahs…';
 try{const view=await mountRunnerWindow(root,{...options,refs:windowRefs,rounds,memoryDifficulty:presentation.memory,motorDifficulty:presentation.motor,isCurrent:()=>alive()&&ticket===epoch,verifyBundle:async b=>{await verifyBundle(b);pins[b.key]=await fingerprints(b);run.verify(pins);},onComplete:null,onWindowEvent:e=>{options.onWindowEvent?.(e);if(e.type==='runner:checkpoint'&&!busy)queueMicrotask(()=>advance(windowRefs,pins,ticket));},onExit:()=>{dispose();onExit();}});if(!alive()||ticket!==epoch){view?.dispose();return;}current=view;
 const hud=document.createElement('p');hud.dataset.continuousProgress='';hud.setAttribute('role','status');hud.textContent=`Selected ${refs[0]}–${refs.at(-1)} · ${run.completed}/${refs.length} completed · section ${stage+1}/${run.windows.length} · saved checkpoint`;root.prepend(hud);view?.start?.();
 }catch(e){if(alive()&&ticket===epoch)notice(e.message,open);}}
 async function advance(windowRefs,pins,ticket){if(!alive()||ticket!==epoch||busy)return;busy=true;try{if((current?.getSnapshot().roundIndex||0)<rounds-1){current.dispatch({type:'continuous-next'});return;}run.complete(windowRefs,pins);if(run.completed<refs.length){busy=false;await open();}else if(!finished){finished=true;const hud=root.querySelector('[data-continuous-progress]');if(hud)hud.textContent=`Selected passage complete · ${refs.length}/${refs.length} ayahs · recognition practice`;onComplete?.({...current?.getSnapshot(),selectedRefs:refs,completedRefs:refs});}}catch(e){current?.pause?.();notice(e.message,()=>{busy=false;return advance(windowRefs,pins,ticket);});}finally{busy=false;}}
 root.__ayahRestartChallenge=async next=>{run.setPresentation({memory:next.memory,motor:next.motor});presentation={memory:next.memory,motor:next.motor};root.__ayahDifficulty=presentation;await open();};root.__ayahDifficulty=presentation;
 function dispose(){if(disposed)return;disposed=true;delete root.__ayahRestartChallenge;delete root.__ayahDifficulty;epoch++;abort.abort();current?.dispose();current=null;root.replaceChildren();}
 window.addEventListener('ayahprofilechange',dispose,{signal:abort.signal});for(const event of ['ayah-content-access-changed','ayah-private-content-denied'])window.addEventListener(event,()=>{if(refs.some(r=>!freeReference(r)))dispose();},{signal:abort.signal});
 await open();return {start:()=>current?.start?.(),pause:()=>current?.pause?.(),resume:()=>current?.dispatch?.({type:'resume'}),dispatch:a=>current?.dispatch?.(a),getSnapshot:()=>({...current?.getSnapshot(),selectedRefs:[...refs],completedRefs:refs.slice(0,run.completed),continuous:true}),restart:async()=>{run.restart();finished=false;await open();},dispose};
}

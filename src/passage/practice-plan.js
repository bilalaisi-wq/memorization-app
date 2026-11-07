export const PASSAGE_GAMES = Object.freeze([
  {id:'asteroids', title:'Ayah Space'}, {id:'snake', title:'Ayah Serpent'},
  {id:'falling', title:'Ayah Blocks'}, {id:'maze', title:'Memory Maze'},
  {id:'bubble',title:'Ayah Bubble Burst'}, {id:'sirat',title:'Sirat Quest'},
]);
export const RECALL_XP_INTERVAL = 16;
export const practiceScope = refs => [...new Set(refs)].sort((a,b)=>{const x=a.split(':').map(Number),y=b.split(':').map(Number);return x[0]-y[0]||x[1]-y[1];}).join('|');
export function validatePractice(work) {
  if(work.layoutPreference!==undefined&&!["legacy","grouped"].includes(work.layoutPreference)||work.current?.layout!==undefined&&!["legacy","grouped"].includes(work.current.layout))throw Error("Saved workspace layout needs recovery; original data is preserved.");
  if(work.games!==undefined&&(!Array.isArray(work.games)||new Set(work.games).size!==work.games.length||work.games.some(id=>!PASSAGE_GAMES.some(g=>g.id===id))))throw Error('Saved game choices need recovery; the original is preserved.');
  if(work.practice!==undefined&&(!work.practice||typeof work.practice!=='object'||Array.isArray(work.practice)))throw Error('Saved practice progress needs recovery.');
  for(const [key,p] of Object.entries(work.practice||{}))if(!/^\d+:\d+(\|\d+:\d+)*$/.test(key)||!p||!p.receipts||typeof p.receipts!=='object'||Array.isArray(p.receipts)||Object.values(p.receipts).some(x=>!Number.isSafeInteger(x)||x<0||x>100)||!Number.isSafeInteger(p.reviewedXP)||p.reviewedXP<0||p.reviewedXP>Object.values(p.receipts).reduce((a,b)=>a+b,0)||!Array.isArray(p.assessments)||p.assessments.some(x=>typeof x!=='string'))throw Error('Saved practice progress needs recovery; it has not been overwritten.');
}
export function practiceProgress(work, refs) {
  validatePractice(work);const p=work.practice?.[practiceScope(refs)],xp=Object.values(p?.receipts||{}).reduce((a,b)=>a+b,0);
  return {xp, sinceRecall:Math.max(0,xp-(p?.reviewedXP||0)), due:xp-(p?.reviewedXP||0)>=RECALL_XP_INTERVAL};
}
export function recordPracticeXP(work, refs, {id,xp}) {
  validatePractice(work);if(typeof id!=='string'||!id||!Number.isSafeInteger(xp)||xp<0||xp>100)throw Error('Invalid practice receipt.');
  const key=practiceScope(refs);work.practice??={};const p=work.practice[key]??={receipts:{},reviewedXP:0,assessments:[]};
  if(!Object.hasOwn(p.receipts,id))Object.defineProperty(p.receipts,id,{value:xp,writable:true,enumerable:true,configurable:true});
  return practiceProgress(work,refs);
}
export function acknowledgePracticeRecall(work,refs,attempt) {
  validatePractice(work);if(!attempt?.graded||!attempt.result||typeof attempt.id!=='string')throw Error('A saved self-assessment is required.');
  const p=work.practice?.[practiceScope(refs)];if(p&&!p.assessments.includes(attempt.id)){p.reviewedXP=practiceProgress(work,refs).xp;p.assessments.push(attempt.id);}
}
export function recommendPassageGame(bundle, memory, now = new Date()) {
  const records=Object.values(memory.records||{}).filter(r=>r.unit?.refs?.includes(bundle.key));
  const due=records.some(r=>r.card&&new Date(r.card.due)<=now);
  const difficulty=records.some(r=>r.history?.slice(-3).some(h=>h.independent&&['Again','Hard'].includes(h.grade)));
  if(due||difficulty)return {game:'maze',reason:due?'A native FSRS review is due. Self-assess first; use the untimed maze for corrective sequence practice.':'Recent independent self-assessments reported difficulty. Use slow, untimed sequence decisions before another recall attempt.',evidence:due?'fsrs-due':'self-assessed-difficulty'};
  return bundle.words.length>36?{game:'asteroids',reason:'Ayah Space presents bounded waves without displaying the entire long ayah at once. This is a content-length recommendation, not a memory diagnosis.',evidence:'content-length'}:{game:'snake',reason:'Ayah Serpent offers repeated canonical word-order practice. Choose slow movement; motor bumps are separate from memory mistakes.',evidence:'content-length'};
}

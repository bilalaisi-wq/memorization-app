// Attempt history is cumulative; the live strike budget resets on Practice retry.
// Older records lack a live budget and conservatively retain their prior errors.
export function inheritedStrikes(results,key,rules){
 const completed=results.filter(Boolean);
 if(rules==='classic')return completed.reduce((n,r)=>n+r.mistakes.length,0);
 const same=completed.filter(r=>r.completed.includes(key)),last=same.at(-1);
 return Number.isInteger(last?.strikes)?last.strikes:same.reduce((n,r)=>n+r.mistakes.filter(e=>e.key===key).length,0);
}

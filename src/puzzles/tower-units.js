// Visual grouping only; full-ayah recitation remains the audio source for grouped pieces.
export function towerVerse(verse){
 const n=verse.words.length,size=n<=12?1:n<=24?2:n<=36?3:5;
 if(size===1)return verse;
 const groups=Array.from({length:Math.ceil(n/size)},(_,i)=>Array.from({length:Math.min(size,n-i*size)},(_,j)=>i*size+j));
 return {...verse,grouped:true,sourceWordCount:n,groups,words:groups.map(g=>g.map(p=>verse.words[p]).join(' ')),roman:groups.map(g=>g.every(p=>verse.roman?.[p])?g.map(p=>verse.roman[p]).join(' '):''),meanings:groups.map(g=>[g.map(p=>verse.meanings?.[p]?.[0]||'').join(' · '),'']),sourceVerse:verse};
}

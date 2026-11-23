// Comparison copies only. Canonical source strings and positions are never rewritten.
export function arabicForm(text,{diacritics=false}={}) {
 let value=String(text).normalize('NFKC').normalize('NFC').replace(/[\u0640\u200c\u200d]/g,'');
 // Ignore verse/stop ornaments, not Arabic letters. Hamzah, alif variants and ayn remain distinct.
 value=value.replace(/[\u06d6-\u06de\u06e9\u0610-\u061a]/g,'');
 if(!diacritics)value=value.replace(/[\u064b-\u0650\u0652\u0670]/g,'');
 return value.trim().replace(/\s+/g,' ');
}
export function latinForm(text,{approximate=false}={}){
 let s=String(text).toLowerCase().normalize('NFC').replace(/[’‘ʼ]/g,"'").replace(/[ʿʻ]/g,'ʿ').replace(/ā/g,'aa').replace(/ī/g,'ii').replace(/ū/g,'uu').replace(/ḥ/g,'h!').replace(/ṣ/g,'s!').replace(/ḍ/g,'d!').replace(/ṭ/g,'t!').replace(/ẓ/g,'z!').replace(/ʾ/g,"'").replace(/[-–]/g,'').trim().replace(/\s+/g,' ');
 if(approximate)s=s.replace(/!/g,'').replace(/[ʿ']/g,'').replace(/([aiu])\1/g,'$1').replace(/([bcdfghjklmnpqrstvwxyz])\1/g,'$1');
 return s;
}
export function candidateIndex(bundles,{assertCurrent=()=>{}}={}){
 let disposed=false;const words=new Map();
 for(const b of bundles)for(const w of b.words){if(!w.transliteration)continue;const id=w.text+'\0'+w.transliteration;if(!words.has(id))words.set(id,{text:w.text,transliteration:w.transliteration,reference:b.key,position:w.position,...(typeof w.translation==='string'&&w.translation?{meaning:w.translation}:{}),exact:latinForm(w.transliteration),approx:latinForm(w.transliteration,{approximate:true})});}
 return {search(input,limit=6){assertCurrent();if(disposed)throw Error('Vocabulary access ended.');const exact=latinForm(input),approx=latinForm(input,{approximate:true});if(!exact)return [];return [...words.values()].map(w=>({word:w,score:w.exact===exact?100:w.exact.replace(/[!ʿ']/g,'')===exact.replace(/[!ʿ']/g,'')?90:w.exact.replace(/([aiu])\1/g,'$1')===exact.replace(/([aiu])\1/g,'$1')?80:w.exact.replace(/([bcdfghjklmnpqrstvwxyz])\1/g,'$1')===exact.replace(/([bcdfghjklmnpqrstvwxyz])\1/g,'$1')?70:w.approx===approx?65:w.exact.startsWith(exact)?45:w.approx.startsWith(approx)?25:approx.length>=3&&w.approx.includes(approx)?15:0})).filter(r=>r.score).sort((a,b)=>b.score-a.score||a.word.text.localeCompare(b.word.text)||a.word.transliteration.localeCompare(b.word.transliteration)).slice(0,Math.min(12,limit)).map(r=>({...r.word,match:r.score===100?'Exact transliteration':r.score>=65?'Approximate spelling':'Partial spelling'}));},dispose(){disposed=true;words.clear();}};
}
export function compareWritten(input,words,{mode='arabic',diacritics=false}={}){
 const normalize=mode==='latin'?t=>latinForm(t):t=>arabicForm(t,{diacritics});
 const actual=normalize(input).split(/\s+/).filter(Boolean),expected=normalize(words.map(w=>mode==='latin'?w.transliteration||'':w.text).join(' ')).split(/\s+/).filter(Boolean);
 if(mode==='latin'&&words.some(w=>!w.transliteration))return {available:false,reason:'Verified transliteration unavailable for this passage.'};
 if(actual.length>512||expected.length>512)return {available:false,reason:'Choose a smaller written-recall passage (up to 512 words). Complete oral recall is still available.'};
 const dp=Array.from({length:expected.length+1},()=>Array(actual.length+1).fill(0));
 for(let i=0;i<=expected.length;i++)dp[i][0]=i;for(let j=0;j<=actual.length;j++)dp[0][j]=j;
 for(let i=1;i<=expected.length;i++)for(let j=1;j<=actual.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(expected[i-1]===actual[j-1]?0:1));
 const differences=[];let i=expected.length,j=actual.length;
 while(i||j){if(i&&j&&expected[i-1]===actual[j-1]){i--;j--;}else if(i&&j&&dp[i][j]===dp[i-1][j-1]+1){differences.push({type:'substitution-or-order',position:i,expected:words[i-1]?.text,typed:actual[j-1]});i--;j--;}else if(i&&dp[i][j]===dp[i-1][j]+1){differences.push({type:'omission',position:i,expected:words[i-1]?.text});i--;}else{differences.push({type:'addition',position:i+1,typed:actual[j-1]});j--;}}
 return {available:true,exact:dp[expected.length][actual.length]===0,differences:differences.reverse(),kind:'written-comparison',spokenVerified:false,fsrsGrade:null};
}
export function moveGrapheme(value,cursor,direction){const boundaries=[0,...[...new Intl.Segmenter('ar',{granularity:'grapheme'}).segment(value)].map(s=>s.index+s.segment.length)];return direction<0?boundaries.filter(b=>b<cursor).at(-1)??0:boundaries.find(b=>b>cursor)??value.length;}
export function deleteGrapheme(value,start,end=start){if(start!==end)return {value:value.slice(0,start)+value.slice(end),cursor:start};if(start===0)return {value,cursor:0};const at=moveGrapheme(value,start,-1),cluster=[...new Intl.Segmenter('ar',{granularity:'grapheme'}).segment(value)].find(g=>g.index===at),removeEnd=Math.max(end,cluster?cluster.index+cluster.segment.length:end);return {value:value.slice(0,at)+value.slice(removeEnd),cursor:at};}

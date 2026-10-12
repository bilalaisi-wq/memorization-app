export const verses = [
 {text:'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',translation:'In the name of Allah, the Most Compassionate, the Most Merciful.',roman:['Bismi','Allāhi','ar-raḥmāni','ar-raḥīm']},
 {text:'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',translation:'All praise is for Allah—Lord of all worlds.',roman:['Al-ḥamdu','lillāhi','rabbi','al-ʿālamīn']},
 {text:'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',translation:'The Most Compassionate, the Most Merciful.',roman:['Ar-raḥmāni','ar-raḥīm']},
 {text:'مَـٰلِكِ يَوْمِ ٱلدِّينِ',translation:'Master of the Day of Judgment.',roman:['Māliki','yawmi','ad-dīn']},
 {text:'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',translation:'You alone we worship and You alone we ask for help.',roman:['Iyyāka','naʿbudu','wa-iyyāka','nastaʿīn']},
 {text:'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',translation:'Guide us along the Straight Path.',roman:['Ihdinā','aṣ-ṣirāṭa','al-mustaqīm']},
 {text:'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',translation:'The Path of those You have blessed—not those You are displeased with, or those who are astray.',roman:['Ṣirāṭa','alladhīna','anʿamta','ʿalayhim','ghayri','al-maghḍūbi','ʿalayhim','wa-lā','aḍ-ḍāllīn']}
].map((v,i)=>({...v,id:i+1,words:v.text.split(' ')}));
export function shuffled(n){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}if(n>1&&a.every((v,i)=>v===i))a.reverse();return a;}
export const wordAudio=(ayah,index)=>`/audio/001_${String(ayah).padStart(3,'0')}_${String(index+1).padStart(3,'0')}.mp3`;
export const verseAudio=ayah=>`/audio/001${String(ayah).padStart(3,'0')}.mp3`;
export const meanings=[
 [['In the name','name'],['Allah','gold'],['The Most Compassionate','gold'],['The Most Merciful','gold']],
 [['All praise','praise'],['For Allah','gold'],['Lord','gold'],['The worlds','worlds']],
 [['The Most Compassionate','gold'],['The Most Merciful','gold']],
 [['Master','gold'],['Day','day'],['Judgment','judgment']],
 [['You alone','gold'],['We worship','worship'],['And You alone','gold'],['We seek help','help']],
 [['Guide us','path'],['The path','path'],['The straight','path']],
 [['Path','path'],['Those who','people'],['You blessed','gift'],['Upon them','people'],['Not','not'],['Those who earned anger','not'],['Upon them','people'],['And not','not'],['Those astray','lost']]
];
export const distractors=[
 {text:'وَٱلشَّجَرُ',roman:'wa-sh-shajaru',meaning:'And the trees',art:'tree',source:'Ar-Rahman 55:6'},
 {text:'ٱلْبَحْرِ',roman:'al-baḥri',meaning:'The sea',art:'water',source:'Al-Baqarah 2:164'},
 {text:'وَٱلْقَمَرُ',roman:'wa-l-qamaru',meaning:'And the moon',art:'moon',source:'Ar-Rahman 55:5'},
 {text:'ٱلْكِتَـٰبُ',roman:'al-kitābu',meaning:'The Book',art:'book',source:'Al-Baqarah 2:2'},
 {text:'ٱلشَّمْسُ',roman:'ash-shamsu',meaning:'The sun',art:'day',source:'Ar-Rahman 55:5'},
 {text:'وَٱلنَّجْمُ',roman:'wa-n-najmu',meaning:'And the plants',art:'tree',source:'Ar-Rahman 55:6'}
];
export function quizCorrect(selection,words,extras){return selection.length===words.length&&selection.every((id,i)=>(id<words.length?words[id]:extras[id-words.length]?.text)===words[i]);}
export function scrambledBank(count,targetCount=count){let a=shuffled(count);if(count>2&&(a.every((x,i)=>x===(a[0]+i)%count)||a.every((x,i)=>x===count-1-i))){[a[0],a[1]]=[a[1],a[0]];}const target=a.filter(x=>x<targetCount);if(targetCount>1&&target.every((x,i)=>x===i)){const x=a.indexOf(0),y=a.indexOf(1);[a[x],a[y]]=[a[y],a[x]];}return a;}

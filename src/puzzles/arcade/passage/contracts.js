const contract=(title,groupWords)=>Object.freeze({title,units:Object.freeze(['words','visual-groups','study-segments']),maxUnits:12,maxGroupWords:groupWords,maxAyahs:50,wholeAyahAudio:true});
export const contentContracts=Object.freeze({
 falling:contract('Ayah Blocks',2),asteroids:contract('Ayah Space',3),snake:contract('Ayah Serpent',2),maze:contract('Memory Maze',3),bubble:contract('Ayah Bubble Burst',2),sirat:contract('Sirat Quest',3),
 bridge:Object.freeze({title:'Bridge Builder',units:Object.freeze(['transitions']),maxUnits:1,maxGroupWords:3,maxAyahs:50,wholeAyahAudio:true})
});

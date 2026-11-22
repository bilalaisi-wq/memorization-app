// Original fictional archive records. No Quran references, translations or tafsir.
const trusted=new WeakSet();
export function mechanicsLesson(){
 const cards=[],relations=[],evidence=[],applications=[],sections=[];
 for(const [i,name] of ['Lantern Atrium','Star Observatory','Constellation Guardian'].entries()){
  const root=`room-${i}`,ids=['symbol','legend','note'].map(k=>`${root}-${k}`);
  cards.push({id:ids[0],kind:'observation',title:'Spiral seal',text:'The fictional archive seal has a spiral symbol.',category:'observation'}, {id:ids[1],kind:'label',title:'Map legend',text:'The museum map labels the spiral symbol as the next archive door.',category:'label'}, {id:ids[2],kind:'unverified',title:'Unverified note',text:'An unsigned fictional note claims that every hidden chest has a key. No observation establishes this.',category:'unverified'});
  relations.push({id:`${root}-link`,from:ids[0],to:ids[1],explanation:'The observed spiral matches the museum map legend. This is a fictional mechanics example.'});
  evidence.push({card:ids[2],accepts:['unverified'],explanation:'An unsigned assertion is not established by the collected observation.'});
  applications.push({id:`${root}-application`,prompt:'Use the observed spiral and map legend to route the archive lift.',choices:[{id:'spiral',text:'Route to the spiral door'},{id:'chest',text:'Assume every chest has a key'}],accepts:['spiral'],explanation:'Use the relationship actually supported by these fictional records.'});
  sections.push({id:root,title:name,cards:ids,relations:[`${root}-link`],evidence:[ids[2]],applications:[`${root}-application`]});
 }
 const d={version:1,id:'mechanics-archive',title:"QUR'AN CHRONICLES · The Explorer’s Chronicle",refs:[],sources:[],cards,relations,evidence,applications,sections};trusted.add(d);return d;
}
export const isMechanicsLesson=d=>trusted.has(d);

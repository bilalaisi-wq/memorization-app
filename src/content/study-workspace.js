// Visual pagination only: no new recitation-stop or independent recall units.
export function createStudyWorkspace(total,size=12){
 if(!Number.isInteger(total)||total<1)throw Error('Invalid word count');
 const pages=Array.from({length:Math.ceil(total/size)},()=>[]);let page=0;
 return {get page(){return page;},get count(){return pages.length;},get first(){return page*size;},get last(){return Math.min(total,(page+1)*size);},indices(){return Array.from({length:this.last-this.first},(_,i)=>this.first+i);},save(selection){pages[page]=[...selection];},go(next,selection){this.save(selection);page=Math.max(0,Math.min(pages.length-1,next));return [...pages[page]];},all(selection){this.save(selection);return pages.flat();}};
}

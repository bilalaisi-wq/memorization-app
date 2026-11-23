// Presentation plan only. Hosts must authorize source loading before launching.
export function nextBatch({first,last,total,batchSize=last-first+1,minAyahs=1}){
 if(![first,last,total,batchSize,minAyahs].every(Number.isSafeInteger)||first<1||last<first||last>total||batchSize<1||minAyahs<1)throw Error('Invalid batch range');
 const start=last+1;if(start>total)return null;const end=Math.min(total,start+batchSize-1);
 if(end-start+1<minAyahs)return {first:Math.max(1,start-(minAyahs-1)),last:end,batchSize,boundaryReview:true,label:`Boundary review · ayahs ${Math.max(1,start-(minAyahs-1))}–${end} (includes previous ayah)`};
 return {first:start,last:end,batchSize,boundaryReview:false,label:`Continue to ayahs ${start}–${end}`};
}

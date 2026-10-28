import {test,expect} from '@playwright/test';
import {flightNextSteps} from '../src/puzzles/arcade/asteroids/next-steps.js';
const session={config:{keys:['1:1','1:2']},mistakes:[]};
const suggest=extra=>flightNextSteps({session,lastAyah:7,...extra});
test('flight guidance respects due reviews, confidence, goals, mistakes, time and surah end without grading',()=>{
 expect(suggest({}).next).toEqual({first:3,last:4,surah:1});
 expect(suggest({goals:{minutes:5}}).next.last).toBe(3);
 expect(suggest({goals:{confidence:'shaky'}}).action).toBe('practice');
 expect(suggest({session:{...session,mistakes:[{}]}}).action).toBe('practice');
 expect(suggest({due:[{key:'112:1'}]}).target).toBe('112:1');
 expect(suggest({goals:{aim:'review'}}).action).toBe('recall');
 expect(suggest({goals:{confidence:'ready'}}).action).toBe('recall');
 expect(suggest({goals:{targets:[113]}}).target).toBe('113:1');
 expect(suggest({elapsed:1200}).action).toBe('recall');
 const history=[1,2,3].map(i=>({game:'asteroids',key:'1:1',sessionId:`arcade:flight${i}:1:1`,at:new Date().toISOString()}));
 expect(suggest({history}).action).toBe('recall');
 expect(suggest({lastAyah:2}).next).toBeNull();
 expect(session).toEqual({config:{keys:['1:1','1:2']},mistakes:[]});
});

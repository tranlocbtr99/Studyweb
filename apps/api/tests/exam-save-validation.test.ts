import {describe,it,expect} from 'vitest';
import {validateExamDraft} from '../../web/src/examValidation';
const question={body:'Hai cộng hai bằng bao nhiêu?',options:['Bốn','Năm','Sáu','Bảy'],correctOption:'A' as const,explanation:''};
const draft={subjectId:'subject',title:'Đề kiểm thử',durationMinutes:90,questions:[question]};
describe('exam save feedback',()=>{
 it('accepts a reviewed complete draft',()=>expect(validateExamDraft(draft,true)).toEqual([]));
 it('explains missing subject and review acknowledgement',()=>expect(validateExamDraft({...draft,subjectId:''},false).map(i=>i.field)).toEqual(['subject','review']));
 it('locates the exact question missing an answer',()=>expect(validateExamDraft({...draft,questions:[question,{...question,correctOption:null}]},true)).toMatchObject([{field:'answer',questionIndex:1}]));
 it('rejects fractional, nonfinite and empty duration',()=>{for(const durationMinutes of [90.5,NaN,Infinity,0])expect(validateExamDraft({...draft,durationMinutes},true)[0].field).toBe('duration')});
 it('points out duplicate questions before sending a doomed save',()=>expect(validateExamDraft({...draft,questions:[question,question]},true)[0]).toMatchObject({field:'body',questionIndex:1}));
 it('reports oversized imported choices and explanations',()=>expect(validateExamDraft({...draft,questions:[{...question,options:['x'.repeat(1001),'B','C','D'],explanation:'x'.repeat(4001)}]},true).map(i=>i.field)).toEqual(['options','explanation']));
});

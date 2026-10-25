import {describe,expect,it} from 'vitest';
import {examContentHash,type ExamDigestItem} from './exam-integrity';

const question={questionId:'question-1',body:'Which answer is correct?',options:[
  {label:'A',text:'First'},{label:'B',text:'Second'},{label:'C',text:'Third'},{label:'D',text:'Fourth'}
]};
const answer={correctOption:'B',explanation:'Second is correct'};
const item=(position:number,questionValue:unknown=question,answerValue:unknown=answer):ExamDigestItem=>({
  position,questionSnapshotJson:JSON.stringify(questionValue),answerKeyPrivateJson:JSON.stringify(answerValue)
});
describe('exam publication integrity',()=>{
  it('rejects empty exams',async()=>{await expect(examContentHash([])).rejects.toThrow('INVALID_ITEM_COUNT');});
  it('rejects gaps in question positions',async()=>{await expect(examContentHash([item(0),item(2)])).rejects.toThrow('NON_CONTIGUOUS_POSITIONS');});
  it('rejects duplicate positions',async()=>{await expect(examContentHash([item(0),item(0)])).rejects.toThrow('NON_CONTIGUOUS_POSITIONS');});
  it('rejects incomplete answer options',async()=>{await expect(examContentHash([item(0,{...question,options:question.options.slice(0,3)})])).rejects.toThrow('INVALID_ITEM_SNAPSHOT');});
  it('rejects answer keys leaked into student snapshots',async()=>{await expect(examContentHash([item(0,{...question,correctOption:'B'})])).rejects.toThrow('INVALID_ITEM_SNAPSHOT');});
  it('rejects invalid private answer keys',async()=>{await expect(examContentHash([item(0,question,{correctOption:'E'})])).rejects.toThrow('INVALID_ITEM_SNAPSHOT');});
  it('returns same hash for reordered input with same positions',async()=>{
    const a=[item(0),item(1,{...question,body:'Another question with four choices'})];
    expect(await examContentHash(a)).toBe(await examContentHash([...a].reverse()));
  });
  it('changes the hash when the private answer key changes',async()=>{
    expect(await examContentHash([item(0)])).not.toBe(await examContentHash([item(0,question,{...answer,correctOption:'C'})]));
  });
  it('changes the hash when student-visible content changes',async()=>{
    expect(await examContentHash([item(0)])).not.toBe(await examContentHash([item(0,{...question,body:'Different question content'})]));
  });
});

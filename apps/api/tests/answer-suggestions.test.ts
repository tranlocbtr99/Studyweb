import {describe,it,expect} from 'vitest';
import {suggestExamAnswers} from '../src/answer-suggestions';
import {analyzeExamText} from '../src/imports';
const q={body:'Tổng của hai và ba bằng bao nhiêu?',options:['Bốn','Năm','Sáu','Bảy'],correctOption:null};
const ai=(answers:unknown[])=>({run:async()=>({response:JSON.stringify({answers})})});
const suggestion={index:0,correctOption:'B',confidence:'high',reason:'Hai cộng ba bằng năm, tương ứng với phương án B.'};
describe('AI answer suggestions',()=>{
 it('returns an answer and rationale without rewriting the question',async()=>{const result=await suggestExamAnswers(ai([suggestion]),[q]);expect(result.suggestions[0]).toMatchObject(suggestion);expect(q.correctOption).toBeNull()});
 it('does not call the solver for explicit answers',async()=>{let calls=0;const result=await suggestExamAnswers({run:async()=>{calls++;throw Error()}},[{...q,correctOption:'A'}]);expect(calls).toBe(0);expect(result.suggestions).toEqual([])});
 it('never overwrites explicit answers or accepts unknown indices',async()=>{const result=await suggestExamAnswers(ai([suggestion,{...suggestion,index:1},{...suggestion,index:99}]),[{...q,correctOption:'A'},q]);expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0].index).toBe(1)});
 it('leaves low-confidence or unjustified answers blank',async()=>{for(const data of [{...suggestion,confidence:'low'},{...suggestion,reason:'OK'}])expect((await suggestExamAnswers(ai([data]),[q])).suggestions[0].correctOption).toBeNull()});
 it('can abstain when the required image or passage is missing',async()=>{const result=await suggestExamAnswers(ai([{...suggestion,correctOption:null,confidence:'low',reason:'Câu hỏi yêu cầu hình minh họa nhưng tài liệu chưa cung cấp hình.'}]),[q]);expect(result.suggestions[0].correctOption).toBeNull()});
 it('rejects conflicting duplicate answer indices',async()=>{const result=await suggestExamAnswers(ai([suggestion,{...suggestion,correctOption:'D'}]),[q]);expect(result.suggestions).toEqual([]);expect(result.warnings.length).toBeGreaterThan(0)});
 it('rejects malformed labels instead of silently treating them as answers',async()=>{await expect(suggestExamAnswers(ai([{...suggestion,correctOption:'E'}]),[q])).rejects.toThrow()});
 it('retains source questions omitted by extraction AI',async()=>{const text='Câu 1: '+q.body+'\nA. Bốn\nB. Năm\nC. Sáu\nD. Bảy\nĐáp án: B';const result=await analyzeExamText({run:async()=>({response:{questions:[]}})},text);expect(result.questions).toHaveLength(1);expect(result.questions[0].correctOption).toBe('B')});
 it('rejects reordered AI options and preserves the authoritative key',async()=>{const text='Câu 1: '+q.body+'\nA. Bốn\nB. Năm\nC. Sáu\nD. Bảy\nĐáp án: B';const result=await analyzeExamText({run:async()=>({response:{questions:[{...q,options:['Năm','Bốn','Sáu','Bảy'],correctOption:'A',explanation:''}]}})},text);expect(result.questions).toHaveLength(1);expect(result.questions[0]).toMatchObject({options:q.options,correctOption:'B'})});
});

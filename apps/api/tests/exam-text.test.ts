import {describe,it,expect} from 'vitest';import {parseExamText,splitExamForAI} from '../../../packages/shared/exam-import';
const text='Câu 1: Khái niệm nào sau đây là đúng?\nA. Phương án thứ nhất\nB. Phương án thứ hai\nC. Phương án thứ ba\nD. Phương án thứ tư';
describe('document question parsing',()=>{
 it('extracts four choices and leaves missing answers unset',()=>{const data=parseExamText(text);expect(data.questions).toHaveLength(1);expect(data.questions[0].options).toHaveLength(4);expect(data.questions[0].correctOption).toBeNull()});
 it('recognizes explicit per-question keys and explanations',()=>{expect(parseExamText(text+'\nĐáp án: C\nGiải thích: Nội dung trong tài liệu.').questions[0]).toMatchObject({correctOption:'C',explanation:'Nội dung trong tài liệu.'})});
 it('recognizes a separate numbered answer key',()=>{expect(parseExamText(text+'\nĐÁP ÁN\n1.B').questions[0].correctOption).toBe('B')});
 it('flags incomplete options rather than inventing answers',()=>{const data=parseExamText(text.replace('D. Phương án thứ tư',''));expect(data.questions[0].options[3]).toBe('');expect(data.warnings).toHaveLength(1)});
 it('does not split a question between AI chunks',()=>{const input=Array.from({length:8},(_,i)=>text.replace('Câu 1:',`Câu ${i+1}:`)).join('\n');const chunks=splitExamForAI(input,500);expect(chunks.length).toBeGreaterThan(1);expect(chunks.every(chunk=>chunk.length<=500)).toBe(true);expect(chunks.join('')).toBe(input)});
 it('reads Markdown headings and tabular explicit keys',()=>{const input=text.replace('Câu 1:','### **Câu 1:**')+'\nĐáp án\n| 1 | B |';expect(parseExamText(input).questions[0]).toMatchObject({correctOption:'B',answerSource:'document'})});
 it('refuses an oversized indivisible question',()=>{expect(()=>splitExamForAI('Câu 1: '+ 'x'.repeat(7000))).toThrow()});
});

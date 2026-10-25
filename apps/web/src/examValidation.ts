import type {ImportQuestion} from '../../../packages/shared/exam-import';
import {normalizeImportText} from '../../../packages/shared/exam-import';
export type SaveIssue={message:string;field:'subject'|'title'|'duration'|'review'|'body'|'options'|'answer'|'explanation';questionIndex?:number};
export function validateExamDraft(data:{subjectId:string;title:string;durationMinutes:number;questions:ImportQuestion[]},reviewed:boolean):SaveIssue[]{
 const issues:SaveIssue[]=[];
 if(!data.subjectId)issues.push({field:'subject',message:'Chọn môn học đã tạo cho đề thi.'});
 if(data.title.trim().length<3||data.title.trim().length>160)issues.push({field:'title',message:'Nhập tên đề thi từ 3 đến 160 ký tự.'});
 if(!Number.isInteger(data.durationMinutes)||data.durationMinutes<5||data.durationMinutes>240)issues.push({field:'duration',message:'Thời gian phải là số nguyên từ 5 đến 240 phút.'});
 if(!data.questions.length||data.questions.length>200)issues.push({field:'body',message:'Đề thi cần có từ 1 đến 200 câu hỏi.'});
 const seen=new Map<string,number>();
 data.questions.forEach((q,i)=>{const add=(field:SaveIssue['field'],message:string)=>issues.push({field,questionIndex:i,message:'Câu '+(i+1)+': '+message});
  if(q.body.trim().length<5||q.body.trim().length>4000)add('body','nội dung cần từ 5 đến 4.000 ký tự.');
  if(q.options.length!==4||q.options.some(o=>!o.trim()||o.trim().length>1000))add('options','điền đủ bốn phương án A–D, mỗi phương án tối đa 1.000 ký tự.');
  if(!q.correctOption||!['A','B','C','D'].includes(q.correctOption))add('answer','chưa chọn đáp án đúng. Chọn đáp án, nhờ AI phân tích hoặc bỏ câu này khỏi đề.');
  if(q.explanation.trim().length>4000)add('explanation','giải thích vượt 4.000 ký tự.');
  if(q.richContent&&JSON.stringify(q.richContent).length>100000)add('body','nội dung hình/bảng/công thức quá lớn, cần chia nhỏ.');
  const signature=JSON.stringify([normalizeImportText(q.body),q.options.map(normalizeImportText),q.correctOption,normalizeImportText(q.explanation),q.richContent??null]),previous=seen.get(signature);
  if(previous!==undefined)add('body','trùng nội dung và đáp án với câu '+(previous+1)+'. Hãy bỏ một trong hai câu.');else seen.set(signature,i);
 });
 if(!reviewed)issues.push({field:'review',message:'Tích xác nhận đã kiểm tra nội dung, đáp án và các đề xuất AI.'});
 return issues;
}

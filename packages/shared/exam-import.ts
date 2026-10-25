import type {RichContent} from './rich-content';
export type ImportQuestion={body:string;options:string[];correctOption:'A'|'B'|'C'|'D'|null;explanation:string;sourceNumber?:number;richContent?:RichContent;answerSource?:'document'|'ai'|'manual';aiConfidence?:'high'|'medium'|'low';aiNote?:string};
export const normalizeImportText=(text:string)=>text.normalize('NFC').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
export function parseExamText(source:string):{questions:ImportQuestion[];warnings:string[]}{
 const text=source.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/([^\n])\s+([ABCD])[.)]\s+/g,'$1\n$2. ');
 const questions:ImportQuestion[]=[],warnings:string[]=[];const keys=new Map<number,ImportQuestion['correctOption']>();
 let current:ImportQuestion|null=null,option=-1,inKey=false,explaining=false;
 for(const raw of text.split('\n')){const line=raw.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*((?:câu|question|q)\s*\d{1,4}\s*[.:)\-]?)\*\*/i,'$1');if(!line)continue;
  const keyHeader=/^(?:đáp\s*án|answer\s*key)\s*[:：]?\s*(.*)$/i.exec(line);
  if(keyHeader&&(!keyHeader[1].trim()||/\d\s*[.\-:=]?\s*[ABCD]/i.test(keyHeader[1])))inKey=true;
  if(inKey){for(const match of line.matchAll(/(?:^|[\s;,|])(\d{1,4})\s*(?:[.\-:=|]\s*)?([ABCD])(?=$|[\s;,|])/gi))keys.set(Number(match[1]),match[2].toUpperCase() as ImportQuestion['correctOption']);continue;}
  const start=/^(?:(?:câu|question|q)\s*)?(\d{1,4})\s*[.:)\-]\s*(.+)$/i.exec(line);
  if(start){if(current)questions.push(current);current={body:start[2].trim(),options:['','','',''],correctOption:null,explanation:'',sourceNumber:Number(start[1])};option=-1;explaining=false;continue;}
  if(!current)continue;
  const answer=/^(?:đáp\s*án(?:\s*đúng)?|correct(?:\s*answer)?|answer)\s*[:：\-]?\s*([ABCD])\b/i.exec(line);
  if(answer){current.correctOption=answer[1].toUpperCase() as ImportQuestion['correctOption'];option=-1;continue;}
  const explanation=/^(?:giải\s*thích|explanation)\s*[:：\-]?\s*(.*)$/i.exec(line);
  if(explanation){current.explanation=explanation[1];explaining=true;option=-1;continue;}
  const choice=/^(\*)?\s*([ABCD])[.):-]\s*(.+)$/i.exec(line);
  if(choice){option=choice[2].toUpperCase().charCodeAt(0)-65;current.options[option]=choice[3].trim();explaining=false;if(choice[1])current.correctOption=choice[2].toUpperCase() as ImportQuestion['correctOption'];continue;}
  if(explaining)current.explanation+='\n'+line;else if(option>=0)current.options[option]+=' '+line;else current.body+=' '+line;
 }
 if(current)questions.push(current);
 for(const q of questions){if(!q.correctOption&&q.sourceNumber)q.correctOption=keys.get(q.sourceNumber)??null;if(q.correctOption)q.answerSource='document';if(q.options.some(value=>!value.trim()))warnings.push('Câu '+(q.sourceNumber??questions.indexOf(q)+1)+' chưa có đủ bốn phương án.');}
 return {questions,warnings};
}
export function splitExamForAI(text:string,max=6500):string[]{
 if(text.length>180000)throw Error('Tài liệu quá dài. Hãy tách thành các file đề nhỏ hơn.');
 const blocks=text.split(/(?=^(?:(?:Câu|Question|Q)\s*)?\d{1,4}\s*[.:)\-]\s+)/gmi).filter(part=>part.trim());
 const pieces:string[]=[];for(const block of blocks){if(block.length<=max){pieces.push(block);continue}if(/^(?:(?:Câu|Question|Q)\s*)?\d{1,4}\s*[.:)\-]/i.test(block.trim()))throw Error('Một câu hoặc một phần tài liệu quá dài. Hãy chia nhỏ văn bản trước khi dùng AI.');let left=block;while(left.length>max){let cut=left.lastIndexOf('\n',max);if(cut<max/2)cut=left.lastIndexOf(' ',max);if(cut<=0)throw Error('Không tách được văn bản tài liệu.');pieces.push(left.slice(0,cut));left=left.slice(cut)}if(left.trim())pieces.push(left)}
 const chunks:string[]=[];let buffer='';for(const piece of pieces){if(buffer&&buffer.length+piece.length>max){chunks.push(buffer);buffer=''}buffer+=piece}if(buffer.trim())chunks.push(buffer);if(chunks.length>40)throw Error('Tài liệu có quá nhiều phần. Hãy tách file nhỏ hơn.');return chunks;
}

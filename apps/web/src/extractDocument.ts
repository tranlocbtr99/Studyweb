/// <reference types="vite/client" />
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export async function extractDocument(file:File):Promise<string>{
 if(file.size===0||file.size>10*1024*1024)throw Error('Tệp cần có dung lượng từ 1 byte đến 10 MB.');
 const extension=file.name.split('.').pop()?.toLowerCase();if(extension!=='docx'&&extension!=='pdf')throw Error('Hỗ trợ Word .docx và PDF. Với file .doc cũ, hãy lưu lại thành .docx.');
 const bytes=await file.arrayBuffer();let text='';
 if(extension==='docx'){
  // Inspect the ZIP central directory before asking the DOCX reader to inflate it.
  const view=new DataView(bytes);let end=-1;for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0)throw Error('File Word không hợp lệ hoặc đang được mã hóa.');let pos=view.getUint32(end+16,true),total=0;const entries=view.getUint16(end+10,true);if(entries>3000)throw Error('File Word có quá nhiều thành phần.');
  for(let i=0;i<entries;i++){if(pos+46>bytes.byteLength||view.getUint32(pos,true)!==0x02014b50)throw Error('Cấu trúc file Word không hợp lệ.');const size=view.getUint32(pos+24,true);total+=size;if(total>40*1024*1024)throw Error('Nội dung giải nén quá lớn. Hãy chia nhỏ file Word.');pos+=46+view.getUint16(pos+28,true)+view.getUint16(pos+30,true)+view.getUint16(pos+32,true)}
  const mammoth=await import('mammoth');text=(await mammoth.extractRawText({arrayBuffer:bytes})).value;
 }else{
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorker;
  const task=pdfjs.getDocument({data:new Uint8Array(bytes)});const pdf=await task.promise;
  try{if(pdf.numPages>100)throw Error('PDF quá 100 trang. Hãy tách các đề thành file nhỏ hơn.');for(let page=1;page<=pdf.numPages;page++){const content=await (await pdf.getPage(page)).getTextContent();let lastY:number|undefined;for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(lastY-y)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y}text+='\n\n';if(text.length>180000)throw Error('Tài liệu quá dài. Hãy chia nhỏ file.')}}finally{await task.destroy()}
 }
 if(text.length>180000)throw Error('Tài liệu quá dài. Hãy chia nhỏ file.');return text.trim();
}

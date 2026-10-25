export type RichCell={text:string;rowSpan?:number;colSpan?:number};
export type RichBlock={type:'text';text:string}|{type:'math';latex:string}|{type:'image';assetId:string;alt:string}|{type:'table';rows:RichCell[][]};
export type RichContent={body:RichBlock[];options?:Partial<Record<'A'|'B'|'C'|'D',RichBlock[]>>};
export function richAssetIds(content?:RichContent):string[]{return [...new Set([...(content?.body??[]),...Object.values(content?.options??{}).flat()].filter((b):b is Extract<RichBlock,{type:'image'}>=>b?.type==='image').map(b=>b.assetId))]}
export function richContext(content?:RichContent):string{return [...(content?.body??[]),...Object.entries(content?.options??{}).flatMap(([label,blocks])=>[{type:'text' as const,text:'Phương án '+label},...blocks])].map(block=>block.type==='text'?block.text:block.type==='math'?block.latex:block.type==='table'?block.rows.map(row=>row.map(cell=>cell.text).join(' | ')).join('\n'):'[Hình ảnh cần xem trực tiếp]').join('\n')}

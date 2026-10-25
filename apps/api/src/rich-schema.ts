import {z} from 'zod';
const cell=z.object({text:z.string().max(1500),rowSpan:z.number().int().min(1).max(100).optional(),colSpan:z.number().int().min(1).max(20).optional()}).strict();
const block=z.discriminatedUnion('type',[
 z.object({type:z.literal('text'),text:z.string().max(8000)}).strict(),
 z.object({type:z.literal('math'),latex:z.string().min(1).max(2000)}).strict(),
 z.object({type:z.literal('image'),assetId:z.string().uuid(),alt:z.string().max(300)}).strict(),
 z.object({type:z.literal('table'),rows:z.array(z.array(cell).max(20)).min(1).max(100)}).strict()
]);
export const richSchema=z.object({body:z.array(block).max(30),options:z.object({A:z.array(block).max(10).optional(),B:z.array(block).max(10).optional(),C:z.array(block).max(10).optional(),D:z.array(block).max(10).optional()}).strict().optional()}).strict().refine(value=>JSON.stringify(value).length<=100000);

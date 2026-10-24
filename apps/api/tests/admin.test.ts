import { describe,it,expect } from 'vitest';
import app from '../src/index';
describe('admin subjects',()=>{
 it('requires authentication',async()=>{
  const res=await app.request('/api/v1/admin/subjects',{method:'POST',headers:{Origin:'http://localhost','content-type':'application/json'},body:'{}'});
  expect(res.status).toBe(401);
 });
});

import {describe,it,expect} from 'vitest';
import {EventEmitter} from 'node:events';
import {attachDisconnectAbort} from './http-runtime.ts';
import type {IncomingMessage,ServerResponse} from 'node:http';
describe('agent response disconnect',()=>{
 it('ignores the completed request body close and aborts on actual response disconnect',()=>{
  const req=new EventEmitter() as unknown as IncomingMessage;
  const res=Object.assign(new EventEmitter(),{writableEnded:false,destroyed:false}) as unknown as ServerResponse;
  const abort=attachDisconnectAbort(req,60_000,res);
  req.emit('close');expect(abort.signal.aborted).toBe(false);
  res.emit('close');expect(abort.signal.aborted).toBe(true);abort.cancel();
 });
});

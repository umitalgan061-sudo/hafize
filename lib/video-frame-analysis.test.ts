import {it,expect,vi} from 'vitest';
import {analyzeVideoFrames} from './video-frame-analysis.ts';
const data=Buffer.from([255,216,255,1,255,217]).toString('base64');
it('analyzes bounded chronological samples without claiming audio or full video coverage',async()=>{
 const vision=vi.fn(async()=>({text:'Kareler',model:'test'}));
 const result=await analyzeVideoFrames({vision},{duration:10,frames:[{time:2,data},{time:8,data}]},new AbortController().signal);
 expect(result).toMatchObject({timestamps:[2,8],mode:'sampled_frames',audioAnalyzed:false,completeVideo:false});
 expect(vision).toHaveBeenCalledTimes(1);
});
it('rejects unordered timestamps, large durations and malformed frames without a model request',async()=>{
 const vision=vi.fn(async()=>({text:'',model:'test'}));
 const signal=new AbortController().signal;
 for(const body of [{duration:301,frames:[{time:1,data}]},{duration:10,frames:[{time:9,data},{time:2,data}]},{duration:10,frames:[{time:2,data:'AAAA'}]}])await expect(analyzeVideoFrames({vision},body,signal)).rejects.toThrow('VIDEO_FRAMES_INVALID');
 expect(vision).not.toHaveBeenCalled();
});

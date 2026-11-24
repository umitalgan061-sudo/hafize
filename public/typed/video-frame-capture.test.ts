import {it,expect} from 'vitest';
import {videoSampleTimes} from './video-frame-capture.ts';
it('samples four strictly ordered interior timestamps and bounds video duration',()=>{
 expect(videoSampleTimes(100)).toEqual([10,35,65,90]);
 for(const duration of [0,NaN,Infinity,301])expect(()=>videoSampleTimes(duration)).toThrow();
 expect(videoSampleTimes(0.25).every(t=>t>0&&t<0.25)).toBe(true);
});

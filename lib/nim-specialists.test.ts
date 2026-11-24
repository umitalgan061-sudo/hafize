
import {describe,it,expect,vi} from 'vitest';
import {createNimSpecialists} from './nim-specialists.ts';
const audio=Buffer.alloc(44);audio.write('RIFF',0);audio.write('WAVE',8);
const png=Buffer.from([137,80,78,71,13,10,26,10]);
describe('standalone NIM services',()=>{
  it('uses fixed multipart paths without forwarding catalog credentials',async()=>{
    const fetchImpl=vi.fn(async(url,init)=>{
      const form=init?.body as FormData;expect(init?.redirect).toBe('error');expect(init?.headers).toBeUndefined();
      if(String(url).endsWith('/transcriptions')){expect(form.get('language')).toBe('tr-TR');expect(form.get('file')).toBeInstanceOf(Blob);return new Response(JSON.stringify({text:'Merhaba'}));}
      if(String(url).endsWith('/synthesize')){expect(form.get('text')).toBe('Merhaba');return new Response(new Uint8Array(audio));}
      expect(form.get('document')).toBeInstanceOf(Blob);return new Response(JSON.stringify({content:'Tablo',finish_reason:'length'}));
    });
    const nim=createNimSpecialists({env:{HAFIZE_NIM_ASR_URL:'http://localhost:9000',HAFIZE_NIM_TTS_URL:'https://tts.example',HAFIZE_NIM_PARSE_URL:'https://parse.example',HAFIZE_NIM_ASR_LANGUAGES:'tr-TR',HAFIZE_NIM_TTS_LANGUAGES:'tr-TR',NVIDIA_API_KEY:'not-forwarded'},fetchImpl:fetchImpl as typeof fetch});
    expect(await nim.transcribe({data:audio.toString('base64'),language:'tr-TR'})).toMatchObject({text:'Merhaba'});
    expect(await nim.synthesize({text:'Merhaba',language:'tr-TR'})).toMatchObject({mime:'audio/wav'});
    expect(await nim.parse({data:png.toString('base64')})).toMatchObject({content:'Tablo',truncated:true});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('rejects unsupported locale and invalid media before a network request',async()=>{
    const fetchImpl=vi.fn(async()=>new Response('{}'));
    const nim=createNimSpecialists({env:{HAFIZE_NIM_ASR_URL:'http://remote.example',HAFIZE_NIM_TTS_LANGUAGES:'en-US'},fetchImpl:fetchImpl as typeof fetch});
    expect(nim.status().asr).toBe(false);
    await expect(nim.synthesize({text:'merhaba',language:'tr-TR'})).rejects.toThrow('NIM_LANGUAGE_NOT_CONFIGURED');
    await expect(nim.parse({data:audio.toString('base64')})).rejects.toThrow('NIM_DOCUMENT_FORMAT');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

it('reports actual service observations without retaining request content or mistaking malformed output for success',async()=>{
 let valid=false;const nim=createNimSpecialists({env:{HAFIZE_NIM_ASR_URL:'https://asr.example',HAFIZE_NIM_ASR_LANGUAGES:'tr-TR'},fetchImpl:async()=>new Response(JSON.stringify(valid?{text:'private transcript'}:{}))});
 const data=audio.toString('base64');
 expect(nim.status().observations.asr.state).toBe('not_tested');
 await expect(nim.transcribe({data,language:'tr-TR'})).rejects.toThrow('NIM_TRANSCRIPT_INVALID');
 expect(nim.status().observations.asr).toMatchObject({state:'failed',error:'NIM_TRANSCRIPT_INVALID'});
 valid=true;await nim.transcribe({data,language:'tr-TR'});
 expect(nim.status().observations.asr).toMatchObject({state:'passed',error:null});
 expect(JSON.stringify(nim.status())).not.toContain('private transcript');
});

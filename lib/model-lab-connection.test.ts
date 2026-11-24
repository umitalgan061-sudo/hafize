import {it,expect} from 'vitest';
import {modelLabConnection,NVIDIA_OFFICIAL_LAB_BASE} from './model-lab-connection.ts';
it('never uses a gateway key or an arbitrary endpoint for the direct NVIDIA lab',()=>{
 expect(modelLabConnection({HAFIZE_FREELLM_API_KEY:'gateway-only'})).toEqual({connection:null,reason:'NVIDIA_KEY_MISSING'});
 expect(modelLabConnection({NVIDIA_API_KEY:'direct',NIM_BASE_URL:'https://gateway.example/v1'})).toEqual({connection:null,reason:'NVIDIA_OFFICIAL_ENDPOINT_REQUIRED'});
 expect(modelLabConnection({NVIDIA_API_KEY:'direct',HAFIZE_FREELLM_API_KEY:'different'})).toEqual({connection:{apiKey:'direct',baseUrl:NVIDIA_OFFICIAL_LAB_BASE},reason:null});
});

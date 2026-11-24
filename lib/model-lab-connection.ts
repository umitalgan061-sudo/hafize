export const NVIDIA_OFFICIAL_LAB_BASE='https://integrate.api.nvidia.com/v1';
/** The lab never reuses a gateway credential, redirects, or operator custom provider URL. */
export function modelLabConnection(env:Record<string,string|undefined>){
 const apiKey=env.NVIDIA_API_KEY?.trim()||'';
 const base=(env.NIM_BASE_URL||NVIDIA_OFFICIAL_LAB_BASE).trim().replace(/\/+$/,'');
 if(!apiKey)return {connection:null,reason:'NVIDIA_KEY_MISSING'} as const;
 if(base!==NVIDIA_OFFICIAL_LAB_BASE)return {connection:null,reason:'NVIDIA_OFFICIAL_ENDPOINT_REQUIRED'} as const;
 return {connection:{apiKey,baseUrl:NVIDIA_OFFICIAL_LAB_BASE},reason:null} as const;
}

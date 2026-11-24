import {describe,expect,it} from 'vitest';
import {isLightweightVoiceTurn} from './voice-turn-routing.ts';
import {pickTurkishVoice} from './voice-output.ts';
import {styles} from './supertonic-pack.ts';
import {readFileSync} from 'node:fs';

describe('fast Turkish voice conversation',()=>{
 it.each(['Merhaba nasılsın','İyiyim','Sen nasılsın?','Bir fıkra anlat','Beni güldür','Bence de','Harika'])('uses fast conversational route: %s',turn=>expect(isLightweightVoiceTurn(turn)).toBe(true));
 it.each(['Hafize GitHub depomu incele','Yarın Ankara hava nasıl','Bana dosya gönder','Güncel haberleri araştır','Merhaba kod yaz','10 dakika sonra hatırlat'])('keeps agent route: %s',turn=>expect(isLightweightVoiceTurn(turn)).toBe(false));
 it('does not silently select a foreign language voice',()=>{
   const tr={name:'Türkçe',lang:'tr-TR',voiceURI:'tr'};
   const en={name:'English',lang:'en-US',voiceURI:'en'};
   expect(pickTurkishVoice([tr,en],'en')).toEqual(tr);
 });
 it('exposes ten genuine existing speaker styles',()=>expect(styles).toEqual(['F1','F2','F3','F4','F5','M1','M2','M3','M4','M5']));
 it('wires the fast route to a bounded request and configured server model',()=>{
   const app=readFileSync(new URL('./app-shell.ts',import.meta.url),'utf8');
   const server=readFileSync(new URL('../../server.ts',import.meta.url),'utf8');
   expect(app).toContain('streamAssistantReply(192, true)');
   expect(app).toContain('voice_conversation: true');
   expect(server).toContain("if (voiceConversation && provider === 'nvidia') model = gateway?.model");
   expect(server).toContain('34_000');
 });
});

it.each(['Fena değilim ya','Sana bir şey anlatacağım','Devam et','Sonra ne oldu?','Ciddi misin?'])('recognizes natural follow-up: %s',turn=>expect(isLightweightVoiceTurn(turn)).toBe(true));
it.each(['Devam et ve Firebase yayınla','Borsa fiyatı ne oldu','Kod yazmaya devam et'])('preserves real tool tasks: %s',turn=>expect(isLightweightVoiceTurn(turn)).toBe(false));

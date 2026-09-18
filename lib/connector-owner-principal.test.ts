import { describe, expect, it } from 'vitest';
import { createConnectorOwnerResolver } from './connector-owner-principal.ts';

const key=Buffer.alloc(32,7);

describe('connector owner principal',()=>{
  it('produces a stable opaque owner id',()=>{
    const resolver=createConnectorOwnerResolver({key});
    const first=resolver.resolve({authenticated:true,subject:'user-1'});
    expect(first).toEqual(resolver.resolve({authenticated:true,subject:'user-1'}));
    expect(first.ownerId).toMatch(/^owner_[A-Za-z0-9_-]+$/);
  });
  it('rejects unauthenticated or malformed principals',()=>{
    const resolver=createConnectorOwnerResolver({key});
    expect(()=>resolver.resolve({authenticated:false,subject:'user-1'})).toThrow('CONNECTOR_AUTH_REQUIRED');
    expect(()=>resolver.resolve({authenticated:true,subject:''})).toThrow('INVALID_CONNECTOR_PRINCIPAL:principal.subject');
    expect(()=>resolver.resolve({authenticated:true,subject:'u',extra:'x'})).toThrow('INVALID_CONNECTOR_PRINCIPAL:principal.extra');
  });
  it('requires a 32-byte key',()=>{
    expect(()=>createConnectorOwnerResolver({key:Buffer.alloc(16)})).toThrow('INVALID_CONNECTOR_PRINCIPAL:key');
  });
});

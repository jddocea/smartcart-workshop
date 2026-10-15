import { createProvider } from './select-provider';

describe('createProvider', () => {
  it('uses Gemini when an API key is configured', () => {
    expect(createProvider({ GEMINI_API_KEY: 'key' }).name).toBe('gemini');
  });

  it('uses the mock provider without an API key', () => {
    expect(createProvider({ GEMINI_API_KEY: '' }).name).toBe('mock');
  });

  it('uses the mock provider when forced, even with a key', () => {
    expect(createProvider({ GEMINI_API_KEY: 'key', SMARTCART_PROVIDER: 'mock' }).name).toBe('mock');
  });
});

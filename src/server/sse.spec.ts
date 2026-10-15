import { encodeSse } from './sse';

describe('encodeSse', () => {
  it('encodes an agent event as a single SSE data frame', () => {
    expect(encodeSse({ type: 'text', delta: 'hi' })).toBe('data: {"type":"text","delta":"hi"}\n\n');
  });
});

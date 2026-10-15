import { encodeSse } from '../../server/sse';
import { SseParser } from './sse-parser';

describe('SseParser', () => {
  let parser: SseParser;

  beforeEach(() => (parser = new SseParser()));

  it('parses a single frame', () => {
    expect(parser.push(encodeSse({ type: 'text', delta: 'Hi' }))).toEqual([
      { type: 'text', delta: 'Hi' },
    ]);
  });

  it('parses two frames delivered in one chunk', () => {
    const chunk = encodeSse({ type: 'text', delta: 'Hi' }) + encodeSse({ type: 'done' });

    expect(parser.push(chunk)).toEqual([{ type: 'text', delta: 'Hi' }, { type: 'done' }]);
  });

  it('buffers a frame split across three chunks', () => {
    const frame = encodeSse({ type: 'error', message: 'Oops' });

    expect(parser.push(frame.slice(0, 5))).toEqual([]);
    expect(parser.push(frame.slice(5, 20))).toEqual([]);
    expect(parser.push(frame.slice(20))).toEqual([{ type: 'error', message: 'Oops' }]);
  });

  it('skips malformed JSON and still parses the next frame', () => {
    const chunk = 'data: {not json\n\n' + encodeSse({ type: 'done' });

    expect(parser.push(chunk)).toEqual([{ type: 'done' }]);
  });

  it('skips frames without a string type', () => {
    expect(parser.push('data: {"type":42}\n\ndata: [1,2]\n\ndata: null\n\n')).toEqual([]);
  });

  it('ignores comments and non-data lines', () => {
    const chunk = ': keep-alive\n\nevent: message\nid: 7\ndata: {"type":"done"}\n\n';

    expect(parser.push(chunk)).toEqual([{ type: 'done' }]);
  });

  it('joins multi-line data and accepts data without a space', () => {
    expect(parser.push('data:{"type":"text",\ndata: "delta":"x"}\n\n')).toEqual([
      { type: 'text', delta: 'x' },
    ]);
  });
});

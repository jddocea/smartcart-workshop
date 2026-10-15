import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { findProduct } from '../../shared/products';
import { CartStore } from '../cart/cart.store';
import { AssistantPanel } from './assistant-panel';
import { ChatService, UiMessage } from './chat.service';

class FakeChatService {
  readonly messages = signal<UiMessage[]>([]);
  readonly streaming = signal(false);
  readonly provider = signal<'gemini' | 'mock' | null>(null);
  readonly send = vi.fn(async () => undefined);
  readonly reset = vi.fn();
}

const headphones = findProduct('wireless-headphones')!;

describe('AssistantPanel', () => {
  let fixture: ComponentFixture<AssistantPanel>;
  let element: HTMLElement;
  let chat: FakeChatService;

  const query = <T extends HTMLElement = HTMLElement>(testId: string) =>
    element.querySelector<T>(`[data-testid="${testId}"]`);
  const queryAll = (testId: string) => element.querySelectorAll(`[data-testid="${testId}"]`);

  async function typeMessage(text: string) {
    const input = query<HTMLTextAreaElement>('assistant-input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    return input;
  }

  beforeEach(async () => {
    localStorage.clear();
    chat = new FakeChatService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ChatService, useValue: chat }],
    });
    fixture = TestBed.createComponent(AssistantPanel);
    element = fixture.nativeElement;
    await fixture.whenStable();
    query('assistant-toggle')!.click();
    await fixture.whenStable();
  });

  it('opens a labelled panel from the toggle', () => {
    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Shopping assistant',
    );
    expect(query('assistant-toggle')).toBeNull();
  });

  it('shows suggestions when empty and sends the clicked one', async () => {
    const suggestions = queryAll('assistant-suggestion');
    expect([...suggestions].map((button) => button.textContent?.trim())).toEqual([
      'Show me headphones under $100',
      'Add the cheapest mug to my cart',
      'What fitness gear do you have?',
    ]);

    (suggestions[0] as HTMLButtonElement).click();
    expect(chat.send).toHaveBeenCalledWith('Show me headphones under $100');
  });

  it('shows the demo banner only for the mock provider', async () => {
    expect(query('demo-banner')).toBeNull();

    chat.provider.set('mock');
    await fixture.whenStable();
    expect(query('demo-banner')?.textContent).toContain('Demo mode');
  });

  it('sends on Enter and clears the input', async () => {
    const input = await typeMessage('find a mug');
    expect(query<HTMLButtonElement>('assistant-send')!.disabled).toBe(false);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(chat.send).toHaveBeenCalledWith('find a mug');
    expect(input.value).toBe('');
    expect(query<HTMLButtonElement>('assistant-send')!.disabled).toBe(true);
  });

  it('disables send while streaming', async () => {
    await typeMessage('hello');
    chat.streaming.set(true);
    await fixture.whenStable();

    expect(query<HTMLButtonElement>('assistant-send')!.disabled).toBe(true);
  });

  it('renders messages, products, typing indicator and errors', async () => {
    chat.streaming.set(true);
    chat.messages.set([
      { id: 1, role: 'user', text: 'headphones?', products: [] },
      { id: 2, role: 'assistant', text: '', products: [] },
    ]);
    await fixture.whenStable();
    expect(query('typing-indicator')).not.toBeNull();

    chat.streaming.set(false);
    chat.messages.update((messages) => [
      messages[0],
      { ...messages[1], text: 'Here you go:', products: [headphones] },
      { id: 3, role: 'user', text: 'and more?', products: [] },
      { id: 4, role: 'assistant', text: '', products: [], error: 'Something broke' },
    ]);
    await fixture.whenStable();

    const roles = [...queryAll('assistant-message')].map((m) => m.getAttribute('data-role'));
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(query('typing-indicator')).toBeNull();
    expect(query('assistant-product')?.textContent).toContain('Wireless Headphones');
    expect(query('assistant-error')?.getAttribute('role')).toBe('alert');
    expect(query('assistant-error')?.textContent).toContain('Something broke');

    query('assistant-product')!.querySelector('button')!.click();
    expect(TestBed.inject(CartStore).count()).toBe(1);
  });

  it('resets and closes', async () => {
    query('assistant-reset')!.click();
    expect(chat.reset).toHaveBeenCalled();

    query('assistant-close')!.click();
    await fixture.whenStable();
    expect(query('assistant-panel')).toBeNull();
    expect(query('assistant-toggle')).not.toBeNull();
  });
});

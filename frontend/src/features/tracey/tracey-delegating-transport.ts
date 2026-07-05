import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';

/**
 * A {@link ChatTransport} that forwards to a swappable inner transport. The runtime is created
 * once (hooks can't be conditional), but the real proxy-backed transport only exists after the
 * session resolves; until then sends reject.
 */
export class DelegatingTransport implements ChatTransport<UIMessage> {
  private inner: ChatTransport<UIMessage> | null = null;

  setInner(inner: ChatTransport<UIMessage> | null): void {
    this.inner = inner;
  }

  sendMessages(
    options: Parameters<ChatTransport<UIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    if (!this.inner) return Promise.reject(new Error('Tracey session not ready'));
    return this.inner.sendMessages(options);
  }

  reconnectToStream(
    options: Parameters<ChatTransport<UIMessage>['reconnectToStream']>[0],
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return this.inner?.reconnectToStream(options) ?? Promise.resolve(null);
  }
}

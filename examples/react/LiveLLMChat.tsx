/**
 * LiveLLM React Integration Example
 *
 * This shows how to use LiveLLM with React to render
 * interactive LLM responses.
 *
 * Install: npm install livellm
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import LiveLLM from 'livellm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Custom hook for LiveLLM rendering
 */
export function useLiveLLM() {
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback((markdown: string) => {
    if (!containerRef.current) return;
    const html = LiveLLM.render(markdown);
    containerRef.current.innerHTML = html;
  }, []);

  const stream = useCallback(async (reader: ReadableStream<string>) => {
    if (!containerRef.current) return;
    const sr = LiveLLM.createStream({
      container: containerRef.current,
      onComplete: (html: string) => {
        console.log('Stream complete', html.length, 'chars');
      },
    });
    sr.connectReadableStream(reader);
  }, []);

  // Set up action listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('LiveLLM Action:', detail);
    };

    container.addEventListener('livellm:action', handler);
    return () => container.removeEventListener('livellm:action', handler);
  }, []);

  return { containerRef, render, stream };
}

/**
 * LiveLLM Chat Component
 */
export function LiveLLMChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { containerRef, render } = useLiveLLM();

  // Re-render when messages change
  useEffect(() => {
    const assistantMessages = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n');

    if (assistantMessages) {
      render(assistantMessages);
    }
  }, [messages, render]);

  // Set up LiveLLM action handler
  useEffect(() => {
    LiveLLM.actions.onAction((action) => {
      console.log('User action:', action);
      // Handle action — e.g., send back to LLM
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Example: Call your LLM API here
    // const response = await fetch('/api/chat', { ... });
    // const assistantMsg = { role: 'assistant', content: response.text };
    // setMessages(prev => [...prev, assistantMsg]);
  };

  return (
    <div className="livellm-chat">
      <div ref={containerRef} className="livellm-output" />
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

/**
 * LiveLLM Streaming Chat Component
 */
export function LiveLLMStreamChat() {
  const { containerRef, stream } = useLiveLLM();
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setInput('');

    // Example: SSE streaming from your API
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input }),
    });

    if (response.body) {
      const reader = response.body.pipeThrough(new TextDecoderStream());
      stream(reader.readable);
    }
  };

  return (
    <div className="livellm-chat">
      <div ref={containerRef} className="livellm-output" />
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

/**
 * LiveLLM Observer Mode Component
 * Automatically processes livellm: blocks in dynamically rendered content
 */
export function LiveLLMObserver({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    LiveLLM.observe({ target: containerRef.current });

    return () => {
      LiveLLM.disconnect();
    };
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

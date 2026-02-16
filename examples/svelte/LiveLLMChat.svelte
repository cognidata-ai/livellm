<!--
  LiveLLM Svelte Integration Example

  This shows how to use LiveLLM with Svelte to render
  interactive LLM responses.

  Install: npm install livellm
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import LiveLLM from 'livellm';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  let outputEl: HTMLDivElement;
  let input = '';
  let messages: Message[] = [];
  let streaming = false;

  // Render messages reactively
  $: {
    const assistantContent = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n');

    if (outputEl && assistantContent) {
      outputEl.innerHTML = LiveLLM.render(assistantContent);
    }
  }

  onMount(() => {
    // Set up global action handler
    LiveLLM.actions.onAction((action) => {
      console.log('User action:', action);
      // Handle action — e.g., send back to LLM
    });
  });

  function handleAction(e: CustomEvent) {
    console.log('LiveLLM Action:', e.detail);
  }

  async function handleSubmit() {
    if (!input.trim()) return;

    messages = [...messages, { role: 'user', content: input }];
    input = '';

    // Example: Call your LLM API here
    // const response = await fetch('/api/chat', { ... });
    // messages = [...messages, { role: 'assistant', content: response.text }];
  }

  async function handleStreamSubmit() {
    if (!input.trim() || streaming) return;

    const userInput = input;
    input = '';
    streaming = true;

    const sr = LiveLLM.createStream({
      container: outputEl,
      onComplete: () => {
        streaming = false;
        console.log('Stream complete');
      },
    });

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userInput }),
      });

      if (response.body) {
        const reader = response.body.pipeThrough(new TextDecoderStream());
        sr.connectReadableStream(reader.readable);
      }
    } catch (err) {
      streaming = false;
      console.error('Stream error:', err);
    }
  }
</script>

<div class="livellm-chat">
  <!-- Rendered output -->
  <div
    bind:this={outputEl}
    class="livellm-output"
    on:livellm:action={handleAction}
  />

  <!-- Input form -->
  <form on:submit|preventDefault={handleSubmit}>
    <input
      type="text"
      bind:value={input}
      placeholder="Ask something..."
    />
    <button type="submit" disabled={!input.trim()}>Send</button>
    <button type="button" on:click={handleStreamSubmit} disabled={streaming}>
      {streaming ? 'Streaming...' : 'Stream'}
    </button>
  </form>
</div>

<style>
  .livellm-chat {
    max-width: 800px;
    margin: 0 auto;
  }
  .livellm-output {
    min-height: 200px;
    padding: 16px;
  }
  form {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid #e0e0e0;
  }
  input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
  }
  button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #6c5ce7;
    color: white;
    cursor: pointer;
    font-size: 14px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

<!--
  LiveLLM Vue Integration Example

  This shows how to use LiveLLM with Vue 3 to render
  interactive LLM responses.

  Install: npm install livellm
-->
<template>
  <div class="livellm-chat">
    <!-- Rendered output -->
    <div ref="outputRef" class="livellm-output" @livellm:action="handleAction" />

    <!-- Input form -->
    <form @submit.prevent="handleSubmit">
      <input
        v-model="input"
        type="text"
        placeholder="Ask something..."
      />
      <button type="submit" :disabled="!input.trim()">Send</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import LiveLLM from 'livellm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const outputRef = ref<HTMLDivElement>();
const input = ref('');
const messages = ref<Message[]>([]);

// Render assistant messages whenever they change
watch(
  () => messages.value.filter(m => m.role === 'assistant'),
  (assistantMsgs) => {
    if (!outputRef.value) return;
    const markdown = assistantMsgs.map(m => m.content).join('\n\n');
    if (markdown) {
      outputRef.value.innerHTML = LiveLLM.render(markdown);
    }
  },
  { deep: true }
);

// Action handler
function handleAction(e: Event) {
  const detail = (e as CustomEvent).detail;
  console.log('LiveLLM Action:', detail);
  // Send action back to LLM or handle locally
}

// Set up global action handler
onMounted(() => {
  LiveLLM.actions.onAction((action) => {
    console.log('User action:', action);
  });
});

async function handleSubmit() {
  if (!input.value.trim()) return;

  messages.value.push({ role: 'user', content: input.value });
  input.value = '';

  // Example: Call your LLM API here
  // const response = await fetch('/api/chat', { ... });
  // messages.value.push({ role: 'assistant', content: response.text });
}
</script>

<!--
  LiveLLM Streaming Example (composable)

  Usage in your component:
    const { containerRef, startStream } = useLiveLLMStream();

  <template>
    <div ref="containerRef" />
    <button @click="startStream('/api/stream')">Start</button>
  </template>
-->
<script lang="ts">
// Composable for streaming
export function useLiveLLMStream() {
  const containerRef = ref<HTMLDivElement>();

  async function startStream(url: string, body?: Record<string, any>) {
    if (!containerRef.value) return;

    const sr = LiveLLM.createStream({
      container: containerRef.value,
      onComplete: (html: string) => {
        console.log('Stream complete', html.length, 'chars');
      },
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

    if (response.body) {
      const reader = response.body.pipeThrough(new TextDecoderStream());
      sr.connectReadableStream(reader.readable);
    }
  }

  return { containerRef, startStream };
}

// Composable for observer mode
export function useLiveLLMObserver() {
  const containerRef = ref<HTMLDivElement>();

  onMounted(() => {
    if (containerRef.value) {
      LiveLLM.observe({ target: containerRef.value });
    }
  });

  onUnmounted(() => {
    LiveLLM.disconnect();
  });

  return { containerRef };
}
</script>

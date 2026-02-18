<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';	
	
	const chat = new Chat({});
	
	let input = '';
	const { messages } = chat;  // This is already reactive
	
	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!input.trim()) return;
		chat.sendMessage({ text: input }).catch((err) => console.error('Chat error:', err));
		input = '';
	}
</script>

<section class="w-full max-w-2xl rounded-lg bg-gray-900 p-6 shadow-lg">
	<h2 class="mb-4 text-2xl font-bold">💬 AI Chat Interface For Post Ideas</h2>
	<ul class="mb-4 max-h-64 space-y-2 overflow-y-auto">
		{#each messages as message, i (i)}
			<li class="rounded-lg bg-gray-800 p-3">
				<div class="text-sm text-gray-400">{message.role}</div>
				<div class="mt-1">
					{#each message.parts as part, j (j)}
						{#if part.type === 'text'}
							<div>{part.text}</div>
						{/if}
					{/each}
				</div>
			</li>
		{/each}
	</ul>
	<form on:submit|preventDefault={handleSubmit} class="flex gap-2">
		<input
			bind:value={input}
			placeholder="Type your idea..."
			class="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
		<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 shadow-lg hover:bg-blue-700">
			Send
		</button>
	</form>
</section>
<!-- CaptureProgressOverlay.svelte -->
<script lang="ts">
	export let progress: number = 0;
	export let message: string = '';
	export let isVisible: boolean = false;
</script>

{#if isVisible}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
		<div class="mx-4 w-full max-w-md rounded-lg border border-white/10 bg-gray-900 p-8 shadow-2xl">
			<!-- Icon -->
			<div class="mb-4 flex justify-center">
				<div class="relative">
					<svg class="h-16 w-16 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<div class="absolute inset-0 flex items-center justify-center">
						<span class="text-2xl">🎬</span>
					</div>
				</div>
			</div>

			<!-- Title -->
			<h3 class="mb-2 text-center text-xl font-bold text-white">Encoding Video</h3>

			<!-- Message -->
			<p class="mb-6 text-center text-sm text-gray-400">
				{message || 'Please wait...'}
			</p>

			<!-- Progress Bar -->
			<div class="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-700">
				<div
					class="h-full rounded-full bg-linear-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
					style="width: {progress}%"
				></div>
			</div>

			<!-- Percentage -->
			<p class="text-center text-xs text-gray-500">
				{Math.round(progress)}% complete
			</p>

			<!-- Tip -->
			<div class="mt-6 rounded border border-blue-500/30 bg-blue-900/30 p-3">
				<p class="text-center text-xs text-blue-300">
					💡 This may take a minute. Don't close this tab!
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>

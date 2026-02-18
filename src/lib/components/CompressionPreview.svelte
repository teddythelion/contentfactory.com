<!-- src/lib/components/CompressionPreview.svelte -->
<!-- Shows what will be compressed before user posts -->

<script lang="ts">
	import type { CompressionResult } from '$lib/utils/compressCaption';
	import { formatFileSize } from '$lib/utils/compressCaption';

	export let contentType: 'image' | 'video';
	export let contentUrl: string;
	export let originalCaption: string;
	export let compressionResult: CompressionResult;
	export let originalFileSize: number = 0;
	export let compressedFileSize: number = 0;
	export let isLoading: boolean = false;
	export let onConfirm: (finalCaption: string) => void;
	export let onEdit: () => void;

	let editedCaption = compressionResult.compressed;
	let isEditing = false;

	function handleConfirm() {
		onConfirm(editedCaption);
	}

	function toggleEdit() {
		isEditing = !isEditing;
		if (!isEditing) {
			editedCaption = compressionResult.compressed;
		}
	}

	$: charCount = editedCaption.length;
	$: isOverLimit = charCount > 280;
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div>
		<h3 class="text-xl font-bold text-white">Ready to Post?</h3>
		<p class="mt-1 text-sm text-gray-400">Review what will be posted to all platforms</p>
	</div>

	<!-- Main Content Area: Left (Video) + Right (Controls) -->
	<div class="flex flex-col gap-6 lg:flex-row">
		<!-- LEFT: Video/Image Preview -->
		<div class="flex flex-1 flex-col">
			<div class="rounded-lg bg-base-300 p-4">
				<p class="mb-2 text-sm font-semibold text-white">Preview:</p>
				{#if contentType === 'video'}
					<video src={contentUrl} controls class="w-full rounded-lg object-cover">
						<track kind="captions" src="" label="English" srclang="en" />
					</video>
				{:else}
					<img src={contentUrl} alt="Content preview" class="w-full rounded-lg object-cover" />
				{/if}
			</div>
		</div>

		<!-- RIGHT: Controls & Details -->
		<div class="flex flex-1 flex-col gap-6 overflow-y-auto">
			<!-- Compression Details -->
			{#if compressionResult.wasCompressed || originalFileSize > 0}
				<div class="rounded-lg border border-blue-500/50 bg-blue-900/30 p-4">
					<p class="mb-3 text-sm font-semibold text-blue-300">📊 Platform Compatibility</p>

					<div class="flex flex-col gap-3 text-sm">
						{#if compressionResult.wasCompressed}
							<div class="flex items-center justify-between">
								<span class="text-gray-300">Caption Length:</span>
								<span class="font-mono text-blue-300">
									{compressionResult.original.length} → {compressionResult.charCount} chars
								</span>
							</div>
							<p class="text-xs text-gray-400">
								✓ All platforms allow {compressionResult.charCount} characters
							</p>
						{/if}

						{#if originalFileSize > 0}
							<div class="flex items-center justify-between">
								<span class="text-gray-300">File Size:</span>
								<span class="font-mono text-blue-300">
									{formatFileSize(originalFileSize)}
									{#if compressedFileSize && compressedFileSize !== originalFileSize}
										→ {formatFileSize(compressedFileSize)}
									{/if}
								</span>
							</div>
							<p class="text-xs text-gray-400">✓ All platforms allow files up to 100MB</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Caption Comparison -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<p class="text-sm font-semibold text-white">Caption</p>
					{#if compressionResult.wasCompressed}
						<button on:click={toggleEdit} class="text-xs text-blue-400 hover:text-blue-300">
							{isEditing ? '✕ Done Editing' : '✎ Edit'}
						</button>
					{/if}
				</div>

				{#if !isEditing}
					<!-- View Mode -->
					<div class="space-y-2">
						{#if compressionResult.wasCompressed}
							<div class="rounded-lg bg-gray-800/50 p-3">
								<p class="mb-1 text-xs text-gray-400">Original:</p>
								<p class="line-clamp-2 text-sm text-gray-300">
									{compressionResult.original}
								</p>
								<p class="mt-1 text-xs text-gray-500">
									{compressionResult.original.length} characters
								</p>
							</div>
						{/if}

						<div class="rounded-lg border border-green-500/50 bg-green-900/30 p-3">
							<p class="mb-1 text-xs text-green-400">
								{compressionResult.wasCompressed ? 'AI Compressed:' : 'Caption:'}
							</p>
							<p class="text-sm text-white">
								{compressionResult.compressed}
							</p>
							<p class="mt-1 text-xs text-green-400">
								{compressionResult.charCount}/280 characters
							</p>
						</div>
					</div>
				{:else}
					<!-- Edit Mode -->
					<div class="space-y-2">
						<textarea
							bind:value={editedCaption}
							placeholder="Edit caption..."
							class="textarea-bordered textarea w-full bg-base-200 text-white"
							rows="4"
							maxlength="280"
						></textarea>
						<div class="flex items-center justify-between">
							<p class="text-xs text-gray-400">
								{charCount}/280 characters
								{#if isOverLimit}
									<span class="text-error">- Over limit!</span>
								{/if}
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-col gap-2">
				<button
					on:click={handleConfirm}
					disabled={isLoading || isOverLimit}
					class="btn w-full btn-success disabled:btn-disabled"
				>
					{#if isLoading}
						<div class="loading loading-sm loading-spinner"></div>
						Posting...
					{:else}
						🚀 Post to All Platforms
					{/if}
				</button>

				<button on:click={onEdit} class="btn w-full btn-outline btn-sm">
					← Back to Edit Content
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	::-webkit-scrollbar {
		width: 8px;
	}

	::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>

<!-- src/lib/components/PostModal.svelte (UPDATED) -->
<!-- Handles caption input, account selection, compression preview, and posting -->

<script lang="ts">
	import { onMount } from 'svelte';
	import type { SocialAccount, SocialPlatform } from '$lib/types/social.types';
	import type { CreateSocialPostDto } from '$lib/types/social.types';
	import { compressCaption, type CompressionResult } from '$lib/utils/compressCaption';
	import CompressionPreview from './CompressionPreview.svelte';

	// Props
	export let contentId: string;
	export let contentUrl: string;
	export let contentType: 'image' | 'video';
	export let onBack: () => void;
	export let onSuccess: () => void;

	// Modal views
	type ModalStep = 'account-select' | 'compression-preview' | 'posting';
	let currentStep: ModalStep = 'account-select';

	// State
	let caption = '';
	let selectedAccountIds: Set<string> = new Set();
	let socialAccounts: SocialAccount[] = [];
	let isLoadingAccounts = false;
	let isPosting = false;
	let postError = '';
	let postSuccess = false;
	let compressionResult: CompressionResult | null = null;
	let isCompressing = false;

	// Group accounts by platform
	$: accountsByPlatform = socialAccounts.reduce(
		(acc, account) => {
			if (!acc[account.platform]) {
				acc[account.platform] = [];
			}
			acc[account.platform].push(account);
			return acc;
		},
		{} as Record<SocialPlatform, SocialAccount[]>
	);

	// Get selected platforms from selected accounts
	$: selectedPlatforms = Array.from(
		new Set(
			Array.from(selectedAccountIds)
				.map((id) => socialAccounts.find((a) => a.id === id)?.platform)
				.filter(Boolean) as SocialPlatform[]
		)
	);

	onMount(async () => {
		isLoadingAccounts = true;
		try {
			const response = await fetch('/api/social/accounts', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				const data = await response.json();
				// Filter to only show active accounts for posting
				socialAccounts = (data.accounts || []).filter((acc) => acc.isActive);
			} else {
				postError = 'Failed to load social accounts';
			}
		} catch (error) {
			console.error('Error loading accounts:', error);
			postError = 'Error loading social accounts';
		} finally {
			isLoadingAccounts = false;
		}
	});

	function toggleAccount(accountId: string) {
		if (selectedAccountIds.has(accountId)) {
			selectedAccountIds.delete(accountId);
		} else {
			selectedAccountIds.add(accountId);
		}
		selectedAccountIds = selectedAccountIds; // Trigger reactivity
	}

	async function handleNextStep() {
		if (selectedAccountIds.size === 0) {
			postError = 'Please select at least one account to post to';
			return;
		}

		if (!caption.trim()) {
			postError = 'Please enter a caption';
			return;
		}

		// Compress caption
		isCompressing = true;
		postError = '';

		try {
			compressionResult = await compressCaption(caption);
			currentStep = 'compression-preview';
		} catch (error) {
			console.error('Error compressing caption:', error);
			postError = 'Error preparing content for posting';
		} finally {
			isCompressing = false;
		}
	}

	async function handlePost(finalCaption: string) {
		isPosting = true;
		postError = '';

		try {
			const postData: CreateSocialPostDto = {
				contentId,
				contentType,
				contentUrl,
				caption: finalCaption,
				platforms: selectedPlatforms
			};

			const response = await fetch('/api/social/post', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(postData)
			});

			const result = await response.json();

			if (response.ok && result.success) {
				postSuccess = true;
				// Reset form for next post
				setTimeout(() => {
					caption = '';
					selectedAccountIds = new Set();
					postSuccess = false;
					currentStep = 'account-select';
					compressionResult = null;
					onSuccess();
				}, 2000);
			} else {
				postError = result.error || 'Failed to post to social media';
				currentStep = 'compression-preview'; // Stay on preview if error
			}
		} catch (error) {
			console.error('Error posting:', error);
			postError = 'Error posting to social media';
			currentStep = 'compression-preview'; // Stay on preview if error
		} finally {
			isPosting = false;
		}
	}

	function goBackToAccountSelect() {
		currentStep = 'account-select';
		compressionResult = null;
	}
</script>

<div class="flex flex-col gap-4 overflow-y-auto">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-xl font-bold text-white">
			{#if currentStep === 'account-select'}
				Share to Social Media
			{:else if currentStep === 'compression-preview'}
				Confirm & Post
			{/if}
		</h3>
		{#if currentStep === 'account-select'}
			<button on:click={onBack} class="btn btn-ghost btn-sm" aria-label="Back to editing">
				← Back to Edit
			</button>
		{/if}
	</div>

	<!-- ===== STEP 1: Account Selection ===== -->
	{#if currentStep === 'account-select'}
		<div class="flex flex-row gap-4">
			<!-- Content Preview -->
			<div class="h-5/7 w-1/2 rounded-lg bg-base-300 p-4">
				<p class="mb-2 text-sm font-semibold text-white">Preview:</p>
				{#if contentType === 'video'}
					<video src={contentUrl} controls class="max-h-96 w-full rounded-lg object-cover">
						<track kind="captions" src="" label="English" srclang="en" />
					</video>
				{:else}
					<img
						src={contentUrl}
						alt="Content preview"
						class="max-h-7/8 w-full rounded-lg object-cover"
					/>
				{/if}
			</div>

			<div class="flex w-1/2 flex-col">
				<!-- Caption Input -->
				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend">Caption</legend>
					<textarea
						bind:value={caption}
						placeholder="Write your caption here... (will be compressed to fit all platforms)"
						class="textarea-bordered textarea min-h-[100px] w-full bg-base-100 text-white"
						maxlength="2200"
					></textarea>
					<p class="mt-1 text-xs text-gray-400">
						{caption.length} characters (will be optimized for all platforms)
					</p>
				</fieldset>

				<!-- Social Accounts Selection -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Select Accounts to Post To</legend>

					{#if isLoadingAccounts}
						<div class="flex items-center justify-center gap-2">
							<div class="loading loading-sm loading-spinner text-info"></div>
							<p class="text-sm text-gray-400">Loading accounts...</p>
						</div>
					{:else if socialAccounts.length === 0}
						<div class="alert py-2 alert-warning">
							<p class="text-sm">
								No social accounts connected. <a href="/settings/social" class="link"
									>Connect an account</a
								>
							</p>
						</div>
					{:else}
						<div class="flex flex-col gap-4">
							{#each Object.entries(accountsByPlatform) as [platform, accounts]}
								<div class="rounded-lg bg-base-200 p-3">
									<p class="mb-2 text-sm font-semibold text-gray-300 uppercase">{platform}</p>
									<div class="flex flex-col gap-2">
										{#each accounts as account}
											<label
												class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-300"
											>
												<input
													type="checkbox"
													checked={selectedAccountIds.has(account.id!)}
													on:change={() => toggleAccount(account.id!)}
													class="checkbox"
												/>
												<span class="text-sm text-white">{account.accountName}</span>
											</label>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</fieldset>

				<!-- Error/Success Messages -->
				{#if postError}
					<div class="alert py-2 alert-error">
						<p class="text-sm">{postError}</p>
					</div>
				{/if}

				<!-- Next Button -->
				<button
					on:click={handleNextStep}
					disabled={isCompressing ||
						selectedAccountIds.size === 0 ||
						!caption.trim() ||
						socialAccounts.length === 0}
					class="btn w-full btn-info disabled:btn-disabled"
				>
					{#if isCompressing}
						<div class="loading loading-sm loading-spinner"></div>
						Preparing...
					{:else}
						Next: Review & Post →
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- ===== STEP 2: Compression Preview ===== -->
	{#if currentStep === 'compression-preview' && compressionResult}
		<CompressionPreview
			{contentType}
			{contentUrl}
			originalCaption={caption}
			{compressionResult}
			isLoading={isPosting}
			onConfirm={handlePost}
			onEdit={goBackToAccountSelect}
		/>

		{#if postError}
			<div class="alert py-2 alert-error">
				<p class="text-sm">{postError}</p>
			</div>
		{/if}

		{#if postSuccess}
			<div class="alert py-2 alert-success">
				<p class="text-sm">
					✅ Posted to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1
						? 's'
						: ''}!
				</p>
			</div>
		{/if}
	{/if}
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

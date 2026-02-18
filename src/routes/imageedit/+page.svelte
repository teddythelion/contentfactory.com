<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth.store';
	import { workflowContext } from '$lib/stores/workflow.store';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import ThreeJSEnhancer from '$lib/components/ThreeJSEnhancer.svelte';
	import PromptCoachRefine from '$lib/components/PromptCoachRefine.svelte';
	import { saveContentToCloud } from '$lib/utils/saveContent';

	let imageUrl = '';
	let loading = false;
	let prompt = '';
	let status = '';
	let uploadedImages: File[] = [];
	let imagePreviews: string[] = [];
	let showEnhancer = false;
	let enhancedPrompt = '';
	let refinePrompt = '';
	let isRefining = false;
	let showPromptCoach = false;
	let isImageUploadedForEditing = false;
	let showInfoModal = false;

	// Save state
	let isSaving = false;
	let saveStatus = '';
	let savedContentId = '';

	// Save state to sessionStorage
	$: if (typeof window !== 'undefined') {
		try {
			sessionStorage.setItem(
				'imageedit_state',
				JSON.stringify({
					imageUrl,
					prompt,
					status,
					refinePrompt
				})
			);
		} catch (e) {
			console.warn('Failed to save state:', e);
			sessionStorage.removeItem('imageedit_state');
		}
	}

	function handlePromptSelected(selectedPrompt: string) {
		prompt = selectedPrompt;
		showPromptCoach = false;
		status = '✨ Prompt loaded from coach! Ready to refine.';
	}

	onMount(() => {
		const savedState = sessionStorage.getItem('imageedit_state');
		if (savedState) {
			try {
				const state = JSON.parse(savedState);
				imageUrl = state.imageUrl || '';
				prompt = state.prompt || '';
				status = state.status || '';
				refinePrompt = state.refinePrompt || '';
			} catch (e) {
				console.error('Failed to restore state:', e);
			}
		}

		const fromCreate = $page.url.searchParams.get('from');
		if (fromCreate === 'create') {
			workflowContext.goToStep(1);
			workflowContext.startCurrentStep();
			status = '✨ Ready to refine! Upload your created image.';
		}
	});

	async function generateImage() {
		loading = true;
		status = 'Generating image...';
		savedContentId = '';
		saveStatus = '';

		try {
			const formData = new FormData();
			formData.append('prompt', prompt);

			for (const file of uploadedImages) {
				formData.append('images', file);
			}

			const response = await fetch('/api/imageEdit', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (data.error) {
				status = `Error: ${data.error}`;
				return;
			}

			imageUrl = data.imageUrl;
			enhancedPrompt = data.enhancedPrompt || '';

			workflowContext.completeCurrentStep(imageUrl);

			status = '✅ Refinement complete! Next: Animate for cinematic video.';
		} catch (err) {
			console.error('Image refinement error:', err);
			status = `Error: ${err}`;
		} finally {
			loading = false;
		}
	}

	async function saveToLibrary() {
		if (!$authStore.user) {
			saveStatus = 'Please sign in to save content';
			return;
		}

		if (!imageUrl) {
			saveStatus = 'No image to save';
			return;
		}

		isSaving = true;
		saveStatus = 'Saving to library...';

		try {
			const result = await saveContentToCloud({
				fileUrl: imageUrl,
				type: 'image',
				title: `Refined Image ${new Date().toLocaleDateString()}`,
				description: 'Refined with AI enhancement',
				prompt: prompt,
				width: 1024,
				height: 1024,
				format: 'png',
				model: 'image-refinement',
				generationTime: 0,
				tags: ['refined']
			});

			if (result.success) {
				savedContentId = result.contentId || '';
				saveStatus = '✅ Saved to library!';
				setTimeout(() => {
					saveStatus = '';
				}, 3000);
			} else {
				saveStatus = `Error: ${result.error}`;
			}
		} catch (error) {
			console.error('Save error:', error);
			saveStatus = 'Failed to save';
		} finally {
			isSaving = false;
		}
	}

	function handleImageUploadForEditing(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file && file.type.startsWith('image/')) {
			const reader = new FileReader();
			reader.onload = (e: ProgressEvent<FileReader>) => {
				if (e.target?.result) {
					imageUrl = e.target.result as string;
					isImageUploadedForEditing = true;
					status = 'Image uploaded! Ready to enhance.';
				}
			};
			reader.readAsDataURL(file);
		} else {
			status = 'Error: Please upload a valid image file';
		}
	}

	function clearUploadedImage() {
		imageUrl = '';
		isImageUploadedForEditing = false;
		status = '';
		savedContentId = '';
		saveStatus = '';
	}

	function handleImageUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (files && files.length > 0) {
			const newFiles = Array.from(files);
			uploadedImages = [...uploadedImages, ...newFiles];

			const readerPromises = newFiles.map((file) => {
				return new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = (e: ProgressEvent<FileReader>) => {
						resolve(e.target?.result as string);
					};
					reader.onerror = reject;
					reader.readAsDataURL(file);
				});
			});

			Promise.all(readerPromises)
				.then((newPreviews) => {
					imagePreviews = [...imagePreviews, ...newPreviews];
				})
				.catch((error) => {
					console.error('Error reading files:', error);
				});

			target.value = '';
		}
	}

	function clearImages() {
		uploadedImages = [];
		imagePreviews = [];
		imageUrl = '';
		refinePrompt = '';
		savedContentId = '';
		saveStatus = '';
	}

	function removeImage(index: number) {
		uploadedImages = uploadedImages.filter((_, i) => i !== index);
		imagePreviews = imagePreviews.filter((_, i) => i !== index);

		if (uploadedImages.length === 0) {
			imageUrl = '';
			refinePrompt = '';
		}
	}

	async function refineImage() {
		if (!imageUrl || !refinePrompt) return;

		isRefining = true;
		status = 'Applying additional refinement...';
		savedContentId = '';
		saveStatus = '';

		try {
			const response = await fetch(imageUrl);
			const blob = await response.blob();
			const file = new File([blob], 'current-image.png', { type: 'image/png' });

			const formData = new FormData();
			formData.append('prompt', refinePrompt);
			formData.append('images', file);

			const apiResponse = await fetch('/api/imageEdit', {
				method: 'POST',
				body: formData
			});

			const data = await apiResponse.json();

			if (data.error) {
				status = `Error: ${data.error}`;
				return;
			}

			imageUrl = data.imageUrl;
			enhancedPrompt = data.enhancedPrompt || '';
			status = '✅ Additional refinement complete!';
			refinePrompt = '';
		} catch (err) {
			console.error('Image refinement error:', err);
			status = `Error: ${err}`;
		} finally {
			isRefining = false;
		}
	}

	function openEnhancer() {
		if (imageUrl) {
			showEnhancer = true;
		}
	}

	function downloadImage() {
		if (!imageUrl) return;
		const a = document.createElement('a');
		a.href = imageUrl;
		a.download = `refined-image-${Date.now()}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	function clearSession() {
		imageUrl = '';
		prompt = '';
		status = '';
		uploadedImages = [];
		imagePreviews = [];
		refinePrompt = '';
		savedContentId = '';
		saveStatus = '';
		sessionStorage.removeItem('imageedit_state');
	}
</script>

<!-- Info Modal -->
{#if showInfoModal}
	<div class="modal-open modal" role="dialog">
		<div class="modal-box max-w-lg border border-info/30 bg-base-200">
			<button
				on:click={() => (showInfoModal = false)}
				class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm"
			>
				✕
			</button>

			<h3 class="text-xl font-bold text-white">🎯 What is Precision Refine?</h3>

			<div class="mt-4 space-y-4 text-sm text-base-content/80">
				<p>
					Precision Refine is an <strong class="text-white">identity-preserving</strong> image
					editor. It keeps your subject — a face, a product, a logo —
					<strong class="text-white">exactly as-is</strong>
					while transforming everything around it.
				</p>

				<div class="rounded-lg bg-base-300 p-3">
					<p class="mb-2 font-semibold text-info">Best for:</p>
					<p>
						<span class="text-white">Portraits & Headshots</span> — New scenes, same you. Your face stays
						pixel-perfect.
					</p>
					<p class="mt-1">
						<span class="text-white">Product Photography</span> — Studio-quality shots without reshooting.
						Your product, untouched.
					</p>
					<p class="mt-1">
						<span class="text-white">Brand Assets</span> — Place your logo or product into any context
						with zero distortion.
					</p>
				</div>

				<div class="rounded-lg bg-base-300 p-3">
					<p class="mb-2 font-semibold text-success">How it works:</p>
					<p>
						Upload a reference image, describe the enhancement you want, and the AI locks onto your
						subject's identity before making any changes. If it detects a face, it activates <strong
							class="text-white">Identity Lock</strong
						> — ensuring facial structure, skin texture, and likeness are never altered.
					</p>
				</div>

				<p class="text-xs text-base-content/50">
					💡 Think of it as Photoshop-level editing that understands what <em>not</em> to touch.
				</p>
			</div>

			<div class="modal-action">
				<button on:click={() => (showInfoModal = false)} class="btn btn-sm btn-neutral">
					Got it
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop"
			on:click={() => (showInfoModal = false)}
			on:keydown={() => {}}
		></div>
	</div>
{/if}

<!-- Prompt Coach Modal -->
{#if showPromptCoach}
	<div class="modal-open modal">
		<div class="modal-box h-[70vh] max-w-3xl p-0">
			<div class="flex h-full flex-col">
				<div class="flex items-center justify-between border-b border-base-300 p-4">
					<h3 class="text-lg font-bold">Prompt Engineer</h3>
					<button
						on:click={() => (showPromptCoach = false)}
						class="btn btn-circle btn-ghost btn-sm"
					>
						✕
					</button>
				</div>
				<div class="flex-1 overflow-hidden">
					<PromptCoachRefine onPromptSelected={handlePromptSelected} />
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ThreeJS Enhancer Modal -->
{#if showEnhancer}
	<ThreeJSEnhancer {imageUrl} onClose={() => (showEnhancer = false)} />
{/if}

<div class="flex flex-col gap-6 py-4 lg:flex-row xl:pl-12 2xl:pl-20">
	<!-- LEFT SIDE: Controls -->
	<div
		class="flex flex-1 flex-col gap-4 sm:w-full md:w-full lg:max-w-4/5 xl:max-w-3/5 2xl:max-w-1/3"
	>
		<!-- Page Header -->
		<div class="text-center">
			<h2 class="mb-1 text-2xl font-bold text-white">🎯 Precision Refine</h2>
			<p class="mb-3 text-xs text-base-content/50">
				Your subject stays perfect. Everything else levels up.
			</p>
			<div
				class="tooltip tooltip-bottom"
				data-tip="Learn how Precision Refine preserves your subject's identity while enhancing scenes, lighting, and context around it."
			>
				<button
					on:click={() => (showInfoModal = true)}
					class="btn gap-1.5 btn-outline btn-xs btn-info"
				>
					<span>ⓘ</span>
					<span>How does this work?</span>
				</button>
			</div>
		</div>

		<button on:click={() => (showPromptCoach = true)} class="btn max-w-66 gap-2 btn-sm btn-neutral">
			<span>🎨</span>
			<span>Use Prompt Engineer</span>
		</button>

		<fieldset class="fieldset">
			<legend class="fieldset-legend text-lg">Upload Reference Image(s) Here!</legend>
			<input
				type="file"
				accept="image/*"
				multiple
				on:change={handleImageUpload}
				class="file-input w-full file-input-sm file-input-neutral"
			/>
			<p class="mt-1 text-xs text-base-content/50">
				💡 Add multiple reference images - each upload adds to your collection
			</p>
			{#if uploadedImages.length > 0}
				<div class="mt-2 flex items-center justify-between">
					<p class="text-sm text-success">
						{uploadedImages.length} reference image(s) ready
					</p>
					<button on:click={clearImages} class="btn text-error btn-ghost btn-xs">
						Clear All
					</button>
				</div>
			{/if}
		</fieldset>

		<fieldset class="fieldset">
			<legend class="fieldset-legend"
				>Prompt for new image generation or for a reference image assisted generation.
			</legend>
			<textarea
				bind:value={prompt}
				placeholder="Describe refinements (e.g., 'Add studio lighting, enhance details, professional photography quality, 8K resolution')..."
				class="textarea-bordered textarea w-full resize-y bg-base-100 text-white"
				style="min-height: 120px; max-height: 400px;"
				rows="5"
			></textarea>
			<p class="mt-1 text-xs text-base-content/50">
				💡 Focus on technical improvements: lighting, detail, quality, resolution
			</p>
		</fieldset>

		<div class="flex flex-col gap-3">
			<button
				on:click={generateImage}
				disabled={loading || !prompt || uploadedImages.length === 0}
				class="btn btn-neutral {loading || !prompt || uploadedImages.length === 0
					? 'btn-disabled'
					: ''}"
			>
				{loading ? 'Generating...' : 'Generate'}
			</button>

			{#if imageUrl && !loading && !savedContentId}
				<button
					on:click={saveToLibrary}
					disabled={isSaving || !$authStore.user}
					class="btn btn-primary {isSaving || !$authStore.user ? 'btn-disabled' : ''}"
				>
					{isSaving ? 'Saving...' : '💾 Save to Library'}
				</button>
			{/if}

			{#if savedContentId}
				<div class="alert py-2 alert-success">
					<span class="text-sm"
						>✅ Saved! <a href="/content-library" class="link">View in Content Library</a></span
					>
				</div>
			{/if}

			{#if saveStatus && !savedContentId}
				<div class="alert {saveStatus.includes('Error') ? 'alert-error' : 'alert-info'} py-2">
					<span class="text-sm">{saveStatus}</span>
				</div>
			{/if}

			{#if imageUrl || prompt || imagePreviews.length > 0}
				<button on:click={clearSession} class="btn btn-ghost btn-sm"> 🗑️ Start Fresh </button>
			{/if}

			{#if status}
				<div
					class="alert {status.includes('Error')
						? 'alert-error'
						: status.includes('✅')
							? 'alert-success'
							: 'alert-info'} py-2"
				>
					<span class="text-sm">{status}</span>
				</div>
			{/if}
		</div>

		{#if imageUrl}
			<div class="divider">Additional Refinement</div>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Further Enhance (Optional)</legend>
				<textarea
					bind:value={refinePrompt}
					placeholder="Add more refinements to the current result..."
					class="textarea-bordered textarea w-full resize-y bg-base-100 textarea-sm text-white"
					style="min-height: 80px; max-height: 200px;"
					rows="3"
				></textarea>
			</fieldset>

			<button
				on:click={refineImage}
				disabled={isRefining || !refinePrompt}
				class="btn btn-sm btn-neutral {isRefining || !refinePrompt ? 'btn-disabled' : ''}"
			>
				{isRefining ? 'Creating...' : 'Apply Additional Refinement'}
			</button>
		{/if}

		{#if imageUrl && !loading}
			<div class="card mt-4 border border-neutral bg-neutral/20">
				<div class="card-body p-4">
					<h3 class="flex items-center gap-2 text-sm font-bold">
						<span>🎬</span>
						<span>Next Step: Animate</span>
					</h3>
					<p class="mt-2 text-xs text-base-content/70">
						Your refined image is ready! Next, upload it to <strong>Animate</strong> (Text to Video)
						to create cinematic video with motion.
					</p>
					<a href="/texttovideo?from=refine" class="btn mt-3 btn-sm btn-neutral">
						Go to Animate →
					</a>
				</div>
			</div>
		{/if}
	</div>

	<!-- RIGHT SIDE: Image Display -->
	<div
		class="flex flex-1 flex-col gap-4 pt-10 sm:w-full md:w-full lg:w-full lg:pt-15 xl:max-w-2/5 xl:pl-10 2xl:pl-10"
	>
		<div class="relative h-96 w-full overflow-hidden rounded-lg bg-base-300">
			{#if loading}
				<div
					class="animate-blur absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-lg"
				>
					<div class="flex flex-col items-center gap-4">
						<div class="loading loading-lg loading-spinner text-neutral"></div>
						<p class="text-center text-white">Generating image...</p>
					</div>
				</div>
			{:else if imageUrl}
				<img src={imageUrl} alt="Refined" class="h-full w-full rounded-lg object-contain" />
				<div class=" dropdown-hover dropdown absolute top-4 left-4 rounded-lg border-2 border-info">
					<div tabindex="0" role="button" class="btn-default btn m-1 btn-lg">Tools</div>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-1 w-52 rounded-box bg-base-100 p-2 shadow-sm"
					>
						<li>
							<button
								on:click={downloadImage}
								class="btn-default btn shadow-lg btn-sm hover:btn-success"
								title="Download Image"
							>
								Download
							</button>
						</li>
						<li>
							<button
								on:click={openEnhancer}
								class="btn shadow-lg btn-ghost btn-sm hover:btn-primary"
								title="Add 3D Effects"
							>
								✨Enhance
							</button>
						</li>
						{#if isImageUploadedForEditing}
							<button on:click={clearUploadedImage} class="btn btn-sm btn-error">
								🗑️ Remove
							</button>
						{/if}
					</ul>
				</div>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="flex flex-col items-center gap-4">
						<p class="text-center text-white opacity-50">Generated image will appear here</p>

						<div class="tooltip" data-tip="Upload image for 3D enhancement (no generation)">
							<label class="btn cursor-pointer btn-outline btn-sm btn-info">
								📤 Upload Image to Enhance only not for reference.
								<input
									type="file"
									accept="image/*"
									on:change={handleImageUploadForEditing}
									class="hidden"
								/>
							</label>
						</div>
					</div>
				</div>
			{/if}
		</div>

		{#if imagePreviews.length > 0}
			<div class="space-y-2">
				<p class="text-xs font-semibold text-base-content/60">Reference Images:</p>
				<div class="grid grid-cols-3 gap-3">
					{#each imagePreviews as preview, i}
						<div class="group relative">
							<img
								src={preview}
								alt="Reference {i + 1}"
								class="h-24 w-full rounded-lg border-2 border-base-300 object-contain transition-colors group-hover:border-neutral"
							/>
							<button
								on:click={() => removeImage(i)}
								class="btn absolute -top-2 -right-2 btn-circle opacity-80 shadow-lg btn-xs btn-error hover:opacity-100"
								title="Remove this reference"
							>
								✕
							</button>
							<div class="absolute bottom-1 left-1 badge badge-xs badge-neutral">
								#{i + 1}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="rounded-lg border-2 border-dashed border-base-300 p-4 text-center">
				<p class="text-xs text-base-content/50">📸 Reference Images will apper here.</p>
				<p class="mt-1 text-xs text-base-content/30">Up to 3 images.</p>
			</div>
		{/if}

		{#if enhancedPrompt}
			<div class="collapse-arrow collapse bg-base-300">
				<input type="checkbox" />
				<div class="collapse-title text-sm font-medium">AI Enhanced Prompt (for learning)</div>
				<div class="collapse-content">
					<p class="text-xs">{enhancedPrompt}</p>
				</div>
			</div>
		{/if}
	</div>
</div>

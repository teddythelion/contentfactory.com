// src/lib/utils/videoCapture.ts
// CLEAN: Upload to GCS + Download locally

import { get } from 'svelte/store';
import { videoState } from '$lib/stores/video.store';

const BATCH_SIZE = 30;

export async function captureThreeJsVideo(
	progressCallback?: (progress: number, message: string) => void
): Promise<string> {
	const $videoState = get(videoState);

	if (!$videoState.videoUrl || !$videoState.isVideoLoaded) {
		throw new Error('Video not loaded');
	}

	const canvas = (window as any).__threeJsCanvas as HTMLCanvasElement;
	const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;

	if (!canvas || !videoElement) {
		throw new Error('Canvas or video not found');
	}

	const videoDuration = videoElement.duration;
	const fps = 30;
	const width = canvas.width;
	const height = canvas.height;
	const totalFrames = Math.ceil(videoDuration * fps);

	progressCallback?.(0, 'Starting capture...');

	try {
		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
		if (!gl) throw new Error('Failed to get WebGL context');

		console.log(
			`📹 Capturing ${totalFrames} frames at ${width}x${height} in batches of ${BATCH_SIZE}`
		);

		const sessionId = Date.now().toString();
		let batchNumber = 0;

		// Capture and send in batches
		for (let startFrame = 0; startFrame < totalFrames; startFrame += BATCH_SIZE) {
			const endFrame = Math.min(startFrame + BATCH_SIZE, totalFrames);
			const batchFrames: Uint8Array[] = [];

			// Capture batch
			for (let i = startFrame; i < endFrame; i++) {
				const targetTime = i / fps;

				videoElement.currentTime = targetTime;
				await new Promise((resolve) => {
					videoElement.addEventListener('seeked', resolve, { once: true });
				});

				const textMesh = (window as any).__textMesh;
				if (textMesh?._videoTexture) {
					textMesh._videoTexture.needsUpdate = true;
				}

				await new Promise((resolve) => requestAnimationFrame(resolve));
				await new Promise((resolve) => requestAnimationFrame(resolve));

				const pixels = new Uint8Array(width * height * 4);
				gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				const flipped = new Uint8Array(width * height * 4);
				for (let y = 0; y < height; y++) {
					const sourceRow = (height - 1 - y) * width * 4;
					const destRow = y * width * 4;
					flipped.set(pixels.subarray(sourceRow, sourceRow + width * 4), destRow);
				}

				batchFrames.push(flipped);

				const progress = (i / totalFrames) * 70;
				progressCallback?.(progress, `Capturing frame ${i + 1}/${totalFrames}`);
			}

			// Send batch to server
			const batchData = new Uint8Array(batchFrames.length * width * height * 4);
			let offset = 0;
			for (const frame of batchFrames) {
				batchData.set(frame, offset);
				offset += frame.length;
			}

			progressCallback?.(
				70 + (batchNumber / Math.ceil(totalFrames / BATCH_SIZE)) * 20,
				`Uploading batch ${batchNumber + 1}...`
			);

			const formData = new FormData();
			formData.append('sessionId', sessionId);
			formData.append('batchNumber', String(batchNumber));
			formData.append('startFrame', String(startFrame));
			formData.append('frameCount', String(batchFrames.length));
			formData.append('width', String(width));
			formData.append('height', String(height));
			formData.append('frameData', new Blob([batchData]), 'batch.raw');

			const response = await fetch('/api/uploadFrameBatch', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Batch upload failed');
			}

			batchNumber++;
		}

		// Encode all batches
		progressCallback?.(95, 'Encoding video...');

		const encodeResponse = await fetch('/api/encodeFromBatches', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				totalFrames,
				fps,
				width,
				height
			})
		});

		if (!encodeResponse.ok) {
			const error = await encodeResponse.json();
			throw new Error(error.details || 'Encoding failed');
		}

		const result = await encodeResponse.json();

		// Convert base64 to blob
		const videoData = atob(result.videoBase64);
		const videoArray = new Uint8Array(videoData.length);

		for (let i = 0; i < videoData.length; i++) {
			videoArray[i] = videoData.charCodeAt(i);
		}

		const videoBlob = new Blob([videoArray], { type: 'video/mp4' });

		console.log(`📊 Final video: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

		// Upload to GCS (background) + Download locally (foreground)
		progressCallback?.(96, 'Uploading to cloud storage...');

		const uploadFormData = new FormData();
		uploadFormData.append('file', videoBlob, `enhanced-video-${sessionId}.mp4`);

		const uploadResponse = await fetch('/api/uploadEnhancedVideo', {
			method: 'POST',
			body: uploadFormData
		});

		if (!uploadResponse.ok) {
			const error = await uploadResponse.json();
			throw new Error(error.error || 'Failed to upload to cloud storage');
		}

		const uploadResult = await uploadResponse.json();
		const gcsUrl = uploadResult.publicUrl;
		const contentId = uploadResult.contentId;

		console.log(`☁️ Uploaded to GCS: ${gcsUrl}`);
		console.log(`📁 Content ID: ${contentId}`);

		// Update store with GCS URL
		videoState.setProcessedVideo(gcsUrl);

		// Download video locally
		progressCallback?.(98, 'Preparing download...');

		const downloadUrl = URL.createObjectURL(videoBlob);
		const downloadLink = document.createElement('a');
		downloadLink.href = downloadUrl;
		downloadLink.download = `enhanced-video-${sessionId}.mp4`;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);

		setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

		progressCallback?.(100, 'Complete! Video downloaded and saved to cloud.');

		// Dispatch event (optional - for future UI enhancements)
		window.dispatchEvent(
			new CustomEvent('videoEnhanced', {
				detail: { gcsUrl, contentId, sessionId }
			})
		);

		return gcsUrl;
	} catch (error) {
		console.error('❌ Capture failed:', error);
		throw error;
	}
}

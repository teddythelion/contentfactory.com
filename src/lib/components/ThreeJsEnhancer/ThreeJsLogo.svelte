<!-- src/lib/components/ThreeJsEnhancer/ThreeJsLogo.svelte -->
<!-- ✅ FIXED VERSION - VIDEO TIME SYNCED -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { logoState } from '$lib/stores/logo.store';

	export let scene: THREE.Scene;

	//new logic

	const basePosition = new THREE.Vector3();
	const baseScale = new THREE.Vector3(1, 1, 1);

	function updateBaseTransform() {
		if (!logoTexture) return;

		const img = logoTexture.image as HTMLImageElement;
		const aspect = img.width / img.height;

		const x = ((position.x - 50) / 50) * 8;
		const y = ((50 - position.y) / 50) * 6;

		basePosition.set(x, y, 5);
		baseScale.set(aspect * scale, scale, 1);

		if (logoMesh) {
			logoMesh.position.copy(basePosition);
			logoMesh.scale.copy(baseScale);
		}
	}

	let logoMesh: THREE.Mesh | null = null;
	let logoTexture: THREE.Texture | null = null;
	let videoElement: HTMLVideoElement | null = null;

	// Subscribe to logo state
	$: enabled = $logoState.enabled;
	$: logoDataUrl = $logoState.logoDataUrl;
	$: position = $logoState.position;
	$: scale = $logoState.scale;
	$: opacity = $logoState.opacity;
	$: startTime = $logoState.startTime;
	$: endTime = $logoState.endTime;
	$: fadeInDuration = $logoState.fadeInDuration;
	$: fadeOutDuration = $logoState.fadeOutDuration;
	$: animationType = $logoState.animationType;
	$: animationSpeed = $logoState.animationSpeed;
	$: rotation3D = $logoState.rotation3D;
	$: autoRotate = $logoState.autoRotate;
	$: autoRotateSpeed = $logoState.autoRotateSpeed;

	let isInitialized = false;

	onMount(() => {
		// Wait for video element to be available
		const checkVideo = setInterval(() => {
			videoElement = (window as any).__threeJsVideo;
			if (videoElement) {
				isInitialized = true;
				clearInterval(checkVideo);
			}
		}, 100);

		// Timeout after 5 seconds
		setTimeout(() => clearInterval(checkVideo), 5000);

		return cleanup;
	});

	onDestroy(() => {
		cleanup();
	});

	function cleanup() {
		if (logoMesh) {
			scene.remove(logoMesh);
			if (logoMesh.geometry) {
				logoMesh.geometry.dispose();
			}
			if (logoMesh.material instanceof THREE.Material) {
				logoMesh.material.dispose();
			}
			logoMesh = null;
		}
		if (logoTexture) {
			logoTexture.dispose();
			logoTexture = null;
		}
	}

	//new logic
	$: if (logoMesh && (position.x || position.y)) {
		updateBasePosition();
	}

	// Update scale reactively
	$: if (logoMesh && logoTexture && scale) {
		updateBaseScale();
	}

	function updateBaseScale() {
		if (!logoTexture) return;
		const img = logoTexture.image as HTMLImageElement;
		const aspect = img.width / img.height;
		baseScale.set(aspect * scale, scale, 1);
		if (logoMesh) {
			logoMesh.scale.copy(baseScale);
		}
	}

	//new logic
	function updateBasePosition() {
		const x = ((position.x - 50) / 50) * 8;
		const y = ((50 - position.y) / 50) * 6;

		basePosition.set(x, y, 5);

		if (logoMesh) {
			logoMesh.position.copy(basePosition);
		}
	}

	// Load logo texture when logoDataUrl changes
	$: if (logoDataUrl && enabled) {
		loadLogoTexture(logoDataUrl);
	} else {
		cleanup();
	}

	function loadLogoTexture(dataUrl: string) {
		const loader = new THREE.TextureLoader();

		loader.load(dataUrl, (texture) => {
			if (logoTexture) {
				logoTexture.dispose();
			}
			if (logoMesh) {
				scene.remove(logoMesh);
				logoMesh.geometry.dispose();
				if (logoMesh.material instanceof THREE.Material) {
					logoMesh.material.dispose();
				}
			}

			logoTexture = texture;

			const image = texture.image as HTMLImageElement;
			const aspect = image.width / image.height;

			// CREATE PLANE GEOMETRY
			//const geometry = new THREE.PlaneGeometry(aspect * scale, scale);
			const geometry = new THREE.PlaneGeometry(1, 1);

			// CREATE MESH BASIC MATERIAL
			const material = new THREE.MeshBasicMaterial({
				map: texture,
				transparent: true,
				opacity: opacity,
				side: THREE.DoubleSide,
				depthTest: false,
				depthWrite: false
			});

			// CREATE MESH
			logoMesh = new THREE.Mesh(geometry, material);

			// ✅ Set initial rotation ONCE here
			logoMesh.rotation.x = rotation3D.x;
			logoMesh.rotation.y = rotation3D.y;
			logoMesh.rotation.z = rotation3D.z;

			updateBaseTransform();
			scene.add(logoMesh);
		});
	}

	// Update opacity reactively
	$: if (logoMesh && logoMesh.material instanceof THREE.MeshBasicMaterial) {
		logoMesh.material.opacity = opacity;
	}

	// ✅ FIXED: Main animation update - accepts animationTime parameter from parent
	export function updateAnimation(animationTime: number) {
		if (!logoMesh || !videoElement || !enabled || !isInitialized) return;

		const currentTime = videoElement.currentTime;

		// Check timing
		const isInTimeRange = currentTime >= startTime && currentTime <= endTime;

		if (!isInTimeRange) {
			logoMesh.visible = false;
			return;
		}

		logoMesh.visible = true;

		// Calculate fade opacity
		const timeSinceStart = currentTime - startTime;
		const timeUntilEnd = endTime - currentTime;

		let finalOpacity = opacity;

		if (timeSinceStart < fadeInDuration) {
			finalOpacity = (timeSinceStart / fadeInDuration) * opacity;
		}

		if (timeUntilEnd < fadeOutDuration) {
			finalOpacity = (timeUntilEnd / fadeOutDuration) * opacity;
		}

		if (logoMesh.material instanceof THREE.MeshBasicMaterial) {
			logoMesh.material.opacity = finalOpacity;
		}

		// Apply rotation (handles base rotation + animations)
		applyRotation(animationTime);

		// Apply animation effects
		applyAnimationEffects(animationTime);
	}

	function applyRotation(animationTime: number) {
		if (!logoMesh) return;

		// Start with base rotation from UI sliders
		let rotX = rotation3D.x;
		let rotY = rotation3D.y;
		let rotZ = rotation3D.z;

		// Add auto rotate (accumulates over time)
		if (autoRotate) {
			rotY += animationTime * autoRotateSpeed;
		}

		// Add animation-specific rotations
		switch (animationType) {
			case 'spin':
				rotZ += animationTime * 2.0 * animationSpeed;
				break;

			case 'flip3d':
				rotX += Math.sin(animationTime * 2.5) * Math.PI;
				break;

			case 'spiral':
				rotZ += animationTime * 1.5;
				rotY += animationTime * 0.7;
				break;

			case 'explode':
				const pulse = Math.sin(animationTime * 3) * 0.5 + 0.5;
				rotZ += pulse * 2.0;
				rotX += pulse * 1.2;
				break;
		}

		// Apply final rotation
		logoMesh.rotation.set(rotX, rotY, rotZ);
	}

	function applyAnimationEffects(animationTime: number) {
		if (!logoMesh || !logoTexture) return;

		const baseX = ((position.x - 50) / 50) * 8;
		const baseY = ((50 - position.y) / 50) * 6;
		const image = logoTexture.image as HTMLImageElement;
		const aspect = image.width / image.height;

		switch (animationType) {
			case 'pulse':
				const pulseScale = 1 + Math.sin(animationTime * 3) * 0.2;
				logoMesh.scale.set(baseScale.x * pulseScale, baseScale.y * pulseScale, baseScale.z);
				break;

			case 'bounce':
				const bounce = Math.abs(Math.sin(animationTime * 2)) * 1.5;
				logoMesh.position.y = baseY + bounce;
				break;

			case 'explode':
				const explodePulse = Math.sin(animationTime * 2) * 0.5 + 0.5;
				const explodeScale = 1 + explodePulse * 0.5;
				logoMesh.scale.set(baseScale.x * explodeScale, baseScale.y * explodeScale, baseScale.z);
				break;

			case 'warp':
				const warpX = Math.sin(animationTime * 2) * 0.5;
				const warpY = Math.cos(animationTime * 2) * 0.5;
				logoMesh.position.x = baseX + warpX;
				logoMesh.position.y = baseY + warpY;
				const warpScale = 1 + Math.sin(animationTime * 3) * 0.3;
				logoMesh.scale.set(baseScale.x * warpScale, baseScale.y * warpScale, baseScale.z);

				break;

			case 'glitch':
				if (Math.random() > 0.95) {
					const glitchX = (Math.random() - 0.5) * 2;
					const glitchY = (Math.random() - 0.5) * 2;
					logoMesh.position.x = baseX + glitchX;
					logoMesh.position.y = baseY + glitchY;
				} else {
					logoMesh.position.x = baseX;
					logoMesh.position.y = baseY;
				}
				break;

			case 'spiral':
				const spiralRadius = Math.sin(animationTime) * 2;
				const spiralAngle = animationTime * 2;
				logoMesh.position.x = baseX + Math.cos(spiralAngle) * spiralRadius;
				logoMesh.position.y = baseY + Math.sin(spiralAngle) * spiralRadius;
				break;

			case 'shimmer':
				const shimmerOpacity = opacity * (0.7 + Math.sin(animationTime * 5) * 0.3);
				if (logoMesh.material instanceof THREE.MeshBasicMaterial) {
					logoMesh.material.opacity = shimmerOpacity;
				}
				const shimmerScale = 1 + Math.sin(animationTime * 3) * 0.1;
				logoMesh.scale.set(baseScale.x * shimmerScale, baseScale.y * shimmerScale, baseScale.z);
				break;

			case 'particle-assemble': {
				const assembleProgress = (Math.sin(animationTime) + 1) / 2;
				const scatter = (1 - assembleProgress) * 5;

				logoMesh.position.x = basePosition.x + Math.cos(animationTime * 5) * scatter;
				logoMesh.position.y = basePosition.y + Math.sin(animationTime * 5) * scatter;

				// ✅ Scale based on baseScale
				logoMesh.scale.set(baseScale.x * assembleProgress, baseScale.y * assembleProgress, 1);

				break;
			}
			default:
				// 'none' - keep base position and scale
				logoMesh.position.x = baseX;
				logoMesh.position.y = baseY;
				logoMesh.scale.set(aspect * scale, scale, 1);
				break;
		}
	}
</script>

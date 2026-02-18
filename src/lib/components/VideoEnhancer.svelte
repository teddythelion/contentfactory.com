<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	export let videoUrl: string = '';
	export let onClose: () => void;

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let mesh: THREE.Mesh;
	let animationId: number | null = null;
	let videoTexture: THREE.VideoTexture;
	let videoElement: HTMLVideoElement;
	let isCapturing = false;
	let isVideoLoaded = false;
	let processedVideoUrl: string | null = null;
	let captureFrames: ImageData[] = [];
	let videoError: string | null = null;

	// Shape selection
	let selectedShape = 'sphere';
	const shapes = ['sphere', 'cube', 'cylinder', 'torus', 'icosahedron', 'plane'];

	// Rotation controls
	let rotationX = 0;
	let rotationY = 0;
	let rotationZ = 0;
	let autoRotate = false;
	let autoRotateSpeed = 0.01;
	let cameraDistance = 5;
	let scale = 1;

	// Lighting
	let ambientIntensity = 0.8;
	let directionalIntensity = 1;

	// Effects
	let videoGlow = 0;
	let shapeGlow = 0;

	// Particle System
	let particleSystem: THREE.Points | null = null;
	let particleGeometry: THREE.BufferGeometry | null = null;
	let particleMaterial: THREE.PointsMaterial | null = null;
	let particlesEnabled = false;
	let particleCount = 5000;
	let particleSize = 0.05;
	let particleSpeed = 0.5;
	let particleSpread = 10;
	let particleColor = '#ffffff';
	let particleOpacity = 0.8;
	let particleReactToVideo = false;
	let particlePositions: Float32Array;
	let particleVelocities: Float32Array;

	// Touch controls
	let isDragging = false;
	let previousMousePosition = { x: 0, y: 0 };

	let ambientLight: THREE.AmbientLight;
	let directionalLight: THREE.DirectionalLight;

	interface ControlGroup {
		id: string;
		title: string;
		items: ControlItem[];
	}

	interface ControlItem {
		label: string;
		type: 'range' | 'toggle' | 'select' | 'button' | 'color';
		value?: any;
		min?: number;
		max?: number;
		step?: number;
		options?: string[];
		action?: () => void;
	}

	const controlGroups: ControlGroup[] = [
		{
			id: 'shapes',
			title: 'Shape Selection',
			items: [
				{
					label: 'Shape',
					type: 'select',
					value: selectedShape,
					options: shapes
				}
			]
		},
		{
			id: 'sizePosition',
			title: 'Size & Position',
			items: [
				{
					label: 'Camera Distance',
					type: 'range',
					min: 2,
					max: 15,
					step: 0.1
				},
				{
					label: 'Scale',
					type: 'range',
					min: 0.5,
					max: 3,
					step: 0.1
				}
			]
		},
		{
			id: 'rotation',
			title: 'Rotation',
			items: [
				{
					label: 'X Rotation',
					type: 'range',
					min: -3.14,
					max: 3.14,
					step: 0.01
				},
				{
					label: 'Y Rotation',
					type: 'range',
					min: -3.14,
					max: 3.14,
					step: 0.01
				},
				{
					label: 'Z Rotation',
					type: 'range',
					min: -3.14,
					max: 3.14,
					step: 0.01
				},
				{
					label: 'Auto Rotate',
					type: 'toggle'
				},
				{
					label: 'Auto Rotate Speed',
					type: 'range',
					min: 0.001,
					max: 0.05,
					step: 0.001
				},
				{
					label: 'Reset Rotation',
					type: 'button',
					action: resetRotation
				}
			]
		},
		{
			id: 'lighting',
			title: 'Lighting',
			items: [
				{
					label: 'Ambient',
					type: 'range',
					min: 0,
					max: 2,
					step: 0.1
				},
				{
					label: 'Directional',
					type: 'range',
					min: 0,
					max: 2,
					step: 0.1
				}
			]
		},
		{
			id: 'effects',
			title: 'Effects',
			items: [
				{
					label: 'Video Glow',
					type: 'range',
					min: 0,
					max: 2,
					step: 0.1
				},
				{
					label: 'Shape Glow',
					type: 'range',
					min: 0,
					max: 2,
					step: 0.1
				}
			]
		},
		{
			id: 'particles',
			title: 'Particle System',
			items: [
				{
					label: 'Enable Particles',
					type: 'toggle'
				},
				{
					label: 'Particle Count',
					type: 'range',
					min: 1000,
					max: 20000,
					step: 1000
				},
				{
					label: 'Particle Size',
					type: 'range',
					min: 0.01,
					max: 0.2,
					step: 0.01
				},
				{
					label: 'Particle Speed',
					type: 'range',
					min: 0.1,
					max: 2,
					step: 0.1
				},
				{
					label: 'Particle Spread',
					type: 'range',
					min: 5,
					max: 20,
					step: 1
				},
				{
					label: 'Particle Color',
					type: 'color'
				},
				{
					label: 'Particle Opacity',
					type: 'range',
					min: 0,
					max: 1,
					step: 0.1
				},
				{
					label: 'React to Video',
					type: 'toggle'
				}
			]
		}
	];

	onMount(() => {
		if (!videoUrl) {
			videoError = 'No video URL provided';
			return;
		}

		initThreeJS();

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mouseup', onMouseUp);
		canvas.addEventListener('touchstart', onTouchStart);
		canvas.addEventListener('touchmove', onTouchMove);
		canvas.addEventListener('touchend', onTouchEnd);

		return () => {
			if (animationId) cancelAnimationFrame(animationId);
			if (renderer) renderer.dispose();
			if (videoTexture) videoTexture.dispose();
			if (videoElement) videoElement.pause();

			canvas.removeEventListener('mousedown', onMouseDown);
			canvas.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('mouseup', onMouseUp);
			canvas.removeEventListener('touchstart', onTouchStart);
			canvas.removeEventListener('touchmove', onTouchMove);
			canvas.removeEventListener('touchend', onTouchEnd);

			if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
		};
	});

	function initThreeJS() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a1a);

		camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
		camera.position.z = cameraDistance;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
		scene.add(ambientLight);

		directionalLight = new THREE.DirectionalLight(0xffffff, directionalIntensity);
		directionalLight.position.set(5, 5, 5);
		scene.add(directionalLight);

		videoElement = document.createElement('video');
		videoElement.crossOrigin = 'anonymous';
		videoElement.loop = true;
		videoElement.muted = true;

		if (videoUrl.startsWith('data:')) {
			videoElement.src = videoUrl;
		} else if (videoUrl.startsWith('https://storage.googleapis.com')) {
			const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(videoUrl)}`;
			videoElement.src = proxyUrl;
		} else {
			videoElement.src = videoUrl;
		}

		videoElement.addEventListener('loadedmetadata', () => {
			videoTexture = new THREE.VideoTexture(videoElement);
			videoTexture.colorSpace = THREE.SRGBColorSpace;
			isVideoLoaded = true;

			createMesh(selectedShape);
			videoElement.play().catch((err) => console.error('Play error:', err));
			animate();
		});

		videoElement.addEventListener('error', (e) => {
			console.error('❌ Video load error:', e);
			videoError = 'Failed to load video. Check URL and CORS settings.';
		});

		window.addEventListener('resize', handleResize);

		createParticleSystem();
	}

	function createMesh(shape: string) {
		if (mesh) {
			scene.remove(mesh);
			mesh.geometry.dispose();
			if (Array.isArray(mesh.material)) {
				mesh.material.forEach((mat) => mat.dispose());
			} else {
				mesh.material.dispose();
			}
		}

		let geometry: THREE.BufferGeometry;

		switch (shape) {
			case 'sphere':
				geometry = new THREE.SphereGeometry(2, 64, 64);
				break;
			case 'cube':
				geometry = new THREE.BoxGeometry(3, 3, 3);
				break;
			case 'cylinder':
				geometry = new THREE.CylinderGeometry(2, 2, 3, 64);
				break;
			case 'torus':
				geometry = new THREE.TorusGeometry(2, 0.8, 32, 100);
				break;
			case 'icosahedron':
				geometry = new THREE.IcosahedronGeometry(2, 4);
				break;
			case 'plane':
			default:
				geometry = new THREE.PlaneGeometry(6, 4);
				break;
		}

		const material = new THREE.MeshStandardMaterial({
			map: videoTexture,
			side: THREE.DoubleSide,
			metalness: 0.2,
			roughness: 0.6,
			emissive: new THREE.Color(0xffffff),
			emissiveIntensity: videoGlow
		});

		mesh = new THREE.Mesh(geometry, material);
		mesh.scale.set(scale, scale, scale);
		scene.add(mesh);
	}

	function createParticleSystem() {
		if (particleSystem) {
			scene.remove(particleSystem);
			if (particleGeometry) particleGeometry.dispose();
			if (particleMaterial) particleMaterial.dispose();
		}

		particleGeometry = new THREE.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const velocities = new Float32Array(particleCount * 3);

		for (let i = 0; i < particleCount * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * particleSpread;
			positions[i + 1] = (Math.random() - 0.5) * particleSpread;
			positions[i + 2] = (Math.random() - 0.5) * particleSpread;

			velocities[i] = (Math.random() - 0.5) * particleSpeed * 0.1;
			velocities[i + 1] = (Math.random() - 0.5) * particleSpeed * 0.1;
			velocities[i + 2] = (Math.random() - 0.5) * particleSpeed * 0.1;
		}

		particlePositions = positions;
		particleVelocities = velocities;

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		particleMaterial = new THREE.PointsMaterial({
			color: particleColor,
			size: particleSize,
			transparent: true,
			opacity: particleOpacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});

		particleSystem = new THREE.Points(particleGeometry, particleMaterial);
		if (particlesEnabled) {
			scene.add(particleSystem);
		}
	}

	function updateParticles() {
		if (!particleSystem || !particlesEnabled || !particleGeometry) return;

		const positions = particleGeometry.attributes.position.array as Float32Array;

		for (let i = 0; i < particleCount * 3; i += 3) {
			positions[i] += particleVelocities[i] * particleSpeed;
			positions[i + 1] += particleVelocities[i + 1] * particleSpeed;
			positions[i + 2] += particleVelocities[i + 2] * particleSpeed;

			if (particleReactToVideo && mesh) {
				const distance = Math.sqrt(
					Math.pow(positions[i] - mesh.position.x, 2) +
						Math.pow(positions[i + 1] - mesh.position.y, 2) +
						Math.pow(positions[i + 2] - mesh.position.z, 2)
				);

				if (distance < 3) {
					const force = (3 - distance) * 0.01;
					const dx = positions[i] - mesh.position.x;
					const dy = positions[i + 1] - mesh.position.y;
					const dz = positions[i + 2] - mesh.position.z;
					const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

					if (len > 0) {
						positions[i] += (dx / len) * force;
						positions[i + 1] += (dy / len) * force;
						positions[i + 2] += (dz / len) * force;
					}
				}
			}

			const boundary = particleSpread / 2;
			if (Math.abs(positions[i]) > boundary) {
				positions[i] = (Math.random() - 0.5) * particleSpread;
				particleVelocities[i] = (Math.random() - 0.5) * particleSpeed * 0.1;
			}
			if (Math.abs(positions[i + 1]) > boundary) {
				positions[i + 1] = (Math.random() - 0.5) * particleSpread;
				particleVelocities[i + 1] = (Math.random() - 0.5) * particleSpeed * 0.1;
			}
			if (Math.abs(positions[i + 2]) > boundary) {
				positions[i + 2] = (Math.random() - 0.5) * particleSpread;
				particleVelocities[i + 2] = (Math.random() - 0.5) * particleSpeed * 0.1;
			}
		}

		particleGeometry.attributes.position.needsUpdate = true;
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		if (mesh) {
			mesh.rotation.x = rotationX;
			mesh.rotation.y = rotationY;
			mesh.rotation.z = rotationZ;

			if (autoRotate) {
				mesh.rotation.y += autoRotateSpeed;
			}

			if (mesh.material instanceof THREE.MeshStandardMaterial) {
				mesh.material.emissiveIntensity = videoGlow + shapeGlow;
			}
		}

		updateParticles();

		camera.position.z = cameraDistance;

		if (ambientLight) ambientLight.intensity = ambientIntensity;
		if (directionalLight) directionalLight.intensity = directionalIntensity;

		renderer.render(scene, camera);
	}

	function handleResize() {
		if (!canvas || !camera || !renderer) return;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
	}

	function onMouseDown(event: MouseEvent) {
		isDragging = true;
		previousMousePosition = { x: event.clientX, y: event.clientY };
	}

	function onMouseMove(event: MouseEvent) {
		if (!isDragging) return;

		const deltaX = event.clientX - previousMousePosition.x;
		const deltaY = event.clientY - previousMousePosition.y;

		rotationY += deltaX * 0.01;
		rotationX += deltaY * 0.01;

		previousMousePosition = { x: event.clientX, y: event.clientY };
	}

	function onMouseUp() {
		isDragging = false;
	}

	function onTouchStart(event: TouchEvent) {
		isDragging = true;
		previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
	}

	function onTouchMove(event: TouchEvent) {
		if (!isDragging) return;

		const deltaX = event.touches[0].clientX - previousMousePosition.x;
		const deltaY = event.touches[0].clientY - previousMousePosition.y;

		rotationY += deltaX * 0.01;
		rotationX += deltaY * 0.01;

		previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
	}

	function onTouchEnd() {
		isDragging = false;
	}

	function resetRotation() {
		rotationX = 0;
		rotationY = 0;
		rotationZ = 0;
	}

	function resetAll() {
		rotationX = 0;
		rotationY = 0;
		rotationZ = 0;
		cameraDistance = 5;
		scale = 1;
		autoRotate = false;
		autoRotateSpeed = 0.01;
		ambientIntensity = 0.8;
		directionalIntensity = 1;
		videoGlow = 0;
		shapeGlow = 0;
		selectedShape = 'sphere';
		particlesEnabled = false;
		particleCount = 5000;
		particleSize = 0.05;
		particleSpeed = 0.5;
		particleSpread = 10;
		particleColor = '#ffffff';
		particleOpacity = 0.8;
		particleReactToVideo = false;
		createMesh(selectedShape);
		createParticleSystem();
	}

	function getControlValue(groupId: string, label: string): number | string | boolean {
		switch (label) {
			case 'Shape':
				return selectedShape;
			case 'Camera Distance':
				return cameraDistance;
			case 'Scale':
				return scale;
			case 'X Rotation':
				return rotationX;
			case 'Y Rotation':
				return rotationY;
			case 'Z Rotation':
				return rotationZ;
			case 'Auto Rotate':
				return autoRotate;
			case 'Auto Rotate Speed':
				return autoRotateSpeed;
			case 'Ambient':
				return ambientIntensity;
			case 'Directional':
				return directionalIntensity;
			case 'Video Glow':
				return videoGlow;
			case 'Shape Glow':
				return shapeGlow;
			case 'Enable Particles':
				return particlesEnabled;
			case 'Particle Count':
				return particleCount;
			case 'Particle Size':
				return particleSize;
			case 'Particle Speed':
				return particleSpeed;
			case 'Particle Spread':
				return particleSpread;
			case 'Particle Color':
				return particleColor;
			case 'Particle Opacity':
				return particleOpacity;
			case 'React to Video':
				return particleReactToVideo;
			default:
				return 0;
		}
	}

	function getNumberValue(groupId: string, label: string): number {
		const val = getControlValue(groupId, label);
		return typeof val === 'number' ? val : 0;
	}

	function getBooleanValue(groupId: string, label: string): boolean {
		const val = getControlValue(groupId, label);
		return typeof val === 'boolean' ? val : false;
	}

	function setControlValue(label: string, value: any) {
		switch (label) {
			case 'Shape':
				selectedShape = value;
				createMesh(selectedShape);
				break;
			case 'Camera Distance':
				cameraDistance = value;
				break;
			case 'Scale':
				scale = value;
				if (mesh) mesh.scale.set(scale, scale, scale);
				break;
			case 'X Rotation':
				rotationX = value;
				break;
			case 'Y Rotation':
				rotationY = value;
				break;
			case 'Z Rotation':
				rotationZ = value;
				break;
			case 'Auto Rotate':
				autoRotate = value;
				break;
			case 'Auto Rotate Speed':
				autoRotateSpeed = value;
				break;
			case 'Ambient':
				ambientIntensity = value;
				break;
			case 'Directional':
				directionalIntensity = value;
				break;
			case 'Video Glow':
				videoGlow = value;
				break;
			case 'Shape Glow':
				shapeGlow = value;
				break;
			case 'Enable Particles':
				particlesEnabled = value;
				if (particleSystem) {
					if (value) {
						scene.add(particleSystem);
					} else {
						scene.remove(particleSystem);
					}
				}
				break;
			case 'Particle Count':
				particleCount = value;
				createParticleSystem();
				break;
			case 'Particle Size':
				particleSize = value;
				if (particleMaterial) particleMaterial.size = value;
				break;
			case 'Particle Speed':
				particleSpeed = value;
				break;
			case 'Particle Spread':
				particleSpread = value;
				createParticleSystem();
				break;
			case 'Particle Color':
				particleColor = value;
				if (particleMaterial) particleMaterial.color.set(value);
				break;
			case 'Particle Opacity':
				particleOpacity = value;
				if (particleMaterial) particleMaterial.opacity = value;
				break;
			case 'React to Video':
				particleReactToVideo = value;
				break;
		}
	}

	function getUnit(label: string) {
		if (label.includes('Glow') || label.includes('Intensity')) return '';
		if (label.includes('Distance')) return 'm';
		if (label.includes('Speed')) return '';
		if (label.includes('Rotation')) return 'rad';
		return '';
	}

	async function captureVideo() {
		if (!videoElement || !canvas) return;

		isCapturing = true;

		try {
			// Get video duration
			const videoDuration = videoElement.duration || 8;
			const fps = 30;
			const totalFrames = Math.ceil(videoDuration * fps);

			// Pause and reset video
			videoElement.currentTime = 0;
			await new Promise((resolve) => {
				videoElement.addEventListener('seeked', resolve, { once: true });
			});

			const frames: Uint8ClampedArray[] = [];

			// Capture frames
			for (let i = 0; i < totalFrames; i++) {
				const time = i / fps;
				if (time > videoDuration) break;

				videoElement.currentTime = time;

				await new Promise((resolve) => {
					videoElement.addEventListener('seeked', resolve, { once: true });
				});

				// Render one frame
				// Use the canvas's toDataURL method to get a PNG/JPEG base64 string
				const dataURL = canvas.toDataURL('image/png'); // Get image data as a PNG base64 string

				// Create a new Image object to read the dataURL
				const img = new Image();
				img.src = dataURL;

				// Wait for the image to load
				await new Promise((resolve) => {
					img.onload = resolve;
				});

				// Create a temporary 2D canvas to get the ImageData object
				const tempCanvas = document.createElement('canvas');
				tempCanvas.width = canvas.width;
				tempCanvas.height = canvas.height;
				const tempCtx = tempCanvas.getContext('2d');

				if (tempCtx) {
					// Draw the image onto the 2D canvas
					tempCtx.drawImage(img, 0, 0);

					// Get the ImageData object that your frames array is expecting
					const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

					// Push the Uint8ClampedArray data
					frames.push(imageData.data);

					// Clean up
					URL.revokeObjectURL(dataURL);
				} else {
					throw new Error('Failed to get 2D context for image data extraction');
				}
			}

			// Send to backend for encoding

			const formData = new FormData();
			formData.append('width', canvas.width.toString());
			formData.append('height', canvas.height.toString());
			formData.append('fps', fps.toString());
			formData.append('frameCount', frames.length.toString());

			// Send frames as binary data
			const frameBuffer = new ArrayBuffer(frames.length * canvas.width * canvas.height * 4);
			const view = new Uint8ClampedArray(frameBuffer);
			let offset = 0;

			for (const frame of frames) {
				view.set(frame, offset);
				offset += frame.length;
			}

			formData.append('frameData', new Blob([frameBuffer]));

			const response = await fetch('/api/encodeThreeJsVideo', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				throw new Error(data.error || data.details || 'Encoding failed');
			}

			if (data.videoBase64) {
				const videoBlob = base64ToBlob(data.videoBase64, 'video/webm');
				if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
				processedVideoUrl = URL.createObjectURL(videoBlob);
			} else {
				throw new Error('No video data received from server');
			}
		} catch (err) {
			console.error('❌ Error capturing video:', err);
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			videoError = `Failed to capture video: ${errorMsg}`;
			alert(`Failed to capture video: ${errorMsg}`);
		} finally {
			isCapturing = false;
		}
	}

	function base64ToBlob(base64: string, mimeType: string): Blob {
		const byteCharacters = atob(base64);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += 512) {
			const slice = byteCharacters.slice(offset, offset + 512);
			const byteNumbers = new Array(slice.length);

			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);
			byteArrays.push(byteArray);
		}

		return new Blob(byteArrays, { type: mimeType });
	}

	function downloadProcessedVideo() {
		if (!processedVideoUrl) return;

		const a = document.createElement('a');
		a.href = processedVideoUrl;
		a.download = `3d-video-${Date.now()}.webm`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	$: if (mesh && videoTexture && selectedShape) {
		createMesh(selectedShape);
	}

	$: if (mesh) {
		mesh.scale.set(scale, scale, scale);
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 p-4">
	<div class="flex h-full w-full max-w-7xl flex-col gap-4 overflow-hidden lg:flex-row">
		<!-- Preview Section -->
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold text-white">3D Video Projection</h2>
				<button
					on:click={onClose}
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Close enhancer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Canvas Preview -->
			<div class="relative flex-1 overflow-hidden rounded-lg bg-base-300">
				{#if videoError}
					<div
						class="absolute inset-0 flex items-center justify-center bg-red-900/50 backdrop-blur-lg"
					>
						<div class="flex flex-col items-center gap-4 text-center">
							<p class="text-red-300">{videoError}</p>
						</div>
					</div>
				{:else if !isVideoLoaded}
					<div
						class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-lg"
					>
						<div class="flex flex-col items-center gap-4">
							<div class="loading loading-lg loading-spinner text-info"></div>
							<p class="text-center text-white">Loading 3D scene...</p>
						</div>
					</div>
				{/if}
				<canvas bind:this={canvas} class="h-full w-full object-contain"></canvas>
			</div>

			<!-- Download Button for Processed Video -->
			{#if processedVideoUrl}
				<div class="rounded-lg border border-green-500/50 bg-green-900/30 p-4">
					<p class="mb-2 text-sm text-green-400">✅ Video captured successfully!</p>
					<button on:click={downloadProcessedVideo} class="btn w-full btn-sm btn-success">
						⬇️ Download 3D Video
					</button>
				</div>
			{/if}
		</div>

		<!-- Controls Panel -->
		<div class="flex w-full flex-col gap-3 overflow-y-auto lg:w-96">
			<!-- Scrollable Controls Container -->
			<div
				class="flex flex-col gap-2 overflow-y-auto pr-2"
				style="max-height: calc(100vh - 200px);"
			>
				{#each controlGroups as group}
					<div class="rounded-lg border border-white/10 bg-gray-800/50">
						<details class="group">
							<summary
								class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
							>
								<span>{group.title}</span>
								<svg
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
									class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
								>
									<path
										d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
										clip-rule="evenodd"
										fill-rule="evenodd"
									/>
								</svg>
							</summary>

							<div class="px-2 pb-2">
								{#each group.items as item}
									{#if item.type === 'select'}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-semibold text-white">{item.label}</span>
											</div>
											<select
												value={getControlValue(group.id, item.label)}
												on:change={(e) => setControlValue(item.label, e.currentTarget.value)}
												class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20"
											>
												{#each item.options || [] as option}
													<option value={option}>
														{option.charAt(0).toUpperCase() + option.slice(1)}
													</option>
												{/each}
											</select>
										</div>
									{:else if item.type === 'toggle'}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<div class="flex items-center justify-between">
												<span class="text-sm font-semibold text-white">{item.label}</span>
												<label class="relative inline-flex cursor-pointer items-center">
													<input
														type="checkbox"
														checked={getBooleanValue(group.id, item.label)}
														on:change={(e) => setControlValue(item.label, e.currentTarget.checked)}
														class="peer sr-only"
													/>
													<div
														class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-gray-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
													></div>
												</label>
											</div>
										</div>
									{:else if item.type === 'button'}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<button
												on:click={item.action}
												class="w-full rounded-lg border border-white/10 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600"
											>
												{item.label}
											</button>
										</div>
									{:else if item.type === 'color'}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-semibold text-white">{item.label}</span>
											</div>
											<input
												type="color"
												value={getControlValue(group.id, item.label)}
												on:input={(e) => setControlValue(item.label, e.currentTarget.value)}
												class="h-8 w-full cursor-pointer rounded border border-white/10"
											/>
										</div>
									{:else if item.type === 'range'}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-semibold text-white">{item.label}</span>
												<span class="text-xs text-gray-400">
													{getNumberValue(group.id, item.label).toFixed(2)}{getUnit(item.label)}
												</span>
											</div>
											<input
												type="range"
												min={item.min}
												max={item.max}
												step={item.step}
												value={getNumberValue(group.id, item.label)}
												on:input={(e) =>
													setControlValue(item.label, parseFloat(e.currentTarget.value))}
												class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500"
											/>
											<input
												type="number"
												min={item.min}
												max={item.max}
												step={item.step}
												value={getNumberValue(group.id, item.label)}
												on:input={(e) =>
													setControlValue(item.label, parseFloat(e.currentTarget.value))}
												class="mt-2 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20"
											/>
										</div>
									{/if}
								{/each}
							</div>
						</details>
					</div>
				{/each}
			</div>

			<!-- ACTION BUTTONS - Fixed at bottom -->
			<div class="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
				<button
					on:click={resetAll}
					class="rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700/50 disabled:opacity-50"
					disabled={isCapturing}
				>
					🔄 Reset All
				</button>
				<button
					on:click={captureVideo}
					class="rounded-lg border border-white/10 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
					disabled={isCapturing || !isVideoLoaded}
				>
					{#if isCapturing}
						🎥 Capturing...
					{:else if processedVideoUrl}
						🎬 Re-Capture Video
					{:else}
						🎬 Capture & Encode
					{/if}
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

	summary::-webkit-details-marker {
		display: none;
	}
</style>

// src/lib/stores/logo.store.ts
// Logo Overlay State Management with THREE.js Animations

import { writable } from 'svelte/store';

export interface LogoState {
	// Enable/Disable
	enabled: boolean;

	// Logo File
	logoDataUrl: string | null; // Base64 data URL of uploaded logo
	logoFileName: string | null;

	// Position (percentage of video width/height)
	// 0-100 for both X and Y
	position: {
		x: number; // 0 = left, 100 = right
		y: number; // 0 = top, 100 = bottom
	};

	// Size & Appearance
	scale: number; // 0.1 - 2.0 (logo size multiplier)
	opacity: number; // 0 - 1 (transparency)

	// Timing (in seconds)
	startTime: number; // When logo appears
	endTime: number; // When logo disappears
	fadeInDuration: number; // Fade in animation length
	fadeOutDuration: number; // Fade out animation length

	// 🎨 NEW: Animation & Effects
	animationType: 'none' | 'spin' | 'pulse' | 'bounce' | 'explode' | 'warp' | 'glitch' | 'flip3d' | 'spiral' | 'shimmer' | 'particle-assemble';
	animationSpeed: number; // 0.1 - 5.0
	rotation3D: {
		x: number;
		y: number;
		z: number;
	};
	autoRotate: boolean;
	autoRotateSpeed: number;
}

const initialState: LogoState = {
	enabled: false,
	logoDataUrl: null,
	logoFileName: null,
	
	position: {
		x: 54, // Default: top right
		y: 47
	},

	scale: 0.3, // 50% size (good default)
	opacity: 0.9,

	startTime: 0, // Show from beginning
	endTime: 8, // Show until end (8s default video length)
	fadeInDuration: 0.5,
	fadeOutDuration: 0.5,

	// 🎨 NEW: Animation defaults
	animationType: 'none',
	animationSpeed: 1.0,
	rotation3D: {
		x: 0,
		y: 0,
		z: 0
	},
	autoRotate: false,
	autoRotateSpeed: 0.01
};

function createLogoStore() {
	const { subscribe, set, update } = writable<LogoState>(initialState);

	return {
		subscribe,
		set,
		update,

		// Enable/disable logo
		setEnabled: (enabled: boolean) => {
			update(state => ({ ...state, enabled }));
		},

		// Upload logo from file
		uploadLogo: (file: File) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const dataUrl = e.target?.result as string;
				update(state => ({
					...state,
					logoDataUrl: dataUrl,
					logoFileName: file.name,
					enabled: true // Auto-enable when logo is uploaded
				}));
			};
			reader.readAsDataURL(file);
		},

		// Set logo from data URL (for DALL-E generated images)
		setLogoDataUrl: (dataUrl: string, fileName: string = 'generated-logo.png') => {
			update(state => ({
				...state,
				logoDataUrl: dataUrl,
				logoFileName: fileName,
				enabled: true
			}));
		},

		// Clear logo
		clearLogo: () => {
			update(state => ({
				...state,
				logoDataUrl: null,
				logoFileName: null,
				enabled: false
			}));
		},

		// Update position
		setPosition: (x: number, y: number) => {
			update(state => ({
				...state,
				position: { x, y }
			}));
		},

		// 🎨 NEW: Animation methods
		setAnimation: (animationType: LogoState['animationType']) => {
			update(state => ({ ...state, animationType }));
		},

		setAnimationSpeed: (speed: number) => {
			update(state => ({ ...state, animationSpeed: speed }));
		},

		setRotation3D: (axis: 'x' | 'y' | 'z', value: number) => {
			update(state => ({
				...state,
				rotation3D: { ...state.rotation3D, [axis]: value }
			}));
		},

		toggleAutoRotate: () => {
			update(state => ({ ...state, autoRotate: !state.autoRotate }));
		},

		setAutoRotateSpeed: (speed: number) => {
			update(state => ({ ...state, autoRotateSpeed: speed }));
		},

		// Update single property
		updateProperty: <K extends keyof LogoState>(key: K, value: LogoState[K]) => {
			update(state => ({ ...state, [key]: value }));
		},

		// Position presets
		presets: {
			topLeft: () => {
				update(state => ({
					...state,
					position: { x: 10, y: 10 }
				}));
			},
			topRight: () => {
				update(state => ({
					...state,
					position: { x: 85, y: 10 }
				}));
			},
			bottomLeft: () => {
				update(state => ({
					...state,
					position: { x: 10, y: 85 }
				}));
			},
			bottomRight: () => {
				update(state => ({
					...state,
					position: { x: 85, y: 85 }
				}));
			},
			center: () => {
				update(state => ({
					...state,
					position: { x: 50, y: 50 }
				}));
			}
		},

		// Reset to defaults
		reset: () => {
			set(initialState);
		}
	};
}

export const logoState = createLogoStore();

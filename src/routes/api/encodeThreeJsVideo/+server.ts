// routes/api/encodeThreeJsVideo/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, unlink, mkdir, readFile, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
//import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// FFmpeg path
function getFFmpegPath(): string {
	if (process.env.FFMPEG_PATH) {
		return process.env.FFMPEG_PATH;
	}

	try {
		const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
		if (ffmpegInstaller.path) {
			console.log('Using FFmpeg from @ffmpeg-installer/ffmpeg:', ffmpegInstaller.path);
			return ffmpegInstaller.path;
		}
	} catch {
		// Package not installed, continue
	}

	const nodeModulesBinPath = path.join(process.cwd(), 'node_modules', '.bin', 'ffmpeg');
	if (existsSync(nodeModulesBinPath)) {
		console.log('Using FFmpeg from node_modules/.bin');
		return nodeModulesBinPath;
	}

	console.log('Using system FFmpeg (must be in PATH)');
	return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

export const POST: RequestHandler = async ({ request }) => {
	let tempInputDir: string | null = null;
	let tempOutputPath: string | null = null;

	try {
		const formData = await request.formData();
		const width = parseInt(formData.get('width') as string);
		const height = parseInt(formData.get('height') as string);
		const fps = parseInt(formData.get('fps') as string);
		const frameCount = parseInt(formData.get('frameCount') as string);
		const frameData = formData.get('frameData') as File;

		console.log(`📥 Received: ${frameCount} frames at ${width}x${height}, ${fps}fps`);

		if (!width || !height || !fps || !frameCount || !frameData) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		// Create temp directory
		const tempDir = path.join(process.cwd(), 'temp');
		if (!existsSync(tempDir)) {
			await mkdir(tempDir, { recursive: true });
		}

		const uniqueId = randomUUID();
		tempInputDir = path.join(tempDir, `frames-${uniqueId}`);
		tempOutputPath = path.join(tempDir, `output-${uniqueId}.webm`);

		// Create frames directory
		console.log(`Creating frames directory...`);
		await mkdir(tempInputDir, { recursive: true });

		// Read frame data
		console.log('📝 Writing frame data to disk...');
		const arrayBuffer = await frameData.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		const bytesPerFrame = width * height * 4; // RGBA

		console.log(`Expected ${bytesPerFrame} bytes per frame, total ${uint8Array.length} bytes`);

		// Write individual frame files
		for (let i = 0; i < frameCount; i++) {
			const frameStart = i * bytesPerFrame;
			const frameEnd = frameStart + bytesPerFrame;
			const frameBuffer = uint8Array.slice(frameStart, frameEnd);
			const framePath = path.join(tempInputDir, `frame-${String(i).padStart(6, '0')}.raw`);
			await writeFile(framePath, Buffer.from(frameBuffer));
		}

		console.log(`✅ Wrote ${frameCount} frames`);

		// Encode using FFmpeg with stdin pipe
		console.log('🎬 Encoding frames to video with FFmpeg (stdin pipe)...');

		//const result = await encodeWithStdin(FFMPEG_PATH, uint8Array, width, height, fps, frameCount, bytesPerFrame, tempOutputPath);
		console.log('🎬 Encoding frames to video with FFmpeg (from disk files)...');

		const result = await encodeFromDisk(FFMPEG_PATH, tempInputDir, width, height, fps, frameCount, tempOutputPath);

		if (!result.success) {
			throw new Error(result.error);
		}

		// // Read the output video
		// if (!existsSync(tempOutputPath)) {
		// 	throw new Error(`Output file not created: ${tempOutputPath}`);
		// }
		// Use the MP4 output path
const finalOutputPath = result.outputPath || tempOutputPath;

if (!existsSync(finalOutputPath)) {
  throw new Error(`Output file not created: ${finalOutputPath}`);
}

// Update tempOutputPath for cleanup
tempOutputPath = finalOutputPath;

		const processedVideo = await readFileAsBase64(tempOutputPath);

		// Clean up
		console.log('🧹 Cleaning up temp files...');
		for (let i = 0; i < frameCount; i++) {
			const framePath = path.join(tempInputDir, `frame-${String(i).padStart(6, '0')}.raw`);
			await unlink(framePath).catch(() => {});
		}

		try {
			await rmdir(tempInputDir);
		} catch (err) {
			console.error(`Failed to remove directory:`, err);
		}

		try {
			await unlink(tempOutputPath);
		} catch (err) {
			console.error(`Failed to remove output file:`, err);
		}

		return json({
			success: true,
			videoBase64: processedVideo,
			message: 'Three.js video encoded successfully'
		});
	} catch (error) {
		console.error('❌ Error encoding Three.js video:', error);

		// Clean up on error
		if (tempInputDir && existsSync(tempInputDir)) {
			try {
				const fs = await import('fs/promises');
				const files = await fs.readdir(tempInputDir);
				for (const file of files) {
					await fs.unlink(path.join(tempInputDir, file)).catch(() => {});
				}
				await rmdir(tempInputDir).catch(() => {});
			} catch (err) {
				console.error('Cleanup error:', err);
			}
		}

		if (tempOutputPath && existsSync(tempOutputPath)) {
			await unlink(tempOutputPath).catch(() => {});
		}

		return json(
			{
				error: 'Failed to encode Three.js video',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

async function readFileAsBase64(filePath: string): Promise<string> {
	const buffer = await readFile(filePath);
	return buffer.toString('base64');
}

/**
 * Encode frames from disk files (more reliable for large videos)
 */
async function encodeFromDisk(
  ffmpegPath: string,
  inputDir: string,
  width: number,
  height: number,
  fps: number,
  frameCount: number,
  outputPath: string
): Promise<{ success: boolean; error?: string; outputPath?: string }> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { writeFile } = await import('fs/promises');
    const execAsync = promisify(exec);

    // Output as MP4
    const mp4OutputPath = outputPath.replace('.webm', '.mp4');
    
    // Create concat file listing all frames
    const concatFilePath = path.join(inputDir, 'frames.txt');
    let concatContent = '';
    
    for (let i = 0; i < frameCount; i++) {
      const framePath = path.join(inputDir, `frame-${i.toString().padStart(6, '0')}.raw`);
      concatContent += `file '${framePath.replace(/\\/g, '/')}'\n`;
    }
    
    await writeFile(concatFilePath, concatContent);
    console.log('📝 Created concat file');

    // Use concat demuxer - bypasses pattern matching issues
    const command = [
      `"${ffmpegPath}"`,
      `-f rawvideo`,
      `-pixel_format rgba`,
      `-video_size ${width}x${height}`,
      `-framerate ${fps}`,
      `-f concat`,
      `-safe 0`,
      `-i "${concatFilePath}"`,
      `-c:v libx264`,
      `-preset medium`,
      `-crf 23`,
      `-b:v 5M`,
      `-pix_fmt yuv420p`,
      `-movflags +faststart`,
      `"${mp4OutputPath}"`
    ].join(' ');

    console.log('Executing:', command);

    await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024
    });

    console.log('✅ FFmpeg encoding complete');
    
    return { 
      success: true,
      outputPath: mp4OutputPath
    };

  } catch (error: any) {
    console.error('FFmpeg error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
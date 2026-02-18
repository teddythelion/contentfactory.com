import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, rmdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

function getFFmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller.path) return ffmpegInstaller.path;
  } catch {console.error("caught")}
  
  return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { sessionId, totalFrames, fps, width, height } = body;

  const sessionDir = path.join(process.cwd(), 'temp', `session-${sessionId}`);
  const outputPath = path.join(process.cwd(), 'temp', `output-${sessionId}.mp4`);

  try {
    console.log(`🎬 Encoding ${totalFrames} frames from session ${sessionId}`);

    // Convert raw frames to PNG (FFmpeg can handle these)
    console.log('🖼️ Converting raw frames to PNG...');
    for (let i = 0; i < totalFrames; i++) {
      const rawPath = path.join(sessionDir, `frame-${i.toString().padStart(6, '0')}.raw`);
      const pngPath = path.join(sessionDir, `frame-${i.toString().padStart(6, '0')}.png`);
      
      const rawBuffer = await readFile(rawPath);
      
      await sharp(rawBuffer, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
      .png()
      .toFile(pngPath);
      
      // Delete raw file to save space
      await unlink(rawPath);
      
      if (i % 30 === 0) {
        console.log(`  Converted ${i + 1}/${totalFrames} frames`);
      }
    }

    console.log('✅ Frame conversion complete');

    // Encode with FFmpeg using PNG frames
    const command = [
  `"${FFMPEG_PATH}"`,
  `-framerate ${fps}`,
  `-i "${path.join(sessionDir, 'frame-%06d.png')}"`,
  `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,  // ← ADD THIS LINE (rounds to even)
  `-c:v libx264`,
  `-preset medium`,
  `-crf 23`,
  `-b:v 5M`,
  `-pix_fmt yuv420p`,
  `-movflags +faststart`,
  `"${outputPath}"`
].join(' ');

    console.log('Executing:', command);

    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });

    console.log('✅ Encoding complete');

    // Read output
    const videoBuffer = await readFile(outputPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Cleanup
    const files = await readdir(sessionDir);
    for (const file of files) {
      await unlink(path.join(sessionDir, file)).catch(() => {});
    }
    await rmdir(sessionDir).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, videoBase64 }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Encoding error:', error);

    // Cleanup on error
    if (existsSync(sessionDir)) {
      const files = await readdir(sessionDir);
      for (const file of files) {
        await unlink(path.join(sessionDir, file)).catch(() => {});
      }
      await rmdir(sessionDir).catch(() => {});
    }
    if (existsSync(outputPath)) {
      await unlink(outputPath).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        error: 'Encoding failed',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
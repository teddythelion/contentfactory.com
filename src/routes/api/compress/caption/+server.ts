// src/routes/api/compress/caption/+server.ts
// Uses Claude to intelligently compress captions to 280 characters

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Anthropic } from '@anthropic-ai/sdk';

const client = new Anthropic();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { caption, maxChars = 280 } = await request.json();

		if (!caption || typeof caption !== 'string') {
			return json({ error: 'Caption is required' }, { status: 400 });
		}

		if (caption.length <= maxChars) {
			return json({
				compressed: caption,
				wasCompressed: false
			});
		}

		// Use Claude to intelligently compress the caption
		const message = await client.messages.create({
			model: 'claude-opus-4-5-20251101',
			max_tokens: 100,
			messages: [
				{
					role: 'user',
					content: `You are a social media expert. Compress this caption to exactly ${maxChars} characters or less while keeping the core message and emotion intact. Keep it natural and engaging. Do NOT use abbreviations or txt speak. Return ONLY the compressed caption, nothing else.

Original caption:
"${caption}"`
				}
			]
		});

		const compressed = message.content[0].type === 'text' ? message.content[0].text.trim() : caption;

		// Ensure it doesn't exceed limit
		const finalCompressed = compressed.length > maxChars 
			? compressed.substring(0, maxChars - 3) + '...'
			: compressed;

		return json({
			compressed: finalCompressed,
			charCount: finalCompressed.length,
			wasCompressed: true
		});
	} catch (error: any) {
		console.error('Error compressing caption:', error);
		return json(
			{
				error: 'Failed to compress caption',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
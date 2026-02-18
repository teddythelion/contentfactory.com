import { z } from 'zod';
import { env } from '$env/dynamic/private';

export async function POST({ request }: { request: Request }) {
    try {
        // Get the API key from environment variables
        const apiKey = env.OPENAI_API_KEY;
        
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured in environment variables');
        }

      //  console.log('API Key loaded:', apiKey.substring(0, 10) + '...');

        // Parse and validate request body
        const body = await request.json().catch(() => ({}));    

        const schema = z.object({ 
            prompt: z.string().min(1).optional() 
        }).strict();

        const { prompt = 'Santa Claus driving a Cadillac' } = schema.parse(body);
        console.log('Prompt:', prompt);

        // Call OpenAI API directly to have full control over parameters
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-image-1.5',
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                // Only including parameters that gpt-image-1.5 supports
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            throw new Error(errorData.error?.message || 'Image generation failed');
        }

        const data = await response.json();
       

        // Check the response structure
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
           
            throw new Error('No image data returned from OpenAI');
        }

        const imageData = data.data[0];
        

        // Check if we have a URL or b64_json
        if (imageData.url) {
           
            
            // Fetch the image and convert to base64
            const imageResponse = await fetch(imageData.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');

            return new Response(
                JSON.stringify({ 
                    imageBase64: base64Image,
                    url: imageData.url
                }), 
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        } else if (imageData.b64_json) {
            console.log('Got base64 image directly');
            
            return new Response(
                JSON.stringify({ 
                    imageBase64: imageData.b64_json
                }), 
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        } else {
           
            throw new Error('Invalid image data format from OpenAI');
        }

    } catch (err) {
        console.error('Image generation error:', err);
        const message = err instanceof Error ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: message }), 
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
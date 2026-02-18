import { VertexAI } from '@google-cloud/vertexai';
import { readFileSync } from 'fs';

const PROJECT_ID = 'project-app-479008';
const LOCATION = 'us-central1';
const KEY_PATH = 'C:/dev/sandbox/sand/service-key.json';

async function testAuth() {
    console.log('Testing Vertex AI Authentication...');
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Location: ${LOCATION}`);
    console.log(`Key Path: ${KEY_PATH}`);

    try {
        const serviceAccountKey = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
        
        const vertexAI = new VertexAI({
            project: PROJECT_ID,
            location: LOCATION,
            googleAuthOptions: {
                credentials: serviceAccountKey
            }
        });

        console.log('Vertex AI initialized.');

        // Test with a simple Gemini call to verify access
        const model = vertexAI.preview.getGenerativeModel({
            model: 'gemini-1.5-flash-001',
        });

        console.log('Sending test request...');
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you working?' }] }],
        });

        const response = await result.response;
        console.log('Response received!');
        console.log('Text:', response.candidates[0].content.parts[0].text);
        console.log('SUCCESS: Authentication and API access verified.');

    } catch (error) {
        console.error('ERROR: Authentication failed or API error.');
        console.error(error);
        process.exit(1);
    }
}

testAuth();

import 'dotenv/config';
import ollama from 'ollama';

// Set the base URL dynamically from your .env
process.env.OLLAMA_HOST = process.env.OLLAMA_API_URL;

async function main() {
  try {
    const response = await ollama.chat({
      model: 'llama3.1',
      messages: [
        { role: 'user', content: 'Say Hi?' }
      ],
    });

    const content = response?.message?.content || '⚠️ Unexpected response: ' + JSON.stringify(response);
    console.log(`🌐 Using Ollama server: ${process.env.OLLAMA_HOST}`);

    console.log('✅ Response from VSP Ollama:\n', content);
  } catch (err) {
    console.error('❌ Error communicating with VPS Ollama:', err?.response?.data || err.message);
  }
}

main();

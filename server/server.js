
import express from 'express';
import cors from 'cors';
import ollama from 'ollama';

const app = express();
const PORT = 3001;


// Middleware
app.use(cors());
app.use(express.json());




app.post('/api/chat-stream', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log('📨 Received streaming message:', message);
    
    // Start streaming response from Ollama
    const response = await ollama.chat({
      model: 'llama3.1',
      messages: [
        { role: 'user', content: message }
      ],
      stream: true, // Enable streaming
    });

    let fullResponse = '';
    
    // Process each chunk as it arrives
    for await (const chunk of response) {
      if (chunk.message?.content) {
        fullResponse += chunk.message.content;
        
        // Send chunk to frontend
        res.write(`data: ${JSON.stringify({
          content: chunk.message.content,
          fullResponse: fullResponse,
          done: chunk.done || false
        })}\n\n`);
      }
      
      // If done, close the stream
      if (chunk.done) {
        console.log('🤖 Streaming complete:', fullResponse);
        res.write(`data: ${JSON.stringify({
          content: '',
          fullResponse: fullResponse,
          done: true
        })}\n\n`);
        res.end();
        break;
      }
    }
    
  } catch (err) {
    console.error('❌ Error from Ollama streaming:', err?.response?.data || err.message);
    res.write(`data: ${JSON.stringify({
      error: 'Error talking to Ollama',
      detail: err.message,
      done: true
    })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌊 Streaming endpoint: http://localhost:${PORT}/api/chat-stream`);
});
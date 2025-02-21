const axios = require('axios');

// Helper function to extract video ID
function getVideoId(url) {
  try {
    const pattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
    throw new Error('Could not extract video ID from URL');
  } catch (error) {
    throw new Error('Invalid YouTube URL format');
  }
}

async function getTranscript(videoId) {
  try {
    // First get video captions metadata
    const captionsUrl = `https://youtube.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`;
    const { data: captionsData } = await axios.get(captionsUrl);

    if (!captionsData.items || captionsData.items.length === 0) {
      throw new Error('No captions available for this video');
    }

    // Find English captions
    const englishCaption = captionsData.items.find(
      caption => caption.snippet.language === 'en' || caption.snippet.language.startsWith('en-')
    );

    if (!englishCaption) {
      throw new Error('No English captions available');
    }

    // Get the actual transcript
    const transcriptUrl = `https://youtube.googleapis.com/youtube/v3/captions/${englishCaption.id}?key=${process.env.YOUTUBE_API_KEY}`;
    const { data: transcript } = await axios.get(transcriptUrl, {
      headers: {
        Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN}`
      }
    });

    return transcript;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw new Error('Failed to fetch transcript: ' + (error.response?.data?.error?.message || error.message));
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      details: 'Only POST requests are allowed'
    });
  }

  // Set CORS headers for the actual response
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'URL is required and must be a string'
      });
    }

    const videoId = getVideoId(url);
    
    try {
      const transcript = await getTranscript(videoId);
      return res.json({ transcript });
    } catch (error) {
      console.error('Transcript Error:', error);
      return res.status(400).json({
        error: 'Failed to get transcript',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(400).json({
      error: 'Failed to process request',
      details: error.message
    });
  }
};

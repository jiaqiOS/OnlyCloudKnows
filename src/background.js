let API_KEY;
const API_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate?key=';

const fetchApiKey = async () => {
  try {
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    API_KEY = json.key;
    // console.log('gotApiKey');
  } catch (error) {
    console.error(error.message);
  }
};

fetchApiKey();

const analyzeImage = async (base64String, sendResponse) => {
  const labelDetectionRequest = {
    "requests": [{
      "image": {
        "content": "" + base64String + ""
      },
      "features": [{
        "type": "LABEL_DETECTION",
        "maxResults": 50,
        // "model": "builtin/legacy"
      }]
    }]
  };

  const options = {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(labelDetectionRequest)
  };

  try {
    const labelDetectionResponse = await fetch(`${API_ENDPOINT}${API_KEY}`, options);
    if (!labelDetectionResponse.ok) {
      throw new Error(`HTTP error! status: ${labelDetectionResponse.status}`);
    }

    const json = await labelDetectionResponse.json();
    const labels = json.responses[0].labelAnnotations;

    let annotations = [];
    if (labels) {
      for (const label of labels) {
        const category = label.description;
        // console.log(category);
        const score = (label.score * 100).toFixed(1) + '%';
        if (['Art', 'Artist', 'Artwork', 'Art exhibition', 'Creative arts', 'Environmental art', 'Fractal art', 'Line art', 'Modern art', 'Plastic arts', 'Performance art', 'Performing arts', 'Street art', 'Visual arts'].includes(category)) {
          annotations.push(`${score} ${category}`);
        }
      }
    }
    sendResponse(annotations);
  } catch (error) {
    console.error(error.message);
  }
};

const loadAndEncodeImage = async (url, sendResponse) => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const blobToBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });

    const base64String = blobToBase64.toString().replace(/^data:(.*,)?/, '');
    analyzeImage(base64String, sendResponse);
  } catch (error) {
    console.error(error.message);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) return;
  if (request.action === 'fetchImage') {
    loadAndEncodeImage(request.data, sendResponse);
    return true;
  }
});
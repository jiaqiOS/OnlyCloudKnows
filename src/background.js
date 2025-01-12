let apiKey;

const fetchApiKey = async () => {
  const response = await fetch('config.json');
  const object = await response.json();
  apiKey = object.key;
}

fetchApiKey()
  .then(response => console.log('gotApiKey'))
  .catch(err => console.error(err.message));

const analyzeImage = (base64String, sendResponse) => {
  const annotateImageRequest = {
    "requests": [{
      "image": {
        "content": "" + base64String + ""
      },
      "features": [{
        "type": "LABEL_DETECTION",
        "maxResults": 50
      }]
    }]
  }

  const options = {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(annotateImageRequest)
  };

  const visionApiEndpoint = 'https://vision.googleapis.com/v1/images:annotate?key=';
  const visionApiRequest = visionApiEndpoint + apiKey;

  fetch(visionApiRequest, options)
    .then((annotateImageResponse) => {
      if (!annotateImageResponse.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return annotateImageResponse.json();
    })
    .then((labelDetection) => {
      const labels = labelDetection.responses[0].labelAnnotations;

      let predictions = [];
      if (typeof labels != 'undefined') {
        for (let i = 0; i < labels.length; i++) {
          const label = labels[i].description;
          // console.log(label);
          const confidenceScore = (labels[i].score * 100).toFixed(1) + '%';
          let annotation = {};
          if (label === 'Art' || label === 'Artist' || label === 'Artwork' || label === 'Art exhibition' || label === 'Creative arts' || label === 'Fractal art' || label === 'Environmental art' || label === 'Line art' || label === 'Modern art' || label === 'Plastic arts' || label === 'Performance art' || label === 'Performing arts' || label === 'Street art' || label === 'Visual arts') {
            annotation = confidenceScore + ' ' + label;
            predictions.push(annotation);
          }
        }
      }
      sendResponse(predictions);
    })
    .catch(err => console.error(err.message));
}

const loadAndEncodeImage = (url, sendResponse) => {
  fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      }
      reader.onerror = error => reject(error);
      reader.readAsDataURL(blob);
    }))
    .then((result) => {
      const base64String = result.toString().replace(/^data:(.*,)?/, '');
      return base64String;
    })
    .then(base64String => analyzeImage(base64String, sendResponse))
    .catch(err => console.error(err.message));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) {
    return;
  }
  if (request.action === 'fetchImage') {
    loadAndEncodeImage(request.data, sendResponse);
    return true;
  }
});
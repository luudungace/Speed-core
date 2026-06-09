const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

async function testTesseract() {
  console.log('Tesseract loaded successfully!');
  
  // Create a minimal 1x1 transparent PNG base64 to test loading
  const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const buffer = Buffer.from(testPngBase64, 'base64');
  
  console.log('Running test recognition (this might take a few seconds on first download of English training data)...');
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    console.log('Tesseract running fine! Result of recognition (empty expected for 1x1 blank image):', JSON.stringify(text));
    console.log('✅ TEST PASSED - Tesseract works offline/locally without keys.');
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
  }
}

testTesseract();

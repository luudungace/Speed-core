const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Path to the image
  const imgPath = path.resolve(__dirname, '../Logo Dọc Màu.png');
  if (!fs.existsSync(imgPath)) {
    console.error('Image not found at:', imgPath);
    await browser.close();
    process.exit(1);
  }

  // Read image as base64
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');
  const dataUrl = `data:image/png;base64,${imgBase64}`;

  // Evaluate color extraction in page context
  const colors = await page.evaluate(async (src) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Collect all non-transparent pixels
        const colorCounts = {};
        // Sample pixels to find dominant colors
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          const a = data[i+3];

          // Exclude transparent and nearly white/black pixels from background
          if (a > 200 && !(r > 240 && g > 240 && b > 240) && !(r < 15 && g < 15 && b < 15)) {
            const rgb = `${r},${g},${b}`;
            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
          }
        }

        // Sort colors by frequency
        const sortedColors = Object.keys(colorCounts)
          .map(rgb => {
            const [r, g, b] = rgb.split(',').map(Number);
            const hex = '#' + [r, g, b].map(x => {
              const hexStr = x.toString(16);
              return hexStr.length === 1 ? '0' + hexStr : hexStr;
            }).join('').toUpperCase();
            return { rgb, hex, count: colorCounts[rgb] };
          })
          .sort((a, b) => b.count - a.count);

        // We also want to sample specific regions:
        // Text is at the bottom (say, between y = 70% and 85%)
        const textColors = {};
        const startY = Math.floor(canvas.height * 0.70);
        const endY = Math.floor(canvas.height * 0.85);
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            if (a > 240 && !(r > 240 && g > 240 && b > 240)) {
              const rgb = `${r},${g},${b}`;
              textColors[rgb] = (textColors[rgb] || 0) + 1;
            }
          }
        }

        const sortedTextColors = Object.keys(textColors)
          .map(rgb => {
            const [r, g, b] = rgb.split(',').map(Number);
            const hex = '#' + [r, g, b].map(x => {
              const hexStr = x.toString(16);
              return hexStr.length === 1 ? '0' + hexStr : hexStr;
            }).join('').toUpperCase();
            return { rgb, hex, count: textColors[rgb] };
          })
          .sort((a, b) => b.count - a.count);

        // Sample top of icon for the sky blue / light blue
        // The light blue is typically in the upper-left of the icon
        const iconLightColors = {};
        const lightStartY = Math.floor(canvas.height * 0.15);
        const lightEndY = Math.floor(canvas.height * 0.4);
        const lightStartX = Math.floor(canvas.width * 0.1);
        const lightEndX = Math.floor(canvas.width * 0.5);
        for (let y = lightStartY; y < lightEndY; y++) {
          for (let x = lightStartX; x < lightEndX; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            if (a > 240 && !(r > 240 && g > 240 && b > 240)) {
              // We want colors where Green and Blue are high (sky blue)
              if (b > 180 && g > 120 && r < 100) {
                const rgb = `${r},${g},${b}`;
                iconLightColors[rgb] = (iconLightColors[rgb] || 0) + 1;
              }
            }
          }
        }

        const sortedLightColors = Object.keys(iconLightColors)
          .map(rgb => {
            const [r, g, b] = rgb.split(',').map(Number);
            const hex = '#' + [r, g, b].map(x => {
              const hexStr = x.toString(16);
              return hexStr.length === 1 ? '0' + hexStr : hexStr;
            }).join('').toUpperCase();
            return { rgb, hex, count: iconLightColors[rgb] };
          })
          .sort((a, b) => b.count - a.count);

        resolve({
          width: img.width,
          height: img.height,
          dominantAll: sortedColors.slice(0, 10),
          dominantText: sortedTextColors.slice(0, 5),
          dominantLight: sortedLightColors.slice(0, 5)
        });
      };
      img.src = src;
    });
  }, dataUrl);

  console.log('--- Image Dimensions ---');
  console.log(`Width: ${colors.width}px, Height: ${colors.height}px`);
  console.log('\n--- Dominant Text Colors (Solid Navy) ---');
  colors.dominantText.slice(0, 3).forEach(c => {
    console.log(`${c.hex} (Count: ${c.count})`);
  });
  console.log('\n--- Dominant Light Blue Gradient Colors ---');
  colors.dominantLight.slice(0, 3).forEach(c => {
    console.log(`${c.hex} (Count: ${c.count})`);
  });
  console.log('\n--- Top Dominant Colors in Image ---');
  colors.dominantAll.slice(0, 8).forEach(c => {
    console.log(`${c.hex} (Count: ${c.count})`);
  });

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

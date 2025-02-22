import { chromium } from 'playwright';
import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// Function to replace GIFs with placeholders
async function disableGifAnimations(page) {
  await page.evaluate(() => {
    // Find all <img> elements with .gif in the src attribute
    const gifs = document.querySelectorAll('img[src$=".gif"]');
    
    gifs.forEach((gif) => {
      // Check if the GIF is already loaded
      if (gif.complete && gif.naturalWidth !== 0) {
        const width = gif.naturalWidth;
        const height = gif.naturalHeight;
        // Replace the src with a placeholder of the appropriate size
        gif.src = `https://placehold.co/${width}x${height}`;
      } else {
        // If the GIF isn't loaded yet, wait for the 'load' event
        gif.addEventListener('load', () => {
          const width = gif.naturalWidth;
          const height = gif.naturalHeight;
          gif.src = `https://placehold.co/${width}x${height}`;
        });
      }
    });
  });

  // Step 2: Disable CSS animations
  await page.addStyleTag({
    content: `
      * {
        animation: none !important;
      }
    `,
  });

  // Wait a bit to ensure all GIFs are loaded and replaced
  await page.waitForTimeout(1000);
}

async function processPair(pair, index, browser, authHeader) {
  console.log(`Processing pair ${index + 1}: ${pair.live} vs ${pair.dev}`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: { 'Authorization': authHeader },
  });

  // Screenshot of the Development page
  const devPage = await context.newPage();
  await devPage.goto(pair.dev, { waitUntil: 'networkidle' });
  await disableGifAnimations(devPage); // Replace GIFs with placeholders
  const devScreenshot = await devPage.screenshot({ fullPage: true });
  await devPage.close();

  // Screenshot of the Live page
  const livePage = await context.newPage();
  await livePage.goto(pair.live, { waitUntil: 'networkidle' });
  await disableGifAnimations(livePage); // Replace GIFs with placeholders
  const liveScreenshot = await livePage.screenshot({ fullPage: true });
  await livePage.close();

  // Screenshots in PNG-Objekte umwandeln
  const devImg = PNG.sync.read(devScreenshot);
  const liveImg = PNG.sync.read(liveScreenshot);

  // Maximale Dimensionen bestimmen
  const maxWidth = Math.max(devImg.width, liveImg.width);
  const maxHeight = Math.max(devImg.height, liveImg.height);

  // Neue Bilder mit einheitlicher Größe erstellen
  const paddedDevImg = new PNG({ width: maxWidth, height: maxHeight, fill: true });
  const paddedLiveImg = new PNG({ width: maxWidth, height: maxHeight, fill: true });

  // Originalbilder in die neuen Bilder kopieren
  PNG.bitblt(devImg, paddedDevImg, 0, 0, devImg.width, devImg.height, 0, 0);
  PNG.bitblt(liveImg, paddedLiveImg, 0, 0, liveImg.width, liveImg.height, 0, 0);

  // Diff-Bild erstellen
  const diffImg = new PNG({ width: maxWidth, height: maxHeight });

  // Bilder vergleichen
  const numDiffPixels = pixelmatch(
    paddedDevImg.data,
    paddedLiveImg.data,
    diffImg.data,
    maxWidth,
    maxHeight,
    { threshold: 0.1, diffColor: [255, 0, 0] }
  );

  let result = null;
  if (numDiffPixels > 0) {
    fs.mkdirSync('diffs', { recursive: true });
    const diffPath = `diffs/diff-${index + 1}-${Date.now()}.png`;
    fs.writeFileSync(`diffs/dev-${index + 1}.png`, PNG.sync.write(paddedDevImg));
    fs.writeFileSync(`diffs/live-${index + 1}.png`, PNG.sync.write(paddedLiveImg));
    fs.writeFileSync(diffPath, PNG.sync.write(diffImg));

    console.log(`Differences found. Diff saved to: ${diffPath}`);
    result = { 
      live: pair.live, 
      dev: pair.dev, 
      dev_browser: pair.dev_browser || null, 
      diff: diffPath, 
      message: 'Differences found' 
    };
  } else {
    console.log('No differences found');
  }

  await context.close();
  return result;
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Please provide the URLs JSON file path as a command line argument.');
    process.exit(1);
  }
  const urlsFilePath = args[0];

  const urlPairs = JSON.parse(fs.readFileSync(urlsFilePath, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const summary = [];

  const username = process.env.BASIC_AUTH_USERNAME || 'admin';
  const password = process.env.BASIC_AUTH_PASSWORD || 'password';
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  // Parallel processing in chunks of 10 URL pairs
  for (let i = 0; i < urlPairs.length; i += 10) {
    const chunk = urlPairs.slice(i, i + 10);
    const results = await Promise.all(
      chunk.map((pair, j) => processPair(pair, i + j, browser, authHeader))
    );
    results.forEach(res => {
      if (res) summary.push(res);
    });
  }

  await browser.close();

  console.log('\nSummary of differing URL pairs:');
  if (summary.length === 0) {
    console.log('All URL pairs are identical');
  } else {
    summary.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.message}`);
      console.log(`   Live: ${item.live}`);
      console.log(`   Dev: ${item.dev}`);
      if (item.dev_browser) {
        console.log(`   Dev Browser: ${item.dev_browser}`);
      }
      console.log(`   Diff image: ${item.diff}`);
    });
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

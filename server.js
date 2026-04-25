const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const PptxGenJS = require('pptxgenjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/ping', (req, res) => res.json({ ok: true }));

app.post('/convert', async (req, res) => {
    const { slides, title } = req.body;
    if (!slides || !slides.length) {
        return res.status(400).json({ error: 'no slides' });
    }

    let browser;
    try {
       browser = await puppeteer.launch({
    headless: 'new',
    executablePath: puppeteer.executablePath(),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });

        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE';

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            await page.setContent(slide.html, { 
                waitUntil: 'networkidle0',
                timeout: 15000 
            });
            
            // Aspetta font e immagini
            await page.waitForTimeout(1000);
            
            const screenshot = await page.screenshot({
                type: 'jpeg',
                quality: 95,
                clip: { x: 0, y: 0, width: 1280, height: 720 }
            });
            
            await page.close();
            
            const pSlide = pptx.addSlide();
            pSlide.addImage({
                data: 'data:image/jpeg;base64,' + screenshot.toString('base64'),
                x: 0, y: 0, w: '100%', h: '100%'
            });
        }

        await browser.close();

        const buffer = await pptx.write({ outputType: 'nodebuffer' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${title || 'presentation'}.pptx"`);
        res.send(buffer);

    } catch (err) {
        if (browser) await browser.close();
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

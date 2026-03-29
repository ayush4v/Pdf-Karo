import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import pkg from 'jspdf';
const { jsPDF } = pkg;
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// Middleware
app.use(cors());
app.use(express.json());

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ensure uploads and outputs directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

// Helper function to clean up files
const cleanupFiles = async (files) => {
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
};

// API Routes

// 1. Merge PDFs
app.post('/api/merge', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'At least 2 files required' });
    }

    const mergedPdf = await PDFDocument.create();
    
    for (const file of req.files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const outputPath = path.join(outputsDir, `merged-${Date.now()}.pdf`);
    const pdfBytes = await mergedPdf.save();
    fs.writeFileSync(outputPath, pdfBytes);

    await cleanupFiles(req.files.map(f => f.path));

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'merged.pdf'
    });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Split PDF
app.post('/api/split', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { pages } = req.body;
    const pageArray = pages ? pages.split(',').map(p => parseInt(p.trim()) - 1) : [0];

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const splitPdf = await PDFDocument.create();
    
    const copiedPages = await splitPdf.copyPages(pdf, pageArray.filter(p => p >= 0 && p < pdf.getPageCount()));
    copiedPages.forEach(page => splitPdf.addPage(page));

    const outputPath = path.join(outputsDir, `split-${Date.now()}.pdf`);
    const outputBytes = await splitPdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'split.pdf'
    });
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Rotate PDF
app.post('/api/rotate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { angle = 90 } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const pages = pdf.getPages();
    pages.forEach(p => {
      const currentRotation = p.getRotation()?.angle || 0;
      p.setRotation(degrees(currentRotation + parseInt(angle)));
    });

    const outputPath = path.join(outputsDir, `rotated-${Date.now()}.pdf`);
    const outputBytes = await pdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'rotated.pdf'
    });
  } catch (error) {
    console.error('Rotate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Protect PDF
app.post('/api/protect', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const outputBytes = await pdf.save({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        printing: 'highResolution',
        copying: false,
        modifying: false,
        annotating: false,
      }
    });

    const outputPath = path.join(outputsDir, `protected-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'protected.pdf'
    });
  } catch (error) {
    console.error('Protect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Unlock PDF
app.post('/api/unlock', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes, { password });
    
    const outputBytes = await pdf.save();

    const outputPath = path.join(outputsDir, `unlocked-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'unlocked.pdf'
    });
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: 'Invalid password or file' });
  }
});

// 6. Add Watermark - IMPROVED with better coverage
app.post('/api/watermark', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { text = 'PdfKaro', opacity = 0.3, angle = 45, size = 60 } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdf.getPages();
    pages.forEach(p => {
      const { width, height } = p.getSize();
      const fontSize = parseInt(size);
      const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
      
      // Create diagonal watermark pattern
      const spacing = fontSize * 2.5;
      const startX = -width;
      const endX = width * 2;
      const startY = -height;
      const endY = height * 2;
      
      for (let x = startX; x < endX; x += spacing * 1.5) {
        for (let y = startY; y < endY; y += spacing * 1.5) {
          p.drawText(text, {
            x: x,
            y: y,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5),
            opacity: parseFloat(opacity),
            rotate: degrees(parseInt(angle))
          });
        }
      }
    });

    const outputPath = path.join(outputsDir, `watermarked-${Date.now()}.pdf`);
    const outputBytes = await pdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'watermarked.pdf'
    });
  } catch (error) {
    console.error('Watermark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Add Page Numbers - IMPROVED with better positioning
app.post('/api/page-numbers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { position = 'bottom-right', startFrom = 1, fontSize = 12 } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdf.embedFont(StandardFonts.Helvetica);
    
    const pages = pdf.getPages();
    const totalPages = pages.length;
    
    pages.forEach((p, i) => {
      const pageNum = i + parseInt(startFrom);
      const { width, height } = p.getSize();
      const margin = 30;
      const fs = parseInt(fontSize);
      const pageText = `${pageNum}`;
      const textWidth = helveticaFont.widthOfTextAtSize(pageText, fs);
      
      let x, y;
      
      switch(position) {
        case 'bottom-right': 
          x = width - margin - textWidth; 
          y = margin; 
          break;
        case 'bottom-center': 
          x = (width - textWidth) / 2; 
          y = margin; 
          break;
        case 'bottom-left': 
          x = margin; 
          y = margin; 
          break;
        case 'top-right': 
          x = width - margin - textWidth; 
          y = height - margin - fs; 
          break;
        case 'top-center': 
          x = (width - textWidth) / 2; 
          y = height - margin - fs; 
          break;
        case 'top-left': 
          x = margin; 
          y = height - margin - fs; 
          break;
        default: 
          x = width - margin - textWidth; 
          y = margin;
      }
      
      p.drawText(pageText, { 
        x, 
        y, 
        size: fs, 
        font: helveticaFont, 
        color: rgb(0, 0, 0) 
      });
    });

    const outputPath = path.join(outputsDir, `numbered-${Date.now()}.pdf`);
    const outputBytes = await pdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'numbered.pdf'
    });
  } catch (error) {
    console.error('Page numbers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. JPG to PDF
app.post('/api/jpg-to-pdf', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();  // 595.28 pt
    const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
    const margin = 36; // ~0.5 inch margin
    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      if (i > 0) doc.addPage();

      const imageBuffer = fs.readFileSync(file.path);
      const metadata = await sharp(imageBuffer).metadata();
      
      const imgWidth = metadata.width;
      const imgHeight = metadata.height;
      const imgRatio = imgWidth / imgHeight;
      
      // Calculate dimensions to fit within page while maintaining aspect ratio
      let finalWidth, finalHeight;
      const pageRatio = maxWidth / maxHeight;
      
      if (imgRatio > pageRatio) {
        // Image is wider relative to page - fit to width
        finalWidth = maxWidth;
        finalHeight = finalWidth / imgRatio;
      } else {
        // Image is taller relative to page - fit to height
        finalHeight = maxHeight;
        finalWidth = finalHeight * imgRatio;
      }
      
      // Center the image on the page
      const x = (pageWidth - finalWidth) / 2;
      const y = (pageHeight - finalHeight) / 2;

      // Convert to JPEG for consistency
      const processedImage = await sharp(imageBuffer)
        .resize(Math.round(finalWidth), Math.round(finalHeight), {
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      const dataUrl = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
      
      // Add image to PDF with calculated dimensions
      doc.addImage(dataUrl, 'JPEG', x, y, finalWidth, finalHeight);
    }

    const outputPath = path.join(outputsDir, `images-to-pdf-${Date.now()}.pdf`);
    const pdfBytes = doc.output('arraybuffer');
    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

    await cleanupFiles(req.files.map(f => f.path));

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'images.pdf'
    });
  } catch (error) {
    console.error('JPG to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Compress PDF
app.post('/api/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const outputBytes = await pdf.save({ useObjectStreams: true });

    const outputPath = path.join(outputsDir, `compressed-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'compressed.pdf',
      originalSize: pdfBytes.length,
      compressedSize: outputBytes.length
    });
  } catch (error) {
    console.error('Compress error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. OCR PDF
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const worker = await createWorker();
    const { data: { text } } = await worker.recognize(req.file.path);
    await worker.terminate();

    const outputPath = path.join(outputsDir, `ocr-text-${Date.now()}.txt`);
    fs.writeFileSync(outputPath, text);

    await cleanupFiles([req.file.path]);

    res.json({ 
      success: true, 
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'extracted-text.txt',
      text: text.substring(0, 1000)
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. PDF to JPG - Convert PDF pages to images
app.post('/api/pdf-to-jpg', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { format = 'jpg', dpi = 150 } = req.body;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPages();
    const imageUrls = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const scale = dpi / 72;
      const pngBytes = await page.render({
        width: width * scale,
        height: height * scale,
      });
      
      let processedImage;
      if (format === 'png') {
        processedImage = pngBytes;
      } else {
        processedImage = await sharp(pngBytes).jpeg({ quality: 90 }).toBuffer();
      }
      
      const imagePath = path.join(outputsDir, `page-${i + 1}-${Date.now()}.${format}`);
      fs.writeFileSync(imagePath, processedImage);
      imageUrls.push(`/download/${path.basename(imagePath)}`);
    }

    await cleanupFiles([req.file.path]);

    res.json({
      success: true,
      downloadUrls: imageUrls,
      pageCount: pages.length,
      format: format
    });
  } catch (error) {
    console.error('PDF to JPG error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Word to PDF
app.post('/api/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!['.doc', '.docx'].includes(fileExt)) {
      return res.status(400).json({ error: 'Only DOC and DOCX files are allowed' });
    }

    // For now, return a message that this feature requires LibreOffice
    // In production, you'd use LibreOffice or pandoc for conversion
    res.status(501).json({
      error: 'Word to PDF conversion requires LibreOffice. Please install it or use the desktop version.',
      comingSoon: true
    });
  } catch (error) {
    console.error('Word to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 13. PowerPoint to PDF
app.post('/api/ppt-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!['.ppt', '.pptx'].includes(fileExt)) {
      return res.status(400).json({ error: 'Only PPT and PPTX files are allowed' });
    }

    res.status(501).json({
      error: 'PowerPoint to PDF conversion requires LibreOffice. Please install it or use the desktop version.',
      comingSoon: true
    });
  } catch (error) {
    console.error('PPT to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 14. Excel to PDF
app.post('/api/excel-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!['.xls', '.xlsx'].includes(fileExt)) {
      return res.status(400).json({ error: 'Only XLS and XLSX files are allowed' });
    }

    res.status(501).json({
      error: 'Excel to PDF conversion requires LibreOffice. Please install it or use the desktop version.',
      comingSoon: true
    });
  } catch (error) {
    console.error('Excel to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 15. PDF to Word (Basic text extraction)
app.post('/api/pdf-to-word', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPages();
    
    let fullText = '';
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n\n--- Page ${i + 1} ---\n\n${pageText}`;
    }

    // Create a simple DOCX-like file (HTML format that Word can open)
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Converted PDF</title>
</head>
<body>
  ${fullText.split('\n').map(line => `<p>${line}</p>`).join('')}
</body>
</html>`;

    const outputPath = path.join(outputsDir, `converted-${Date.now()}.docx.html`);
    fs.writeFileSync(outputPath, htmlContent);

    await cleanupFiles([req.file.path]);

    res.json({
      success: true,
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'converted.docx.html',
      pageCount: pages.length,
      note: 'Open in Microsoft Word and save as .docx format'
    });
  } catch (error) {
    console.error('PDF to Word error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 16. HTML to PDF
app.post('/api/html-to-pdf', async (req, res) => {
  try {
    const { url, html } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({ error: 'Please provide URL or HTML content' });
    }

    res.status(501).json({
      error: 'HTML to PDF requires a headless browser (Puppeteer/Playwright). Coming soon!',
      comingSoon: true
    });
  } catch (error) {
    console.error('HTML to PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 17. Organize PDF (Reorder pages)
app.post('/api/organize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { pageOrder } = req.body; // e.g., "3,1,2,4" - new order
    if (!pageOrder) {
      return res.status(400).json({ error: 'Please provide page order (e.g., 3,1,2,4)' });
    }

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    const orderArray = pageOrder.split(',').map(p => parseInt(p.trim()) - 1);
    const copiedPages = await newPdf.copyPages(pdf, orderArray);
    copiedPages.forEach(page => newPdf.addPage(page));

    const outputPath = path.join(outputsDir, `organized-${Date.now()}.pdf`);
    const outputBytes = await newPdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({
      success: true,
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'organized.pdf'
    });
  } catch (error) {
    console.error('Organize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 18. Sign PDF
app.post('/api/sign', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { page = 1, x = 100, y = 100, width = 150, height = 50 } = req.body;
    
    const pdfBytes = fs.readFileSync(req.files.file[0].path);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const targetPage = pdf.getPages()[parseInt(page) - 1];
    if (!targetPage) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    // If signature image provided
    if (req.files.signature) {
      const signatureBuffer = fs.readFileSync(req.files.signature[0].path);
      const signatureImage = await pdf.embedPng(signatureBuffer);
      targetPage.drawImage(signatureImage, {
        x: parseInt(x),
        y: parseInt(y),
        width: parseInt(width),
        height: parseInt(height)
      });
    } else {
      // Add text signature
      const helveticaFont = await pdf.embedFont(StandardFonts.HelveticaBold);
      targetPage.drawText('SIGNED', {
        x: parseInt(x),
        y: parseInt(y),
        size: 20,
        font: helveticaFont,
        color: rgb(1, 0, 0) // Red color
      });
    }

    const outputPath = path.join(outputsDir, `signed-${Date.now()}.pdf`);
    const outputBytes = await pdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles(req.files.file.map(f => f.path));
    if (req.files.signature) {
      await cleanupFiles(req.files.signature.map(f => f.path));
    }

    res.json({
      success: true,
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'signed.pdf'
    });
  } catch (error) {
    console.error('Sign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 19. Edit PDF (Add text annotation)
app.post('/api/edit', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { page = 1, text, x = 100, y = 100, size = 12, color = 'black' } = req.body;
    
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const targetPage = pdf.getPages()[parseInt(page) - 1];
    if (!targetPage) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const helveticaFont = await pdf.embedFont(StandardFonts.Helvetica);
    
    const colorMap = {
      'black': rgb(0, 0, 0),
      'red': rgb(1, 0, 0),
      'blue': rgb(0, 0, 1),
      'green': rgb(0, 1, 0),
      'yellow': rgb(1, 1, 0)
    };

    targetPage.drawText(text || 'Edited Text', {
      x: parseInt(x),
      y: parseInt(y),
      size: parseInt(size),
      font: helveticaFont,
      color: colorMap[color] || rgb(0, 0, 0)
    });

    const outputPath = path.join(outputsDir, `edited-${Date.now()}.pdf`);
    const outputBytes = await pdf.save();
    fs.writeFileSync(outputPath, outputBytes);

    await cleanupFiles([req.file.path]);

    res.json({
      success: true,
      downloadUrl: `/download/${path.basename(outputPath)}`,
      filename: 'edited.pdf'
    });
  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download endpoint
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(outputsDir, req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }, 60000);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from dist folder
app.use(express.static(path.join(__dirname, 'dist')));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

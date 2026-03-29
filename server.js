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
const PORT = process.env.PORT || 8080;

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

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const filePath = path.join(process.cwd(), 'app', 'captacao', 'CaptacaoClient.tsx');
  
  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: 'File not found at: ' + filePath });
    }
    
    const buffer = fs.readFileSync(filePath);
    
    // Check for UTF-16 LE BOM (FF FE) or UTF-16 BE BOM (FE FF)
    let encoding: string = 'utf8';
    let decodedContent = '';
    
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      encoding = 'utf16le-bom';
      decodedContent = buffer.slice(2).toString('utf16le');
    } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      encoding = 'utf16be-bom';
      // Swap bytes to read as LE in Node
      const swapped = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i += 2) {
        if (i + 1 < buffer.length) {
          swapped[i] = buffer[i + 1];
          swapped[i + 1] = buffer[i];
        }
      }
      decodedContent = swapped.slice(2).toString('utf16le');
    } else {
      // Check if it has null bytes indicating UTF-16 without BOM
      let nullCount = 0;
      for (let i = 0; i < Math.min(buffer.length, 100); i++) {
        if (buffer[i] === 0) nullCount++;
      }
      
      if (nullCount > 5) {
        encoding = 'utf16le-nobom';
        decodedContent = buffer.toString('utf16le');
      } else {
        // Try reading as latin1 (Windows-1252) which parses any byte sequence
        encoding = 'latin1';
        decodedContent = buffer.toString('latin1');
      }
    }
    
    // Check if the decoded content has typical JS/TS keywords
    const keywords = ['import', 'const', 'export', 'function', 'React', 'useClient', 'use client'];
    const isReadable = keywords.some(kw => decodedContent.includes(kw));
    
    if (isReadable) {
      // Write it back as UTF-8
      fs.writeFileSync(filePath, decodedContent, 'utf8');
      
      return NextResponse.json({
        success: true,
        detectedEncoding: encoding,
        message: 'File converted to UTF-8 successfully!',
        preview: decodedContent.substring(0, 500)
      });
    } else {
      // If the selected encoding didn't yield keywords, let's also try to just force-decode as latin1 or utf8
      // to see what it contains
      const utf8Try = buffer.toString('utf8');
      const latin1Try = buffer.toString('latin1');
      
      return NextResponse.json({
        success: false,
        message: 'Decoded content does not seem readable. Not overwriting yet.',
        detectedEncoding: encoding,
        bufferLength: buffer.length,
        hexHeader: buffer.slice(0, 32).toString('hex'),
        utf16lePreview: decodedContent.substring(0, 250),
        utf8Preview: utf8Try.substring(0, 250),
        latin1Preview: latin1Try.substring(0, 250)
      });
    }
    
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

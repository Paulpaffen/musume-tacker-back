import { Injectable } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OcrService {
  constructor(private prisma: PrismaService) { }

  async processImages(files: Array<Express.Multer.File>, userId: string) {
    console.log('OCR Service: processing', files.length, 'files', 'for user', userId);
    const results = [];

    // Fetch all user characters once for efficiency
    const userCharacters = await this.prisma.characterTraining.findMany({
      where: { userId },
      select: {
        id: true,
        characterName: true,
        identifierVersion: true,
      },
    });

    for (const file of files) {
      console.log('Processing file:', file.originalname, 'size:', file.size);
      const processedBuffer = await this.preprocessImage(file.buffer);
      console.log('Image preprocessed');
      const text = await this.extractText(processedBuffer);
      console.log('Text extracted:', text?.slice(0, 100));
      const parsedItems = this.parseResults(text);
      console.log('Parsed items:', parsedItems);

      // Match with database
      for (const item of parsedItems) {
        const match = this.matchCharacter(item.detectedName, userCharacters);
        console.log('Match for', item.detectedName, ':', match);

        let defaults = { trackType: 'TURF_MEDIUM', finalPlace: 1 };
        if (match.bestMatchId) {
          defaults = await this.getCharacterDefaults(match.bestMatchId);
        }

        results.push({
          ...item,
          ...match,
          defaults,
        });
      }
    }

    console.log('OCR Service: finished processing');
    return results;
  }

  private async getCharacterDefaults(characterId: string) {
    const runs = await this.prisma.run.findMany({
      where: { characterTrainingId: characterId },
      select: { trackType: true, finalPlace: true },
    });

    if (runs.length === 0) {
      return { trackType: 'TURF_MEDIUM', finalPlace: 1 };
    }

    // Calculate mode for trackType
    const trackCounts: Record<string, number> = {};
    let maxCount = 0;
    let modeTrack = 'TURF_MEDIUM';

    for (const run of runs) {
      trackCounts[run.trackType] = (trackCounts[run.trackType] || 0) + 1;
      if (trackCounts[run.trackType] > maxCount) {
        maxCount = trackCounts[run.trackType];
        modeTrack = run.trackType;
      }
    }

    // Calculate average for finalPlace
    const totalPlace = runs.reduce((sum, run) => sum + run.finalPlace, 0);
    const avgPlace = Math.max(1, Math.round(totalPlace / runs.length));

    return { trackType: modeTrack, finalPlace: avgPlace };
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .grayscale() // Convert to B&W
      .threshold(180) // Binarize to make text pop
      .resize({ width: 2000, withoutEnlargement: true }) // Upscale if too small, but limit max width
      .toBuffer();
  }

  private async extractText(buffer: Buffer): Promise<string> {
    const worker = await Tesseract.createWorker('eng');
    const {
      data: { text },
    } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  }

  private parseResults(text: string): any[] {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    const items = [];

    // Regex to find lines with score (e.g., "44,426 pts")
    // It might be on the same line as the name or separate
    const scoreRegex = /([\d,]+)\s*pts/i;

    // Simple heuristic:
    // If a line has a score, the name is likely at the beginning of that line
    // OR the previous line.

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const scoreMatch = line.match(scoreRegex);

      if (scoreMatch) {
        const scoreStr = scoreMatch[1].replace(/,/g, '');
        const score = parseInt(scoreStr, 10);

        // Try to get name from the same line, removing the score part
        let name = line.replace(scoreMatch[0], '').trim();

        // Remove common noise (Rank icons often read as garbage like "A+" or "O")
        // This is a basic cleanup, might need refinement
        name = name.replace(/^[A-Z]\+\s*/, '').trim();

        // If name is empty or too short, check previous line
        if (name.length < 3 && i > 0) {
          const prevLine = lines[i - 1].trim();
          // Heuristic: Previous line shouldn't be another score line
          if (!prevLine.match(scoreRegex)) {
            name = prevLine;
          }
        }

        // Clean up name further
        name = name.replace(/Witness to Legend|Dream Team/gi, '').trim();

        if (name && score) {
          items.push({ detectedName: name, score });
        }
      }
    }

    return items;
  }

  private matchCharacter(detectedName: string, userCharacters: any[]) {
    // Normalize detected name: lowercase
    const detectedLower = detectedName.toLowerCase();

    // Filter candidates based on bidirectional inclusion
    const candidates = userCharacters.filter((char) => {
      const charNameLower = char.characterName.toLowerCase();

      // Check 1: Detected name contains character name (e.g. "xs Gold Ship !,af" contains "gold ship")
      if (detectedLower.includes(charNameLower)) return true;

      // Check 2: Character name contains detected name (e.g. "Gold Ship" contains "gold")
      // We add a length check to avoid matching very short detected strings like "a" or "s" to everything
      if (detectedLower.length > 2 && charNameLower.includes(detectedLower)) return true;

      return false;
    });

    return {
      candidates,
      bestMatchId: candidates.length > 0 ? candidates[0].id : null,
    };
  }

  async processCharacterStatsImage(file: Express.Multer.File) {
    console.log('OCR Service: processing character stats image', file.originalname);

    // Try multiple preprocessing strategies
    const strategies = [
      // Strategy 1: Light preprocessing (works for high quality images)
      async () => {
        return await sharp(file.buffer)
          .grayscale()
          .normalize()
          .resize({ width: 2400, withoutEnlargement: true })
          .toBuffer();
      },
      // Strategy 2: Moderate preprocessing
      async () => {
        return await sharp(file.buffer)
          .grayscale()
          .normalize()
          .sharpen()
          .resize({ width: 2400, withoutEnlargement: true })
          .toBuffer();
      },
      // Strategy 3: Aggressive preprocessing (for low quality images)
      async () => {
        return await sharp(file.buffer)
          .grayscale()
          .normalize()
          .sharpen()
          .threshold(140) // Higher threshold to preserve more detail
          .resize({ width: 2400, withoutEnlargement: true })
          .toBuffer();
      },
    ];

    let bestResult = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0, rank: '' };
    let bestCount = 0;

    // Try each strategy and pick the one that finds the most stats
    for (let i = 0; i < strategies.length; i++) {
      console.log(`Trying preprocessing strategy ${i + 1}/${strategies.length}...`);
      const processedBuffer = await strategies[i]();
      const text = await this.extractTextDigitsOnly(processedBuffer);
      const result = this.parseCharacterStats(text);

      const count = [result.speed, result.stamina, result.power, result.guts, result.wit]
        .filter(v => v > 0).length;

      console.log(`Strategy ${i + 1} found ${count}/5 stats`);

      if (count > bestCount) {
        bestCount = count;
        bestResult = result;
      }

      // If we found all 5, no need to try other strategies
      if (count === 5) {
        console.log(`✅ Strategy ${i + 1} succeeded, using this result`);
        break;
      }
    }

    return bestResult;
  }

  private async extractTextDigitsOnly(buffer: Buffer): Promise<string> {
    const worker = await Tesseract.createWorker('eng');

    // Configure Tesseract to focus on digits
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789', // Only recognize digits
    });

    const {
      data: { text },
    } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  }

  private parseCharacterStats(text: string) {
    console.log('=== OCR STATS PARSING START ===');
    console.log('Raw text from Tesseract:', text);
    console.log('Text length:', text.length);

    const result = {
      speed: 0,
      stamina: 0,
      power: 0,
      guts: 0,
      wit: 0,
      rank: '', // User asked to ignore rank for now
    };

    // Regex to find numbers that look like stats (3 to 4 digits)
    // We use global flag to find all occurrences
    const statRegex = /\b(\d{3,4})\b/g;
    const allNumbers: number[] = [];
    const allNumbersBeforeFilter: number[] = [];

    let match;
    while ((match = statRegex.exec(text)) !== null) {
      const num = parseInt(match[1]);
      allNumbersBeforeFilter.push(num);
      // Filter: Stats are typically between 100 and 1500
      // This helps filter out noise like "55" from "SS" rank icons
      if (num >= 100 && num <= 1500) {
        allNumbers.push(num);
      }
    }

    console.log('Numbers found (before filter):', allNumbersBeforeFilter);
    console.log('Numbers found (after filter 100-1500):', allNumbers);

    // We expect at least 5 numbers for the 5 stats.
    // The order is standard: Speed, Stamina, Power, Guts, Wit.
    if (allNumbers.length >= 5) {
      // We take the first 5 numbers found. 
      // This assumes the image is cropped to the stats area or the stats are the first numbers appearing.
      result.speed = allNumbers[0];
      result.stamina = allNumbers[1];
      result.power = allNumbers[2];
      result.guts = allNumbers[3];
      result.wit = allNumbers[4];
      console.log('✅ Successfully parsed 5 stats:', result);
    } else {
      console.warn('❌ Could not find 5 stats numbers. Found only:', allNumbers.length);
      console.warn('This usually means OCR failed to read the numbers from the image');
    }

    console.log('=== OCR STATS PARSING END ===');
    return result;
  }
}

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

    // Preprocess image specifically for stats reading
    // We might need less aggressive thresholding or different settings
    const processedBuffer = await sharp(file.buffer)
      .grayscale()
      .resize({ width: 2000, withoutEnlargement: true })
      .toBuffer();

    const text = await this.extractText(processedBuffer);
    console.log('Extracted Text for Stats:', text);

    return this.parseCharacterStats(text);
  }

  private parseCharacterStats(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result = {
      speed: 0,
      stamina: 0,
      power: 0,
      guts: 0,
      wit: 0,
      rank: '',
    };

    // Regex for finding stats (e.g. "1089", "534")
    // We look for lines that might contain these numbers
    // Often they appear near keywords like "Speed", "Stamina"

    // Simple approach: Look for numbers in the text and try to map them based on order or proximity
    // Given the layout is usually fixed: Speed, Stamina, Power, Guts, Wit

    // Let's try to find lines that look like "Speed 1089" or just "1089" after "Speed"

    const statKeywords = ['Speed', 'Stamina', 'Power', 'Guts', 'Wit'];

    // Helper to extract number from a line or next line
    const findStat = (keyword: string) => {
      // Find line with keyword
      const index = lines.findIndex(l => l.toLowerCase().includes(keyword.toLowerCase()));
      if (index === -1) return 0;

      // Check same line for number
      const sameLineMatch = lines[index].match(/(\d{3,4})/);
      if (sameLineMatch) return parseInt(sameLineMatch[1]);

      // Check next line (often the value is below the label)
      if (index + 1 < lines.length) {
        const nextLineMatch = lines[index + 1].match(/(\d{3,4})/);
        if (nextLineMatch) return parseInt(nextLineMatch[1]);
      }

      return 0;
    };

    result.speed = findStat('Speed');
    result.stamina = findStat('Stamina');
    result.power = findStat('Power');
    result.guts = findStat('Guts');
    result.wit = findStat('Wit');

    // Rank parsing (e.g. "UG", "SS", "A+")
    // Usually appears near the top or as a large standalone text
    // We look for standard rank patterns
    const rankRegex = /\b(UG[1-9]?|SS\+|SS|S\+|S|A\+|A|B\+|B|C\+|C)\b/;
    for (const line of lines) {
      const match = line.match(rankRegex);
      if (match) {
        result.rank = match[1];
        break;
      }
    }

    return result;
  }
}

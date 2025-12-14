import { Injectable } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { SkillsService } from '../skills/skills.service';

@Injectable()
export class OcrService {
  constructor(
    private prisma: PrismaService,
    private skillsService: SkillsService,
  ) {}

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

      const count = [result.speed, result.stamina, result.power, result.guts, result.wit].filter(
        (v) => v > 0,
      ).length;

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
      rank: '',
    };

    // Remove all non-digit characters
    const digitsOnly = text.replace(/\D/g, '');
    console.log('Digits only:', digitsOnly);

    // Try to parse as concatenated numbers (e.g. "10895349154904812")
    // We expect 5 numbers of 3-4 digits each
    const allNumbers: number[] = [];

    // Strategy: Try to split the digit string into 5 groups
    // Each stat is typically 3-4 digits (100-1500 range)
    if (digitsOnly.length >= 15 && digitsOnly.length <= 20) {
      // Most likely we have 5 numbers concatenated
      // Try to intelligently split them

      // Approach: Scan through and try to identify valid 3-4 digit numbers
      let remaining = digitsOnly;
      while (remaining.length > 0 && allNumbers.length < 5) {
        // Try 4 digits first
        if (remaining.length >= 4) {
          const fourDigit = parseInt(remaining.substring(0, 4));
          if (fourDigit >= 100 && fourDigit <= 1500) {
            allNumbers.push(fourDigit);
            remaining = remaining.substring(4);
            continue;
          }
        }

        // Try 3 digits
        if (remaining.length >= 3) {
          const threeDigit = parseInt(remaining.substring(0, 3));
          if (threeDigit >= 100 && threeDigit <= 1500) {
            allNumbers.push(threeDigit);
            remaining = remaining.substring(3);
            continue;
          }
        }

        // If neither worked, skip this digit (noise)
        remaining = remaining.substring(1);
      }
    } else {
      // Fallback: Try to find individual numbers with word boundaries
      const statRegex = /\b(\d{3,4})\b/g;
      let match;
      while ((match = statRegex.exec(text)) !== null) {
        const num = parseInt(match[1]);
        if (num >= 100 && num <= 1500) {
          allNumbers.push(num);
        }
      }
    }

    console.log('Numbers found:', allNumbers);

    // We expect exactly 5 numbers for the 5 stats
    if (allNumbers.length >= 5) {
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

  async processCharacterSkillsImage(file: Express.Multer.File) {
    console.log('OCR Service: processing character skills image', file.originalname);

    // Preprocess image for text extraction
    const processedBuffer = await sharp(file.buffer)
      .grayscale()
      .normalize()
      .resize({ width: 2400, withoutEnlargement: true })
      .toBuffer();

    const text = await this.extractText(processedBuffer);
    console.log('Extracted Text for Skills:', text);

    const parsedSkills = await this.parseCharacterSkills(text);

    // Match detected skills with database
    const matchedSkills = await this.matchSkillsWithDatabase(parsedSkills.skills);

    return {
      uniqueSkillLevel: parsedSkills.uniqueSkillLevel,
      skills: matchedSkills,
    };
  }

  private async matchSkillsWithDatabase(
    detectedSkills: Array<{ name: string; isRare: boolean }>,
  ) {
    const allSkills = await this.prisma.skill.findMany();
    const matchedSkills: Array<{ name: string; isRare: boolean }> = [];

    for (const detected of detectedSkills) {
      // Try exact match first
      let matchedSkill = allSkills.find(
        (s) => s.name.toLowerCase() === detected.name.toLowerCase(),
      );

      // Try fuzzy match if no exact match
      if (!matchedSkill) {
        matchedSkill = this.findBestSkillMatch(detected.name, allSkills);
      }

      if (matchedSkill) {
        // Use database skill data
        matchedSkills.push({
          name: matchedSkill.name, // Use corrected name from DB
          isRare: matchedSkill.isRare, // Use isRare from DB
        });
        console.log(`✅ Matched: "${detected.name}" -> "${matchedSkill.name}" (rare: ${matchedSkill.isRare})`);
      } else {
        // Keep original detected skill
        matchedSkills.push(detected);
        console.log(`⚠️ No match for: "${detected.name}" - keeping original`);
      }
    }

    return matchedSkills;
  }

  private findBestSkillMatch(detectedName: string, dbSkills: any[]): any | null {
    const detectedLower = detectedName.toLowerCase();
    let bestMatch: any = null;
    let bestScore = 0;

    for (const skill of dbSkills) {
      const skillLower = skill.name.toLowerCase();

      // Calculate simple similarity score
      // 1. Check if detected contains skill name or vice versa
      if (detectedLower.includes(skillLower) || skillLower.includes(detectedLower)) {
        const lengthRatio = Math.min(detectedLower.length, skillLower.length) / 
                           Math.max(detectedLower.length, skillLower.length);
        
        if (lengthRatio > bestScore) {
          bestScore = lengthRatio;
          bestMatch = skill;
        }
      }

      // 2. Calculate Levenshtein similarity for close matches
      const similarity = this.calculateSimilarity(detectedLower, skillLower);
      if (similarity > 0.8 && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = skill;
      }
    }

    // Only return match if score is high enough (80% similarity)
    return bestScore >= 0.8 ? bestMatch : null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async parseCharacterSkills(text: string) {
    console.log('=== OCR SKILLS PARSING START ===');
    console.log('Raw text from Tesseract:', text);

    const result = {
      uniqueSkillLevel: 0,
      skills: [] as Array<{ name: string; isRare: boolean }>,
    };

    // Extract unique skill level (look for "Lvl", "Level" followed by a number)
    // More robust regex to catch variations
    const lvlMatch = text.match(/(?:Lvl?|Level)\s*[:\-]?\s*(\d+)/i);
    if (lvlMatch) {
      const level = parseInt(lvlMatch[1]);
      if (level >= 1 && level <= 6) {
        result.uniqueSkillLevel = level;
        console.log('✅ Found unique skill level:', level);
      }
    }

    // Extract skill names
    // The image has 2 columns, OCR reads them as one line with skills separated
    // Pattern indicators of column separation:
    // - Letters followed by ") " or ") B" or ") O" (rarity indicators)
    // - Multiple capital letters in sequence (new skill starting)
    // - Pattern: "skill1 ) skill2" or "skill1 ) B skill2" or "skill1 O skill2"

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const skipPatterns = [
      /^(?:Lvl?|Level)\s*[:\-]?\s*\d+$/i,
      /^\d+$/,
      /^[0-9\s]+$/,
      /^[©®™]+$/,
      /^Venus\s*x/i, // Skip character name line
    ];

    for (const line of lines) {
      // Skip if matches any skip pattern
      if (skipPatterns.some((pattern) => pattern.test(line))) {
        continue;
      }

      // Split line into potential skills using column separators
      // First try to split by "|" which is a clear column separator
      let skills: string[] = [];

      if (line.includes('|')) {
        // Split by | - it's always a column separator
        skills = line
          .split('|')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else {
        // Fallback to other patterns: ") ", ") B ", ") O ", " O ", " B "
        const splitPattern =
          /\s*\)\s*(?=[A-Z])|(?<=[a-z])\s+(?=[BO]\s+[A-Z])|(?<=[a-z])\s+O\s+(?=[A-Z])|(?<=[a-z])\s+B\s+(?=[A-Z])/g;

        const parts = line.split(splitPattern);

        if (parts.length > 1) {
          skills = parts;
        } else {
          // Last resort: try to detect by parenthesis and capital letters
          const manualSplit = line.split(/\s*\)\s*(?=[A-Z])/);
          if (manualSplit.length > 1) {
            skills = manualSplit;
          } else {
            // Final fallback: detect concatenated skills (e.g., "Professor of Curvature Corner Recovery")
            // Split when a lowercase letter is followed directly by an uppercase letter after a space
            // Pattern: "word " followed by capital letter (typical skill name start)
            const concatenatedSplit = line.split(/(?<=[a-z])\s+(?=[A-Z][a-z])/);
            if (concatenatedSplit.length > 1) {
              skills = concatenatedSplit;
            } else {
              // Keep as single skill
              skills = [line];
            }
          }
        }
      }

      for (let skillRaw of skills) {
        // Clean up the skill name
        let skillName = skillRaw
          .replace(/[©®™]/g, '') // Remove special characters
          .replace(/\s*\)\s*$/, '') // Remove trailing )
          .replace(/^\s*[BO]\s+/, '') // Remove leading B or O (rarity markers)
          .replace(/\s*[BO]\s*$/, '') // Remove trailing B or O
          .replace(/\[?\d+\]?/g, '') // Remove numbers like [7], 3, [2]
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // Remove common OCR artifacts
        skillName = skillName
          .replace(/\s*[|j]\s*$/i, '') // Remove trailing | or j
          .replace(/^[|j]\s*/i, '') // Remove leading | or j
          .replace(/\s*©\s*$/i, '') // Remove trailing ©
          .trim();

        // Only add if it looks like a skill name (has letters and reasonable length)
        if (skillName.length >= 3 && /[a-zA-Z]/.test(skillName)) {
          result.skills.push({
            name: skillName,
            isRare: false, // Default to false, user will change
          });
        }
      }
    }

    // Deduplicate skills by name (case-insensitive)
    // Keep the first occurrence
    const uniqueSkills = Array.from(
      new Map(result.skills.map((s) => [s.name.toLowerCase(), s])).values(),
    );
    result.skills = uniqueSkills;

    console.log('✅ Found skills (after deduplication):', result.skills);
    console.log('=== OCR SKILLS PARSING END ===');
    return result;
  }
}

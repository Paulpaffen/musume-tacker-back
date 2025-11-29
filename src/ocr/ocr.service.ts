
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
                results.push({
                    ...item,
                    ...match,
                });
            }
        }

        console.log('OCR Service: finished processing');
        return results;
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
        const { data: { text } } = await worker.recognize(buffer);
        await worker.terminate();
        return text;
    }

    private parseResults(text: string): any[] {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
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
        const candidates = userCharacters.filter(char => {
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
}

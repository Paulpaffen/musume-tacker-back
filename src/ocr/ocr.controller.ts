import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @UseInterceptors(FilesInterceptor('files'))
  async scanImages(@UploadedFiles() files: Array<Express.Multer.File>, @Request() req) {
    console.log('OCR Controller: received', files?.length || 0, 'files');
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.ocrService.processImages(files, req.user.id);
  }

  @Post('scan-stats')
  @UseInterceptors(FilesInterceptor('file'))
  async scanStats(@UploadedFiles() files: Array<Express.Multer.File>) {
    // FilesInterceptor returns an array even for single file field if configured,
    // but usually FileInterceptor is for single.
    // Let's stick to FilesInterceptor to be safe or use files[0]

    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    return this.ocrService.processCharacterStatsImage(files[0]);
  }

  @Post('scan-skills')
  @UseInterceptors(FilesInterceptor('file'))
  async scanSkills(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    return this.ocrService.processCharacterSkillsImage(files[0]);
  }
}

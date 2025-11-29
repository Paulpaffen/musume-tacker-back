import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
    constructor(private readonly ocrService: OcrService) { }

    @Post('scan')
    @UseInterceptors(FilesInterceptor('files'))
    async scanImages(@UploadedFiles() files: Array<Express.Multer.File>) {
        console.log('OCR Controller: received', files?.length || 0, 'files');
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        return this.ocrService.processImages(files);
    }
}

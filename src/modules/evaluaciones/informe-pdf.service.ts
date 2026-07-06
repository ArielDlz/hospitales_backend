import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import {
  ACCENT_COLOR,
  BRAND_COLOR,
  COMENTARIO_BOX_PADDING_PT,
  COMENTARIO_EXTRA_INSET_PT,
  COMENTARIO_SECTION_TITLE,
  DEFAULT_LOGO_URL,
  ESPECIALISTA_RESPONSABLE_LABEL,
  HEADER_ORG_LINE,
  HEADER_REPORT_SUBTITLE,
  HEADER_REPORT_TITLE,
  MARGIN_PT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PAGE_NUMBER_BOTTOM_OFFSET_PT,
  RESULTADO_SECTION_TITLE,
  SIGNATURE_BLOCK_HEIGHT_PT,
  SIGNATURE_LINE_WIDTH_RATIO,
  WATERMARK_OPACITY,
  WATERMARK_SIZE_PT,
} from './informe-pdf.constants';
import {
  formatFechaInformeEspanol,
  resolveResultadoPerfilKey,
  RESULTADO_PERFIL_OPTIONS,
} from './informe-pdf.utils';

export interface InformePdfInput {
  nombre: string;
  apellidos: string;
  registroHospital: string;
  emailEvaluador: string;
  comentario: string;
  veredictoEtiqueta: string;
  veredictoCodigo?: string;
  fechaInforme?: Date;
  firmaUrl?: string;
  nombreFirmante?: string;
}

@Injectable()
export class InformePdfService {
  private readonly logoUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.logoUrl =
      this.configService.get<string>('PSIQUE_LOGO_URL') ?? DEFAULT_LOGO_URL;
  }

  async buildPdf(data: InformePdfInput): Promise<Buffer> {
    const logoBuffer = await this.fetchImageBuffer(
      this.logoUrl,
      'No se pudo cargar el logo para el informe PDF',
    );
    const firmaBuffer =
      data.firmaUrl?.trim() && data.nombreFirmante?.trim()
        ? await this.fetchImageBuffer(
            data.firmaUrl,
            'No se pudo cargar la firma para el informe PDF',
          )
        : null;
    const nombreCompleto = `${data.nombre} ${data.apellidos}`.trim();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: true,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentWidth = PAGE_WIDTH - 2 * MARGIN_PT;
      const contentX = MARGIN_PT;
      const colWidth = contentWidth / 12;
      const bodyBottomLimit =
        PAGE_HEIGHT -
        MARGIN_PT -
        SIGNATURE_BLOCK_HEIGHT_PT -
        PAGE_NUMBER_BOTTOM_OFFSET_PT -
        10;

      let bodyStartY = 0;

      const drawPageChrome = () => {
        doc.save();
        doc
          .lineWidth(1)
          .strokeColor(BRAND_COLOR)
          .rect(MARGIN_PT, MARGIN_PT, contentWidth, PAGE_HEIGHT - 2 * MARGIN_PT)
          .stroke();

        const wmX = (PAGE_WIDTH - WATERMARK_SIZE_PT) / 2;
        const wmY = (PAGE_HEIGHT - WATERMARK_SIZE_PT) / 2;
        doc.save();
        doc.opacity(WATERMARK_OPACITY);
        doc.image(logoBuffer, wmX, wmY, {
          width: WATERMARK_SIZE_PT,
          height: WATERMARK_SIZE_PT,
          fit: [WATERMARK_SIZE_PT, WATERMARK_SIZE_PT],
          align: 'center',
          valign: 'center',
        });
        doc.restore();
        doc.restore();
      };

      const drawHeader = (): number => {
        const headerTop = MARGIN_PT + 10;
        const leftX = contentX;
        const leftWidth = colWidth * 2;
        const centerX = contentX + colWidth * 2;
        const centerWidth = colWidth * 8;
        const rightX = contentX + colWidth * 10;
        const rightWidth = colWidth * 2;

        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(BRAND_COLOR)
          .text('EVALUACIONES\nPSICOLÓGICAS', leftX + 6, headerTop + 6, {
            width: leftWidth - 12,
            align: 'center',
            lineGap: 1,
          });

        const stampLineY = headerTop + 32;
        const stampPad = 10;
        doc
          .moveTo(leftX + stampPad, stampLineY)
          .lineTo(leftX + leftWidth - stampPad, stampLineY)
          .lineWidth(0.5)
          .strokeColor(BRAND_COLOR)
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(5.5)
          .fillColor(BRAND_COLOR)
          .text('— por Psique y Cultura —', leftX + 6, stampLineY - 5, {
            width: leftWidth - 12,
            align: 'center',
          });

        let centerY = headerTop + 2;
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(BRAND_COLOR)
          .text(HEADER_ORG_LINE, centerX, centerY, {
            width: centerWidth,
            align: 'center',
          });

        centerY = doc.y + 3;
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(BRAND_COLOR)
          .text(HEADER_REPORT_TITLE, centerX, centerY, {
            width: centerWidth,
            align: 'center',
          });

        centerY = doc.y + 2;
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(BRAND_COLOR)
          .text(HEADER_REPORT_SUBTITLE, centerX, centerY, {
            width: centerWidth,
            align: 'center',
          });

        centerY = doc.y + 8;
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(BRAND_COLOR)
          .text(`No. Registro: ${data.registroHospital}`, centerX, centerY, {
            width: centerWidth,
            align: 'center',
          });

        centerY = doc.y + 5;
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(ACCENT_COLOR)
          .text(nombreCompleto, centerX, centerY, {
            width: centerWidth,
            align: 'center',
          });

        const logoSize = Math.min(rightWidth - 12, 72);
        doc.image(
          logoBuffer,
          rightX + (rightWidth - logoSize) / 2,
          headerTop + 4,
          {
            fit: [logoSize, logoSize],
            align: 'center',
            valign: 'center',
          },
        );

        const headerBottom = Math.max(doc.y, headerTop + logoSize + 8);
        const headerLineY = headerBottom + 10;
        doc
          .moveTo(contentX, headerLineY)
          .lineTo(contentX + contentWidth, headerLineY)
          .lineWidth(1)
          .strokeColor(BRAND_COLOR)
          .stroke();

        return headerLineY + 16;
      };

      const setupPage = () => {
        drawPageChrome();
        bodyStartY = drawHeader();
      };

      doc.on('pageAdded', () => {
        setupPage();
      });

      setupPage();

      let y = bodyStartY;

      const ensureSpace = (needed: number) => {
        if (y + needed > bodyBottomLimit) {
          doc.addPage();
          y = bodyStartY;
        }
      };

      doc.font('Helvetica').fontSize(11).fillColor('#000000');

      const evaluadorLine = `Nombre del evaluador: ${data.emailEvaluador}`;
      ensureSpace(16);
      doc.text(evaluadorLine, contentX, y, { width: contentWidth });
      y = doc.y + 16;

      y = this.drawComentarioSection(
        doc,
        contentX,
        y,
        contentWidth,
        data.comentario,
        () => bodyStartY,
        bodyBottomLimit,
      );

      const resultadoKey = resolveResultadoPerfilKey(
        data.veredictoCodigo,
        data.veredictoEtiqueta,
      );
      const fechaInforme = data.fechaInforme ?? new Date();
      const resultadoSectionHeight = 150;

      ensureSpace(resultadoSectionHeight);
      y = this.drawResultadoPerfilSection(
        doc,
        contentX,
        y,
        contentWidth,
        resultadoKey,
        fechaInforme,
      );

      ensureSpace(90);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(BRAND_COLOR)
        .text(ESPECIALISTA_RESPONSABLE_LABEL, contentX, y, {
          width: contentWidth,
          align: 'center',
        });
      y = doc.y + 10;

      const signatureLineHalfWidth = (contentWidth * SIGNATURE_LINE_WIDTH_RATIO) / 2;
      const signatureLineCenterX = contentX + contentWidth / 2;

      if (firmaBuffer && data.nombreFirmante) {
        const signatureImageWidth = contentWidth * 0.28;
        const signatureImageHeight = 44;
        const signatureImageX =
          contentX + (contentWidth - signatureImageWidth) / 2;

        ensureSpace(signatureImageHeight + 36);
        doc.image(firmaBuffer, signatureImageX, y, {
          fit: [signatureImageWidth, signatureImageHeight],
          align: 'center',
          valign: 'center',
        });
        y += signatureImageHeight + 6;

        const signatureLineY = y;
        doc
          .moveTo(signatureLineCenterX - signatureLineHalfWidth, signatureLineY)
          .lineTo(signatureLineCenterX + signatureLineHalfWidth, signatureLineY)
          .lineWidth(0.5)
          .strokeColor(BRAND_COLOR)
          .stroke();

        y = signatureLineY + 8;
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(BRAND_COLOR)
          .text(data.nombreFirmante, contentX, y, {
            width: contentWidth,
            align: 'center',
          });
      } else {
        y += SIGNATURE_BLOCK_HEIGHT_PT - 48;
        const signatureLineY = Math.min(y, PAGE_HEIGHT - MARGIN_PT - 24);
        doc
          .moveTo(signatureLineCenterX - signatureLineHalfWidth, signatureLineY)
          .lineTo(signatureLineCenterX + signatureLineHalfWidth, signatureLineY)
          .lineWidth(0.5)
          .strokeColor(BRAND_COLOR)
          .stroke();
      }

      this.drawPageNumbers(doc, contentX, contentWidth);

      doc.end();
    });
  }

  private drawComentarioSection(
    doc: InstanceType<typeof PDFDocument>,
    contentX: number,
    y: number,
    contentWidth: number,
    comentario: string,
    getBodyStartY: () => number,
    bodyBottomLimit: number,
  ): number {
    const boxX = contentX + COMENTARIO_EXTRA_INSET_PT;
    const boxWidth = contentWidth - 2 * COMENTARIO_EXTRA_INSET_PT;
    const textX = boxX + COMENTARIO_BOX_PADDING_PT;
    const textWidth = boxWidth - 2 * COMENTARIO_BOX_PADDING_PT;
    const textOptions = {
      width: textWidth,
      align: 'justify' as const,
      lineGap: 5,
    };
    const gapAfterSection = 24;

    let sectionY = y;
    if (sectionY + 36 > bodyBottomLimit) {
      doc.addPage();
      sectionY = getBodyStartY();
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(BRAND_COLOR)
      .text(COMENTARIO_SECTION_TITLE, contentX, sectionY, {
        width: contentWidth,
        align: 'center',
      });

    let segmentTopY = doc.y + 10;
    let remaining = comentario.trim();

    while (remaining.length > 0) {
      this.applyComentarioTextStyle(doc);

      const maxTextHeight =
        bodyBottomLimit - segmentTopY - 2 * COMENTARIO_BOX_PADDING_PT;
      if (maxTextHeight <= 12) {
        doc.addPage();
        segmentTopY = getBodyStartY();
        continue;
      }

      const { chunk, nextIndex } = this.sliceTextToHeight(
        doc,
        remaining,
        textOptions,
        maxTextHeight,
      );
      const chunkHeight = doc.heightOfString(chunk, textOptions);
      const segmentHeight = chunkHeight + 2 * COMENTARIO_BOX_PADDING_PT;

      if (segmentTopY + segmentHeight > bodyBottomLimit) {
        doc.addPage();
        segmentTopY = getBodyStartY();
        continue;
      }

      this.applyComentarioTextStyle(doc);
      doc
        .lineWidth(0.75)
        .strokeColor('#000000')
        .rect(boxX, segmentTopY, boxWidth, segmentHeight)
        .stroke();

      doc.text(chunk, textX, segmentTopY + COMENTARIO_BOX_PADDING_PT, textOptions);

      remaining = remaining.slice(nextIndex).trimStart();
      if (remaining.length > 0) {
        doc.addPage();
        segmentTopY = getBodyStartY();
      } else {
        return segmentTopY + segmentHeight + gapAfterSection;
      }
    }

    return segmentTopY + gapAfterSection;
  }

  private applyComentarioTextStyle(
    doc: InstanceType<typeof PDFDocument>,
  ): void {
    doc.font('Helvetica').fontSize(11).fillColor(BRAND_COLOR);
  }

  private sliceTextToHeight(
    doc: InstanceType<typeof PDFDocument>,
    text: string,
    options: { width: number; align: 'justify'; lineGap: number },
    maxHeight: number,
  ): { chunk: string; nextIndex: number } {
    if (doc.heightOfString(text, options) <= maxHeight) {
      return { chunk: text, nextIndex: text.length };
    }

    let low = 0;
    let high = text.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = text.slice(0, mid);
      if (doc.heightOfString(candidate, options) <= maxHeight) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best >= text.length) {
      return { chunk: text, nextIndex: text.length };
    }

    let cut = best;
    const lastSpace = text.lastIndexOf(' ', cut);
    const lastNewline = text.lastIndexOf('\n', cut);
    const breakAt = Math.max(lastSpace, lastNewline);
    if (breakAt > 0 && breakAt > cut * 0.55) {
      cut = breakAt;
    }

    return { chunk: text.slice(0, cut).trimEnd(), nextIndex: cut };
  }

  private drawResultadoPerfilSection(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    y: number,
    width: number,
    selectedKey: ReturnType<typeof resolveResultadoPerfilKey>,
    fecha: Date,
  ): number {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(BRAND_COLOR)
      .text(RESULTADO_SECTION_TITLE, x, y, { width, align: 'center' });

    const boxesTop = doc.y + 14;
    const sectionWidth = width * 0.88;
    const sectionX = x + (width - sectionWidth) / 2;
    const gap = 12;
    const boxCount = RESULTADO_PERFIL_OPTIONS.length;
    const boxWidth = (sectionWidth - gap * (boxCount - 1)) / boxCount;
    const boxHeight = 28;
    const labelAreaHeight = 24;

    RESULTADO_PERFIL_OPTIONS.forEach((option, index) => {
      const boxX = sectionX + index * (boxWidth + gap);
      const labelY = boxesTop;

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(BRAND_COLOR)
        .text(option.label, boxX, labelY, {
          width: boxWidth,
          align: 'center',
          lineGap: 0.5,
        });

      const boxY = boxesTop + labelAreaHeight;
      const isSelected = option.key === selectedKey;

      if (isSelected) {
        doc
          .save()
          .fillColor(option.fillColor)
          .rect(boxX, boxY, boxWidth, boxHeight)
          .fill()
          .restore();
      }

      doc
        .lineWidth(0.75)
        .strokeColor('#000000')
        .rect(boxX, boxY, boxWidth, boxHeight)
        .stroke();
    });

    const afterBoxesY = boxesTop + labelAreaHeight + boxHeight + 22;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BRAND_COLOR)
      .text(formatFechaInformeEspanol(fecha), x, afterBoxesY, {
        width,
        align: 'center',
      });

    return doc.y + 20;
  }

  private drawPageNumbers(
    doc: InstanceType<typeof PDFDocument>,
    contentX: number,
    contentWidth: number,
  ): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      doc.switchToPage(pageIndex);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(BRAND_COLOR)
        .text(
          `Página ${pageIndex + 1} de ${totalPages}`,
          contentX,
          PAGE_HEIGHT - MARGIN_PT - PAGE_NUMBER_BOTTOM_OFFSET_PT,
          { width: contentWidth, align: 'center' },
        );
    }
  }

  private async fetchImageBuffer(
    url: string,
    errorMessage: string,
  ): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException(errorMessage);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

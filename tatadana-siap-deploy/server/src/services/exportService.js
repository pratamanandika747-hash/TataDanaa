/**
 * Export Generator Service for TataDana
 * Generates high-fidelity PDF and Excel (.xlsx) financial reports.
 * Supports Supabase Storage with Signed URLs (24-hour expiry) & direct streaming fallback.
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { formatRupiah } from './currencyParser.js';
import { formatWIBDate, getNowWIB, toWIBISOString } from '../utils/timezone.js';
import { supabase, config } from '../config/index.js';
import { inMemoryStore } from '../store/inMemoryStore.js';

export class ExportService {
  /**
   * Generate PDF financial statement buffer
   * @param {object} params
   * @returns {Promise<Buffer>}
   */
  async generatePdf({ user, transactions, summary, dateRange = 'Semua Periode' }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Laporan Keuangan TataDana - ${user.full_name}`,
            Author: 'TataDana Fintech Engine'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- 1. HEADER (Orange Theme #FF5B00) ---
        doc.rect(40, 40, 515, 60).fill('#FF5B00');

        doc.fillColor('#FFFFFF')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('TataDana', 55, 52);

        doc.fontSize(10)
          .font('Helvetica')
          .text('Laporan Keuangan Pribadi Terpadu', 55, 78);

        doc.fontSize(9)
          .text(`Waktu Cetak: ${formatWIBDate(getNowWIB(), true)}`, 350, 65, { align: 'right', width: 190 });

        // --- 2. USER INFO & FILTER METADATA ---
        doc.moveDown(3);
        doc.fillColor('#1F2937')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`Nama Pengguna: `, 40, 115, { continued: true })
          .font('Helvetica')
          .text(`${user.full_name} (${user.email || user.phone_number})`);

        doc.font('Helvetica-Bold')
          .text(`Periode Laporan: `, 40, 130, { continued: true })
          .font('Helvetica')
          .text(dateRange);

        // --- 3. METRICS SUMMARY CARDS ---
        const startY = 155;
        const cardWidth = 160;
        const cardHeight = 50;

        // Card 1: Total Pemasukan
        doc.rect(40, startY, cardWidth, cardHeight).fillAndStroke('#F0FDF4', '#86EFAC');
        doc.fillColor('#166534').fontSize(8).font('Helvetica-Bold').text('TOTAL PEMASUKAN', 50, startY + 10);
        doc.fillColor('#15803D').fontSize(12).text(formatRupiah(summary.totalIncome || 0), 50, startY + 26);

        // Card 2: Total Pengeluaran
        doc.rect(215, startY, cardWidth, cardHeight).fillAndStroke('#FEF2F2', '#FECACA');
        doc.fillColor('#991B1B').fontSize(8).font('Helvetica-Bold').text('TOTAL PENGELUARAN', 225, startY + 10);
        doc.fillColor('#B91C1C').fontSize(12).text(formatRupiah(summary.totalExpense || 0), 225, startY + 26);

        // Card 3: Arus Kas Bersih (Net Cashflow)
        const netFlow = (summary.totalIncome || 0) - (summary.totalExpense || 0);
        const netBg = netFlow >= 0 ? '#EFF6FF' : '#FEF2F2';
        const netBorder = netFlow >= 0 ? '#93C5FD' : '#FECACA';
        const netText = netFlow >= 0 ? '#1D4ED8' : '#B91C1C';

        doc.rect(390, startY, cardWidth, cardHeight).fillAndStroke(netBg, netBorder);
        doc.fillColor(netText).fontSize(8).font('Helvetica-Bold').text('ARUS KAS BERSIH', 400, startY + 10);
        doc.fillColor(netText).fontSize(12).text(formatRupiah(netFlow), 400, startY + 26);

        // --- 4. TRANSACTIONS TABLE HEADER ---
        let tableY = startY + 70;
        doc.rect(40, tableY, 515, 22).fill('#374151');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        doc.text('TANGGAL (WIB)', 45, tableY + 6, { width: 95 });
        doc.text('TIPE', 145, tableY + 6, { width: 65 });
        doc.text('KATEGORI', 215, tableY + 6, { width: 95 });
        doc.text('NOMINAL', 315, tableY + 6, { width: 85, align: 'right' });
        doc.text('CATATAN / STRUK', 415, tableY + 6, { width: 135 });

        // --- 5. ROWS ---
        tableY += 24;
        transactions.forEach((tx, index) => {
          // Check for page overflow
          if (tableY > 740) {
            doc.addPage();
            tableY = 50;
            // Redraw Header on new page
            doc.rect(40, tableY, 515, 20).fill('#374151');
            doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
            doc.text('TANGGAL (WIB)', 45, tableY + 6, { width: 95 });
            doc.text('TIPE', 145, tableY + 6, { width: 65 });
            doc.text('KATEGORI', 215, tableY + 6, { width: 95 });
            doc.text('NOMINAL', 315, tableY + 6, { width: 85, align: 'right' });
            doc.text('CATATAN / STRUK', 415, tableY + 6, { width: 135 });
            tableY += 22;
          }

          const isEven = index % 2 === 0;
          if (isEven) {
            doc.rect(40, tableY - 2, 515, 20).fill('#F9FAFB');
          }

          const isIncome = tx.type === 'pemasukan';
          const typeColor = isIncome ? '#15803D' : '#B91C1C';
          const dateStr = formatWIBDate(tx.date || tx.created_at, false);

          doc.fillColor('#374151').fontSize(8).font('Helvetica');
          doc.text(dateStr, 45, tableY + 3, { width: 95 });

          doc.fillColor(typeColor).font('Helvetica-Bold');
          doc.text(isIncome ? 'Pemasukan' : 'Pengeluaran', 145, tableY + 3, { width: 65 });

          doc.fillColor('#4B5563').font('Helvetica');
          doc.text(tx.category_name || 'Lain-lain', 215, tableY + 3, { width: 95 });

          doc.fillColor(typeColor).font('Helvetica-Bold');
          doc.text(formatRupiah(tx.amount), 315, tableY + 3, { width: 85, align: 'right' });

          doc.fillColor('#6B7280').font('Helvetica');
          const noteText = tx.notes || (tx.merchant_name ? `Struk: ${tx.merchant_name}` : '-');
          doc.text(noteText.slice(0, 32), 415, tableY + 3, { width: 135 });

          tableY += 20;
        });

        // --- 6. FOOTER ---
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fillColor('#9CA3AF').fontSize(8)
            .text(`TataDana © 2026 • Laporan Finansial Otomatis • Halaman ${i + 1} dari ${pageCount}`, 40, 800, { align: 'center', width: 515 });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate Excel (.xlsx) financial workbook buffer
   * @param {object} params
   * @returns {Promise<Buffer>}
   */
  async generateExcel({ user, transactions, summary, dateRange = 'Semua Periode' }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TataDana System';
    workbook.created = getNowWIB();

    // Sheet 1: Transaksi Keuangan
    const sheet = workbook.addWorksheet('Daftar Transaksi', {
      properties: { tabColor: { argb: 'FFFF5B00' } }
    });

    // Title Row
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LAPORAN TRANSAKSI TATADANA — ${user.full_name.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5B00' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Metadata Row
    sheet.getCell('A2').value = `Periode: ${dateRange} | Dicetak: ${formatWIBDate(getNowWIB(), true)}`;
    sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };

    // Columns Definition
    sheet.getRow(4).values = [
      'ID Transaksi',
      'Tanggal (WIB)',
      'Tipe',
      'Kategori',
      'Nominal (IDR)',
      'Dompet / Rekening',
      'Catatan / Merchant'
    ];
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    sheet.getRow(4).height = 24;

    sheet.columns = [
      { key: 'id', width: 22 },
      { key: 'date', width: 24 },
      { key: 'type', width: 16 },
      { key: 'category', width: 22 },
      { key: 'amount', width: 20 },
      { key: 'wallet', width: 20 },
      { key: 'notes', width: 35 }
    ];

    transactions.forEach(tx => {
      const isIncome = tx.type === 'pemasukan';
      const row = sheet.addRow({
        id: tx.id,
        date: formatWIBDate(tx.date || tx.created_at, true),
        type: isIncome ? 'Pemasukan' : 'Pengeluaran',
        category: tx.category_name || 'Lain-lain',
        amount: Number(tx.amount),
        wallet: tx.wallet_name || 'Dompet Utama',
        notes: tx.notes || (tx.merchant_name ? `Struk: ${tx.merchant_name}` : '')
      });

      // Format currency column
      const amountCell = row.getCell(5);
      amountCell.numFmt = '"Rp "#,##0';
      if (isIncome) {
        amountCell.font = { color: { argb: 'FF15803D' }, bold: true };
      } else {
        amountCell.font = { color: { argb: 'FFB91C1C' }, bold: true };
      }
    });

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Ringkasan Keuangan');
    summarySheet.columns = [
      { header: 'Metrik Finansial', key: 'metric', width: 30 },
      { header: 'Nilai (IDR)', key: 'value', width: 25 }
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRow({ metric: 'Total Pemasukan', value: summary.totalIncome || 0 });
    summarySheet.addRow({ metric: 'Total Pengeluaran', value: summary.totalExpense || 0 });
    summarySheet.addRow({ metric: 'Arus Kas Bersih', value: (summary.totalIncome || 0) - (summary.totalExpense || 0) });
    summarySheet.addRow({ metric: 'Jumlah Transaksi', value: transactions.length });

    summarySheet.getColumn(2).numFmt = '"Rp "#,##0';

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Save export record and attempt upload to Supabase Storage, with signed URL
   * @param {object} params
   * @returns {Promise<{ downloadUrl: string, isSignedUrl: boolean, recordId: string }>}
   */
  async saveAndGetUrl({ userId, format, fileName, buffer, filters = {} }) {
    let signedUrl = null;
    let storagePath = null;

    if (supabase && config.supabaseStorageBucket) {
      try {
        storagePath = `exports/${userId}/${Date.now()}_${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from(config.supabaseStorageBucket)
          .upload(storagePath, buffer, {
            contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upsert: true
          });

        if (!uploadError) {
          // Generate Signed URL valid for 24 hours (86400 seconds)
          const { data: signedData, error: signError } = await supabase.storage
            .from(config.supabaseStorageBucket)
            .createSignedUrl(storagePath, 86400);

          if (!signError && signedData?.signedUrl) {
            signedUrl = signedData.signedUrl;
          }
        }
      } catch (err) {
        console.warn('Supabase storage upload error, using fallback:', err.message);
      }
    }

    // Direct fallback streaming route if Supabase Storage is not set up
    const fallbackUrl = `/api/reports/download-stream/${fileName}`;
    const finalUrl = signedUrl || fallbackUrl;

    const exportRecord = {
      id: 'exp' + Math.random().toString(36).substring(2, 9),
      user_id: userId,
      format,
      file_name: fileName,
      storage_path: storagePath,
      signed_url: finalUrl,
      file_size_bytes: buffer.length,
      filters_applied: filters,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: toWIBISOString()
    };

    inMemoryStore.exports.unshift(exportRecord);

    return {
      downloadUrl: finalUrl,
      isSignedUrl: Boolean(signedUrl),
      recordId: exportRecord.id
    };
  }
}

export const exportService = new ExportService();

// server/reporting/excelGenerator.js
// Standard Excel Spreadsheet Generator for TataDana
// Generates clean, valid Spreadsheet XML (.xls/.xlsx compatible) with headers, numbers, and WIB timestamps

const { formatWIBFull } = require('../utils/wib');

/**
 * Generates an Excel XML Spreadsheet document
 */
function generateFinancialReportExcel({
  userName = 'Pengguna TataDana',
  periodStart = '2026-10-01',
  periodEnd = '2026-10-31',
  summary = { income: 0, expense: 0, net: 0 },
  transactions = []
}) {
  const generatedAt = formatWIBFull(new Date());

  let rowsXml = '';

  // Title rows
  rowsXml += `
    <Row>
      <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">TataDana - Laporan Keuangan Pribadi</Data></Cell>
    </Row>
    <Row>
      <Cell><Data ss:Type="String">Pengguna: ${userName} | Dibuat: ${generatedAt} WIB</Data></Cell>
    </Row>
    <Row>
      <Cell><Data ss:Type="String">Periode: ${periodStart} s.d ${periodEnd}</Data></Cell>
    </Row>
    <Row></Row>
    <Row>
      <Cell ss:StyleID="Bold"><Data ss:Type="String">Total Pemasukan</Data></Cell>
      <Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.income}</Data></Cell>
    </Row>
    <Row>
      <Cell ss:StyleID="Bold"><Data ss:Type="String">Total Pengeluaran</Data></Cell>
      <Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.expense}</Data></Cell>
    </Row>
    <Row>
      <Cell ss:StyleID="Bold"><Data ss:Type="String">Net Cashflow</Data></Cell>
      <Cell ss:StyleID="Currency"><Data ss:Type="Number">${summary.net}</Data></Cell>
    </Row>
    <Row></Row>
    <Row ss:StyleID="TableHeader">
      <Cell><Data ss:Type="String">ID Transaksi</Data></Cell>
      <Cell><Data ss:Type="String">Tanggal (WIB)</Data></Cell>
      <Cell><Data ss:Type="String">Jenis</Data></Cell>
      <Cell><Data ss:Type="String">Kategori</Data></Cell>
      <Cell><Data ss:Type="String">Dompet</Data></Cell>
      <Cell><Data ss:Type="String">Nominal (IDR)</Data></Cell>
      <Cell><Data ss:Type="String">Catatan</Data></Cell>
      <Cell><Data ss:Type="String">Sumber</Data></Cell>
    </Row>
  `;

  // Transaction rows
  for (const tx of transactions) {
    const isIncome = tx.type === 'pemasukan';
    const amountVal = Number(tx.amount) || 0;
    const dateStr = (tx.transaction_date || '').split('T')[0];

    rowsXml += `
    <Row>
      <Cell><Data ss:Type="String">${tx.id || ''}</Data></Cell>
      <Cell><Data ss:Type="String">${dateStr}</Data></Cell>
      <Cell><Data ss:Type="String">${isIncome ? 'Pemasukan' : 'Pengeluaran'}</Data></Cell>
      <Cell><Data ss:Type="String">${tx.category_name || '-'}</Data></Cell>
      <Cell><Data ss:Type="String">${tx.wallet_name || '-'}</Data></Cell>
      <Cell ss:StyleID="Currency"><Data ss:Type="Number">${amountVal}</Data></Cell>
      <Cell><Data ss:Type="String">${(tx.notes || '').replace(/[<&>]/g, '')}</Data></Cell>
      <Cell><Data ss:Type="String">${tx.source || 'web'}</Data></Cell>
    </Row>
    `;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="HeaderTitle">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FF5B00"/>
  </Style>
  <Style ss:ID="Bold">
   <Font ss:Bold="1"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#FF5B00" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Laporan Keuangan">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf-8');
}

module.exports = {
  generateFinancialReportExcel
};

import fetch from 'node-fetch';

// テスト用のCSVデータ（8/31 06:00 JSTのデータ）
const testCsvData = [
  {
    startTime: '2025-08-31 06:00',
    duration: 20468,
    grossRevenue: 465605,
    directGmv: 439643,
    viewers: 8386,
    peakViewers: 1000,
    ordersPaidFor: 160,
    productClicks: 1000,
    likes: 234160,
    comments: 100,
    shares: 50,
    newFollowers: 100,
    itemsSold: 160,
    buyerCount: 150,
  }
];

// APIを呼び出し
const baseUrl = 'http://localhost:3000';

async function testImport() {
  console.log('Testing CSV import...');
  console.log('Input data:', JSON.stringify(testCsvData[0], null, 2));
  
  // まず、brandIdとliverIdを取得
  // ここでは仮の値を使用（実際のテストでは正しい値が必要）
  const brandId = 1;
  const liverId = 1;
  
  const response = await fetch(`${baseUrl}/api/trpc/csvImport.importLivestreamCsv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      json: {
        brandId,
        liverId,
        csvData: testCsvData,
        fileName: 'test.xlsx',
      }
    }),
  });
  
  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
}

testImport().catch(console.error);

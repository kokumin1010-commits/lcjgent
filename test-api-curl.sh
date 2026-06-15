#!/bin/bash
curl -s https://lcjmall.com/api/trpc/festival.submitCompany \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"json":{"companyName":"CurlTest3","contactName":"テスト","contactDepartment":"テスト部","contactNameKana":"テスト","postalCode":"100-0001","address":"東京都","phone":"03-0000-0000","email":"curl3@test.com","websiteUrl":"https://curl3.test","tiktokShopSellerName":"CurlShop3","brandIntro":"テスト紹介3","targetAudience":"テスト","salesLicense":"特になし"}}' \
  > /tmp/api-result.json 2>&1
cat /tmp/api-result.json

#!/bin/bash
curl -s "https://lcjmall.com/api/trpc/festival.submitCompany" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept-Encoding: identity" \
  -d '{"json":{"companyName":"Test7","contactName":"T","contactDepartment":"T","contactNameKana":"T","postalCode":"100","address":"Tokyo","phone":"03","email":"t7@t.com","websiteUrl":"https://t.com","tiktokShopSellerName":"T","brandIntro":"T","targetAudience":"T","salesLicense":"T"}}' \
  -o /tmp/test7.json 2>&1
echo "Response size: $(wc -c < /tmp/test7.json) bytes"
cat /tmp/test7.json
echo ""

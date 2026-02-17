# Debug: Referral code fix verification

## Dev server test - AFTER fix (no redirect approach)
- URL: /register?code=7H6RJF
- URL stays at: /register?code=7H6RJF (NO redirect!)
- Referral code field shows: "7H6RJF" ✅
- Validation message: "友達招待コードが適用されました（登録で50pt付与）" ✅
- Mode: Registration mode (新規登録) ✅

## Key change
- Register.tsx now renders LineLogin directly with forceRegisterMode prop
- No redirect at all - URL stays as /register?code=7H6RJF
- LineLogin reads ?code= param directly from window.location.search
- This eliminates ALL redirect-related parameter loss issues

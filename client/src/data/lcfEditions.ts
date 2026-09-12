/**
 * LCF multi-edition content model.
 * Design rule: evidence-led editorial archive, real event photography, black/ivory/gold palette.
 * Adding a future edition must not overwrite the 2026 archive or any /lcf operational route.
 */

export type LcfPhotoGroup = "day1" | "awards" | "day2";

export type LcfPhoto = {
  id: string;
  group: LcfPhotoGroup;
  src: string;
  originalSrc: string;
  alt: string;
  width: number;
  height: number;
};

const photo = (
  id: string,
  group: LcfPhotoGroup,
  src: string,
  originalSrc: string,
  alt: string,
  width = 1800,
  height = 1201,
): LcfPhoto => ({ id, group, src, originalSrc, alt, width, height });

export const lcf2026Photos: LcfPhoto[] = [
  photo("D2-115", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/thLQDotkzsZWHDPO.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vznrrbgvXTibHBke.jpg", "LCF 2026 DAY2 出演者フォト", 1800, 1202),
  photo("D2-187", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/JyVXJDDLEIsmYvvM.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/wNwhmyAMBWmpbGWa.jpg", "LCF 2026 DAY2 ステージトーク", 1800, 1202),
  photo("AW-085", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BgBVuaDhoynLaLdr.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DUUkpotrVQWefCfM.jpg", "LCF 2026 アフターパーティー集合写真", 1800, 1200),
  photo("D1-104", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pUGBXUTgNBwPpMwf.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yUjKiJxSFhnLjPRa.jpg", "LCF 2026 DAY1 ライブコマース会場", 1800, 1201),
  photo("D2-200", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/LPxICjjNAnGMZeno.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/WQVyREPorOgpQqxI.jpg", "LCF 2026 DAY2 トークセッション", 1800, 1202),
  photo("D2-035", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/UKJFnQZCtHAcNbsG.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/rrcnnYDJonVPJpEE.jpg", "LCF 2026 DAY2 満席のセミナー会場", 1800, 1202),
  photo("D2-282", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/mHUMWFKmUuNmXUmR.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/mCNVKxLNgYzacfnG.jpg", "LCF 2026 DAY2 ブランドとライバー", 1800, 1202),
  photo("AW-069", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/cCzBrAazaaNJuFYK.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zQBEMrQWTIAYJwUI.jpg", "LCF 2026 LIVE COMMERCE AWARD フォト", 1800, 1201),
  photo("D1-056", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vooYaUtmeqwqNdmH.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pmXSYvCIllaeilVn.jpg", "LCF 2026 DAY1 ライブ配信風景", 1800, 1200),
  photo("D2-114", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/REVqArSSDHMcvGpe.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/EtADMvmWCiNxIyBp.jpg", "LCF 2026 DAY2 商品紹介の交流", 1800, 1202),
  photo("AW-031", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/voBReRDQletZewlq.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/GRSoVIFaeRcQKmWH.jpg", "LCF 2026 LIVE COMMERCE AWARD 受賞風景", 1800, 1201),
  photo("D2-203", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/VhWkzUTImbevFxyU.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zDvVRRQjOlnjIWFa.jpg", "LCF 2026 DAY2 ステージ対談", 1800, 1202),
  photo("D2-161", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/IDvvLtXmLMkYVWHg.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/YdRuDhfXVXvbRlnc.jpg", "LCF 2026 DAY2 セミナートーク", 1800, 1202),
  photo("D1-094", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TdpcIdJiMRwTeLtW.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pDysbUFuTOhUlkfe.jpg", "LCF 2026 DAY1 にぎわう出展エリア", 1800, 1201),
  photo("D2-013", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pnVgQQgSpNRQDaDj.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DUtYvxejFzdlhArE.jpg", "LCF 2026 DAY2 集合写真", 1800, 1202),
  photo("AW-011", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/hcKrwXtjKFLaaWrj.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gSFExMYJYMIUvaYT.jpg", "LCF 2026 アワード発表風景", 1800, 1201),
  photo("AW-040", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/diaXvmyuEbpqBNNP.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/CwmnLHsCEueUcXrJ.jpg", "LCF 2026 アワード表彰", 1800, 1200),
  photo("D1-030", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MAhcjuPzKgUDchoC.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/wAxMtGiuJhvXGqtP.jpg", "LCF 2026 DAY1 出展ブースでの交流", 1800, 1201),
  photo("D1-053", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gNTyUbQkzmSJOnSC.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/wpncwTnAiumfZjks.jpg", "LCF 2026 DAY1 ライブ配信ブース", 1800, 1200),
  photo("D1-234", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/lmwyWdfXuwCVIZiA.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zgVGOPGPMFohSnJs.jpg", "LCF 2026 DAY1 ブランド展示", 1800, 1201),
  photo("D2-026", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BHIUqxaBqjanjqnK.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yPenyZJVLUGhuDMx.jpg", "LCF 2026 DAY2 観客との対話", 1800, 1202),
  photo("D2-116", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ONhOBkFPvASUxREQ.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/UBQrYMstlWlhmJiw.jpg", "LCF 2026 DAY2 フォトスポット", 1800, 1202),
  photo("D2-138", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/IZGlKojjfKYyBgTV.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/YnSrGKTXZqEwbgYp.jpg", "LCF 2026 DAY2 パネルセッション", 1800, 1202),
  photo("D2-154", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/VrBGufzYrhhlGnwt.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gCufbYMVpPkLKDfw.jpg", "LCF 2026 DAY2 ライブコマース体験", 1800, 1202),
  photo("D2-064", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KeDYhPHZBZAqltfP.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/pyBhwguGLSgSBGVu.jpg", "LCF 2026 DAY2 商品ライブ紹介", 1800, 1202),
  photo("AW-001", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/uiMRCxgSICeRCLTn.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vGlzouyTzvyWwptj.jpg", "LCF 2026 アワード集合写真", 1800, 1201),
  photo("AW-094", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/iOVmrvJrPetCtDnI.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/nOJTKwTxbfwFThpL.jpg", "LCF 2026 アフターパーティー交流", 1800, 1201),
  photo("D1-049", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/oSTTvSzRZsAMdRds.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fewNceNszFABSQYQ.jpg", "LCF 2026 DAY1 会場のにぎわい", 1800, 1201),
  photo("D1-269", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QODMjSaBwOCQmNad.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/mENFdjAZaCkOjzuU.jpg", "LCF 2026 DAY1 メインステージ", 1800, 1201),
  photo("D2-009", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/etUgSVVAvTxCjCJl.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/HgdiGqgTzcLBQpYf.jpg", "LCF 2026 DAY2 表彰と交流", 1800, 1202),
  photo("D2-023", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/XvxZVNjYGbOaEMjB.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/GaCTXvqtGxksYAOW.jpg", "LCF 2026 DAY2 来場者との質疑", 1800, 1202),
  photo("D2-099", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vfYmkzufWXsUfafg.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/EBUglVUvvGROTwGh.jpg", "LCF 2026 DAY2 ライブ販売体験", 1800, 1202),
  photo("D2-144", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BIMrUuCTgJWqSzcd.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QrwJfifdJibZVBol.jpg", "LCF 2026 DAY2 ステージセッション", 1800, 1202),
  photo("D2-170", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/mwaKwIYBZGUhQfUY.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KgNFMAjozXOMyEHM.jpg", "LCF 2026 DAY2 観客参加セッション", 1800, 1202),
  photo("AW-024", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/XRCinEHNRwwRPVgp.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FKCxhVmpeDVuHksw.jpg", "LCF 2026 アワード受賞記念", 1800, 1200),
  photo("D1-116", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/VBgxJXnQNcuuazNa.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/HkhicWJFsDbupUBw.jpg", "LCF 2026 DAY1 出演者フォト", 1800, 1201),
  photo("D1-121", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DFuqbOaxBXFwzKzy.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KzyoZXRNMJDzAOqU.jpg", "LCF 2026 DAY1 ブランドブース", 1800, 1201),
  photo("D2-017", "day2", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/PtSbtFQwFSqbjVMB.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/yvnYfYlEVVcPXCXk.jpg", "LCF 2026 DAY2 セミナー観覧席", 1800, 1202),
  photo("AW-045", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/IFMzewuLXoBGYRYh.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/XjhJBQrARXNEQGFj.jpg", "LCF 2026 アフターパーティーフォト", 1800, 1200),
  photo("D1-013", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/cjnSnjuuUEMWWAmt.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/qobdgYoWvSeQoWcD.jpg", "LCF 2026 DAY1 商品紹介ライブ", 1800, 1200),
  photo("D1-046", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/KEfucQvosejTFnuk.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dbFbIDReAMeJLbbz.jpg", "LCF 2026 DAY1 展示商品の紹介", 1800, 1201),
  photo("D1-177", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/IBmHhtKFtVoZxqoE.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/lhXxpBOkqwwMHlgg.jpg", "LCF 2026 DAY1 出展企業ブース", 1800, 1201),
  photo("D1-210", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/iQcdCZcXXYhHTgBH.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zjPgYkCyzsWPqnjj.jpg", "LCF 2026 DAY1 サービス体験", 1800, 1201),
  photo("AW-081", "awards", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QiBfQNfFsFjDnoEB.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/HxpzLSffLvpjTYBS.jpg", "LCF 2026 アワード出演者フォト", 1800, 1201),
  photo("D1-137", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/LuVAlHPbQVJfIxgN.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/EAqBKkRmvfWyBQxl.jpg", "LCF 2026 DAY1 商品とライバーの出会い", 1800, 1201),
  photo("D1-214", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/rHUGMXlkCHjiqrrM.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fZcAEtArfiYxRIKW.jpg", "LCF 2026 DAY1 テクノロジーブース", 1800, 1201),
  photo("D1-110", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FvUtWjokQjhoEkYL.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/RpkwJwZbUuOOoBlj.jpg", "LCF 2026 DAY1 来場者フォト", 1800, 1201),
  photo("D1-086", "day1", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/gfUxGHWPzhnszXfn.webp", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/vcseORTzATDaHwLD.jpg", "LCF 2026 DAY1 交流のひととき", 1800, 1201),
];

export const lcf2026PhotoById = Object.fromEntries(lcf2026Photos.map((item) => [item.id, item])) as Record<string, LcfPhoto>;

export const lcf2026HomepagePhotoIds = [
  "D1-104", "D2-035", "D1-094", "D2-114", "D1-056", "D2-200", "AW-085", "D1-030", "D2-064", "AW-031", "D2-017", "D1-269",
];

export const lcf2026Stats = [
  { value: "750+", label: "来場ライバー", note: "2日間累計" },
  { value: "50", label: "参加企業", note: "ブランド・事業者" },
  { value: "193", label: "販売数", note: "15分間の実演企画" },
  { value: "満席", label: "DAY2セミナー", note: "全プログラム" },
];

export const lcf2026Coverage = [
  { outlet: "運営公式", title: "「LIVE COMMERCE FESTIVAL 2026」大盛況のうちに閉幕", href: "https://nacmob.jp/%e3%80%90%e9%96%8b%e5%82%ac%e9%80%9f%e5%a0%b1%e3%80%91%e3%80%8clive-commerce-festival-2026%e3%80%8d%e5%a4%a7%e7%9b%9b%e6%b3%81%e3%81%ae%e3%81%86%e3%81%a1%e3%81%ab%e9%96%89%e5%b9%95%ef%bd%9c2%e6%97%a5/" },
  { outlet: "運営公式", title: "想像を超える熱狂。企業とライバーが出会ったDAY1", href: "https://nacmob.jp/%e3%80%90%e9%96%8b%e5%82%ac%e3%83%ac%e3%83%9d%e3%83%bc%e3%83%88-day1%e3%80%91%e6%83%b3%e5%83%8f%e3%82%92%e8%b6%85%e3%81%88%e3%82%8b%e7%86%b1%e7%8b%82%e3%80%82%e4%bc%81%e6%a5%ad%e3%81%a8%e3%83%a9/" },
  { outlet: "PR TIMES", title: "2日間で750名以上のライバーが集結", href: "https://prtimes.jp/main/html/rd/p/000000014.000140472.html" },
  { outlet: "日刊スポーツ", title: "ライブコマースイベントで豪華共演", href: "https://www.nikkansports.com/m/entertainment/news/202609080001753_m.html" },
  { outlet: "スポーツ報知", title: "人気YouTuber・ゆん、後藤真希と初共演", href: "https://hochi.news/articles/20260908-OHT1T51426.html?page=1" },
  { outlet: "デイリースポーツ", title: "日本最大級のライブコマースイベントに登場", href: "https://www.daily.co.jp/gossip/2026/09/09/0020799309.shtml?pg=2" },
  { outlet: "モデルプレス", title: "LIVE COMMERCE FESTIVAL 2026 掲載記事", href: "https://mdpr.jp/other/4841619" },
  { outlet: "Pop'n'Roll", title: "豪華出演陣と特別番組に登場", href: "https://popnroll.tv/articles/47500" },
  { outlet: "LIVE TIMES", title: "LIVE COMMERCE FESTIVAL 2026 掲載記事", href: "https://livetimes.jp/news/62987/" },
];

export const lcfEditions = [
  {
    edition: 1,
    year: 2026,
    label: "第1回",
    status: "開催終了",
    dates: "2026.09.08 — 09.09",
    venue: "八芳園｜東京・白金台",
    shortPath: "/2026",
    eventPath: "/livecommercefestival/2026",
    reportPath: "/livecommercefestival/2026/report",
    guidancePath: "/lcf/guidance/2026",
    heroPhotoId: "D1-104",
  },
] as const;

export const lcfContactEmail = "lcj.inquiry@livecommercejapan.jp";

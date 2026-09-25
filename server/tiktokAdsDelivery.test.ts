import { describe, expect, it } from "vitest";
import {
  getTikTokDeliveryLabel,
  isTikTokEffectivelyDelivering,
  resolveTikTokDeliveryState,
} from "../shared/tiktokAdsDelivery";
import { TIKTOK_ADS_BOOTSTRAP_SNAPSHOT } from "./tiktokAdsSnapshot";

describe("TikTok effective delivery state", () => {
  it("does not report enabled children as delivering when a parent campaign is paused", () => {
    const campaign = resolveTikTokDeliveryState({
      operationStatus: "DISABLE",
      secondaryStatus: "CAMPAIGN_STATUS_DISABLE",
    });
    const adgroup = resolveTikTokDeliveryState({
      operationStatus: "ENABLE",
      secondaryStatus: "ADGROUP_STATUS_CAMPAIGN_DISABLE",
      parentDelivering: isTikTokEffectivelyDelivering(campaign),
    });
    const ad = resolveTikTokDeliveryState({
      operationStatus: "ENABLE",
      secondaryStatus: "AD_STATUS_CAMPAIGN_DISABLE",
      parentDelivering: isTikTokEffectivelyDelivering(adgroup),
    });

    expect(campaign).toBe("paused");
    expect(adgroup).toBe("parent_paused");
    expect(ad).toBe("parent_paused");
    expect(getTikTokDeliveryLabel(ad)).toBe("上层已暂停");
  });

  it("labels a fully enabled hierarchy as delivering", () => {
    expect(resolveTikTokDeliveryState({ operationStatus: "ENABLE", secondaryStatus: "CAMPAIGN_STATUS_ENABLE" })).toBe("delivering");
    expect(resolveTikTokDeliveryState({ operationStatus: "ENABLE", secondaryStatus: "ADGROUP_STATUS_ENABLE", parentDelivering: true })).toBe("delivering");
    expect(resolveTikTokDeliveryState({ operationStatus: "ENABLE", secondaryStatus: "AD_STATUS_ENABLE", parentDelivering: true })).toBe("delivering");
  });

  it("shows zero effective delivery for the captured LCJ-01 hierarchy", () => {
    const campaigns = new Map(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.campaigns.map(item => [
      item.campaignId,
      resolveTikTokDeliveryState({ operationStatus: item.operationStatus, secondaryStatus: item.secondaryStatus }),
    ]));
    const adgroups = new Map(TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.adgroups.map(item => [
      item.adgroupId,
      resolveTikTokDeliveryState({
        operationStatus: item.operationStatus,
        secondaryStatus: item.secondaryStatus,
        parentDelivering: isTikTokEffectivelyDelivering(campaigns.get(item.campaignId) ?? "paused"),
      }),
    ]));
    const ads = TIKTOK_ADS_BOOTSTRAP_SNAPSHOT.ads.map(item => resolveTikTokDeliveryState({
      operationStatus: item.operationStatus,
      secondaryStatus: item.secondaryStatus,
      parentDelivering:
        isTikTokEffectivelyDelivering(campaigns.get(item.campaignId) ?? "paused") &&
        isTikTokEffectivelyDelivering(adgroups.get(item.adgroupId) ?? "paused"),
    }));

    expect([...campaigns.values()].filter(isTikTokEffectivelyDelivering)).toHaveLength(0);
    expect([...adgroups.values()].filter(isTikTokEffectivelyDelivering)).toHaveLength(0);
    expect(ads.filter(isTikTokEffectivelyDelivering)).toHaveLength(0);
  });
});

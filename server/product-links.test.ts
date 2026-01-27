import { describe, it, expect, afterAll } from "vitest";
import { addProductLink, getProductLinks, deleteProductLink, updateProductLink, getProductLinksForProducts } from "./db";

describe("Product Links", () => {
  // Use a test product ID - we'll use 1 as a placeholder
  const testProductId = 1;
  const testUserId = 1;
  const createdLinkIds: number[] = [];

  afterAll(async () => {
    // Clean up all created links
    for (const linkId of createdLinkIds) {
      try {
        await deleteProductLink(linkId);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe("addProductLink", () => {
    it("should add a new link to a product", async () => {
      const result = await addProductLink({
        productId: testProductId,
        title: "TikTok Shop Test",
        url: "https://www.tiktok.com/shop/test-product",
        createdBy: testUserId,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(typeof result.sortOrder).toBe("number");
      createdLinkIds.push(result.id);
    });

    it("should add multiple links with incrementing sortOrder", async () => {
      const result1 = await addProductLink({
        productId: testProductId,
        title: "Rakuten Test",
        url: "https://item.rakuten.co.jp/test",
        createdBy: testUserId,
      });
      createdLinkIds.push(result1.id);

      const result2 = await addProductLink({
        productId: testProductId,
        title: "Official Site Test",
        url: "https://example.com/product",
        createdBy: testUserId,
      });
      createdLinkIds.push(result2.id);

      expect(result2.sortOrder).toBeGreaterThan(result1.sortOrder);
    });
  });

  describe("getProductLinks", () => {
    it("should retrieve all links for a product", async () => {
      const links = await getProductLinks(testProductId);
      
      expect(Array.isArray(links)).toBe(true);
      // Should have at least the links we created
      const testLinks = links.filter((l: any) => 
        l.title.includes("Test") && createdLinkIds.includes(l.id)
      );
      expect(testLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("should return links ordered by sortOrder", async () => {
      const links = await getProductLinks(testProductId);
      
      for (let i = 1; i < links.length; i++) {
        expect(links[i].sortOrder).toBeGreaterThanOrEqual(links[i - 1].sortOrder);
      }
    });
  });

  describe("updateProductLink", () => {
    it("should update a link title", async () => {
      if (createdLinkIds.length === 0) {
        // Create a link first if none exist
        const result = await addProductLink({
          productId: testProductId,
          title: "Update Test Link",
          url: "https://example.com/update-test",
          createdBy: testUserId,
        });
        createdLinkIds.push(result.id);
      }

      const linkId = createdLinkIds[0];
      const updateResult = await updateProductLink(linkId, {
        title: "Updated Title",
      });

      expect(updateResult.success).toBe(true);

      // Verify the update
      const links = await getProductLinks(testProductId);
      const updatedLink = links.find((l: any) => l.id === linkId);
      expect(updatedLink?.title).toBe("Updated Title");
    });

    it("should update a link URL", async () => {
      const linkId = createdLinkIds[0];
      const newUrl = "https://example.com/new-url";
      
      const updateResult = await updateProductLink(linkId, {
        url: newUrl,
      });

      expect(updateResult.success).toBe(true);

      // Verify the update
      const links = await getProductLinks(testProductId);
      const updatedLink = links.find((l: any) => l.id === linkId);
      expect(updatedLink?.url).toBe(newUrl);
    });
  });

  describe("getProductLinksForProducts", () => {
    it("should retrieve links for multiple products", async () => {
      const links = await getProductLinksForProducts([testProductId]);
      
      expect(Array.isArray(links)).toBe(true);
    });

    it("should return empty array for empty product IDs", async () => {
      const links = await getProductLinksForProducts([]);
      
      expect(Array.isArray(links)).toBe(true);
      expect(links.length).toBe(0);
    });
  });

  describe("deleteProductLink", () => {
    it("should delete a link", async () => {
      // Create a link specifically for deletion
      const result = await addProductLink({
        productId: testProductId,
        title: "Link to Delete",
        url: "https://example.com/delete-me",
        createdBy: testUserId,
      });

      const deleteResult = await deleteProductLink(result.id);
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const links = await getProductLinks(testProductId);
      const deletedLink = links.find((l: any) => l.id === result.id);
      expect(deletedLink).toBeUndefined();
    });
  });
});

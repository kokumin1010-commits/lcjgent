import { describe, it, expect, beforeAll } from "vitest";

/**
 * 商品管理APIの権限テスト
 * - createProduct, updateProduct, deleteProduct, uploadProductImage, updateProductImages
 *   がprotectedProcedure（ログインユーザー全員可）であることを確認
 * - 管理者権限チェック（ctx.user.role !== "admin"）が削除されていることを確認
 */

describe("商品管理API権限テスト", () => {
  let routersContent: string;

  beforeAll(async () => {
    const fs = await import("fs");
    routersContent = fs.readFileSync("./server/routers.ts", "utf-8");
  });

  it("createProductに管理者権限チェックがないこと", () => {
    const createProductMatch = routersContent.match(
      /createProduct:\s*protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(createProductMatch).toBeTruthy();
    const mutationBody = createProductMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
    expect(mutationBody).not.toContain("管理者権限が必要です");
  });

  it("updateProductに管理者権限チェックがないこと", () => {
    const updateProductMatch = routersContent.match(
      /updateProduct:\s*protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(updateProductMatch).toBeTruthy();
    const mutationBody = updateProductMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
  });

  it("deleteProductに管理者権限チェックがないこと", () => {
    const deleteProductMatch = routersContent.match(
      /deleteProduct:\s*protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(deleteProductMatch).toBeTruthy();
    const mutationBody = deleteProductMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
  });

  it("uploadProductImageに管理者権限チェックがないこと", () => {
    const uploadMatch = routersContent.match(
      /uploadProductImage:\s*protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\/\/ 商品画像の並び替え/
    );
    expect(uploadMatch).toBeTruthy();
    const mutationBody = uploadMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
    expect(mutationBody).not.toContain("管理者権限が必要です");
  });

  it("updateProductImagesに管理者権限チェックがないこと", () => {
    const updateImagesMatch = routersContent.match(
      /updateProductImages:\s*protectedProcedure[\s\S]*?\.mutation\(async \(\{ ctx, input \}\) => \{([\s\S]*?)\}\),/
    );
    expect(updateImagesMatch).toBeTruthy();
    const mutationBody = updateImagesMatch![1];
    expect(mutationBody).not.toContain('ctx.user.role !== "admin"');
    expect(mutationBody).not.toContain("FORBIDDEN");
  });

  it("REST API upload-product-imageに管理者権限チェックがないこと", async () => {
    const fs = await import("fs");
    const coreIndexContent = fs.readFileSync("./server/_core/index.ts", "utf-8");
    
    const uploadEndpointMatch = coreIndexContent.match(
      /upload-product-image[\s\S]*?Authenticate user([\s\S]*?)if \(!req\.file\)/
    );
    expect(uploadEndpointMatch).toBeTruthy();
    const authSection = uploadEndpointMatch![1];
    expect(authSection).not.toContain('user.role !== "admin"');
    expect(authSection).not.toContain("管理者権限が必要です");
    // ログインチェックは残っていること
    expect(authSection).toContain("!user");
  });

  it("LCJ MALL統合ページ(/master/mall)がサイドバーに存在すること", async () => {
    const fs = await import("fs");
    const dashboardContent = fs.readFileSync("./client/src/components/DashboardLayout.tsx", "utf-8");
    
    // LCJ MALLメニューが存在すること
    const mallMenuLine = dashboardContent.split("\n").find(line => 
      line.includes("/master/mall")
    );
    expect(mallMenuLine).toBeTruthy();
  });
});

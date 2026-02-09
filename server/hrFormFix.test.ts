import { describe, it, expect } from "vitest";

/**
 * HRシステムのフォーム入力バグ修正テスト
 * 
 * バグ: StaffFormFieldsがインライン関数コンポーネントとして定義されていたため、
 * setFormDataが呼ばれるたびにReactが新しいコンポーネントとして認識し、
 * DOMを再構築してフォーカスが失われ、1文字ずつしか入力できなかった。
 * 
 * 修正: StaffFormFieldsをインラインJSX変数（staffFormFieldsJsx）に変更し、
 * onChange内でuseCallbackベースのupdateFieldヘルパーを使用。
 */

describe("HR Form Input Fix", () => {
  it("should use functional setState pattern (updateField) instead of spread pattern", async () => {
    // Read the HRManagement.tsx file to verify the fix is applied
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/HRManagement.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify updateField helper exists with useCallback
    expect(content).toContain("const updateField = useCallback(");
    expect(content).toContain("setFormData(prev => ({ ...prev, [field]: value }))");
  });

  it("should NOT define StaffFormFields as an inline function component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/HRManagement.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // The old pattern: const StaffFormFields = ({ isEdit = false }: ...) => (
    // This creates a new component identity on every render, causing DOM remounting
    expect(content).not.toMatch(/const StaffFormFields\s*=\s*\(/);
    expect(content).not.toMatch(/const StaffFormFields\s*=\s*\(\{/);
  });

  it("should use staffFormFieldsJsx as a JSX variable instead of a component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/HRManagement.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify it's defined as a JSX variable
    expect(content).toContain("const staffFormFieldsJsx = (");

    // Verify it's used as JSX expression, not as a component
    expect(content).toContain("{staffFormFieldsJsx}");
    expect(content).not.toContain("<StaffFormFields");
  });

  it("should use updateField for email and phone inputs", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/HRManagement.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify email and phone inputs use updateField instead of setFormData spread
    expect(content).toContain("updateField('email', e.target.value)");
    expect(content).toContain("updateField('phone', e.target.value)");

    // Verify other fields also use updateField
    expect(content).toContain("updateField('name', e.target.value)");
    expect(content).toContain("updateField('nameEn', e.target.value)");
    expect(content).toContain("updateField('position', e.target.value)");
  });

  it("should import useCallback from React", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/HRManagement.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify useCallback is imported
    expect(content).toMatch(/import\s*\{[^}]*useCallback[^}]*\}\s*from\s*["']react["']/);
  });
});

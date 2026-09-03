import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLiverT } from "../client/src/lib/liverI18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const appSource = read("client/src/App.tsx");
const loginSource = read("client/src/pages/LiverLogin.tsx");
const registerSource = read("client/src/pages/LiverRegister.tsx");
const routerSource = read("server/liverRouter.ts");

describe("Chinese liver authentication entry", () => {
  it("publishes dedicated Chinese login and registration routes", () => {
    expect(appSource).toContain('path={"/liver/login-cn"}');
    expect(appSource).toContain('<LiverLogin forcedLanguage="zh" />');
    expect(appSource).toContain('path={"/liver/register-cn"}');
    expect(appSource).toContain('<LiverRegister forcedLanguage="zh" />');
  });

  it("keeps the user-provided legacy registration URL working", () => {
    expect(appSource).toContain('path={"/liver/registe"}');
    expect(appSource).toContain('<Redirect to="/liver/register-cn" />');
  });

  it("renders simplified Chinese login labels", () => {
    const t = createLiverT("zh");

    expect(t("login.subtitle")).toBe("登录");
    expect(t("login.description")).toBe("使用邮箱和密码登录");
    expect(t("login.email")).toBe("邮箱");
    expect(t("login.password")).toBe("密码");
    expect(t("login.register")).toBe("立即注册");
  });

  it("keeps Chinese navigation and submits the selected language", () => {
    expect(loginSource).toMatch(
      /forcedLanguage\s*===\s*["']zh["']\s*\?\s*["']\/liver\/register-cn["']/
    );
    expect(loginSource).toContain(
      "...(forcedLanguage ? { language: forcedLanguage } : {})"
    );
    expect(registerSource).toContain(
      'onClick={() => navigate("/liver/login-cn")}'
    );
    expect(registerSource).toContain("language: activeLanguage");
  });

  it("persists an explicitly selected Chinese language after authentication", () => {
    expect(routerSource).toMatch(
      /language:\s*z\.enum\(\[["']ja["'],\s*["']zh-TW["'],\s*["']en["'],\s*["']zh["']\]\)\.optional\(\)/
    );
    expect(routerSource).toContain(
      "...(input.language ? { language: input.language } : {})"
    );
    expect(routerSource).toContain(
      "await updateLiver(liver.id, { language: input.language })"
    );
    expect(routerSource).toMatch(
      /language:\s*input\.language\s*\|\|\s*liver\.language\s*\|\|\s*["']ja["']/
    );
    expect(routerSource).toContain('"邮箱或密码错误"');
    expect(routerSource).toContain('"该账号已停用，请联系管理员"');
    expect(routerSource).toContain('"该邮箱已注册，请直接登录"');
  });
});

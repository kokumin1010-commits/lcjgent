import LineLogin from "./LineLogin";

/**
 * /register?code=XXXX → LineLoginコンポーネントを直接表示（新規登録モード）
 * 
 * リダイレクトを使わず直接表示することで、URLパラメータ（?code=）が
 * 確実にLineLogin内で読み取れるようにする。
 * リダイレクト方式だとLINEアプリ内ブラウザや一部環境でパラメータが消失する問題があった。
 */
export default function Register() {
  return <LineLogin forceRegisterMode />;
}

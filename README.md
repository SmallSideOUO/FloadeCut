# FloadeCut / Floade

繁體中文影片剪輯器，基於 [OpenChatCut](https://github.com/0xsline/OpenChatCut)。保留手動時間軸、素材、特效、轉場、字幕、預覽和匯出；AI 對話與上下文由外部 Codex 等工具負責。

## Windows 桌面版

1. 到 [Releases](https://github.com/SmallSideOUO/FloadeCut/releases) 下載 Floade 的 Windows x64 安裝檔。
2. 執行 .exe，選擇安裝位置。安裝程式會建立桌面與開始功能表捷徑。
3. 開啟 Floade 即可剪輯，不需要另外安裝 Node.js 或配置 AI 金鑰。

目前為未簽章的初始版本。外部 AI 接入資訊可從編輯器上方的 MCP 按鈕取得，修改草稿可在介面預覽、核准或捨棄。

原始碼放在 Git repository；安裝檔放在 GitHub Releases。專案與素材留在本機，不包含在安裝包或原始碼提交中。

## 從原始碼開發

需要 Node.js 24。

```powershell
npm ci
npm run dev
```

桌面開發：npm run desktop:dev。打包 Windows x64：npm run desktop:dist:win。

驗證：npm run lint、npm run verify:floade、npm run verify:no-internal-ai、npm run build。

GitHub Actions 的 CI 驗證目前 Floade 功能；「Windows desktop」可手動建置安裝檔。

## 授權與來源

程式碼維持 **AGPL-3.0-or-later**，詳見 [LICENSE](LICENSE)。Floade 圖示來自 Floade need，其 MIT 聲明保留於 [FLOADE-NEED-LICENSE.txt](assets/branding/FLOADE-NEED-LICENSE.txt)，也隨安裝包提供。

保留上游 Git 歷史、[原始 README](README_UPSTREAM.md) 與貢獻者資訊。上游 README 中的內建 AI 配置說明不適用於此分支。改版說明見 [README_FLOADE.md](README_FLOADE.md)。

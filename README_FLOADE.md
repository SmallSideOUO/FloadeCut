# Floade

Floade 是以 [OpenChatCut](https://github.com/0xsline/OpenChatCut) 為基礎的開源影片剪輯器。本分支維持 **AGPL-3.0-or-later**，原始授權與上游貢獻者資訊保留於 LICENSE 和原有 README。

介面採用 Floade need 的深色、圓角與淡藍重點色，預設繁體中文。介面用語會轉換，使用者的字幕、檔名與專案內容保持原樣。支援手動素材匯入、時間軸剪輯、特效、轉場、字幕、預覽與匯出。

Floade 圖示取自 Floade need 的 assets/tray.png 與 assets/tray.ico；其 MIT 授權與著作權聲明保留於 assets/branding/FLOADE-NEED-LICENSE.txt。OpenCC.js 用於繁中介面轉換。

## 外部 AI 操作

AI 對話與上下文管理交由外部 Codex 等工具負責。Floade 已移除內建聊天側欄、模型推論、供應商金鑰設定、訂閱登入，以及內建 AI 生成與語音辨識服務。

保留本機 MCP 剪輯工具與草稿審閱介面。可從編輯器上方的「外部 Agent 接入 (MCP)」取得連線資訊。外部工具可以讀取專案、建立修改草稿與送交審閱；使用者在剪輯器預覽、套用或捨棄修改。預設需要手動核准，不自動更動外部 Codex 的帳號或設定。

本機 MCP 端點為 /api/external-mcp/mcp，使用 Bearer token 驗證。一般編輯器偏好設定使用 GET /api/settings 和 POST /api/settings，僅開放 UI_LOCALE、MEDIA_DIR、DATA_DIR。寫入保留本機請求來源檢查；不接受模型或 AI 金鑰設定。

## 開發與驗證

需要 Node.js 24。使用 npm run dev、npm run desktop:dev 與 npm run build。開發資料採隔離 profile，保留專案格式與儲存相容性。已停用此分支自動安裝上游桌面更新。

- npm run verify:floade：確認內建 AI 已移除、外部剪輯草稿與核准流程正常。
- npm run verify:no-internal-ai：建置並檢查前端未載入內建 AI 客戶端、聊天面板或供應商設定。
- npm run lint：檢查程式碼。

原有 README 保留上游資訊；其中內建 AI 與供應商配置說明不適用於此分支。

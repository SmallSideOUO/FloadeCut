# Floade

Floade 是以 [OpenChatCut](https://github.com/0xsline/OpenChatCut) 為基礎的開源影片剪輯器。本分支維持 **AGPL-3.0-or-later**，原始授權與上游貢獻者資訊保留於 LICENSE 和原有 README。

介面採用 Floade need 的深色、圓角與淡藍重點色，預設繁體中文。介面用語會轉換，使用者的字幕、檔名與專案內容保持原樣。支援手動素材匯入、時間軸剪輯、特效、轉場、字幕、預覽與匯出。

Floade 圖示取自 Floade need 的 assets/tray.png 與 assets/tray.ico；其 MIT 授權與著作權聲明保留於 assets/branding/FLOADE-NEED-LICENSE.txt。OpenCC.js 用於繁中介面轉換。

## 外部 AI 操作

AI 對話與上下文管理交由外部 Codex 等工具負責。Floade 已移除內建聊天側欄、模型推論、供應商金鑰設定、訂閱登入，以及內建 AI 生成與語音辨識服務。

保留本機 MCP 剪輯工具與草稿審閱介面。可從編輯器上方的「外部 Agent 接入 (MCP)」取得連線資訊。外部工具可以讀取專案、建立修改草稿與送交審閱；使用者在剪輯器預覽、套用或捨棄修改。預設需要手動核准，不自動更動外部 Codex 的帳號或設定。

本機 MCP 端點為 /api/external-mcp/mcp，使用 Bearer token 驗證。一般編輯器偏好設定使用 GET /api/settings 和 POST /api/settings，僅開放 UI_LOCALE、MEDIA_DIR、DATA_DIR。寫入保留本機請求來源檢查；不接受模型或 AI 金鑰設定。

## 開發與驗證

### 合併片段與馬賽克

在時間軸多選兩個以上片段後，右鍵選「合併為一個片段」。片段會成為一個可移動、裁切的合併片段，原始素材、剪輯間隔、內部轉場和既有特效會保留。選取合併片段，在右側「特效」新增區域性馬賽克，可在預覽拖動位置與調整範圍，也能從特效庫拖入馬賽克。

右鍵「取消合併片段」會依目前位置與裁切範圍還原原始片段，並移除合併層上的馬賽克等效果；合併與取消合併均支援復原／重做，存檔重開後也能取消。取消前需將合併片段恢復為 1× 速度並移除外部轉場。鎖定軌道、多機位組、未完整選取的連結組，以及仍驅動字幕的來源片段會顯示處理提示，避免遺失剪輯關聯。

### 本機命令匯出

桌面版開啟時，可透過本機 API 操作已存檔的專案，不需要操作視窗：

- `GET /api/commands/projects`：列出專案。
- `POST /api/commands/exports`：傳入 `projectId`、`resolution`、`fps`，回傳 `renderId`。
- `GET /api/commands/exports/{renderId}`：查詢進度、錯誤及成片路徑。

這些路由沿用本機編輯器的 loopback、Origin 和 Sec-Fetch-Site 驗證；不提供任意 shell 指令執行。

命令列會等待匯出完成並儲存成片，不覆蓋既有檔案：

```powershell
node cli/local-export.mjs --project <專案ID> --output "D:\影片\成片.mp4" --resolution 1080p --fps 60
```

預設連線位置為 `http://127.0.0.1:5199`，可用 `--url` 指定其他本機埠。

需要 Node.js 24。使用 npm run dev、npm run desktop:dev 與 npm run build。開發資料採隔離 profile，保留專案格式與儲存相容性。已停用此分支自動安裝上游桌面更新。

- npm run verify:floade：確認內建 AI 已移除、外部剪輯草稿與核准流程正常。
- npm run verify:no-internal-ai：建置並檢查前端未載入內建 AI 客戶端、聊天面板或供應商設定。
- npm run lint：檢查程式碼。

原有 README 保留上游資訊；其中內建 AI 與供應商配置說明不適用於此分支。

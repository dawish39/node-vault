# node-vault

> 判斷先於存檔。讓每一條入庫的知識都有可追溯的責任主體。

---

## 給文組人的懶人包

**這個專案在做什麼：**
你用 Claude 討論事情、做決策、整理想法，對話結束後把重要的內容存成筆記。node-vault 是讓這件事變得有系統的工具——它確保你存下來的每一條筆記，都是你自己確認過的判斷，而不是 AI 自動幫你整理的東西。

**用了之後會發生什麼：**
六個月後打開任何一條筆記，你會知道：這個結論是在什麼情況下做的、當時考慮過哪些選項、哪些前提如果改變了結論就不成立。不會再看著自己寫的東西說「這是我說的還是 AI 說的」。

**為什麼用 Markdown（.md）檔案：**
純文字檔，任何裝置、任何軟體都能打開，不會因為某個 app 停止服務就消失。不需要特定軟體才能讀，十年後照樣能用記事本打開。Obsidian 用它，NotebookLM 能匯入它，Google Drive 能存它——整套工作流不被任何單一平台鎖住。

---

用 LLM 用久了，有沒有覺得它變笨了？

用 LLM 工作，過了一陣子卻完全想不起來自己做了什麼？

用 LLM 得出結論，但完全忘記推論過程是什麼？

**這不是 LLM 的問題。是你的判斷沒有被記錄下來——每次對話結束就消失了。**

---

## 1. 這些症狀從哪裡來

問題出在互動迴圈本身：你給出模糊的問題，AI 給出通用的回答，你接受，下一輪問得更模糊。迴圈跑久了，你開始依賴 AI 替你定義問題、組織答案，自己的輸入品質在退化，但你感受到的是「AI 變笨了」。

更深的問題是：每次對話結束，你帶走的只有結論。**判斷歷程**——你考慮過哪些選項、為什麼選這個、當時的前提是什麼——全部留在視窗裡。六個月後你取回那份結論，不知道它在什麼條件下成立，也不知道當時的前提現在還算不算數。下次遇到類似問題，從零開始。

node-vault 的設計起點就是這個具體限制：Claude 跨對話沒有持久記憶，對話結束後消失的不只是資訊——是判斷歷程。

---

## 2. node-vault 是什麼

node-vault 是一套跑在 Obsidian[^1] 上的個人知識管理系統，核心設計只有一件事：**在每次入庫時強制人工判斷**，讓知識庫裡的每一個節點都有可追溯的責任主體。

### 節點是什麼

**節點（node）** 是 node-vault 的基本單位，一個節點對應一個 `.md` 檔案，記錄一次對話裡產出的判斷與決策歷程。

每個節點由兩個部分組成：

**frontmatter**（檔案開頭的元資料，由 `---` 包住）：

```
---
date: 2026-04-09
keywords: [關鍵字1, 關鍵字2, 關鍵字3]
see_also: ["[[節點A檔名]]", "[[節點B檔名]]"]
status: draft
---
```

| 欄位 | 用途 |
|---|---|
| `date` | 建立日期，帳本與索引依賴此欄位排序 |
| `keywords` | 你六個月後會用來找這個節點的詞，不是內容摘要 |
| `see_also` | 與這個節點相關的其他節點。YAML 陣列每一項用 Obsidian 雙括號連結格式 `[[節點檔名]]`，並用引號包住避免 YAML 解析把 `[[` 誤判為巢狀陣列 |
| `status` | `draft` 或 `done`，標示節點是否已完成 |

**正文**：記錄這次對話的決策歷程、考慮過的選項、結論、以及哪些前提如果改變結論就不成立（標記為 `[assumption — unconfirmed]`[^5]）。

### 系統架構

系統由五個元件構成，各司其職，資料流單向：

```
Claude + session-wrap-ex  →  GAS Web App  →  Google Drive  →  同步軟體  →  Obsidian
（產出與閘控）               （自動搬運）      （持久儲存）      （本地同步）    （導航視覺化）
```

| 元件 | 角色 |
|---|---|
| **Claude + session-wrap-ex**[^2] | 對話收尾與閘控。人工判斷在這裡發生，確認前節點不產出。 |
| **GAS Web App**[^3] | 判斷確認後的自動搬運與索引維護，無需人工介入。 |
| **Google Drive** | 跨裝置的 Markdown 實體檔案持久儲存。 |
| **同步軟體** | 將 Drive 上的節點同步到本地，銜接 Obsidian（需自行配置，見 Step 4）。 |
| **Obsidian** | 本地端的節點導航、雙向連結與關聯圖視覺化。 |

---

## 3. session-wrap-ex：系統的唯一入口

session-wrap-ex 是 node-vault 的核心 SKILL[^2]。沒有它就沒有標準化的節點產出，後面的 GAS、Drive、Obsidian 都接不起來。

### 如何觸發

在 Claude 對話視窗裡，對話接近尾聲時直接輸入以下任一詞即可觸發：

```
wrap up / 收尾 / 結束 / 打包 / 今天先到這
```

SKILL 也會在對話明顯收束且有重要產出時自動判斷觸發，不一定需要手動呼叫。

### 它做什麼

觸發後執行三步驟收尾協議：

| 步驟 | 執行者 | 動作 | 是否需要人工 |
|---|---|---|---|
| Step 1 | AI | 掃描對話，識別這次討論考慮過哪些選項、做了哪些決定、哪些問題仍然開放，提出節點結構草稿與 frontmatter 草稿 | AI 提案，無需操作 |
| ⏸ HARD STOP | SKILL 指令 | 在畫面上等待確認 keywords 與節點結構草稿。你不回應，Step 2 不執行，節點不產出。SKILL 在指令層要求 Claude 停止並等待確認；在指令遵循正常的情況下，Claude 在未收到確認前不繼續執行後續步驟。 | **是，必須** |
| Steps 2+3 | AI | 依據你確認後的 keywords 與結構，產出完整 Markdown 節點 + 本次對話的產出清單 | 否，自動執行 |

### keywords 確認的意義

keywords 確認不是填欄位。它強制你在入庫前回答一個問題：「**六個月後我會用什麼詞來找這個節點**」——而不是「這個節點在講什麼」。

這兩個問題的答案不一樣。「在講什麼」是內容摘要，「會用什麼詞找」是你自己的思維索引。前者讓 AI 替你定義，後者必須你自己決定。SKILL 在你給出答案之前要求 Claude 不繼續執行，這個閘門是 node-vault 的設計核心。



---

## 4. 節點管理

### 完整工作流

| 步驟 | 執行者 | 動作 |
|---|---|---|
| 對話結束，觸發 session-wrap-ex | — | — |
| Step 1 提案 | AI | 掃描對話，產出節點草稿與 frontmatter |
| ⏸ **HARD STOP** | **SKILL 指令 + 你** | **確認 keywords 與節點結構草稿（不可省略）** |
| Steps 2+3 產出 | AI | 產出完整 MD + 產出清單 |
| 開啟 GAS Web App 頁面，將 MD 檔案拖入上傳區，按 submit | 你 | 上傳節點（唯一需要手動操作的步驟）。頁面 URL 來自 Step 2 部署時複製的 Web App 連結。 |
| uploadToDrive() | GAS | 寫入 Google Drive 節點資料夾 |
| appendToIndex() | GAS | 在 `_node-index.md` 自動新增一行 |
| 同步軟體 | 自動 | 節點進入 Obsidian vault |

### 工作流前置條件層

以下四件事不在工作流定義內，但決定工作流能否被正確驅動：

| 前置條件 | 說明 |
|---|---|
| **任務邊界管理** | 每個對話對應單一任務類型，不混用。例如「邊討論架構邊處理 bug」會讓 Step 1 不知道這次對話要記錄什麼，提案品質下降。 |
| **即時糾錯** | 對話中發現 AI 說錯了，當場糾正，不留到下一輪。累積的誤解最後會進節點。 |
| **收尾時機的主動判斷** | 有產出判斷的對話才跑收尾，例如架構決策、概念釐清、策略討論。純操作類對話（裝機、指令執行、即時排障）通常不需要。 |
| **資源優先序取捨** | 時間與 token 有上限，需要在對話之間做優先序判斷。這是使用習慣層的能力，工具無法替代。 |

工具是閘道，前置條件是讓閘道有機會被走到的路。

### 入庫判斷標準

| 值得入庫 | 不需入庫 |
|---|---|
| 對話產出了可複用的框架或判斷 | 純執行性的對話 |
| 決策歷程有追溯價值 | 已有更完整節點覆蓋的討論 |
| 概念在多個情境下都會用到 | 疲憊或時間壓力下無法做出有品質判斷的當下 |

「今天先不入庫」是合法的品質控管動作，不是失敗。

### `_node-index.md`：問責帳本[^4]

不是普通的目錄，是決策歷程的可查帳本。每個節點對應一行：

```
YYYY-MM-DD | keywords | 節點檔名
```

由 GAS `appendToIndex()` 在每次上傳後自動寫入，不需手動維護。

### 召回路徑

三條路徑覆蓋所有召回需求：

- **Obsidian 關聯圖**：視覺化節點連結，適合關聯導航
- **`_node-index.md`**：全量帳本，跨環境可讀，直接 Ctrl+F
- **NotebookLM**：MD 格式相容，可直接匯入；跨節點語意查詢的實際效果 `[assumption — unconfirmed]`[^5]

---

## 5. 部署步驟

### 你需要能夠做到這些事

在開始之前確認自己能處理以下操作，卡在任何一點都會讓部署中斷：

| 需要的能力 | 用在哪裡 |
|---|---|
| 在 Google Drive 建立資料夾，並從 URL 取得資料夾 ID | Step 1 |
| 在 Google Apps Script 貼上程式碼、設定變數、點選部署 | Step 2 |
| 在 Claude.ai 設定頁下載並上傳 `SKILL.md` 檔案 | Step 3 |
| 安裝同步軟體、設定本地資料夾,在 Obsidian 建立 vault | Step 4 |

不需要會寫程式，但需要能照步驟操作網頁介面。

### 前置需求

- Google 帳號
- Claude 訂閱方案:**建議使用 Pro / Max / Team / Enterprise 其一**（自訂 SKILL 上傳建議使用 Pro 方案以上）[^6]
- Obsidian(任意平台)
- 本地或雲端同步軟體(Obsidian Sync、Syncthing、rclone、Google Drive 桌面版等)——詳見 Step 4

### Step 1：建立 Google Drive 資料夾

建立兩個資料夾，記下各自的資料夾 ID（URL 中 `folders/` 後的字串）：

- **節點資料夾**：存放 MD 節點檔案
- **索引資料夾**：存放 `_node-index.md`（可與節點資料夾相同）

### Step 2：部署 GAS Web App

1. 前往 [Google Apps Script](https://script.google.com)，新增專案
2. 將本 repo 的 `Code.gs` 與 `index.html` 內容貼入對應檔案
3. 設定 Script Properties（「專案設定」→「指令碼屬性」）：

| Key | 值 |
|---|---|
| `NODE_FOLDER_ID` | 節點資料夾的 Drive ID |
| `INDEX_FOLDER_ID` | 索引資料夾的 Drive ID |
| `INDEX_FILENAME` | `_node-index.md` |

4. 部署為 Web App：「部署」→「新增部署」→ 類型選「網頁應用程式」→ 執行身分選「我」→ 存取權選「知道連結的任何人」→「部署」

   > ⚠️ **安全說明**：此設定不含身份驗證，知道 URL 的人即可呼叫後端。URL 請勿公開分享。個人單機使用場景下風險可接受；如有顧慮，見 Section 6 Known boundaries。
5. 複製 Web App URL，日後拖入 MD 時開啟此頁面

**驗證**：用瀏覽器打開 Web App URL，應該看到上傳介面。若出現錯誤頁面，最常見原因是 Script Properties 三個 key 有空白或填錯 Drive ID。

### Step 3：安裝 session-wrap-ex SKILL

本 repo 的 [skills/session-wrap-ex/SKILL.md](https://github.com/dawish39/node-vault/blob/main/skills/session-wrap-ex/SKILL.md)

安裝步驟：

1. 從本 repo 的 [skills/session-wrap-ex/SKILL.md](https://github.com/dawish39/node-vault/blob/main/skills/session-wrap-ex/SKILL.md) 下載skill.md檔案
2. 在 Claude.ai 網頁版登入，進入 **Settings → Capabilities → Skills**（或 **Customize → Skills**，依方案而異），點「+」按鈕上傳skill.md檔案
3. 上傳成功後在 Skills 清單裡會看到 `session-wrap-ex`，確認已啟用（toggle on）
4. 開新對話，輸入觸發詞（`收尾` / `wrap up` 等）測試是否被 Claude 載入並執行

**驗證**：觸發收尾後，Claude 應該開始執行 Step 1 掃描，並在 Step 1 結束後停住等待你確認 keywords。若 Claude 直接跳過 HARD STOP 往下產出完整 MD，代表 SKILL 沒有被載入——回到 Skills 清單確認開關是否啟用、或重新上傳單檔。

> **桌面版同步**：Claude 桌面版會自動從網頁版同步 Skills，不需重複上傳。Claude Code 與 API 是獨立環境，需另行安裝(本 README 範圍內不涵蓋)。

### Step 4：設定本地同步與 Obsidian

**同步軟體選擇(擇一)**:

| 方案 | 適用情境 | 設定難度 |
|---|---|---|
| **Google Drive 桌面版**[^7] | 只有一台主要工作裝置,想最快跑通 | 低 |
| **Syncthing** | 多台裝置互相同步,不想完全依賴 Google | 中 |
| **Obsidian Sync**(付費) | 已是 Obsidian 付費用戶,想用官方方案 | 低 |
| **rclone + 排程** | 熟悉命令列、想要完全控制 | 高 |

**最簡配置(Google Drive 桌面版)**:
1. 安裝 Google Drive 桌面版,登入 Google 帳號
2. 在「偏好設定」將 Step 1 建立的節點資料夾設為「可在本地使用」
3. 記下本地同步後的實體路徑(例如 `G:\我的雲端硬碟\node-vault\nodes`)

**Obsidian 設定**:
- 建立 vault,vault 路徑指向上一步的本地同步路徑
- 建議開啟 Graph View,初期規模已可有效導航

> **Fallback(先不裝 Obsidian 也能用)**:如果你暫時不想碰 Obsidian,只用 **GAS Web App + Google Drive 網頁版**也能跑通最小流程——節點會寫入 Drive、索引會自動更新,你可以在 Drive 網頁版直接開啟 `_node-index.md` 查找節點、點擊連結開啟對應的 MD 檔案。只是沒有 Obsidian 的雙向連結與關聯圖視覺化。Obsidian 可以之後再補。

### 驗證整套流程是否跑通

部署完成後，做一次完整的測試跑：

1. 在 Claude 開一個新對話，隨便聊幾句
2. 輸入「收尾」觸發 session-wrap-ex
3. 確認 Step 1 有產出草稿，且在 HARD STOP 後停住等待回應
   - 若未停住、Claude 直接產出完整 MD：先確認 SKILL 是否正確載入（回到 Step 3）；若 SKILL 已正確載入但仍未停住，重新觸發收尾再試一次。SKILL 是指令層機制，極少數情況下 Claude 可能未遵循。
4. 確認 keywords 後讓它產出完整 MD
5. 將 MD 拖入 GAS Web App，按 submit
6. 前往 Google Drive 節點資料夾，確認 MD 檔案已出現
7. 打開 `_node-index.md`，確認有新增一行
8. 等同步軟體跑完，確認 Obsidian vault 裡出現該節點

全部 8 步通過，系統正常運作。

---

## 6. 已知風險與邊界

**覆蓋率損失**：未入庫的東西會消失。這是主動選擇，不是系統限制。寧可少，但每一條都知道是誰的判斷、在什麼脈絡下做的。

**個人紀律依賴**：制度成本由個人紀律吸收（詳見 Section 4 工作流前置條件層）。多人協作場景下流程層需另行設計，尚未實作。

### Known boundaries

- 節點檔名含有特殊字元（如括號、斜線）時，GAS 在轉換內部連結格式時可能失敗，修法已確認，尚未部署驗證
- GAS Web App 無身份驗證層，知道連結者皆可呼叫後端
- 批次上傳高並發下若觸發 Drive API 速率限制，實際行為未實測
- NotebookLM 作為召回路徑的實際效果未系統性測試

---

## 授權

MIT License

---

[^1]: **Obsidian**：基於本地 Markdown 檔案的個人知識管理工具，支援雙向連結與圖譜視覺化。免費使用，資料存在本地。
[^2]: **SKILL**：Claude 的結構化指令集。透過特定格式讓 Claude 在對話中執行固定的多步驟協議，並在指定步驟要求停止等待人工介入。SKILL 是指令層機制（非執行層強制），實務上 Claude 對 SKILL 的遵循率高，但並非絕對保證；發現未停住時請參考 Section 5 的故障排除。
[^3]: **GAS Web App**：Google Apps Script 部署的瀏覽器介面。拖入 MD 檔案、填入 keywords、按送出，後端自動執行寫入 Drive 與更新索引，無第三方套件相依。
[^4]: `_node-index.md` 由 GAS `appendToIndex()` 自動維護。每次 `upload()` 成功後自動執行附加，不存在則自動建立，不需手動寫入。
[^5]: `[assumption — unconfirmed]`：節點正文裡的不確定性標記。標示推測性判斷及其依據，讓六個月後取回節點時能判斷當時的前提現在是否還成立。
[^6]: 自訂 SKILL 上傳功能建議使用 Pro 方案以上。Anthropic 官方政策可能隨時調整，以 [Anthropic 官方說明](https://support.claude.com/en/articles/12512180-use-skills-in-claude) 為準。
[^7]: Google Drive 桌面版(Google Drive for desktop)是 Google 官方桌面同步工具,免費,支援 Windows / macOS。會把 Drive 檔案對應到本地資料夾,讓 Obsidian 可以當成一般資料夾讀取。

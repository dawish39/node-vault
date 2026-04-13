---
name: session-wrap-ex
description: session-wrap 的升級版，在對話收尾時同步產出 Obsidian frontmatter 與索引關鍵字草稿，方便後續歸檔。觸發條件與 session-wrap 相同：wrap up / 收尾 / 結束 / 打包 / 今天先到這，或對話明顯收束且有重要產出時自動觸發。
---

# Session Wrap Extended

對話收尾流程，整合節點歸檔所需的 frontmatter 與索引關鍵字。三個步驟依序執行，不得跳過、合併或重排。

**執行規則：**

* 觸發後第一個輸出必須是 `▶ Step 1`，否則視為執行失敗。
* Step 1 必須以 `⏸ Waiting for confirmation` 結尾後停止，不得繼續。
* 收到使用者回應前，不得開始 Steps 2 和 3。

---

## ▶ Step 1: Node Proposal + Frontmatter Draft

掃描對話，識別三種內容：

1. **Decision trail** — 考慮過哪些選項、各自為何被選擇或放棄
2. **Conversation arc** — 問題如何演進、做了哪些假設
3. **Final state** — 哪些已收斂、哪些仍開放

輸出以下所有欄位，一個都不能省：

**Anchor**: `節點主題 — 一句話描述`

**Proposed structure**: 列出 `##` 區塊標題，每個標題附一句說明（3–6 個區塊）。必須反映決策歷程與結論，不只是主題分類。

**Unverified assumptions**: 列出推測性或未確認的判斷。若無則寫「None」。

**Suggested sub-topics**（若無則省略）: `→ Suggest separate node: 主題名稱（原因）`

**Frontmatter draft**:
```
---
date: YYYY-MM-DD
keywords: [關鍵字1, 關鍵字2, 關鍵字3]
see_also: []
status: draft
---
```

Keywords 說明：用你**下次會用來找這個節點的詞**，不是節點在講什麼的摘要。3–5 個為佳。

結尾輸出：
```
⏸ 請確認以下兩件事後再繼續：
1. 節點結構（ok 或給修正）
2. keywords（確認或修改）
說 "skip" 跳過 Step 2 直接到清單。
```

然後停止。不得繼續執行任何步驟。

---

## ▶ Steps 2 and 3: Output + Checklist

收到使用者確認或修正後，輸出 `▶ Steps 2 and 3`，然後不停頓地執行兩個項目。

### Step 2: 產出知識節點

若使用者說 "skip" → 跳過此步驟，直接執行 Step 3。

若使用者確認或給出修正 → 在對話裡 inline 產出 Markdown 文件，使用確認後的結構。

檔案標頭格式：

```
---
date: YYYY-MM-DD
keywords: [確認後的關鍵字]
see_also: []
status: draft
---

# 主題 — 副標題

**Created**: YYYY-MM-DD
**Last revised**: YYYY-MM-DD（修訂說明）
**Source**: 一句話描述這次對話
```

內容規則：

* 保留完整脈絡、決策歷程與結論。不只寫結果——寫**為什麼**是這個結果。
* 每個 `##` 區塊必須自成一體，可被獨立引用。
* 推測性判斷標記為 `[assumption — unconfirmed]` 並說明推測依據。
* 操作性內容使用表格或清單。
* 交叉引用格式：
  * 已存在的節點：`→ See: [[節點檔名不含副檔名]]`
  * 尚未建立的節點：`→ See (pending): 節點名稱.md`（維持純文字，不加雙括號）
* 若對話產出了可複用的框架，加入 `## Core insight: XXX` 區塊。
* 以 `## Known boundaries` 結尾。

不要逐字謄錄對話。用自己的語言重新組織。

### Step 3: 產出清單

掃描對話中所有產出物（明確建立的檔案、產出的 Markdown 文件、提及的 artifacts）。

格式：

```
📋 本次產出，請確認已下載：

🔁 脈絡交接（下次對話用）
- [ ] 檔名.md

📚 知識節點（Obsidian 用）
- [ ] 檔名.md — 一句話說明
```

若只有一種類型，省略分類標題直接列清單。若無產出物，跳過此步驟。

清單結尾加一行：
```
📤 上傳提醒：下載知識節點後，連同上方確認的 keywords 一併存入你的歸檔系統。
```

兩個步驟完成後，以一句話結尾。不展開說明。

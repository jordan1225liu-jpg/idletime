# idletime 視覺風格指南 v0.1

> 「可愛中世紀」風格的具體表達 —— 給後續每一個新功能(以及未來幫忙的人)當參考。

---

## 1. 顏色系統

所有 embed 都從這 5 個顏色挑(在 `apps/bot/src/lib/embeds.ts` 的 `COLORS` 常數):

| 用途 | 名稱 | Hex | 何時用 |
|---|---|---|---|
| 🟫 棕 | `PRIMARY` | `#8B4513` | 角色面板、身分相關、預設 |
| 🟨 金 | `GOLD` | `#D4AF37` | 邀請、歡迎、節慶、寶箱 |
| 🟩 綠 | `GREEN` | `#3CB371` | 農場、成功事件、accept |
| 🟥 紅 | `RED` | `#CC3333` | 錯誤、警告、decline |
| 🟦 藍 | `BLUE` | `#4682B4` | 純資訊、教學、提示(目前未用,保留) |

**規則**:
- 中世紀色 = 暖色為主。**禁用霓虹/螢光色**(壞氣氛)
- 一個 embed 一個顏色,不要混
- 警告類紅色用得謹慎,讓玩家看到紅色 = 確定要注意

---

## 2. Emoji 字典

集中在 `apps/bot/src/lib/embeds.ts` 的 `EMOJI` 常數,讓後續整個遊戲統一用法。

### 系統狀態
| 用途 | Emoji | 程式碼 |
|---|---|---|
| 慶祝/成功事件 | 🎉 | `EMOJI.success` |
| 完成、可採收 | ✨ | `EMOJI.ready` |
| 警告 | ⚠️ | `EMOJI.warning` |
| 錯誤、拒絕 | ❌ | `EMOJI.error` |
| 鎖定、未解鎖 | 🔒 | `EMOJI.locked` |
| 等待中 | ⏳ | `EMOJI.pending` |
| 刷新 | 🔄 | `EMOJI.refresh` |

### 資源 / 數值
| 用途 | Emoji | 程式碼 |
|---|---|---|
| 體力 | ⚡ | `EMOJI.energy` |
| 金幣 | 💰 | `EMOJI.gold` |
| 經驗值 / 技能進度 | 🎯 | `EMOJI.exp` |
| 角色等級 | ⚔️ | `EMOJI.level` |

### 動作
| 用途 | Emoji | 程式碼 |
|---|---|---|
| 收成 | 🚜 | `EMOJI.harvest` |
| 種植 | 🌱 | `EMOJI.plant` |
| 拜訪 / 社交 | 🤝 | `EMOJI.visit` |

### 實體 / 標題
| 用途 | Emoji | 程式碼 |
|---|---|---|
| 角色標題 | 🛡️ | `EMOJI.character` |
| 農場標題、品牌 emoji | 🌿 | `EMOJI.farm` / `EMOJI.brand` |
| Bot 自己 | 🤖 | `EMOJI.bot` |
| 公會 / 位置 | 📍 | `EMOJI.location` |
| 空田、空格 | ⬜ | `EMOJI.empty` |

### 作物 emoji
作物 emoji 各自 unique,定義在 `apps/bot/src/lib/crops.ts` 的 `CROPS`(不放到 EMOJI 字典,因為跟「資料」綁在一起):

🌾 小麥 · 🥕 胡蘿蔔 · 🥔 馬鈴薯 · 🍅 番茄 · 🌽 玉米 · 🎃 南瓜 · 🌶️ 辣椒 · 🤍 棉花 · 🍓 草莓 · 🍇 葡萄 · 🍉 西瓜 · 🍵 茶葉 · 🍎 蘋果 · 🍷 釀酒葡萄 · 🌿 神祕藥草 · 🌟 黃金小麥

---

## 3. Embed 模板規則

### 標題
| 場景 | 模板 | 範例 |
|---|---|---|
| 角色相關 | `🛡️ {name}` | `🛡️ 伊森` |
| 場景介面 | `🌿 {name} 的 {place}` | `🌿 伊森的農場` |
| 事件 | `{emoji} {event}!` | `✨ 拜訪完成!` |
| 邀請類 | `🌿 {action}邀請` | `🌿 拜訪邀請` |
| 錯誤 | (不放標題,只 description) | `⚠️ 體力不足` |

### Description
- 開頭通常放 `📍 {公會名}` 或 location 資訊
- 用空行分段,不要塞滿
- 用 `>` quote block 強調「上一個動作的結果」(notification line)

### Fields
- 標題前帶 emoji:`❤️ 體力`、`💰 金幣`、`🎯 技能`
- 同類型欄位用 `inline: true` 排在一起(最多 3 個一排)
- 大段內容(如清單)用 `inline: false`

### Footer
- 狀態 embed:`加入於 2026/5/26`、`最後更新 X`
- 事件 embed:用 `.setTimestamp()` Discord 會自動算「剛剛」「3 分前」等

### 進度條
- 統一用 `▰▱` 風格 (helper 在 `embeds.ts` 的 `makeProgressBar`)
- Width 約定:
  - **8** — 緊湊型(寫在 field inline 裡)
  - **10** — 預設
  - **12** — 寬鬆型(田地、長條狀態)

---

## 4. 視覺資產(圖片)

### MVP 暫時不需要
emoji + Discord 內建 UI 已經足夠表達遊戲狀態。

### Phase 2 開始需要的
| 資產 | 規格 | 用途 | 急迫度 |
|---|---|---|---|
| **Bot 頭像** | 512×512 PNG | Discord App 頭像 | ⭐⭐⭐ 高 |
| **伺服器 banner** | 960×540 PNG | 用在 Discord App description | ⭐⭐ 中 |
| **作物縮圖** | 256×256 PNG × 16 | embed `setThumbnail()` | ⭐ 低 |
| **怪物縮圖** | 256×256 PNG × N | 戰鬥系統開後用 | (還沒做) |

### AI 生圖建議流程
1. 用下方 prompt 在 ChatGPT Plus (DALL-E 3) 或 Imagen 生
2. 滿意的版本下載
3. 上傳到 Cloudflare R2(免費 10GB,S3 相容)或先用 Discord CDN(上傳到伺服器後右鍵「複製連結」)
4. 程式碼裡 `embed.setThumbnail(url)`

---

## 5. AI Prompt 模板

### 🤖 Bot 頭像(MVP 就需要)
```
A cute chibi medieval villager character portrait, soft pastel watercolor
style, friendly smile, wearing a straw hat and simple peasant clothes,
holding a small wheat sprig, cozy Studio Ghibli aesthetic with Stardew
Valley vibes, warm browns and forest greens with hints of gold, centered
portrait composition, soft circular background or transparent, suitable
for a Discord bot avatar, 512x512, no text.
```

### 🏰 伺服器 banner(描述 bot 的官方視覺)
```
A serene medieval village landscape at golden hour, soft pastel
watercolor style, thatched-roof stone cottages, wheat fields and a
winding cobblestone path, distant misty mountains, no people, cozy
Studio Ghibli aesthetic, warm earthy tones with golden highlights,
peaceful and inviting atmosphere, 16:9 widescreen, 960x540, no text.
```

### 🌾 作物縮圖(Phase 2 批次生成)
把 `[ITEM]` 換成下方對應字串:

```
A single [ITEM] in cute chibi RPG icon style, centered composition on a
soft watercolor circular background with subtle medieval village vibes,
soft browns and forest greens palette, Studio Ghibli aesthetic, clean
inventory icon look, no text, no border, 256x256, transparent or solid
soft background.
```

| 作物 | `[ITEM]` 填什麼 |
|---|---|
| wheat | a golden wheat sprig with full grains |
| carrot | a bright orange carrot with leafy green top |
| potato | a brown freshly-dug potato with a sprig of dirt |
| tomato | a glossy red ripe tomato with green stem |
| corn | a golden corn cob partly husked |
| pumpkin | an orange pumpkin with a curly green stem |
| chili | a bright red chili pepper with green stem |
| cotton | a soft white cotton boll on a brown stem |
| strawberry | a glossy red strawberry with green leaves |
| grape | a bunch of purple grapes |
| watermelon | a striped green watermelon, whole |
| tea | tea leaves with small white flowers |
| apple | a glossy red apple with leaf and stem |
| winegrape | a bunch of deep red wine grapes on a vine |
| herb | a glowing mystical green herb with purple flower |
| goldwheat | a wheat sprig made entirely of glowing gold |

### 🐗 未來怪物(Phase 2)
```
A cute chibi [MONSTER NAME] enemy character, soft pastel watercolor
style, friendly-menacing expression (it's a kids-friendly RPG enemy),
Studio Ghibli aesthetic, browns and forest greens palette, centered
composition on soft background, 256x256, no text.
```

### 推薦的 AI 工具

| 工具 | 費用 | 優點 |
|---|---|---|
| **ChatGPT Plus (DALL-E 3)** | $20/月 | 上手最快、品質穩 |
| **Google Imagen (AI Studio)** | **免費!** | 品質高,額度寬 |
| **Midjourney** | $10/月 | 風格化最強,需在 Discord 用 |
| Stable Diffusion (本機) | 免費但要顯卡 | 完全可控,適合大量生成 |

---

## 6. 語氣與用字

| 規則 | 範例 |
|---|---|
| 用「你」不用「您」 | ✅ 你的小麥成熟了 / ❌ 您的小麥已經成熟 |
| 指令用 backtick | ✅ 用 `/farm` 看看 |
| 全形標點不混半形 | ✅ 你還沒有角色!用 `/start` 開始 |
| Emoji 點綴,不堆疊 | ✅ 收成!🎉 / ❌ 收成 🎉 ✨ 🌾 🎊 ✨ |
| 中世紀調性,不用 meme | ✅ 好田豐收 / ❌ 麻煩你 EZ 過關 |

---

## 7. 未來補充

- [ ] 升級時的 Discord GIF 慶祝動畫
- [ ] 公會 banner 客製化(每個 Discord 伺服器自己上傳)
- [ ] 季節主題色(春櫻、夏綠、秋黃、冬白)
- [ ] 玩家頭像框(裝飾性)
- [ ] embed setAuthor() 一致化(等 bot 頭像生好再做)

---

**文件版本**:v0.1
**最後更新**:2026-05-26

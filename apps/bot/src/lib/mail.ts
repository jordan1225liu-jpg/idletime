import { prisma, Prisma } from '@idletime/db';

/** 信件 N 天後過期(未領取就消失)。改這裡就能調整保存期限。 */
export const MAIL_EXPIRY_DAYS = 30;

/** admin 一封信最多帶幾種物品(指令的 item 欄位數量)。 */
export const MAX_ATTACHMENT_SLOTS = 3;

/** /mail 信箱一次最多顯示幾封未領取的信。 */
export const MAIL_INBOX_LIMIT = 10;

/** 領取全部時最多一次處理幾封(避免極端情況一次掃太多)。 */
const CLAIM_ALL_LIMIT = 200;

export interface MailAttachment {
  itemId: string;
  quantity: number;
}

/** 附件 + 從型錄解析出的顯示資訊 */
export interface ResolvedAttachment extends MailAttachment {
  name: string;
  emoji: string;
}

export interface InboxMail {
  id: number;
  title: string;
  body: string;
  gold: number;
  attachments: ResolvedAttachment[];
  senderId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

/** 把 DB 的 Json 欄位安全地解析成 MailAttachment[](防髒資料)。 */
function parseAttachments(raw: Prisma.JsonValue): MailAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: MailAttachment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const itemId = typeof obj.itemId === 'string' ? obj.itemId : '';
    const quantity = Number(obj.quantity);
    if (itemId && Number.isFinite(quantity) && quantity > 0) {
      out.push({ itemId, quantity: Math.floor(quantity) });
    }
  }
  return out;
}

// ─── Admin:發送廣播信 ─────────────────────────────────────────

export type SendMailResult =
  | { ok: true; mailId: number; gold: number; attachments: ResolvedAttachment[]; expiresAt: Date }
  | { ok: false; reason: string };

/**
 * Admin 廣播一封信給全體玩家(全域信:建立 1 個 Mail row,玩家各自領取)。
 * 會驗證所有 itemId 都在型錄裡(否則之後玩家領取時會撞 FK 約束)。
 * 允許純文字公告(gold = 0 且無附件)。
 */
export async function sendBroadcastMail(params: {
  title: string;
  body: string;
  gold: number;
  attachments: MailAttachment[];
  senderId: string;
}): Promise<SendMailResult> {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title) return { ok: false, reason: '信件標題不能空白' };
  if (!body) return { ok: false, reason: '信件內容不能空白' };
  if (title.length > 200) return { ok: false, reason: '標題太長(上限 200 字)' };
  if (body.length > 1500) return { ok: false, reason: '內容太長(上限 1500 字)' };

  const gold = Math.max(0, Math.floor(params.gold || 0));

  // 合併同 itemId、濾掉數量 <= 0
  const merged = new Map<string, number>();
  for (const a of params.attachments) {
    const qty = Math.floor(a.quantity);
    if (!a.itemId || qty <= 0) continue;
    merged.set(a.itemId, (merged.get(a.itemId) ?? 0) + qty);
  }
  const attachments: MailAttachment[] = [...merged.entries()].map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));

  // 驗證 itemId 都存在型錄,並解析顯示資訊
  let resolved: ResolvedAttachment[] = [];
  if (attachments.length > 0) {
    const items = await prisma.item.findMany({
      where: { id: { in: attachments.map((a) => a.itemId) } },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const missing = attachments.filter((a) => !itemMap.has(a.itemId));
    if (missing.length > 0) {
      return { ok: false, reason: `未知物品 id:${missing.map((m) => m.itemId).join(', ')}` };
    }
    resolved = attachments.map((a) => {
      const it = itemMap.get(a.itemId)!;
      return { itemId: a.itemId, quantity: a.quantity, name: it.name, emoji: it.emoji ?? '📦' };
    });
  }

  const expiresAt = new Date(Date.now() + MAIL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const mail = await prisma.mail.create({
    data: {
      title,
      body,
      gold,
      attachments: attachments as unknown as Prisma.InputJsonValue,
      senderId: params.senderId,
      expiresAt,
    },
  });

  return { ok: true, mailId: mail.id, gold, attachments: resolved, expiresAt };
}

// ─── 玩家:讀信箱 ─────────────────────────────────────────────

/** 取得玩家「未領取且未過期」的信(新到舊),附件已解析成名稱/emoji。 */
export async function getInboxMails(
  userId: string,
  limit: number = MAIL_INBOX_LIMIT,
): Promise<InboxMail[]> {
  const now = new Date();
  const mails = await prisma.mail.findMany({
    where: {
      expiresAt: { gt: now },
      claims: { none: { userId } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  if (mails.length === 0) return [];

  // 批次解析所有附件物品(一次 query 撈全部名稱/emoji)
  const allIds = new Set<string>();
  const parsedByMail = new Map<number, MailAttachment[]>();
  for (const m of mails) {
    const atts = parseAttachments(m.attachments);
    parsedByMail.set(m.id, atts);
    atts.forEach((a) => allIds.add(a.itemId));
  }
  const items =
    allIds.size > 0 ? await prisma.item.findMany({ where: { id: { in: [...allIds] } } }) : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return mails.map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    gold: m.gold,
    senderId: m.senderId,
    expiresAt: m.expiresAt,
    createdAt: m.createdAt,
    attachments: (parsedByMail.get(m.id) ?? []).map((a) => {
      const it = itemMap.get(a.itemId);
      return {
        itemId: a.itemId,
        quantity: a.quantity,
        name: it?.name ?? a.itemId,
        emoji: it?.emoji ?? '📦',
      };
    }),
  }));
}

/** 玩家還有幾封未領取且未過期的信(用來顯示「還有 N 封」)。 */
export async function countInboxMails(userId: string): Promise<number> {
  return prisma.mail.count({
    where: { expiresAt: { gt: new Date() }, claims: { none: { userId } } },
  });
}

// ─── 玩家:領取 ───────────────────────────────────────────────

export type ClaimResult =
  | { ok: true; title: string; gold: number; attachments: ResolvedAttachment[] }
  | { ok: false; reason: string; alreadyClaimed?: boolean };

/**
 * 領取一封信:把金幣 + 附件物品放進角色。原子操作 ——
 * 先建立 MailClaim(複合 PK 防重複領),衝突就整筆 rollback,保證不會領兩次。
 */
export async function claimMail(userId: string, mailId: number): Promise<ClaimResult> {
  const mail = await prisma.mail.findUnique({ where: { id: mailId } });
  if (!mail) return { ok: false, reason: '找不到這封信' };
  if (mail.expiresAt <= new Date()) return { ok: false, reason: '這封信已經過期了' };

  // 物品/金幣放角色身上,所以必須先有角色
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { ok: false, reason: '你還沒建立角色,先用 /start' };

  const atts = parseAttachments(mail.attachments);
  const items =
    atts.length > 0 ? await prisma.item.findMany({ where: { id: { in: atts.map((a) => a.itemId) } } }) : [];
  const itemMap = new Map(items.map((i) => [i.id, i]));

  try {
    await prisma.$transaction(async (tx) => {
      // 先插領取紀錄:若已領過會撞複合 PK(P2002),整個交易 rollback → 不會重複發獎
      await tx.mailClaim.create({ data: { mailId, userId } });

      if (mail.gold > 0) {
        await tx.character.update({ where: { userId }, data: { gold: { increment: mail.gold } } });
      }
      for (const a of atts) {
        await tx.inventoryItem.upsert({
          where: { userId_itemId: { userId, itemId: a.itemId } },
          create: { userId, itemId: a.itemId, quantity: a.quantity },
          update: { quantity: { increment: a.quantity } },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, reason: '你已經領過這封信了', alreadyClaimed: true };
    }
    throw e;
  }

  const resolved: ResolvedAttachment[] = atts.map((a) => {
    const it = itemMap.get(a.itemId);
    return {
      itemId: a.itemId,
      quantity: a.quantity,
      name: it?.name ?? a.itemId,
      emoji: it?.emoji ?? '📦',
    };
  });
  return { ok: true, title: mail.title, gold: mail.gold, attachments: resolved };
}

export interface ClaimAllResult {
  claimedCount: number;
  gold: number;
  attachments: ResolvedAttachment[]; // 已跨信合併
  noCharacter?: boolean;
}

/** 一鍵領取所有未領取的信,回傳合併後的總獎勵。 */
export async function claimAllMails(userId: string): Promise<ClaimAllResult> {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return { claimedCount: 0, gold: 0, attachments: [], noCharacter: true };

  const mails = await getInboxMails(userId, CLAIM_ALL_LIMIT);
  let claimedCount = 0;
  let gold = 0;
  const merged = new Map<string, ResolvedAttachment>();

  for (const m of mails) {
    const r = await claimMail(userId, m.id);
    if (!r.ok) continue; // 已領 / 過期 → 跳過
    claimedCount += 1;
    gold += r.gold;
    for (const a of r.attachments) {
      const cur = merged.get(a.itemId);
      if (cur) cur.quantity += a.quantity;
      else merged.set(a.itemId, { ...a });
    }
  }

  return { claimedCount, gold, attachments: [...merged.values()] };
}

/**
 * 灰燼谷的居民(NPC)。主線劇情(campaign.ts)由這些人輪流帶領,
 * /town 也會介紹他們。改名字 / 加角色直接動這裡就好。
 */
export interface Npc {
  id: string;
  name: string;
  title: string;
  emoji: string;
  blurb: string;
}

export const TOWN_NAME = '灰燼谷';

export const NPCS = {
  mayor: {
    id: 'mayor',
    name: '艾德溫',
    title: '鎮長',
    emoji: '🧓',
    blurb: '灰燼谷的鎮長,溫和卻疲憊。一心想讓這座沒落的邊境小鎮重回昔日的炊煙與笑聲。',
  },
  tom: {
    id: 'tom',
    name: '湯姆',
    title: '老農',
    emoji: '🧑‍🌾',
    blurb: '種了一輩子田的老農夫,口頭禪是「土地不會辜負努力的人」。',
  },
  marina: {
    id: 'marina',
    name: '瑪琳娜',
    title: '漁婦',
    emoji: '🎣',
    blurb: '在河邊長大的漁婦,總能在魚汛來臨前嗅到水的味道。',
  },
  borin: {
    id: 'borin',
    name: '博林',
    title: '鐵匠',
    emoji: '🔨',
    blurb: '沉默寡言的鐵匠,打出的鋼鐵比說過的話還多。',
  },
  sage: {
    id: 'sage',
    name: '賽吉',
    title: '藥師',
    emoji: '⚗️',
    blurb: '神祕的藥師,鍋裡永遠咕嘟咕嘟冒著看不懂的泡泡。',
  },
} as const satisfies Record<string, Npc>;

export type NpcId = keyof typeof NPCS;

const BASIC_CARD_DEFS = {
    key: { name: '键', icon: '🎹', colorClass: 'type-key' },
    tone: { name: '音', icon: '🎵', colorClass: 'type-tone' },
    effect: { name: '效', icon: '✨', colorClass: 'type-effect' },
    line: { name: '线', icon: '📏', colorClass: 'type-line' }
};

const SKILL_DEFS = {
    retreat: { name: '退', icon: '📉', desc: '退回一个已填充需求' },
    explode: { name: '爆', icon: '💥', desc: '炸毁曲目，2轮恢复' },
    gift: { name: '赐', icon: '🎁', desc: '指定玩家给你一张基础牌' },
    lock: { name: '锁', icon: '🔒', desc: '冻结一名玩家下回合' },
    shine: { name: '炫', icon: '🌟', desc: '所有玩家抽一张牌' }
};

const SKILL_KEYS = Object.keys(SKILL_DEFS);
const AI_NAMES = ['小蓝','小绿','小红','小白','小黑','小灰','小紫','小橙','小粉','小棕','小银','小黄'];

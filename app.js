function getEffectiveYield(mastery, includeBlue) {
  const baseYield = getYieldFromMastery(mastery);
  if (mastery === -1 || !includeBlue) {
    return baseYield;
  }
  // Blue Elixir proc rate is approx 0.30 per craft. In Draughts, 1 Blue = 3 Green (adds +0.90 equivalent)
  return baseYield + 0.90;
}

// BDO Alchemy Mastery Table (from BDO Codex / Incendar)
const MASTERY_TABLE = [
  [0, 2.50],
  [50, 2.59],
  [100, 2.60],
  [200, 2.61],
  [300, 2.64],
  [400, 2.66],
  [500, 2.68],
  [600, 2.71],
  [700, 2.74],
  [800, 2.76],
  [900, 2.80],
  [1000, 2.83],
  [1100, 2.86],
  [1200, 2.90],
  [1300, 2.94],
  [1400, 2.98],
  [1500, 3.02],
  [1600, 3.06],
  [1700, 3.11],
  [1800, 3.15],
  [1900, 3.20],
  [2000, 3.25]
];

function getYieldFromMastery(mastery) {
  if (mastery === -1) return 1.0; // 1:1 base recipe mode (no proc)
  if (mastery <= 0) return 2.50;
  if (mastery >= 2000) return 3.25;
  for (let i = 0; i < MASTERY_TABLE.length - 1; i++) {
    const [m1, y1] = MASTERY_TABLE[i];
    const [m2, y2] = MASTERY_TABLE[i + 1];
    if (mastery >= m1 && mastery <= m2) {
      const ratio = (mastery - m1) / (m2 - m1);
      return y1 + ratio * (y2 - y1);
    }
  }
  return 2.50;
}

function calculateMasteryFromLevel(tier, level, gearBonus) {
  let base = 0;
  const lvl = Math.max(1, parseInt(level) || 1);
  if (tier === 'beginner') {
    base = lvl * 5;
  } else if (tier === 'apprentice') {
    base = 50 + lvl * 5;
  } else if (tier === 'skilled') {
    base = 100 + lvl * 5;
  } else if (tier === 'professional') {
    base = 150 + lvl * 5;
  } else if (tier === 'artisan') {
    base = 200 + lvl * 5;
  } else if (tier === 'master') {
    base = 250 + Math.min(lvl, 30) * 5;
  } else if (tier === 'guru') {
    base = 400 + Math.min(lvl, 50) * 10;
  }
  return base + (parseInt(gearBonus) || 0);
}

/**
 * Black Desert Online - [Party] Harmony Draught - Edania Calculator
 * Complete recursive crafting tree, live Arsha API market pricing & inventory manager.
 */

// Global Items Database (ID -> metadata)
const ITEMS_DB = {
  // Target & Draughts
  1407: { id: 1407, name_th: '[ปาร์ตี้] น้ำยาอีดาเนียแห่งความกลมกลืน', name_en: '[Party] Harmony Draught - Edania', category: 'finished', default_price: 125000000 },
  1399: { id: 1399, name_th: 'น้ำยาแห่งความกลมกลืน', name_en: 'Harmony Draught', category: 'intermediate', default_price: 95000000 },
  1389: { id: 1389, name_th: 'น้ำยาแห่งความพิโรธ', name_en: 'Fury Draught', category: 'draught', default_price: 18500000 },
  1391: { id: 1391, name_th: 'น้ำยาแห่งการปรับตัว', name_en: 'Adaptation Draught', category: 'draught', default_price: 18000000 },
  1393: { id: 1393, name_th: 'น้ำยาแห่งศักยภาพ', name_en: 'Potential Draught', category: 'draught', default_price: 18200000 },
  1395: { id: 1395, name_th: 'น้ำยาแห่งความเสื่อมทราม', name_en: 'Corruption Draught', category: 'draught', default_price: 18700000 },
  1397: { id: 1397, name_th: 'น้ำยาแห่งความบ้าคลั่ง', name_en: 'Berserk Draught', category: 'draught', default_price: 18400000 },
  820936: { id: 820936, name_th: 'สารเร่งเวทมนตร์', name_en: 'Spellbound Catalyst', category: 'raw', default_price: 1000000, vendor_price: 1000000 },
  4986: { id: 4986, name_th: 'น้ำบริสุทธิ์ของอิเบลลับ', name_en: "Ibellab's Essence", category: 'raw', default_price: 4500000 },

  // 22 Elixirs
  704: { id: 704, name_th: 'น้ำยาแห่งความพิโรธ (น้ำยา)', name_en: 'Elixir of Fury', category: 'elixir', default_price: 65000 },
  672: { id: 672, name_th: 'น้ำยาแห่งความบ้าคลั่งระห่ำ', name_en: 'Elixir of Frenzy', category: 'elixir', default_price: 250000 },
  700: { id: 700, name_th: 'น้ำยาเสริมสมาธิ', name_en: 'Elixir of Concentration', category: 'elixir', default_price: 75000 },
  1180: { id: 1180, name_th: 'น้ำยาแห่งการทำลายล้าง', name_en: 'Elixir of Destruction', category: 'elixir', default_price: 350000 },
  716: { id: 716, name_th: 'น้ำยาเพิ่มการป้องกัน', name_en: 'Defense Elixir', category: 'elixir', default_price: 85000 },
  782: { id: 782, name_th: 'น้ำยาแห่งเกลียวคลื่น', name_en: 'Helix Elixir', category: 'elixir', default_price: 280000 },
  708: { id: 708, name_th: 'น้ำยาแห่งชีวิต', name_en: 'Elixir of Life', category: 'elixir', default_price: 60000 },
  722: { id: 722, name_th: 'น้ำยาเสริมความอดทน', name_en: 'Elixir of Endurance', category: 'elixir', default_price: 68000 },
  688: { id: 688, name_th: 'น้ำยาแห่งสายลม', name_en: 'Elixir of Wind', category: 'elixir', default_price: 120000 },
  692: { id: 692, name_th: 'น้ำยาแห่งเวทมนตร์', name_en: 'Elixir of Spells', category: 'elixir', default_price: 110000 },
  762: { id: 762, name_th: 'น้ำยาจู่โจมฉับพลัน', name_en: 'Elixir of Shock', category: 'elixir', default_price: 150000 },
  690: { id: 690, name_th: 'น้ำยาแห่งความว่องไว', name_en: 'Elixir of Swiftness', category: 'elixir', default_price: 130000 },
  680: { id: 680, name_th: 'น้ำยาเจาะเกราะ', name_en: 'Elixir of Perforation', category: 'elixir', default_price: 240000 },
  686: { id: 686, name_th: 'น้ำยาแห่งความตาย', name_en: 'Elixir of Death', category: 'elixir', default_price: 235000 },
  676: { id: 676, name_th: 'น้ำยาดูดซับเลือด', name_en: 'Elixir of Draining', category: 'elixir', default_price: 210000 },
  712: { id: 712, name_th: 'น้ำยาแห่งยมทูต', name_en: "Grim Reaper's Elixir", category: 'elixir', default_price: 260000 },
  696: { id: 696, name_th: 'น้ำยาแห่งการลอบสังหาร', name_en: 'Elixir of Assassination', category: 'elixir', default_price: 270000 },
  698: { id: 698, name_th: 'น้ำยาค้นหาศัตรู', name_en: 'Elixir of Detection', category: 'elixir', default_price: 265000 },
  718: { id: 718, name_th: 'น้ำยาแห่งการเข่นฆ่า', name_en: 'Elixir of Carnage', category: 'elixir', default_price: 275000 },
  720: { id: 720, name_th: 'น้ำยาแห่งเวหา', name_en: 'Elixir of Sky', category: 'elixir', default_price: 280000 },
  1409: { id: 1409, name_th: 'น้ำยาอีดาเนีย', name_en: 'Elixir of Edania', category: 'elixir', default_price: 420000 },
  702: { id: 702, name_th: 'น้ำยาแห่งเจตจำนง', name_en: 'Elixir of Will', category: 'elixir', default_price: 45000 },

  // 5 Oils
  6601: { id: 6601, name_th: 'น้ำมันแห่งการฟื้นฟู', name_en: 'Oil of Regeneration', category: 'oil', default_price: 150000 },
  6602: { id: 6602, name_th: 'น้ำมันแห่งพายุหมุน', name_en: 'Oil of Storms', category: 'oil', default_price: 155000 },
  6603: { id: 6603, name_th: 'น้ำมันแห่งความทรหด', name_en: 'Oil of Fortitude', category: 'oil', default_price: 148000 },
  6604: { id: 6604, name_th: 'น้ำมันแห่งความเสื่อมทราม', name_en: 'Oil of Corruption', category: 'oil', default_price: 152000 },
  6605: { id: 6605, name_th: 'น้ำมันแห่งความเงียบสงบ', name_en: 'Oil of Tranquility', category: 'oil', default_price: 156000 },

  // 5 Bloods (Crafted)
  6353: { id: 6353, name_th: 'เลือดตัวตลก', name_en: "Clown's Blood", category: 'blood_craft', default_price: 48000 },
  6355: { id: 6355, name_th: 'เลือดสัตว์อสูรในตำนาน', name_en: "Legendary Beast's Blood", category: 'blood_craft', default_price: 52000 },
  6354: { id: 6354, name_th: 'เลือดนักปราชญ์', name_en: "Wise Man's Blood", category: 'blood_craft', default_price: 51000 },
  6352: { id: 6352, name_th: 'เลือดทรราช', name_en: "Tyrant's Blood", category: 'blood_craft', default_price: 49000 },
  6351: { id: 6351, name_th: 'เลือดคนบาป', name_en: "Sinner's Blood", category: 'blood_craft', default_price: 50000 },

  // 2 Reagents
  5301: { id: 5301, name_th: 'น้ำยาเคมีใส', name_en: 'Clear Liquid Reagent', category: 'reagent', default_price: 12000 },
  5302: { id: 5302, name_th: 'ผงเคมีบริสุทธิ์', name_en: 'Pure Powder Reagent', category: 'reagent', default_price: 12000 },

  // Raw Materials: Fruit & Trace (Unified Grouping as mandated)
  5205: { id: 5205, name_th: 'ผลไม้แห่งธรรมชาติ (รวม Fruit ทั้งหมด)', name_en: 'Fruit of Nature (All Fruits)', category: 'raw', default_price: 210000 },
  5960: { id: 5960, name_th: 'ร่องรอยแห่งธรรมชาติ (รวม Trace ทั้งหมด)', name_en: 'Trace of Nature (All Traces)', category: 'raw', default_price: 195000 },

  // Raw Materials: Bloods
  6201: { id: 6201, name_th: 'เลือดหมาป่า', name_en: 'Wolf Blood', category: 'raw', default_price: 9500 },
  6203: { id: 6203, name_th: 'เลือดจิ้งจอก', name_en: 'Fox Blood', category: 'raw', default_price: 9200 },
  6205: { id: 6205, name_th: 'เลือดหมี', name_en: 'Bear Blood', category: 'raw', default_price: 9800 },
  6207: { id: 6207, name_th: 'เลือดหมู', name_en: 'Pig Blood', category: 'raw', default_price: 9000 },
  6209: { id: 6209, name_th: 'เลือดกิ้งก่า', name_en: 'Lizard Blood', category: 'raw', default_price: 9600 },

  // Raw Materials: Saps
  5001: { id: 5001, name_th: 'ยางไม้แอช', name_en: 'Ash Sap', category: 'raw', default_price: 8500 },
  5002: { id: 5002, name_th: 'ยางไม้เบิร์ช', name_en: 'Birch Sap', category: 'raw', default_price: 8800 },
  5003: { id: 5003, name_th: 'ยางไม้สน', name_en: 'Pine Sap', category: 'raw', default_price: 9000 },
  5004: { id: 5004, name_th: 'ยางไม้ซีดาร์', name_en: 'Cedar Sap', category: 'raw', default_price: 9200 },
  5005: { id: 5005, name_th: 'ยางไม้เมเปิ้ล', name_en: 'Maple Sap', category: 'raw', default_price: 8600 },
  5012: { id: 5012, name_th: 'ยางไม้ทูจา', name_en: 'Thuja Sap', category: 'raw', default_price: 12000 },
  5024: { id: 5024, name_th: 'ยางไม้ซีดาร์แดนหิมะ', name_en: 'Snowfield Cedar Sap', category: 'raw', default_price: 14500 },
  5025: { id: 5025, name_th: 'ยางไม้คาพลาส', name_en: 'Caphras Tree Sap', category: 'raw', default_price: 22000 },

  // Raw Materials: Mushrooms
  5101: { id: 5101, name_th: 'เห็ดแคระ', name_en: 'Dwarf Mushroom', category: 'raw', default_price: 5500 },
  5102: { id: 5102, name_th: 'เห็ดเมฆา', name_en: 'Cloud Mushroom', category: 'raw', default_price: 5200 },
  5103: { id: 5103, name_th: 'เห็ดหัวลูกศร', name_en: 'Arrow Mushroom', category: 'raw', default_price: 5400 },
  5104: { id: 5104, name_th: 'เห็ดนภา', name_en: 'Sky Mushroom', category: 'raw', default_price: 5300 },
  5105: { id: 5105, name_th: 'เห็ดพิษอมานิตา', name_en: 'Amanita Mushroom', category: 'raw', default_price: 4900 },
  5106: { id: 5106, name_th: 'เห็ดผีเสื้อสาง', name_en: 'Ghost Mushroom', category: 'raw', default_price: 6500 },
  5107: { id: 5107, name_th: 'เห็ดหนอก', name_en: 'Hump Mushroom', category: 'raw', default_price: 5100 },
  5108: { id: 5108, name_th: 'เห็ดทำนายทายทัก', name_en: 'Fortune Teller Mushroom', category: 'raw', default_price: 5000 },
  5109: { id: 5109, name_th: 'เห็ดเสือ', name_en: 'Tiger Mushroom', category: 'raw', default_price: 5300 },
  5110: { id: 5110, name_th: 'เห็ดดึกดำบรรพ์', name_en: 'Ancient Mushroom', category: 'raw', default_price: 6800 },
  5111: { id: 5111, name_th: 'เห็ดหลอกลวง', name_en: 'Bluffer Mushroom', category: 'raw', default_price: 5200 },
  5112: { id: 5112, name_th: 'เห็ดทรัฟเฟิล', name_en: 'Truffle Mushroom', category: 'raw', default_price: 75000 },
  5113: { id: 5113, name_th: 'เห็ดจักรพรรดิ', name_en: 'Emperor Mushroom', category: 'raw', default_price: 5500 },

  // Raw Materials: Tree Items
  5051: { id: 5051, name_th: 'เปลือกไม้เก่าแก่', name_en: 'Old Tree Bark', category: 'raw', default_price: 6500 },
  5052: { id: 5052, name_th: 'ปุ่มไม้เปื้อนเลือด', name_en: 'Bloody Tree Knot', category: 'raw', default_price: 7200 },
  5053: { id: 5053, name_th: 'ใบไม้วิญญาณ', name_en: "Spirit's Leaf", category: 'raw', default_price: 6800 },
  5054: { id: 5054, name_th: 'กิ่งไม้ของนักบวช', name_en: "Monk's Branch", category: 'raw', default_price: 7000 },
  5055: { id: 5055, name_th: 'เนื้องอกไม้แดง', name_en: 'Red Tree Lump', category: 'raw', default_price: 6900 },

  // Raw Materials: Powders
  4801: { id: 4801, name_th: 'ผงแห่งความมืดมิด', name_en: 'Powder of Darkness', category: 'raw', default_price: 4200 },
  4802: { id: 4802, name_th: 'ผงแห่งเปลวเพลิง', name_en: 'Powder of Flame', category: 'raw', default_price: 4100 },
  4803: { id: 4803, name_th: 'ผงแห่งรอยแยก', name_en: 'Powder of Rifts', category: 'raw', default_price: 4500 },
  4804: { id: 4804, name_th: 'ผงแห่งปฐพี', name_en: 'Powder of Earth', category: 'raw', default_price: 4000 },
  4805: { id: 4805, name_th: 'ผงแห่งกาลเวลา', name_en: 'Powder of Time', category: 'raw', default_price: 4600 },

  // Raw Materials: Herbs & Vendor
  6656: { id: 6656, name_th: 'น้ำบริสุทธิ์', name_en: 'Purified Water', category: 'raw', default_price: 2500 },
  5439: { id: 5439, name_th: 'หญ้าป่า (หรือวัชพืช)', name_en: 'Wild Grass / Weed', category: 'raw', default_price: 2000 },
  5401: { id: 5401, name_th: 'หญ้าอรุณ', name_en: 'Sunrise Herb', category: 'raw', default_price: 2100 },
  5402: { id: 5402, name_th: 'ดอกอาซาเลียสีเงิน', name_en: 'Silver Azalea', category: 'raw', default_price: 2200 },
  5404: { id: 5404, name_th: 'ดอกเกล็ดไฟ', name_en: 'Fire Flake Flower', category: 'raw', default_price: 2300 },
  9001: { id: 9001, name_th: 'เกลือ (ร้านค้า NPC)', name_en: 'Salt (NPC Shop)', category: 'raw', default_price: 20, vendor_price: 20 },
  9002: { id: 9002, name_th: 'น้ำตาล (ร้านค้า NPC)', name_en: 'Sugar (NPC Shop)', category: 'raw', default_price: 20, vendor_price: 20 },
  501: { id: 501, name_th: 'น้ำยาฟื้นฟูพลังกาย (เล็ก)', name_en: 'HP Potion (Small)', category: 'raw', default_price: 200, vendor_price: 200 }
};

// Complete Recipe Graph
const RECIPES = {
  // Top Target (1407): yields 10 per craft
  1407: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 1399: 10, 1409: 30, 702: 30, 820936: 10, 4986: 1 }
  },

  // Harmony Draught (1399): yields 10 per craft
  1399: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 1389: 10, 1391: 10, 1393: 10, 1395: 10, 1397: 10 }
  },

  // 5 Draughts: each yields 10 per craft
  1389: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 704: 30, 672: 30, 700: 30, 1180: 30, 820936: 10 }
  },
  1391: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 716: 30, 782: 30, 708: 30, 722: 30, 820936: 10 }
  },
  1393: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 688: 30, 692: 30, 762: 30, 690: 30, 820936: 10 }
  },
  1395: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 680: 30, 686: 30, 676: 30, 712: 30, 820936: 10 }
  },
  1397: {
    type: 'Simple Alchemy',
    yield: 10,
    mats: { 696: 30, 698: 30, 718: 30, 720: 30, 820936: 10 }
  },

  // 22 Elixirs (standard yield = 1, can be scaled by yield multiplier)
  704: { type: 'Alchemy', yield: 1, mats: { 5101: 4, 5001: 1, 6205: 4, 6656: 3 } },
  672: { type: 'Alchemy', yield: 1, mats: { 6601: 1, 5301: 5, 5004: 5, 5960: 3, 5106: 2 } },
  700: { type: 'Alchemy', yield: 1, mats: { 5301: 1, 5102: 3, 5439: 2, 6205: 3 } },
  1180: { type: 'Alchemy', yield: 1, mats: { 6602: 1, 5960: 3, 5301: 5, 4802: 5, 5024: 7 } },
  716: { type: 'Alchemy', yield: 1, mats: { 5301: 1, 5001: 6, 6207: 5, 6656: 3 } },
  782: { type: 'Alchemy', yield: 1, mats: { 5012: 6, 5054: 3, 6353: 2, 4802: 2, 6656: 3 } },
  708: { type: 'Alchemy', yield: 1, mats: { 5302: 1, 5402: 3, 6203: 5, 501: 3 } },
  722: { type: 'Alchemy', yield: 1, mats: { 5302: 1, 5101: 2, 5002: 5, 6205: 4 } },
  688: { type: 'Alchemy', yield: 1, mats: { 6354: 1, 5108: 5, 5003: 5, 4801: 2 } },
  692: { type: 'Alchemy', yield: 1, mats: { 6352: 1, 5404: 5, 4801: 2, 5005: 3 } },
  762: { type: 'Alchemy', yield: 1, mats: { 6353: 1, 5109: 5, 5004: 7, 4805: 3 } },
  690: { type: 'Alchemy', yield: 1, mats: { 6355: 1, 5103: 5, 5002: 5, 4801: 2 } },
  680: { type: 'Alchemy', yield: 1, mats: { 6604: 1, 5301: 4, 5111: 5, 5003: 5, 5960: 2 } },
  686: { type: 'Alchemy', yield: 1, mats: { 6605: 1, 5301: 6, 5110: 2, 5001: 7, 5960: 2 } },
  676: { type: 'Alchemy', yield: 1, mats: { 6603: 1, 5301: 4, 5107: 3, 5002: 4, 5960: 2 } },
  712: { type: 'Alchemy', yield: 1, mats: { 6603: 1, 5302: 4, 5104: 2, 5054: 2, 5960: 4 } },
  696: { type: 'Alchemy', yield: 1, mats: { 6601: 1, 5302: 5, 5105: 4, 5055: 2, 5960: 2 } },
  698: { type: 'Alchemy', yield: 1, mats: { 6602: 1, 5302: 6, 5112: 3, 5051: 2, 5960: 3 } },
  718: { type: 'Alchemy', yield: 1, mats: { 6604: 1, 5302: 7, 5109: 2, 5053: 2, 5960: 3 } },
  720: { type: 'Alchemy', yield: 1, mats: { 6605: 1, 5302: 6, 5113: 1, 5052: 2, 5960: 4 } },
  1409: { type: 'Alchemy', yield: 1, mats: { 6351: 2, 5960: 4, 5051: 5, 5301: 5, 5025: 6 } },
  702: { type: 'Alchemy', yield: 1, mats: { 5302: 1, 5401: 4, 6201: 6, 6656: 3 } },

  // 5 Oils
  6601: { type: 'Alchemy', yield: 1, mats: { 6355: 1, 5055: 1, 5205: 1, 4803: 1 } },
  6602: { type: 'Alchemy', yield: 1, mats: { 6352: 1, 5051: 1, 5205: 1, 4805: 1 } },
  6603: { type: 'Alchemy', yield: 1, mats: { 6353: 1, 5054: 1, 5205: 1, 4802: 1 } },
  6604: { type: 'Alchemy', yield: 1, mats: { 6351: 1, 5053: 1, 5205: 1, 4801: 1 } },
  6605: { type: 'Alchemy', yield: 1, mats: { 6354: 1, 5052: 1, 5205: 1, 4804: 1 } },

  // 5 Bloods
  6353: { type: 'Alchemy', yield: 1, mats: { 5301: 1, 6201: 2, 5053: 1, 4801: 1 } },
  6355: { type: 'Alchemy', yield: 1, mats: { 5302: 1, 6209: 2, 5053: 1, 5960: 1 } },
  6354: { type: 'Alchemy', yield: 1, mats: { 5301: 1, 6203: 2, 5054: 1, 5960: 1 } },
  6352: { type: 'Alchemy', yield: 1, mats: { 5302: 1, 6205: 2, 5054: 1, 5960: 1 } },
  6351: { type: 'Alchemy', yield: 1, mats: { 5301: 1, 6207: 2, 5052: 1, 4802: 1 } },

  // 2 Reagents
  5301: { type: 'Alchemy', yield: 1, mats: { 6656: 1, 5439: 1, 5401: 1, 9001: 1 } },
  5302: { type: 'Alchemy', yield: 1, mats: { 6656: 1, 5439: 1, 5402: 1, 9002: 1 } }
};

// Application State
const state = {
  region: 'sea',
  batchCount: 1,
  hasVP: true,
  hasRing: false,
  mastery: 1000,
  includeBlueProc: false,
  alchemyYield: 2.83,
  inventory: {},        // { [itemId]: count }
  marketPrices: {},     // { [itemId]: { basePrice, currentStock, lastSoldPrice, ... } }
  priceCacheTimestamp: 0,
  activeFilter: 'all',  // 'all' | 'missing' | 'complete'
  searchQuery: ''
};

// Storage Keys
const STORAGE_INVENTORY_KEY = 'bdo_harmony_edania_inventory';
const STORAGE_SETTINGS_KEY = 'bdo_harmony_edania_settings';
const STORAGE_CACHE_KEY_PREFIX = 'bdo_harmony_edania_cache_';

// Helper formatting
function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Math.round(num).toLocaleString('en-US');
}

function formatPercent(num) {
  if (num === undefined || num === null || isNaN(num)) return '0.0%';
  return (num * 100).toFixed(1) + '%';
}

// Calculate Market Tax Rate
function calculateTaxRate(vp, ring) {
  // Base collection rate is 65% (35% tax)
  // Value Pack adds 30% to collection: 0.65 * 1.30 = 84.5%
  // Merchant Ring adds 5% to collection: 0.65 * 1.05 = 68.25%
  // Both: 0.65 * 1.30 * 1.05 = 88.725%
  let rate = 0.65;
  if (vp) rate *= 1.30;
  if (ring) rate *= 1.05;
  return rate;
}

// Decompose recipe recursively down to raw materials
function getRawMaterialsBreakdown(targetId, targetCount, yieldMultiplier) {
  const rawTotals = {};

  function recurse(itemId, count) {
    if (RECIPES[itemId]) {
      const rec = RECIPES[itemId];
      let baseYield = rec.yield;
      // Apply alchemy mastery yield multiplier only to regular Alchemy recipes (not Simple Alchemy)
      if (rec.type === 'Alchemy') {
        baseYield *= yieldMultiplier;
      }
      const craftCount = count / baseYield;
      for (const [matId, matQty] of Object.entries(rec.mats)) {
        recurse(Number(matId), matQty * craftCount);
      }
    } else {
      rawTotals[itemId] = (rawTotals[itemId] || 0) + count;
    }
  }

  recurse(targetId, targetCount);
  return rawTotals;
}

// Get intermediate item requirements
function getIntermediateRequirements(batchCount) {
  // 1 set produces 10 [Party] Harmony Draught - Edania (1407)
  const partyCount = 10 * batchCount;
  return {
    harmonyDraught: 10 * batchCount, // 1399
    edaniaElixir: 30 * batchCount,   // 1409
    willElixir: 30 * batchCount,     // 702
    catalystTop: 10 * batchCount,    // 820936
    ibellab: 1 * batchCount,         // 4986
    draughts: 10 * batchCount,       // each of 5 draughts
    elixirs: 30 * batchCount         // each of 20 elixir ingredients in draughts
  };
}

// Load and Save LocalStorage
function loadPersistedState() {
  try {
    const savedInv = localStorage.getItem(STORAGE_INVENTORY_KEY);
    if (savedInv) {
      state.inventory = JSON.parse(savedInv);
    }
    const savedSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.region) state.region = parsed.region;
      if (parsed.batchCount) state.batchCount = Number(parsed.batchCount) || 1;
      if (typeof parsed.hasVP === 'boolean') state.hasVP = parsed.hasVP;
      if (typeof parsed.hasRing === 'boolean') state.hasRing = parsed.hasRing;
      if (parsed.mastery !== undefined) {
        state.mastery = Number(parsed.mastery);
        state.alchemyYield = getEffectiveYield(state.mastery, state.includeBlueProc);
      } else if (parsed.alchemyYield) {
        state.alchemyYield = Number(parsed.alchemyYield) || 2.83;
      }
    }
  } catch (e) {
    console.warn('Could not load localStorage:', e);
  }
}

function saveInventory() {
  try {
    localStorage.setItem(STORAGE_INVENTORY_KEY, JSON.stringify(state.inventory));
  } catch (e) {
    console.warn('Could not save inventory:', e);
  }
}

function saveSettings() {
  try {
    const settings = {
      region: state.region,
      batchCount: state.batchCount,
      hasVP: state.hasVP,
      hasRing: state.hasRing,
      includeBlueProc: state.includeBlueProc,
      mastery: state.mastery,
      alchemyYield: state.alchemyYield
    };
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

// API Price Fetching via Proxy
// Fast Fetch Helper with Timeout
async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Blazing-fast Single-Batch API Price Fetching
async function fetchPrices(forceRefresh = false) {
  const statusDot = document.getElementById('api-status-dot');
  const statusText = document.getElementById('api-status-text');
  const errorBanner = document.getElementById('error-banner');

  // Check cache (5 min = 300,000 ms)
  const cacheKey = STORAGE_CACHE_KEY_PREFIX + state.region;
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000 && Object.keys(data).length > 20) {
          state.marketPrices = data;
          state.priceCacheTimestamp = timestamp;
          updateCacheTimer();
          if (statusDot) statusDot.className = 'status-dot green';
          if (statusText) statusText.innerText = `ราคาตลาด: แคช (${state.region.toUpperCase()}) อัปเดต ${new Date(timestamp).toLocaleTimeString()}`;
          if (errorBanner) errorBanner.style.display = 'none';
          recalculateAndRender();
          return;
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }
  }

  if (statusDot) statusDot.className = 'status-dot yellow';
  if (statusText) statusText.innerText = `กำลังดึงราคาจากตลาด (${state.region.toUpperCase()})...`;

  // Collect all 89 IDs in one single request (only 469 chars URL length!)
  const allIds = Object.keys(ITEMS_DB).map(Number);
  const idParam = allIds.join(',');

  const arshaTarget = `https://api.arsha.io/v2/${state.region}/item?id=${idParam}&lang=en`;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Candidate URLs to try in order of speed
  let candidateUrls = [];
  if (isLocalhost) {
    candidateUrls = [
      `/api/market?region=${encodeURIComponent(state.region)}&id=${encodeURIComponent(idParam)}&lang=en`
    ];
  } else {
    // For GitHub Pages & Web: try direct first, then reliable CORS proxies
    candidateUrls = [
      arshaTarget, // Direct fetch (super fast if allowed)
      `https://api.allorigins.win/raw?url=${encodeURIComponent(arshaTarget)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(arshaTarget)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(arshaTarget)}`
    ];
  }

  let fetchedData = null;
  let lastError = null;

  for (const url of candidateUrls) {
    try {
      const resp = await fetchWithTimeout(url, 3500);
      if (resp && resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedData = data;
          break;
        }
      }
    } catch (err) {
      lastError = err;
      // Continue to next candidate URL without long hanging
    }
  }

  const newPrices = { ...state.marketPrices };

  if (fetchedData && Array.isArray(fetchedData)) {
    fetchedData.forEach(item => {
      if (item && item.id) {
        newPrices[item.id] = {
          name: item.name,
          id: item.id,
          basePrice: Number(item.basePrice) || 0,
          currentStock: Number(item.currentStock) || 0,
          totalTrades: Number(item.totalTrades) || 0,
          lastSoldPrice: Number(item.lastSoldPrice) || Number(item.basePrice) || 0,
          priceMin: Number(item.priceMin) || 0,
          priceMax: Number(item.priceMax) || 0
        };
      }
    });

    state.marketPrices = newPrices;
    state.priceCacheTimestamp = Date.now();

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: state.priceCacheTimestamp,
        data: state.marketPrices
      }));
    } catch (e) {
      console.warn('Cache write error:', e);
    }

    if (statusDot) statusDot.className = 'status-dot green';
    if (statusText) statusText.innerText = `ราคาตลาด: สดใหม่ (${state.region.toUpperCase()}) ${new Date().toLocaleTimeString()}`;
    if (errorBanner) errorBanner.style.display = 'none';
  } else {
    // If all network attempts failed, ensure all items have sensible defaults so app is 100% usable
    allIds.forEach(id => {
      if (!newPrices[id] || newPrices[id].basePrice <= 0) {
        const def = ITEMS_DB[id];
        newPrices[id] = {
          name: def.name_en,
          id: id,
          basePrice: def.vendor_price || def.default_price || 10000,
          currentStock: 100,
          totalTrades: 5000,
          lastSoldPrice: def.vendor_price || def.default_price || 10000,
          priceMin: 0,
          priceMax: 0
        };
      }
    });
    state.marketPrices = newPrices;

    if (statusDot) statusDot.className = 'status-dot yellow';
    if (statusText) statusText.innerText = `ราคาตลาด: ใช้ราคาอ้างอิงล่าสุด (${state.region.toUpperCase()})`;
    if (errorBanner) {
      errorBanner.style.display = 'flex';
      document.getElementById('error-title').innerText = 'ไม่สามารถดึงราคาแบบเรียลไทม์ได้ชั่วคราว';
      document.getElementById('error-desc').innerText = 'ระบบใช้ราคามาตรฐานของตลาด SEA เพื่อให้คุณคำนวณต้นทุนต่อได้ทันที';
    }
  }

  updateCacheTimer();
  recalculateAndRender();
}

function updateCacheTimer() {
  const timerElem = document.getElementById('api-cache-timer');
  if (!timerElem || !state.priceCacheTimestamp) return;

  const elapsed = Math.floor((Date.now() - state.priceCacheTimestamp) / 1000);
  const remaining = Math.max(0, 300 - elapsed);
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  timerElem.innerText = `(หมดอายุใน ${min}:${sec.toString().padStart(2, '0')})`;
}

// Main Calculation Engine
function calculateMetrics() {
  const totalFinishedBottles = state.batchCount * 10;
  const finishedItem = state.marketPrices[1407] || { basePrice: 125000000, currentStock: 0 };
  const finishedUnitPrice = finishedItem.basePrice;
  const finishedTotalMarketPrice = finishedUnitPrice * totalFinishedBottles;

  // Tax and Revenue
  const taxRate = calculateTaxRate(state.hasVP, state.hasRing);
  const netRevenue = finishedTotalMarketPrice * taxRate;

  // Raw Materials Breakdown
  const rawRequirements = getRawMaterialsBreakdown(1407, totalFinishedBottles, state.alchemyYield);

  let fullRawCost = 0;
  let netRawCost = 0;
  let totalSavedSilver = 0;
  let totalMatsRequiredCount = 0;
  let totalMatsInStockCount = 0;
  let totalMatsMissingCount = 0;

  const rawRows = [];

  for (const [idStr, requiredQty] of Object.entries(rawRequirements)) {
    const id = Number(idStr);
    const itemMeta = ITEMS_DB[id] || { name_th: 'ไม่ทราบชื่อ', name_en: 'Unknown', id: id };
    const priceData = state.marketPrices[id] || { basePrice: itemMeta.default_price || 10000, currentStock: 0 };
    const unitPrice = priceData.basePrice;
    const currentStock = priceData.currentStock;

    const inStock = Math.max(0, Math.floor(Number(state.inventory[id]) || 0));
    const missing = Math.max(0, requiredQty - inStock);
    const lineFullCost = requiredQty * unitPrice;
    const lineNetCost = missing * unitPrice;
    const lineSaved = Math.min(requiredQty, inStock) * unitPrice;

    fullRawCost += lineFullCost;
    netRawCost += lineNetCost;
    totalSavedSilver += lineSaved;

    totalMatsRequiredCount += requiredQty;
    totalMatsInStockCount += inStock;
    totalMatsMissingCount += missing;

    rawRows.push({
      id: id,
      name_th: itemMeta.name_th,
      name_en: itemMeta.name_en,
      required: requiredQty,
      inStock: inStock,
      missing: missing,
      unitPrice: unitPrice,
      currentStock: currentStock,
      lineNetCost: lineNetCost,
      lineFullCost: lineFullCost,
      isComplete: missing === 0
    });
  }

  // Calculate % of total cost for each row
  rawRows.forEach(r => {
    r.costPercent = fullRawCost > 0 ? (r.lineFullCost / fullRawCost) : 0;
    // Mark as high cost if > 4% of total cost or cost > 15,000,000
    r.isHighCost = (r.costPercent > 0.04) || (r.lineFullCost > 15000000);
  });

  // Intermediate Options Costs:
  // Option A: Buy Harmony Draughts (1399) x (10 * batch) + Edania (1409) x 30 + Will (702) x 30 + Catalysts + Ibellab
  const priceHarmony = (state.marketPrices[1399]?.basePrice || 95000000);
  const priceEdania = (state.marketPrices[1409]?.basePrice || 420000);
  const priceWill = (state.marketPrices[702]?.basePrice || 45000);
  const priceCatalyst = (state.marketPrices[820936]?.basePrice || 1000000);
  const priceIbellab = (state.marketPrices[4986]?.basePrice || 4500000);

  const costOptHarmony = (priceHarmony * 10 * state.batchCount)
                       + (priceEdania * 30 * state.batchCount)
                       + (priceWill * 30 * state.batchCount)
                       + (priceCatalyst * 10 * state.batchCount)
                       + (priceIbellab * 1 * state.batchCount);

  // Option B: Buy 5 Draughts (1389, 1391, 1393, 1395, 1397) x 10 + top ingredients
  const draughtIds = [1389, 1391, 1393, 1395, 1397];
  let cost5Draughts = 0;
  draughtIds.forEach(did => {
    cost5Draughts += (state.marketPrices[did]?.basePrice || 18000000) * 10 * state.batchCount;
  });
  const costOpt5Draughts = cost5Draughts 
                         + (priceEdania * 30 * state.batchCount)
                         + (priceWill * 30 * state.batchCount)
                         + (priceCatalyst * 10 * state.batchCount)
                         + (priceIbellab * 1 * state.batchCount);

  // Option C: Buy 22 Elixirs directly from market
  const elixirIds = [
    704, 672, 700, 1180, 716, 782, 708, 722, 688, 692,
    762, 690, 680, 686, 676, 712, 696, 698, 718, 720,
    1409, 702
  ];
  let cost22Elixirs = 0;
  elixirIds.forEach(eid => {
    cost22Elixirs += (state.marketPrices[eid]?.basePrice || 150000) * 30 * state.batchCount;
  });
  // Plus 60 catalysts (50 for draughts + 10 for top) + 1 Ibellab
  const costOpt22Elixirs = cost22Elixirs 
                         + (priceCatalyst * 60 * state.batchCount)
                         + (priceIbellab * 1 * state.batchCount);

  // Profit/Loss based on Net Raw Cost
  const netProfit = netRevenue - netRawCost;
  const fullProfit = netRevenue - fullRawCost;
  const netRoi = netRawCost > 0 ? (netProfit / netRawCost) : 0;
  const fullRoi = fullRawCost > 0 ? (fullProfit / fullRawCost) : 0;
  const profitPerBottle = totalFinishedBottles > 0 ? (netProfit / totalFinishedBottles) : 0;

  // Calculate raw cost at 1:1 recipe (no mastery proc) to evaluate savings
  const unscaledBreakdown = getRawMaterialsBreakdown(1407, totalFinishedBottles, 1.0);
  let unscaledFullCost = 0;
  for (const [uid, uqty] of Object.entries(unscaledBreakdown)) {
    const p = state.marketPrices[uid]?.basePrice || ITEMS_DB[uid]?.default_price || 10000;
    unscaledFullCost += p * uqty;
  }
  const masterySavedCost = Math.max(0, unscaledFullCost - fullRawCost);
  const masterySavedPct = unscaledFullCost > 0 ? (masterySavedCost / unscaledFullCost) : 0;

  return {
    totalFinishedBottles,
    masterySavedCost,
    masterySavedPct,
    finishedUnitPrice,
    finishedStock: finishedItem.currentStock,
    finishedTotalMarketPrice,
    taxRate,
    netRevenue,
    fullRawCost,
    netRawCost,
    totalSavedSilver,
    netProfit,
    fullProfit,
    netRoi,
    fullRoi,
    profitPerBottle,
    costOptHarmony,
    costOpt5Draughts,
    costOpt22Elixirs,
    rawRows,
    totalMatsRequiredCount,
    totalMatsInStockCount,
    totalMatsMissingCount
  };
}

// Render KPI Dashboard
function renderDashboard(metrics) {
  document.getElementById('display-region').innerText = `${state.region.toUpperCase()} Server`;
  document.getElementById('batch-yield-text').innerText = `ออก ${metrics.totalFinishedBottles} ขวด`;

  // Tax explanation
  const vpText = state.hasVP ? 'มี Value Pack (+30%)' : 'ไม่มี Value Pack';
  const ringText = state.hasRing ? ' + แหวนพ่อค้า (+5%)' : '';
  const taxPct = (metrics.taxRate * 100).toFixed(3);
  document.getElementById('tax-explanation').innerText = `ขายได้ ${taxPct}% (${vpText}${ringText})`;

  // Card 1: Finished
  document.getElementById('kpi-finished-bottles').innerText = `${metrics.totalFinishedBottles} ขวด`;
  document.getElementById('kpi-finished-price').innerText = `${formatNumber(metrics.finishedTotalMarketPrice)} Silver`;
  document.getElementById('kpi-finished-unit-price').innerText = `${formatNumber(metrics.finishedUnitPrice)} Silver`;
  document.getElementById('kpi-finished-stock').innerText = `${formatNumber(metrics.finishedStock)} ชิ้น`;
  document.getElementById('kpi-net-revenue').innerText = `${formatNumber(metrics.netRevenue)} Silver`;

  // Update Mastery Display
  const masteryInput = document.getElementById('mastery-input');
  if (masteryInput && document.activeElement !== masteryInput) {
    masteryInput.value = state.mastery === -1 ? '1:1' : state.mastery;
  }
  const yieldDisplay = document.getElementById('mastery-yield-display');
  if (yieldDisplay) {
    if (state.mastery === -1) {
      yieldDisplay.innerText = 'สูตร 1:1 (ไม่มี Proc)';
    } else if (state.includeBlueProc) {
      const base = getYieldFromMastery(state.mastery);
      yieldDisplay.innerText = `ผลผลิตรวม ${state.alchemyYield.toFixed(2)}x (เขียว ${base.toFixed(2)}x + ฟ้า 0.30x)`;
    } else {
      yieldDisplay.innerText = `เฉลี่ย ${state.alchemyYield.toFixed(2)}x (${(metrics.masterySavedPct * 100).toFixed(0)}% เซฟวัตถุดิบ)`;
    }
  }
  const masterySavedElem = document.getElementById('kpi-mastery-saved-text');
  if (masterySavedElem) {
    if (state.mastery === -1) {
      masterySavedElem.innerText = 'คิดตามสูตร 1:1 ไม่ลดทอน';
    } else {
      masterySavedElem.innerText = `ประหยัดต้นทุนดิบ -${formatNumber(metrics.masterySavedCost)} Silver (${(metrics.masterySavedPct * 100).toFixed(1)}%)`;
    }
  }

  // Card 2: Full Raw Cost
  document.getElementById('kpi-full-raw-cost').innerText = `${formatNumber(metrics.fullRawCost)} Silver`;
  const fullUnitCost = metrics.totalFinishedBottles > 0 ? (metrics.fullRawCost / metrics.totalFinishedBottles) : 0;
  document.getElementById('kpi-full-unit-cost').innerText = `${formatNumber(fullUnitCost)} Silver`;
  
  const fullProfitElem = document.getElementById('kpi-full-profit');
  fullProfitElem.innerText = `${formatNumber(metrics.fullProfit)} Silver`;
  fullProfitElem.className = metrics.fullProfit >= 0 ? 'val-bold text-green' : 'val-bold text-red';
  
  const fullRoiElem = document.getElementById('kpi-full-roi');
  fullRoiElem.innerText = formatPercent(metrics.fullRoi);
  fullRoiElem.className = metrics.fullRoi >= 0 ? 'text-green val-bold' : 'text-red val-bold';

  // Card 3: Net Cost (Hero)
  document.getElementById('kpi-net-raw-cost').innerText = `${formatNumber(metrics.netRawCost)} Silver`;
  document.getElementById('kpi-saved-silver').innerText = `+${formatNumber(metrics.totalSavedSilver)} Silver`;
  document.getElementById('kpi-inventory-saved-badge').innerText = `ประหยัด ${formatNumber(metrics.totalSavedSilver)} Silver`;

  const netProfitElem = document.getElementById('kpi-net-profit');
  netProfitElem.innerText = `${formatNumber(metrics.netProfit)} Silver`;
  netProfitElem.className = metrics.netProfit >= 0 ? 'val-bold text-green' : 'val-bold text-red';

  const profitPerBottleElem = document.getElementById('kpi-profit-per-bottle');
  profitPerBottleElem.innerText = `${formatNumber(metrics.profitPerBottle)} Silver`;
  profitPerBottleElem.className = metrics.profitPerBottle >= 0 ? 'val-bold text-green' : 'val-bold text-red';

  // Card 4: Intermediate
  document.getElementById('kpi-intermediate-cost').innerText = `${formatNumber(metrics.costOptHarmony)} Silver`;
  document.getElementById('kpi-opt-harmony-cost').innerText = `${formatNumber(metrics.costOptHarmony)} Silver`;
  document.getElementById('kpi-opt-draughts-cost').innerText = `${formatNumber(metrics.costOpt5Draughts)} Silver`;
  document.getElementById('kpi-opt-elixirs-cost').innerText = `${formatNumber(metrics.costOpt22Elixirs)} Silver`;

  // Card 5: Best Route Recommendation
  const recHeadline = document.getElementById('rec-headline');
  const recDesc = document.getElementById('rec-desc');
  const recBreakdown = document.getElementById('rec-breakdown');

  // Compare costs: Net Raw vs Full Raw vs Intermediate vs Finished
  const options = [
    { name: 'คราฟต์จาก Raw (หักคลัง)', cost: metrics.netRawCost },
    { name: 'คราฟต์จาก Raw เต็ม', cost: metrics.fullRawCost },
    { name: 'ซื้อ 22 Elixirs ผสม', cost: metrics.costOpt22Elixirs },
    { name: 'ซื้อ 5 Draughts ผสม', cost: metrics.costOpt5Draughts },
    { name: 'ซื้อ Harmony Draught ผสม', cost: metrics.costOptHarmony },
    { name: 'ซื้อ [Party] สำเร็จรูป', cost: metrics.finishedTotalMarketPrice }
  ];

  options.sort((a, b) => a.cost - b.cost);
  const bestOption = options[0];

  recHeadline.innerText = `💡 เส้นทางที่ดีที่สุด: ${bestOption.name}`;
  const diffFromFinished = metrics.finishedTotalMarketPrice - bestOption.cost;
  
  if (bestOption.name.includes('หักคลัง')) {
    recDesc.innerText = `ของในคลังช่วยให้คุณประหยัดเงินไปถึง ${formatNumber(metrics.totalSavedSilver)} Silver! คราฟต์ต่อคุ้มค่าที่สุด`;
  } else if (bestOption.cost < metrics.finishedTotalMarketPrice) {
    recDesc.innerText = `ประหยัดกว่าซื้อสำเร็จรูปในตลาด ${formatNumber(diffFromFinished)} Silver`;
  } else {
    recDesc.innerText = `ราคาสำเร็จรูปในตลาดถูกกว่าการคราฟต์ ซื้อตรงอาจคุ้มกว่าถ้าไม่มีวัตถุดิบในคลัง`;
  }

  recBreakdown.innerHTML = options.slice(0, 3).map((opt, idx) => `
    <div class="rec-item">
      <span>#${idx + 1} ${opt.name}</span>
      <span class="val-bold ${idx === 0 ? 'text-green' : 'text-muted'}">${formatNumber(opt.cost)} Silver</span>
    </div>
  `).join('');
}

// Render Raw Materials Table
function renderRawTable(metrics) {
  const tbody = document.getElementById('raw-table-body');
  const query = state.searchQuery.toLowerCase().trim();

  let filtered = metrics.rawRows;

  // Filter tab
  if (state.activeFilter === 'missing') {
    filtered = filtered.filter(r => r.missing > 0);
  } else if (state.activeFilter === 'complete') {
    filtered = filtered.filter(r => r.isComplete);
  }

  // Search filter
  if (query) {
    filtered = filtered.filter(r => 
      r.name_th.toLowerCase().includes(query) ||
      r.name_en.toLowerCase().includes(query) ||
      r.id.toString().includes(query)
    );
  }

  // Sort by highest cost first
  filtered.sort((a, b) => b.lineNetCost - a.lineNetCost);

  // Update counters
  const totalCount = metrics.rawRows.length;
  const missingCount = metrics.rawRows.filter(r => r.missing > 0).length;
  const completeCount = metrics.rawRows.filter(r => r.isComplete).length;

  document.getElementById('raw-count-badge').innerText = totalCount;
  document.getElementById('filter-all-count').innerText = totalCount;
  document.getElementById('filter-missing-count').innerText = missingCount;
  document.getElementById('filter-complete-count').innerText = completeCount;

  // Table rows
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 30px;">ไม่พบรายการวัตถุดิบที่ค้นหา</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(row => {
    let rowClass = '';
    let statusIcon = '';
    if (row.isComplete) {
      rowClass = 'row-complete';
      statusIcon = '<span class="status-badge complete" title="ของในคลังครบแล้ว">✓</span>';
    } else if (row.isHighCost) {
      rowClass = 'row-high-cost';
      statusIcon = '<span class="status-badge high" title="วัตถุดิบต้นทุนสูง/ขาดเยอะ">★</span>';
    } else {
      statusIcon = '<span class="status-badge missing" title="ยังขาดอยู่">✕</span>';
    }

    return `
      <tr class="${rowClass}" data-id="${row.id}">
        <td class="text-center">${statusIcon}</td>
        <td>
          <div class="item-name-cell">
            <span class="item-th">${row.name_th}</span>
            <span class="item-en">${row.name_en}</span>
          </div>
        </td>
        <td><span class="id-badge">${row.id}</span></td>
        <td class="text-right num-val">${formatNumber(row.required)}</td>
        <td class="text-right">
          <input type="number" 
                 class="stock-input" 
                 data-id="${row.id}" 
                 min="0" 
                 step="1" 
                 value="${row.inStock === 0 ? '' : row.inStock}" 
                 placeholder="0">
        </td>
        <td class="text-right num-val ${row.missing === 0 ? 'text-green text-bold' : 'text-red'}">
          ${formatNumber(row.missing)}
        </td>
        <td class="text-right num-val">${formatNumber(row.unitPrice)}</td>
        <td class="text-right num-val ${row.currentStock === 0 ? 'text-red' : ''}">${formatNumber(row.currentStock)}</td>
        <td class="text-right num-val text-bold ${row.lineNetCost > 0 ? 'text-gold' : 'text-green'}">
          ${formatNumber(row.lineNetCost)}
        </td>
        <td class="text-right num-val text-muted">${formatPercent(row.costPercent)}</td>
      </tr>
    `;
  }).join('');

  // Update Footer totals
  document.getElementById('total-mats-required').innerText = formatNumber(metrics.totalMatsRequiredCount);
  document.getElementById('total-mats-in-stock').innerText = formatNumber(metrics.totalMatsInStockCount);
  document.getElementById('total-mats-missing').innerText = formatNumber(metrics.totalMatsMissingCount);
  document.getElementById('total-cost-to-buy').innerText = `${formatNumber(metrics.netRawCost)} Silver`;
}

// Render Intermediate Table
function renderIntermediateTable(metrics) {
  // Update Elixir Yield & Blue Proc Simulator Card
  const targetPerElixir = 30 * state.batchCount;
  const m = Math.max(0, Math.min(2000, state.mastery === -1 ? 0 : state.mastery));
  const baseGreen = state.mastery === -1 ? 1.0 : getYieldFromMastery(state.mastery);
  const blueRate = state.mastery === -1 ? 0.0 : (0.25 + (m / 2000) * 0.10); // ~0.30 at 1000
  
  let craftsNeeded = 0;
  let expGreen = 0;
  let expBlue = 0;

  if (state.includeBlueProc && state.mastery !== -1) {
    const effYield = baseGreen + (blueRate * 3);
    craftsNeeded = Math.ceil(targetPerElixir / effYield);
    expGreen = Math.round(craftsNeeded * baseGreen);
    expBlue = Math.round(craftsNeeded * blueRate);
  } else {
    craftsNeeded = Math.ceil(targetPerElixir / baseGreen);
    expGreen = Math.round(craftsNeeded * baseGreen);
    expBlue = state.mastery === -1 ? 0 : Math.round(craftsNeeded * blueRate);
  }

  const blueEquiv = expBlue * 3;
  const savePct = targetPerElixir > 0 ? ((1 - (craftsNeeded / targetPerElixir)) * 100).toFixed(1) : '0';

  const simBatchLabel = document.getElementById('sim-batch-label');
  if (simBatchLabel) simBatchLabel.innerText = `${state.batchCount} ชุด (เป้าหมาย ${formatNumber(targetPerElixir)} ขวด/ชนิด)`;
  
  const simTarget = document.getElementById('sim-target-per-elixir');
  if (simTarget) simTarget.innerText = `${formatNumber(targetPerElixir)} ขวด`;

  const simCrafts = document.getElementById('sim-crafts-needed');
  if (simCrafts) simCrafts.innerText = `~${formatNumber(craftsNeeded)} รอบ`;

  const simGreen = document.getElementById('sim-green-count');
  if (simGreen) simGreen.innerText = `~${formatNumber(expGreen)} ขวด`;

  const simBlue = document.getElementById('sim-blue-count');
  if (simBlue) simBlue.innerText = `~${formatNumber(expBlue)} ขวด`;

  const simBlueInline = document.getElementById('sim-blue-inline');
  if (simBlueInline) simBlueInline.innerText = formatNumber(expBlue);

  const simBlueEquiv = document.getElementById('sim-blue-equiv');
  if (simBlueEquiv) simBlueEquiv.innerText = formatNumber(blueEquiv);

  const simGreenInline = document.getElementById('sim-green-inline');
  if (simGreenInline) simGreenInline.innerText = formatNumber(expGreen);

  const simTotalEquiv = document.getElementById('sim-total-equiv');
  if (simTotalEquiv) simTotalEquiv.innerText = formatNumber(expGreen + blueEquiv);

  const simSavePct = document.getElementById('sim-save-pct');
  if (simSavePct) simSavePct.innerText = `${savePct}%`;

  const tbody = document.getElementById('intermediate-table-body');
  const items = [
    // Harmony Draught
    { id: 1399, qty: 10 * state.batchCount },
    // 5 Draughts
    { id: 1389, qty: 10 * state.batchCount },
    { id: 1391, qty: 10 * state.batchCount },
    { id: 1393, qty: 10 * state.batchCount },
    { id: 1395, qty: 10 * state.batchCount },
    { id: 1397, qty: 10 * state.batchCount },
    // 22 Elixirs
    { id: 1409, qty: 30 * state.batchCount },
    { id: 702, qty: 30 * state.batchCount },
    { id: 704, qty: 30 * state.batchCount },
    { id: 672, qty: 30 * state.batchCount },
    { id: 700, qty: 30 * state.batchCount },
    { id: 1180, qty: 30 * state.batchCount },
    { id: 716, qty: 30 * state.batchCount },
    { id: 782, qty: 30 * state.batchCount },
    { id: 708, qty: 30 * state.batchCount },
    { id: 722, qty: 30 * state.batchCount },
    { id: 688, qty: 30 * state.batchCount },
    { id: 692, qty: 30 * state.batchCount },
    { id: 762, qty: 30 * state.batchCount },
    { id: 690, qty: 30 * state.batchCount },
    { id: 680, qty: 30 * state.batchCount },
    { id: 686, qty: 30 * state.batchCount },
    { id: 676, qty: 30 * state.batchCount },
    { id: 712, qty: 30 * state.batchCount },
    { id: 696, qty: 30 * state.batchCount },
    { id: 698, qty: 30 * state.batchCount },
    { id: 718, qty: 30 * state.batchCount },
    { id: 720, qty: 30 * state.batchCount }
  ];

  tbody.innerHTML = items.map(it => {
    const meta = ITEMS_DB[it.id] || { name_th: 'Unknown', name_en: 'Unknown' };
    const priceData = state.marketPrices[it.id] || { basePrice: 100000, currentStock: 0 };
    const unitPrice = priceData.basePrice;
    const marketTotal = unitPrice * it.qty;

    // Calculate craft cost from direct raw breakdown
    const rawBreakdown = getRawMaterialsBreakdown(it.id, it.qty, state.alchemyYield);
    let craftCost = 0;
    for (const [rawId, rawQty] of Object.entries(rawBreakdown)) {
      const p = state.marketPrices[rawId]?.basePrice || ITEMS_DB[rawId]?.default_price || 10000;
      craftCost += p * rawQty;
    }

    const diff = marketTotal - craftCost; // >0 means craft is cheaper
    const isCraftCheaper = diff > 0;

    return `
      <tr>
        <td>
          <div class="item-name-cell">
            <span class="item-th">${meta.name_th}</span>
            <span class="item-en">${meta.name_en}</span>
          </div>
        </td>
        <td><span class="id-badge">${it.id}</span></td>
        <td class="text-right num-val">${formatNumber(it.qty)}</td>
        <td class="text-right num-val">${formatNumber(unitPrice)}</td>
        <td class="text-right num-val ${priceData.currentStock === 0 ? 'text-red' : ''}">${formatNumber(priceData.currentStock)}</td>
        <td class="text-right num-val">${formatNumber(marketTotal)}</td>
        <td class="text-right num-val text-gold">${formatNumber(craftCost)}</td>
        <td class="text-right num-val ${isCraftCheaper ? 'text-green' : 'text-red'}">
          ${isCraftCheaper ? 'ประหยัด ' : 'แพงกว่า '}${formatNumber(Math.abs(diff))}
        </td>
        <td class="text-center">
          <span class="badge ${isCraftCheaper ? 'badge-purple' : 'badge-gray'}">
            ${isCraftCheaper ? '🔨 คราฟต์เอง' : '🛒 ซื้อตลาด'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Interactive Recipe Tree
function renderRecipeTree() {
  const container = document.getElementById('recipe-tree-root');

  function buildNode(itemId, qtyNeeded, isRoot = false) {
    const meta = ITEMS_DB[itemId] || { name_th: 'Unknown', name_en: 'Unknown' };
    const priceData = state.marketPrices[itemId] || { basePrice: 0, currentStock: 0 };
    const hasSubRecipe = !!RECIPES[itemId];
    const rec = RECIPES[itemId];

    let tagClass = 'tag-raw';
    let tagLabel = 'วัตถุดิบดิบ';
    if (rec) {
      if (rec.type === 'Simple Alchemy') {
        tagClass = 'tag-simple';
        tagLabel = 'Simple Alchemy';
      } else {
        tagClass = 'tag-alchemy';
        tagLabel = 'Alchemy';
      }
    }

    const nodeDiv = document.createElement('div');
    nodeDiv.className = `tree-node ${isRoot ? 'root-node' : ''}`;

    const cardDiv = document.createElement('div');
    cardDiv.className = 'node-card';

    const mainDiv = document.createElement('div');
    mainDiv.className = 'node-main';

    if (hasSubRecipe) {
      const toggle = document.createElement('span');
      toggle.className = 'toggle-icon';
      toggle.innerText = '▼';
      mainDiv.appendChild(toggle);
    } else {
      const bullet = document.createElement('span');
      bullet.className = 'toggle-icon';
      bullet.innerText = '•';
      bullet.style.opacity = '0.5';
      mainDiv.appendChild(bullet);
    }

    const tagSpan = document.createElement('span');
    tagSpan.className = `node-tag ${tagClass}`;
    tagSpan.innerText = tagLabel;
    mainDiv.appendChild(tagSpan);

    const namesDiv = document.createElement('div');
    namesDiv.innerHTML = `
      <span class="node-name">${meta.name_th}</span>
      <span class="node-subname">${meta.name_en} (ID: ${itemId})</span>
    `;
    mainDiv.appendChild(namesDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'node-meta';
    metaDiv.innerHTML = `
      <span class="node-qty">x${formatNumber(qtyNeeded)}</span>
      <span class="node-cost">${formatNumber(priceData.basePrice * qtyNeeded)} Silver</span>
    `;

    cardDiv.appendChild(mainDiv);
    cardDiv.appendChild(metaDiv);
    nodeDiv.appendChild(cardDiv);

    if (hasSubRecipe) {
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children';

      let baseYield = rec.yield;
      if (rec.type === 'Alchemy') {
        baseYield *= state.alchemyYield;
      }
      const craftCount = qtyNeeded / baseYield;

      for (const [childId, childQty] of Object.entries(rec.mats)) {
        const childNode = buildNode(Number(childId), childQty * craftCount, false);
        childrenDiv.appendChild(childNode);
      }

      nodeDiv.appendChild(childrenDiv);

      cardDiv.addEventListener('click', (e) => {
        const isCollapsed = childrenDiv.classList.toggle('collapsed');
        cardDiv.querySelector('.toggle-icon').innerText = isCollapsed ? '►' : '▼';
      });
    }

    return nodeDiv;
  }

  container.innerHTML = '';
  const totalTarget = 10 * state.batchCount;
  container.appendChild(buildNode(1407, totalTarget, true));
}

// Global Recalculate and Render
function recalculateAndRender() {
  const metrics = calculateMetrics();
  renderDashboard(metrics);
  renderRawTable(metrics);
  renderIntermediateTable(metrics);
  renderRecipeTree();
}

// Setup Event Listeners
function setupEvents() {
  // Region Select
  const regionSelect = document.getElementById('region-select');
  regionSelect.value = state.region;
  regionSelect.addEventListener('change', (e) => {
    state.region = e.target.value;
    saveSettings();
    fetchPrices(true);
  });

  // Batch Count
  const batchInput = document.getElementById('batch-count');
  batchInput.value = state.batchCount;
  batchInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 10000) val = 10000;
    state.batchCount = val;
    batchInput.value = val;
    saveSettings();
    recalculateAndRender();
  });

  document.getElementById('btn-batch-dec').addEventListener('click', () => {
    if (state.batchCount > 1) {
      state.batchCount--;
      batchInput.value = state.batchCount;
      saveSettings();
      recalculateAndRender();
    }
  });

  document.getElementById('btn-batch-inc').addEventListener('click', () => {
    state.batchCount++;
    batchInput.value = state.batchCount;
    saveSettings();
    recalculateAndRender();
  });

  // Switches
  const switchVP = document.getElementById('switch-vp');
  switchVP.checked = state.hasVP;
  switchVP.addEventListener('change', (e) => {
    state.hasVP = e.target.checked;
    saveSettings();
    recalculateAndRender();
  });

  const switchRing = document.getElementById('switch-ring');
  if (switchRing) {
    switchRing.checked = state.hasRing;
    switchRing.addEventListener('change', (e) => {
      state.hasRing = e.target.checked;
      saveSettings();
      recalculateAndRender();
    });
  }

  const switchBlueProc = document.getElementById('switch-blue-proc');
  if (switchBlueProc) {
    switchBlueProc.checked = state.includeBlueProc;
    switchBlueProc.addEventListener('change', (e) => {
      state.includeBlueProc = e.target.checked;
      state.alchemyYield = getEffectiveYield(state.mastery, state.includeBlueProc);
      saveSettings();
      recalculateAndRender();
    });
  }

  // Mastery Input & Presets
  const masteryInput = document.getElementById('mastery-input');
  masteryInput.value = state.mastery === -1 ? 0 : state.mastery;
  
  function applyMastery(val) {
    state.mastery = val;
    state.alchemyYield = getEffectiveYield(val, state.includeBlueProc);
    saveSettings();
    
    // Update preset active classes
    document.querySelectorAll('.preset-btn').forEach(btn => {
      const bM = parseInt(btn.dataset.mastery, 10);
      btn.classList.toggle('active', bM === val);
    });
    
    recalculateAndRender();
  }

  masteryInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 3000) val = 3000;
    applyMastery(val);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.mastery, 10);
      applyMastery(val);
    });
  });

  // Level Helper Drawer
  const drawer = document.getElementById('level-helper-drawer');
  const toggleBtn = document.getElementById('btn-toggle-level-helper');
  const closeBtn = document.getElementById('btn-close-level-helper');
  const tierSelect = document.getElementById('calc-level-tier');
  const lvlNumInput = document.getElementById('calc-level-num');
  const gearSelect = document.getElementById('calc-gear-tier');
  const totalDisplay = document.getElementById('calc-total-mastery-val');
  const previewDisplay = document.getElementById('calc-yield-preview');
  const applyBtn = document.getElementById('btn-apply-calculated-mastery');

  function updateDrawerEstimate() {
    const total = calculateMasteryFromLevel(tierSelect.value, lvlNumInput.value, gearSelect.value);
    totalDisplay.innerText = formatNumber(total);
    const y = getYieldFromMastery(total);
    previewDisplay.innerText = `(ผลผลิตเฉลี่ย ${y.toFixed(2)} ขวด/รอบ)`;
    return total;
  }

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = drawer.style.display !== 'none';
      drawer.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) updateDrawerEstimate();
    });
  }

  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.style.display = 'none';
    });
  }

  [tierSelect, lvlNumInput, gearSelect].forEach(el => {
    if (el) el.addEventListener('input', updateDrawerEstimate);
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const calcTotal = updateDrawerEstimate();
      drawer.style.display = 'none';
      applyMastery(calcTotal);
    });
  }

  // Action Buttons
  document.getElementById('btn-refresh-prices').addEventListener('click', () => {
    fetchPrices(true);
  });

  document.getElementById('btn-retry-error').addEventListener('click', () => {
    fetchPrices(true);
  });

  document.getElementById('btn-clear-inventory').addEventListener('click', () => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างจำนวนในคลังทั้งหมด?')) {
      state.inventory = {};
      saveInventory();
      recalculateAndRender();
    }
  });

  // Fill All Stock Button
  document.getElementById('btn-fill-all-stock').addEventListener('click', () => {
    const rawReq = getRawMaterialsBreakdown(1407, 10 * state.batchCount, state.alchemyYield);
    for (const [idStr, qty] of Object.entries(rawReq)) {
      state.inventory[idStr] = Math.ceil(qty);
    }
    saveInventory();
    recalculateAndRender();
  });

  // Search Input
  const searchInput = document.getElementById('raw-search');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    const metrics = calculateMetrics();
    renderRawTable(metrics);
  });

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      const metrics = calculateMetrics();
      renderRawTable(metrics);
    });
  });

  // Tab Navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Tree Expand/Collapse All
  document.getElementById('btn-tree-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('collapsed'));
    document.querySelectorAll('.tree-node .toggle-icon').forEach(icon => {
      if (icon.innerText === '►') icon.innerText = '▼';
    });
  });

  document.getElementById('btn-tree-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.tree-children').forEach((el, idx) => {
      if (idx > 0) el.classList.add('collapsed');
    });
    document.querySelectorAll('.tree-node:not(.root-node) .toggle-icon').forEach(icon => {
      if (icon.innerText === '▼') icon.innerText = '►';
    });
  });

  // Delegate Inventory Input Changes in Raw Table
  document.getElementById('raw-table-body').addEventListener('input', (e) => {
    if (e.target.classList.contains('stock-input')) {
      const itemId = Number(e.target.dataset.id);
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      state.inventory[itemId] = val;
      saveInventory();

      // Recalculate metrics without losing focus
      const metrics = calculateMetrics();
      renderDashboard(metrics);
      renderIntermediateTable(metrics);

      // Update row missing cell and total in-place
      const tr = e.target.closest('tr');
      if (tr) {
        const rowData = metrics.rawRows.find(r => r.id === itemId);
        if (rowData) {
          const missingTd = tr.querySelector('td:nth-child(6)');
          const netCostTd = tr.querySelector('td:nth-child(9)');
          const statusTd = tr.querySelector('td:nth-child(1)');

          if (missingTd) {
            missingTd.innerText = formatNumber(rowData.missing);
            missingTd.className = `text-right num-val ${rowData.missing === 0 ? 'text-green text-bold' : 'text-red'}`;
          }
          if (netCostTd) {
            netCostTd.innerText = formatNumber(rowData.lineNetCost);
            netCostTd.className = `text-right num-val text-bold ${rowData.lineNetCost > 0 ? 'text-gold' : 'text-green'}`;
          }
          if (statusTd) {
            if (rowData.isComplete) {
              tr.className = 'row-complete';
              statusTd.innerHTML = '<span class="status-badge complete" title="ของในคลังครบแล้ว">✓</span>';
            } else if (rowData.isHighCost) {
              tr.className = 'row-high-cost';
              statusTd.innerHTML = '<span class="status-badge high" title="วัตถุดิบต้นทุนสูง/ขาดเยอะ">★</span>';
            } else {
              tr.className = '';
              statusTd.innerHTML = '<span class="status-badge missing" title="ยังขาดอยู่">✕</span>';
            }
          }
        }
      }

      // Update table totals
      document.getElementById('total-mats-in-stock').innerText = formatNumber(metrics.totalMatsInStockCount);
      document.getElementById('total-mats-missing').innerText = formatNumber(metrics.totalMatsMissingCount);
      document.getElementById('total-cost-to-buy').innerText = `${formatNumber(metrics.netRawCost)} Silver`;
    }
  });

  // Countdown timer interval
  setInterval(updateCacheTimer, 1000);
}

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  setupEvents();
  // 1. Render immediately with cached/default prices so user sees dashboard in 0ms!
  recalculateAndRender();
  // 2. Fetch live prices in background to update
  fetchPrices(false);
});

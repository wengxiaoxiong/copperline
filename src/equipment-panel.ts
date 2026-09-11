import { WEAPONS, type Inventory } from "./inventory";

export function renderEquipmentPanel(inventory: Inventory, coins: number, mode: "inventory" | "shop", doc: Pick<Document, "getElementById"> = document) {
  const $ = (id: string) => doc.getElementById(id)!;
  $("equipment-title").textContent = mode === "shop" ? "街角武器商店" : "我的物品栏";
  $("equipment-wallet").textContent = `余额 ◈ ${coins} · 已拥有 ${inventory.owned.size} / ${WEAPONS.length}`;
  $("equipment-items").innerHTML = WEAPONS.map((w, i) => {
    const owned = inventory.owned.get(i), selected = inventory.selected === i;
    return `<button data-slot="${i}" class="weapon-card ${selected ? "selected" : ""}" ${!owned && (mode !== "shop" || coins < w.price) ? "disabled" : ""}><small>0${i + 1} / ${owned ? "已拥有" : "未拥有"}</small><strong>${w.name}</strong><span>${w.description}</span><span>弹匣 ${owned ? owned.ammo : w.capacity} / ${w.capacity} · 射程 ${w.range}m</span><b>${selected ? "使用中" : owned ? "装备" : `◈ ${w.price} 金币 · ${mode === "shop" ? coins < w.price ? "余额不足" : "购买并装备" : "商店购买"}`}</b></button>`;
  }).join("");
}

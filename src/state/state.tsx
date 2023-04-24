import {makeAutoObservable, toJS} from 'mobx';
import React, {createContext, useContext} from 'react';
import {PartialDeep} from 'type-fest';
import {Potion} from '@/lib/enums/Potion';
import * as localforage from 'localforage';
import {EquipmentPiece, Monster, Player, PlayerEquipment, Preferences, State, UI} from '@/types/State';
import {Prayer} from '@/lib/enums/Prayer';
import merge from 'lodash.merge';
import {EquipmentCategory, getCombatStylesForCategory} from '@/lib/enums/EquipmentCategory';
import {toast} from 'react-toastify';

const emptyEquipmentSlot: EquipmentPiece = {
  name: '',
  image: '',
  category: EquipmentCategory.NONE,
  offensive: {
    crush: 0,
    magic_str: 0,
    magic: 0,
    ranged: 0,
    ranged_str: 0,
    slash: 0,
    stab: 0,
    str: 0
  },
  defensive: {
    crush: 0,
    magic: 0,
    ranged: 0,
    slash: 0,
    stab: 0,
    prayer: 0
  }
}

const generateInitialEquipment = () => {
  let slots = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
  let equipment: {[k: string]: any} = {};
  for (let s of slots) {
    equipment[s] = emptyEquipmentSlot;
  }
  return equipment as PlayerEquipment;
}

class GlobalState implements State {
  player: Player = {
    style: getCombatStylesForCategory(EquipmentCategory.NONE)[0],
    skills: {
      atk: 1,
      def: 1,
      hp: 10,
      magic: 1,
      prayer: 1,
      ranged: 1,
      str: 1,
    },
    equipment: generateInitialEquipment(),
    prayers: [],
    bonuses: {
      str: 0,
      ranged_str: 0,
      magic_str: 0,
      prayer: 0,
    },
    defensive: {
      stab: 0,
      slash: 0,
      crush: 0,
      magic: 0,
      ranged: 0,
    },
    offensive: {
      stab: 0,
      slash: 0,
      crush: 0,
      magic: 0,
      ranged: 0,
    },
    buffs: {
      potions: [],
      onSlayerTask: false,
      inWilderness: false,
      kandarinDiary: false,
      chargeSpell: false,
    },
    spell: {
      name: '',
      image: '',
      max_hit: 0,
      spellbook: 'standard',
    }
  }

  monster: Monster = {
    name: '',
    size: 0,
    skills: {
      atk: 0,
      def: 0,
      hp: 0,
      magic: 0,
      ranged: 0,
      str: 0,
    },
    offensive: {
      atk: 0,
      magic: 0,
      magic_str: 0,
      ranged: 0,
      ranged_str: 0,
      str: 0,
    },
    defensive: {
      crush: 0,
      magic: 0,
      ranged: 0,
      slash: 0,
      stab: 0,
    },
    attributes: []
  }

  ui: UI = {
    showPreferencesModal: false,
  }
  prefs: Preferences = {
    allowEditingPlayerStats: false,
    allowEditingMonsterStats: false,
  }

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Get the available combat styles for the currently equipped weapon
   * @see https://oldschool.runescape.wiki/w/Combat_Options
   */
  get availableCombatStyles() {
    return getCombatStylesForCategory(this.player.equipment.weapon.category);
  }

  updateUIState(ui: PartialDeep<UI>) {
    this.ui = Object.assign(this.ui, ui);
  }

  loadPreferences() {
    localforage.getItem('dps-calc-prefs').then((v) => {
      this.updatePreferences(v as PartialDeep<Preferences>);
    }).catch((e) => {
      console.error(e);
      // TODO maybe some handling here
    })
  }

  updatePreferences(pref: PartialDeep<Preferences>) {
    // Update local state store
    this.prefs = Object.assign(this.prefs, pref);

    // Save to browser storage
    localforage.setItem('dps-calc-prefs', toJS(this.prefs)).catch((e) => {
      console.error(e);
      // TODO something that isn't this
      alert('Could not persist preferences to browser. Make sure our site has permission to do this.');
    })
  }

  /**
   * Toggle a potion, with logic to remove from or add to the potions array depending on if it is already in there.
   * @param potion
   */
  togglePlayerPotion(potion: Potion) {
    const isToggled = this.player.buffs.potions.includes(potion);
    if (isToggled) {
      this.player.buffs.potions = this.player.buffs.potions.filter((p) => p !== potion);
    } else {
      this.player.buffs.potions = [...this.player.buffs.potions, potion];
    }
  }

  /**
   * Toggle a prayer, with logic to remove from or add to the prayers array depending on if it is already in there.
   * @param prayer
   */
  togglePlayerPrayer(prayer: Prayer) {
    const isToggled = this.player.prayers.includes(prayer);
    if (isToggled) {
      this.player.prayers = this.player.prayers.filter((p) => p !== prayer);
    } else {
      this.player.prayers = [...this.player.prayers, prayer];
    }
  }

  /**
   * Update the player state.
   * @param player
   */
  updatePlayer(player: PartialDeep<Player>) {
    if (
      (player.equipment?.weapon?.category !== undefined) &&
      (player.equipment.weapon.category !== this.player.equipment.weapon.category)
    ) {
      // If the weapon slot category was changed, we should reset the player's selected combat style to the first one that exists.
      player.style = getCombatStylesForCategory(player.equipment.weapon.category)[0];
      toast(<div>The available combat styles have changed. We&apos;ve selected the first available style for this weapon.</div>,
        {toastId: 'weapon-category-changed', type: 'info'}
      )
    }

    this.player = merge(this.player, player);
  }

  /**
   * Update the monster state.
   * @param monster
   */
  updateMonster(monster: PartialDeep<Monster>) {
    this.monster = merge(this.monster, monster);
  }

  /**
   * Clear an equipment slot, removing the item that was inside of it.
   * @param slot
   */
  clearEquipmentSlot(slot: keyof PlayerEquipment ) {
    this.updatePlayer({
      equipment: {
        [slot]: emptyEquipmentSlot
      }
    })
  }
}

const StoreContext = createContext<GlobalState>(new GlobalState());

const StoreProvider: React.FC<{ store: GlobalState, children: any }> = ({ store, children }) => {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  )
}

const useStore = () => {
  return useContext(StoreContext);
}

export { GlobalState, StoreProvider, useStore };
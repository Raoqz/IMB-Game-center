/* =========================================================
   IMB CASINO - GLOBAL ECONOMY, FICTIONAL DEBT & DAILY BONUS API (v2)
   Stockage Firebase : casino/users/<tag>
   ========================================================= */
(function () {
  'use strict';

  const INITIAL_BALANCE = 1000;
  const INITIAL_TOKENS = 0;
  const INITIAL_DEBT = 0;
  const ATM_THRESHOLD = 200;    // Éligible uniquement si solde <= 200$
  const ATM_REWARD = 1000;      // +1000$ par retrait ATM
  const DAILY_BONUS_AMOUNT = 200; // +200$ par jour
  const ATM_COOLDOWN_MS = 2000; // Anti-spam de 2 secondes

  let currentTag = null;
  let currentProfile = null;
  let profileRef = null;
  let leaderboardRef = null;
  let lastAtmCall = 0;
  let atmBusy = false;

  const profileSubscribers = new Set();
  const leaderboardSubscribers = new Set();

  /**
   * Retourne la date du jour au format YYYY-MM-DD (heure locale)
   */
  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Vérifie si le joueur peut récupérer son bonus quotidien de 200$
   */
  function canClaimDailyBonus(profile) {
    const p = profile || currentProfile;
    if (!p) return false;
    return p.lastDailyDate !== getTodayDateString();
  }

  /**
   * Tri du Classement des Plus Riches :
   * 1. Solde décroissant
   * 2. Dette croissante (le moins endetté devant)
   * 3. Tokens utilisés croissants
   * 4. Ancienneté
   */
  function sortCasinoPlayers(a, b) {
    const balA = Number(a.balance ?? 0);
    const balB = Number(b.balance ?? 0);
    if (balB !== balA) return balB - balA;

    const debtA = Number(a.debt ?? 0);
    const debtB = Number(b.debt ?? 0);
    if (debtA !== debtB) return debtA - debtB;

    const tokA = Number(a.tokens ?? a.tokensUsed ?? 0);
    const tokB = Number(b.tokens ?? b.tokensUsed ?? 0);
    if (tokA !== tokB) return tokA - tokB;

    const tsA = Number(a.timestamp ?? Number.MAX_SAFE_INTEGER);
    const tsB = Number(b.timestamp ?? Number.MAX_SAFE_INTEGER);
    return tsA - tsB;
  }

  /**
   * Tri du Classement des Dettes (du plus endetté au moins endetté) :
   * 1. Dette décroissante
   * 2. Tokens utilisés décroissants
   * 3. Solde croissant
   */
  function sortCasinoDebtPlayers(a, b) {
    const debtA = Number(a.debt ?? 0);
    const debtB = Number(b.debt ?? 0);
    if (debtB !== debtA) return debtB - debtA;

    const tokA = Number(a.tokens ?? a.tokensUsed ?? 0);
    const tokB = Number(b.tokens ?? b.tokensUsed ?? 0);
    if (tokB !== tokA) return tokB - tokA;

    const balA = Number(a.balance ?? 0);
    const balB = Number(b.balance ?? 0);
    return balA - balB;
  }

  function waitForShellUser() {
    return new Promise((resolve) => {
      if (window.GameShell && GameShell.currentUser) {
        return resolve(GameShell.currentUser);
      }
      const iv = setInterval(() => {
        if (window.GameShell && GameShell.currentUser) {
          clearInterval(iv);
          resolve(GameShell.currentUser);
        }
      }, 60);
    });
  }

  /**
   * Initialise ou met à jour le profil du joueur dans casino/users/<tag>
   */
  async function initPlayerProfile(userOverride) {
    const u = userOverride || await waitForShellUser();
    if (!u || !u.tag) throw new Error("Utilisateur non identifié.");

    currentTag = u.tag;
    profileRef = db.ref(`casino/users/${u.tag}`);

    await profileRef.transaction((current) => {
      if (!current) {
        return {
          tag: u.tag,
          nickname: u.nickname || u.tag,
          avatarEmoji: u.avatarEmoji || '🍺',
          flagEmoji: u.flagEmoji || '🇫🇷',
          balance: INITIAL_BALANCE,
          tokens: INITIAL_TOKENS,
          tokensUsed: INITIAL_TOKENS,
          debt: INITIAL_DEBT,
          lastDailyDate: null,
          timestamp: Date.now(),
          createdAt: Date.now()
        };
      }
      current.tag = u.tag;
      current.nickname = u.nickname || current.nickname || u.tag;
      current.avatarEmoji = u.avatarEmoji || current.avatarEmoji || '🍺';
      current.flagEmoji = u.flagEmoji || current.flagEmoji || '🇫🇷';
      current.balance = Math.max(0, Number(current.balance) || 0);
      current.tokens = Math.max(0, Number(current.tokens ?? current.tokensUsed ?? 0));
      current.tokensUsed = current.tokens;
      current.debt = Math.max(0, Number(current.debt ?? 0));
      if (!current.timestamp) current.timestamp = Date.now();
      return current;
    });

    profileRef.on('value', (snap) => {
      const val = snap.val();
      if (!val) return;
      currentProfile = val;
      profileSubscribers.forEach((cb) => {
        try { cb(val); } catch (e) { console.error(e); }
      });
    });

    const snap = await profileRef.once('value');
    currentProfile = snap.val();
    return currentProfile;
  }

  /**
   * Met à jour le solde du joueur (gain positif ou perte négative, jamais sous 0$)
   */
  async function updateCasinoBalance(amount) {
    const delta = Math.round(Number(amount));
    if (isNaN(delta) || delta === 0) {
      return { ok: false, error: "Montant invalide.", profile: currentProfile };
    }

    if (!profileRef) await initPlayerProfile();

    let rejectedReason = null;

    const result = await profileRef.transaction((current) => {
      if (!current) return current;

      const curBal = Math.max(0, Number(current.balance ?? INITIAL_BALANCE));
      const nextBal = curBal + delta;

      if (nextBal < 0) {
        rejectedReason = `Solde insuffisant (${curBal} $ disponibles).`;
        return;
      }

      current.balance = nextBal;
      current.timestamp = Date.now();
      return current;
    });

    if (!result.committed || rejectedReason) {
      return {
        ok: false,
        error: rejectedReason || "Transaction refusée.",
        profile: currentProfile
      };
    }

    currentProfile = result.snapshot.val();
    return {
      ok: true,
      balance: currentProfile.balance,
      tokens: currentProfile.tokens,
      debt: currentProfile.debt || 0,
      profile: currentProfile
    };
  }

  /**
   * Distributeur ATM (Sans limite de tokens) :
   * - Autorisé UNIQUEMENT si solde <= 200$
   * - Ajoute +1000$ au solde et +1 Token
   * - Ajoute à la dette fictive la différence : (1000 - solde_restant)
   */
  async function useATM() {
    const now = Date.now();
    if (atmBusy || (now - lastAtmCall) < ATM_COOLDOWN_MS) {
      const waitSec = Math.ceil((ATM_COOLDOWN_MS - (now - lastAtmCall)) / 1000);
      return {
        ok: false,
        code: 'COOLDOWN',
        error: `Anti-spam : patiente ${Math.max(1, waitSec)}s.`
      };
    }

    if (!profileRef) await initPlayerProfile();

    atmBusy = true;
    lastAtmCall = now;
    let failCode = null;
    let failMsg = null;
    let addedDebtAmount = 0;

    try {
      const result = await profileRef.transaction((current) => {
        if (!current) return current;

        const bal = Math.max(0, Number(current.balance ?? 0));
        const tok = Math.max(0, Number(current.tokens ?? current.tokensUsed ?? 0));
        const curDebt = Math.max(0, Number(current.debt ?? 0));

        if (bal > ATM_THRESHOLD) {
          failCode = 'TOO_RICH';
          failMsg = `ATM verrouillé : ton solde (${bal} $) doit être inférieur ou égal à ${ATM_THRESHOLD} $.`;
          return;
        }

        // Dette fictive ajoutée = différence entre 1000$ et la somme qu'il restait au joueur
        addedDebtAmount = Math.max(0, ATM_REWARD - bal);

        current.balance = bal + ATM_REWARD;
        current.tokens = tok + 1;
        current.tokensUsed = current.tokens;
        current.debt = curDebt + addedDebtAmount;
        current.timestamp = Date.now();
        current.lastAtmAt = Date.now();
        return current;
      });

      if (!result.committed || failMsg) {
        return {
          ok: false,
          code: failCode || 'ABORTED',
          error: failMsg || "Retrait ATM impossible.",
          profile: currentProfile
        };
      }

      currentProfile = result.snapshot.val();
      return {
        ok: true,
        reward: ATM_REWARD,
        addedDebt: addedDebtAmount,
        balance: currentProfile.balance,
        tokens: currentProfile.tokens,
        debt: currentProfile.debt,
        profile: currentProfile
      };
    } catch (err) {
      console.error("Erreur ATM :", err);
      return { ok: false, code: 'ERROR', error: "Erreur réseau lors du retrait ATM." };
    } finally {
      setTimeout(() => { atmBusy = false; }, 500);
    }
  }

  /**
   * Permet au joueur de rembourser sa dette fictive du montant de son choix
   * @param {number} requestedAmount - Montant que le joueur souhaite rembourser
   */
  async function repayDebt(requestedAmount) {
    if (!profileRef) await initPlayerProfile();

    const rawAmount = Math.floor(Number(requestedAmount));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      return { ok: false, error: "Entre un montant valide supérieur à 0 $." };
    }

    let failMsg = null;
    let paidAmount = 0;

    const result = await profileRef.transaction((current) => {
      if (!current) return current;

      const bal = Math.max(0, Number(current.balance ?? 0));
      const curDebt = Math.max(0, Number(current.debt ?? 0));

      if (curDebt <= 0) {
        failMsg = "Tu n'as aucune dette à rembourser !";
        return;
      }
      if (bal <= 0) {
        failMsg = "Ton solde est à 0 $, impossible de rembourser pour le moment.";
        return;
      }
      if (rawAmount > bal) {
        failMsg = `Solde insuffisant : tu ne peux pas rembourser plus que ton solde (${bal.toLocaleString('fr-FR')} $).`;
        return;
      }

      paidAmount = Math.min(rawAmount, curDebt);
      current.balance = bal - paidAmount;
      current.debt = curDebt - paidAmount;
      current.timestamp = Date.now();
      return current;
    });

    if (!result.committed || failMsg) {
      return { ok: false, error: failMsg || "Remboursement impossible." };
    }

    currentProfile = result.snapshot.val();
    return {
      ok: true,
      paidAmount,
      balance: currentProfile.balance,
      debt: currentProfile.debt,
      profile: currentProfile
    };
  }

  /**
   * Réclame le bonus quotidien de +200$ (1 fois par jour)
   */
  async function claimDailyBonus() {
    if (!profileRef) await initPlayerProfile();

    const today = getTodayDateString();
    let failMsg = null;

    const result = await profileRef.transaction((current) => {
      if (!current) return current;

      if (current.lastDailyDate === today) {
        failMsg = "Tu as déjà récupéré ton bonus quotidien de 200 $ aujourd'hui ! Reviens demain.";
        return;
      }

      current.balance = Math.max(0, Number(current.balance ?? 0)) + DAILY_BONUS_AMOUNT;
      current.lastDailyDate = today;
      current.timestamp = Date.now();
      return current;
    });

    if (!result.committed || failMsg) {
      return { ok: false, error: failMsg || "Bonus quotidien indisponible." };
    }

    currentProfile = result.snapshot.val();
    return {
      ok: true,
      reward: DAILY_BONUS_AMOUNT,
      balance: currentProfile.balance,
      lastDailyDate: today,
      profile: currentProfile
    };
  }

  function decorateLeaderboard(sortedList) {
    const total = sortedList.length;
    return sortedList.map((player, index) => {
      const isFirst = index === 0;
      const isLast = total > 1 && index === total - 1;
      const tokens = Number(player.tokens ?? player.tokensUsed ?? 0);
      const debt = Number(player.debt ?? 0);
      return {
        ...player,
        balance: Number(player.balance ?? 0),
        tokens,
        tokensUsed: tokens,
        debt,
        rank: index + 1,
        isFirst,
        isLast,
        badgeEmoji: isFirst ? '👑' : (isLast ? '🫏' : null)
      };
    });
  }

  async function getLeaderboard() {
    const snap = await db.ref('casino/users').once('value');
    const data = snap.val() || {};
    const list = Object.values(data).sort(sortCasinoPlayers);
    return decorateLeaderboard(list);
  }

  function subscribeLeaderboard(callback) {
    if (typeof callback !== 'function') return () => {};
    leaderboardSubscribers.add(callback);

    if (!leaderboardRef) {
      leaderboardRef = db.ref('casino/users');
      leaderboardRef.on('value', (snap) => {
        const data = snap.val() || {};
        const sorted = decorateLeaderboard(Object.values(data).sort(sortCasinoPlayers));
        leaderboardSubscribers.forEach((cb) => {
          try { cb(sorted); } catch (e) { console.error(e); }
        });
      });
    } else {
      getLeaderboard().then((sorted) => callback(sorted));
    }

    return () => {
      leaderboardSubscribers.delete(callback);
    };
  }

  function subscribeProfile(callback) {
    if (typeof callback !== 'function') return () => {};
    profileSubscribers.add(callback);
    if (currentProfile) {
      try { callback(currentProfile); } catch (e) { console.error(e); }
    }
    return () => {
      profileSubscribers.delete(callback);
    };
  }

  window.CasinoAPI = {
    INITIAL_BALANCE,
    ATM_THRESHOLD,
    ATM_REWARD,
    DAILY_BONUS_AMOUNT,
    initPlayerProfile,
    updateCasinoBalance,
    useATM,
    repayDebt,
    claimDailyBonus,
    canClaimDailyBonus,
    getTodayDateString,
    getLeaderboard,
    subscribeLeaderboard,
    subscribeProfile,
    sortCasinoPlayers,
    sortCasinoDebtPlayers,
    getCurrentProfile: () => currentProfile
  };

  window.updateCasinoBalance = updateCasinoBalance;
  window.useATM = useATM;
})();

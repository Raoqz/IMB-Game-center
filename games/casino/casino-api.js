/* =========================================================
   IMB CASINO - GLOBAL ECONOMY & LEADERBOARD API (v1)
   Stockage Firebase : casino/users/<tag>
   ========================================================= */
(function () {
  'use strict';

  const INITIAL_BALANCE = 1000;
  const INITIAL_TOKENS = 0;
  const ATM_THRESHOLD = 200; // Éligible si solde <= 200$
  const ATM_REWARD = 1000;   // +1000$ par retrait ATM
  const MAX_TOKENS = 20;     // Plafond absolu : 20 tokens max
  const ATM_COOLDOWN_MS = 2500; // Anti-spam de 2.5 secondes

  let currentTag = null;
  let currentProfile = null;
  let profileRef = null;
  let leaderboardRef = null;
  let lastAtmCall = 0;
  let atmBusy = false;

  const profileSubscribers = new Set();
  const leaderboardSubscribers = new Set();

  /**
   * Fonction de tri officielle du Casino :
   * 1. Richesse (Solde décroissant)
   * 2. Économe (Tokens utilisés croissants)
   * 3. Ancienneté (Timestamp croissant : le premier arrivé à ce montant gagne)
   */
  function sortCasinoPlayers(a, b) {
    const balA = Number(a.balance ?? 0);
    const balB = Number(b.balance ?? 0);
    if (balB !== balA) return balB - balA;

    const tokA = Number(a.tokens ?? a.tokensUsed ?? 0);
    const tokB = Number(b.tokens ?? b.tokensUsed ?? 0);
    if (tokA !== tokB) return tokA - tokB;

    const tsA = Number(a.timestamp ?? Number.MAX_SAFE_INTEGER);
    const tsB = Number(b.timestamp ?? Number.MAX_SAFE_INTEGER);
    return tsA - tsB;
  }

  /**
   * Attend que GameShell ait chargé l'utilisateur connecté
   */
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
   * Initialise ou récupère le compte Casino du joueur sur Firebase
   * Chemin : casino/users/<tag>
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
          timestamp: Date.now(),
          createdAt: Date.now()
        };
      }
      // Mise à jour des infos cosmétiques tout en préservant l'économie
      current.tag = u.tag;
      current.nickname = u.nickname || current.nickname || u.tag;
      current.avatarEmoji = u.avatarEmoji || current.avatarEmoji || '🍺';
      current.flagEmoji = u.flagEmoji || current.flagEmoji || '🇫🇷';
      if (typeof current.balance !== 'number' || current.balance < 0) {
        current.balance = Math.max(0, Number(current.balance) || 0);
      }
      if (typeof current.tokens !== 'number') {
        current.tokens = Number(current.tokensUsed || 0);
      }
      current.tokensUsed = current.tokens;
      if (!current.timestamp) {
        current.timestamp = Date.now();
      }
      return current;
    });

    // Écoute temps réel du profil joueur
    profileRef.off();
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
   * Met à jour le solde du joueur (gain positif ou mise/perte négative).
   * SÉCURITÉ : Refuse toute opération qui ferait passer le solde sous 0$.
   * @param {number} amount - Montant à ajouter (ex: +250) ou retirer (ex: -100)
   */
  async function updateCasinoBalance(amount) {
    const delta = Math.round(Number(amount));
    if (isNaN(delta) || delta === 0) {
      return { ok: false, error: "Montant invalide.", profile: currentProfile };
    }

    if (!profileRef) {
      await initPlayerProfile();
    }

    let rejectedReason = null;

    const result = await profileRef.transaction((current) => {
      if (!current) return current;

      const curBal = Math.max(0, Number(current.balance ?? INITIAL_BALANCE));
      const nextBal = curBal + delta;

      // Règle absolue : Solde négatif impossible
      if (nextBal < 0) {
        rejectedReason = `Solde insuffisant (${curBal} $ disponibles).`;
        return; // Annule la transaction Firebase
      }

      if (nextBal !== curBal) {
        current.balance = nextBal;
        current.timestamp = Date.now(); // Horodatage du nouveau solde atteint
      }
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
      profile: currentProfile
    };
  }

  /**
   * Vérifie si un montant de mise est autorisé pour le joueur actuel
   */
  function canAffordBet(betAmount) {
    const bet = Math.round(Number(betAmount));
    if (isNaN(bet) || bet <= 0) return false;
    const bal = Number(currentProfile?.balance ?? 0);
    return bet <= bal;
  }

  /**
   * Retourne la mise maximale autorisée (bridée au solde actuel)
   */
  function getMaxBet() {
    return Math.max(0, Number(currentProfile?.balance ?? 0));
  }

  /**
   * Distributeur ATM :
   * - Autorisé UNIQUEMENT si solde <= 200$
   * - Limité à 20 Tokens maximum par joueur
   * - Ajoute +1000$ et +1 Token
   * - Intègre un anti-spam (cooldown + verrou de transaction)
   */
  async function useATM() {
    const now = Date.now();
    if (atmBusy || (now - lastAtmCall) < ATM_COOLDOWN_MS) {
      const waitSec = Math.ceil((ATM_COOLDOWN_MS - (now - lastAtmCall)) / 1000);
      return {
        ok: false,
        code: 'COOLDOWN',
        error: `Anti-spam : patiente ${Math.max(1, waitSec)}s avant d'utiliser l'ATM.`
      };
    }

    if (!profileRef) {
      await initPlayerProfile();
    }

    atmBusy = true;
    lastAtmCall = now;
    let failCode = null;
    let failMsg = null;

    try {
      const result = await profileRef.transaction((current) => {
        if (!current) return current;

        const bal = Number(current.balance ?? 0);
        const tok = Number(current.tokens ?? current.tokensUsed ?? 0);

        if (bal > ATM_THRESHOLD) {
          failCode = 'TOO_RICH';
          failMsg = `ATM verrouillé : ton solde (${bal} $) doit être inférieur ou égal à ${ATM_THRESHOLD} $.`;
          return; // Abort
        }

        if (tok >= MAX_TOKENS) {
          failCode = 'MAX_TOKENS';
          failMsg = `Limite atteinte : tu as déjà utilisé tes ${MAX_TOKENS}/${MAX_TOKENS} Tokens !`;
          return; // Abort
        }

        current.balance = bal + ATM_REWARD;
        current.tokens = tok + 1;
        current.tokensUsed = current.tokens;
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
        balance: currentProfile.balance,
        tokens: currentProfile.tokens,
        remainingTokens: Math.max(0, MAX_TOKENS - currentProfile.tokens),
        profile: currentProfile
      };
    } catch (err) {
      console.error("Erreur ATM :", err);
      return {
        ok: false,
        code: 'ERROR',
        error: "Erreur réseau lors du retrait ATM."
      };
    } finally {
      setTimeout(() => { atmBusy = false; }, 600);
    }
  }

  /**
   * Récupère le classement complet trié et enrichi des badges (👑 1er, 🫏 dernier)
   */
  async function getLeaderboard() {
    const snap = await db.ref('casino/users').once('value');
    const data = snap.val() || {};
    const list = Object.values(data).sort(sortCasinoPlayers);
    return decorateLeaderboard(list);
  }

  /**
   * Ajoute les métadonnées de rang et de badge (👑 / 🫏) à la liste triée
   */
  function decorateLeaderboard(sortedList) {
    const total = sortedList.length;
    return sortedList.map((player, index) => {
      const isFirst = index === 0;
      const isLast = total > 1 && index === total - 1;
      const tokens = Number(player.tokens ?? player.tokensUsed ?? 0);
      return {
        ...player,
        balance: Number(player.balance ?? 0),
        tokens: tokens,
        tokensUsed: tokens,
        rank: index + 1,
        isFirst: isFirst,
        isLast: isLast,
        badgeEmoji: isFirst ? '👑' : (isLast ? '🫏' : null)
      };
    });
  }

  /**
   * Écoute en temps réel le classement du Casino
   */
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

  /**
   * Écoute en temps réel les changements du profil du joueur connecté
   */
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

  // Exposition globale
  window.CasinoAPI = {
    INITIAL_BALANCE,
    ATM_THRESHOLD,
    ATM_REWARD,
    MAX_TOKENS,
    initPlayerProfile,
    updateCasinoBalance,
    useATM,
    canAffordBet,
    getMaxBet,
    getLeaderboard,
    subscribeLeaderboard,
    subscribeProfile,
    sortCasinoPlayers,
    getCurrentProfile: () => currentProfile
  };

  // Alias globaux directs pour un appel simplifié depuis n'importe quel jeu du casino
  window.updateCasinoBalance = updateCasinoBalance;
  window.useATM = useATM;
})();

/* =========================================================
   IMB CASINO - BLACKJACK APP
   Solo & Salon Multijoueur synchronisé, Jetons cumulables,
   Remboursement Push corrigé, Sans spam Big Win
   ========================================================= */
(function () {
  'use strict';

  const AFK_TIMEOUT_SECONDS = 60;

  let myUser = null;
  let myProfile = { balance: 1000, tokens: 0, debt: 0 };
  let isBootstrapped = false;

  let activeChip = 50;
  let currentBet = 50;
  let previousBet = 50;
  let freshBettingPhase = true; // Permet au 1er clic après une manche de repartir proprement ou d'empiler

  let shoe = [];
  let playerCards = [];
  let dealerCards = [];
  let gameState = 'BETTING'; // BETTING, WAITING_ROOM, PLAYING, DEALER_TURN, ROUND_OVER

  let soundEnabled = true;
  let audioCtx = null;

  // État Salon Multijoueur & Synchronisation Firebase
  let currentRoomCode = null;
  let roomRef = null;
  let roomDataCache = null;
  let settledRoundId = null;
  let afkInterval = null;
  let afkSecondsLeft = AFK_TIMEOUT_SECONDS;

  window.addEventListener('DOMContentLoaded', () => {
    shoe = BlackjackEngine.createShoe(6);
    renderBetsAndBalanceUI();
    listenCasinoChat();

    GameShell.init({
      gameId: 'casino/blackjack',
      gameTitle: '🃏 IMB Blackjack 21',
      theme: 'casino',
      rulesHtml: `
        <p>• 🃏 <strong>Objectif :</strong> Obtenir un score de 21 ou s'en approcher plus que le croupier sans dépasser.</p>
        <p>• 💰 <strong>Paiements :</strong> Victoire 1:1 (×2), Blackjack naturel payé 3:2 (×2.5), Égalité (Push) = mise intégralement remboursée.</p>
        <p>• 🎩 <strong>Croupier :</strong> Tire jusqu'à 16 et s'arrête obligatoirement à partir de 17.</p>
        <p>• 👥 <strong>Salon Multijoueur :</strong> Tous les joueurs du salon affrontent la même main du croupier en direct.</p>
      `,
      onGameInit: (user) => {
        bootstrapPlayerSession(user);
      },
      onJoinRoom: (code) => {
        joinMultiplayerRoom(code, false);
      }
    });

    waitForResolvedUser().then((user) => {
      if (user) bootstrapPlayerSession(user);
    });
  });

  function waitForResolvedUser() {
    return new Promise((resolve) => {
      if (window.GameShell && GameShell.currentUser) {
        return resolve(GameShell.currentUser);
      }
      const iv = setInterval(async () => {
        if (window.GameShell && GameShell.currentUser) {
          clearInterval(iv);
          return resolve(GameShell.currentUser);
        }
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
          try {
            const uid = firebase.auth().currentUser.uid;
            const snap = await db.ref(`users/${uid}`).once('value');
            if (snap.exists()) {
              clearInterval(iv);
              return resolve(snap.val());
            }
          } catch (e) {}
        }
      }, 100);
    });
  }

  async function bootstrapPlayerSession(userParam) {
    const user = userParam || (window.GameShell && GameShell.currentUser);
    if (!user || !user.tag || isBootstrapped) return;
    isBootstrapped = true;
    myUser = user;

    const avatarEl = document.getElementById('hudAvatar');
    const nickEl = document.getElementById('hudNickname');
    if (avatarEl) avatarEl.textContent = user.avatarEmoji || '🍺';
    if (nickEl) nickEl.textContent = user.nickname || user.tag;

    try {
      await CasinoAPI.initPlayerProfile(user);
      CasinoAPI.subscribeProfile((val) => {
        if (!val) return;
        myProfile = val;
        renderBetsAndBalanceUI();
      });
    } catch (err) {}

    renderBetsAndBalanceUI();

    const match = window.location.hash.match(/room=([A-Z0-9]{4})/i);
    if (match) {
      joinMultiplayerRoom(match[1].toUpperCase(), false);
    }
  }

  function getRealBalance() {
    if (myProfile && typeof myProfile.balance === 'number' && !isNaN(myProfile.balance)) {
      return Math.max(0, myProfile.balance);
    }
    return 1000;
  }

  async function commitBalanceDeltaToFirebase(deltaAmount) {
    const delta = Math.round(Number(deltaAmount));
    if (isNaN(delta) || delta === 0) return getRealBalance();

    if (!myUser) {
      myUser = (window.GameShell && GameShell.currentUser) || await waitForResolvedUser();
    }

    const currentBal = getRealBalance();
    const nextBal = Math.max(0, currentBal + delta);
    myProfile.balance = nextBal;
    renderBetsAndBalanceUI();

    if (!myUser || !myUser.tag) return nextBal;

    try {
      const userCasinoRef = db.ref(`casino/users/${myUser.tag}`);
      const snap = await userCasinoRef.once('value');
      const serverData = snap.val();

      const baseBal = (serverData && typeof serverData.balance === 'number') ? Math.max(0, serverData.balance) : currentBal;
      const finalBalance = Math.max(0, baseBal + delta);

      await userCasinoRef.update({
        balance: finalBalance,
        timestamp: Date.now()
      });

      myProfile.balance = finalBalance;
      renderBetsAndBalanceUI();
      return finalBalance;
    } catch (err) {
      return nextBal;
    }
  }

  /* =========================================================
     1. GESTION DES JETONS & MISES (CORRIGÉE)
     ========================================================= */
  function prepareForNewBetIfNeeded() {
    if (gameState === 'ROUND_OVER') {
      gameState = 'BETTING';
    }
  }

  function selectChip(val) {
    prepareForNewBetIfNeeded();
    if (gameState !== 'BETTING') return;

    const realBal = getRealBalance();
    activeChip = val;

    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    const t = document.getElementById(`chip_${val}`);
    if (t) t.classList.add('active');

    if (realBal <= 0) {
      showToast('Solde à 0 $ ! Utilise le bouton 🏧 ATM (+1 000 $).', '⚠️');
      return;
    }

    if (val === 'MAX') {
      currentBet = realBal;
      freshBettingPhase = false;
    } else {
      const chipAmount = Number(val) || 0;
      if (freshBettingPhase) {
        // Si la mise était pré-remplie automatiquement, le 1er clic sur un jeton ajoute directement ou ajuste
        currentBet = Math.min(realBal, currentBet + chipAmount);
        freshBettingPhase = false;
      } else {
        if (currentBet + chipAmount > realBal) {
          currentBet = realBal;
          showToast('Mise maximum atteinte selon ton solde.', '💰');
        } else {
          currentBet += chipAmount;
        }
      }
    }

    playCardSound();
    renderBetsAndBalanceUI();
    syncMySeatBet();
  }

  function clearBet() {
    prepareForNewBetIfNeeded();
    if (gameState !== 'BETTING') return;
    currentBet = 0;
    freshBettingPhase = false;
    renderBetsAndBalanceUI();
    syncMySeatBet();
  }

  function rebetLast() {
    prepareForNewBetIfNeeded();
    if (gameState !== 'BETTING') return;
    const realBal = getRealBalance();
    if (previousBet <= 0) return;
    if (previousBet > realBal) {
      currentBet = realBal;
      showToast('Solde ajusté au maximum disponible.', '⚠️');
    } else {
      currentBet = previousBet;
    }
    freshBettingPhase = false;
    renderBetsAndBalanceUI();
    syncMySeatBet();
  }

  function doubleBetAmount() {
    prepareForNewBetIfNeeded();
    if (gameState !== 'BETTING') return;
    const realBal = getRealBalance();
    if (currentBet <= 0) {
      currentBet = Math.min(realBal, 50);
    } else if (currentBet * 2 > realBal) {
      currentBet = realBal;
      showToast('Solde maximum engagé !', '💰');
    } else {
      currentBet *= 2;
    }
    freshBettingPhase = false;
    renderBetsAndBalanceUI();
    syncMySeatBet();
  }

  function renderBetsAndBalanceUI() {
    const realBal = getRealBalance();
    const tok = Number(myProfile?.tokens ?? myProfile?.tokensUsed ?? 0);

    const balEl = document.getElementById('hudBalanceValue');
    const tokEl = document.getElementById('hudTokensValue');
    if (balEl) balEl.textContent = realBal.toLocaleString('fr-FR');
    if (tokEl) tokEl.textContent = tok;

    // Si en phase de mise la mise dépasse le solde, on la plafonne
    if (gameState === 'BETTING' && currentBet > realBal) {
      currentBet = realBal;
    }

    const currentBetDisp = document.getElementById('currentBetDisplay');
    if (currentBetDisp) currentBetDisp.textContent = `${currentBet.toLocaleString('fr-FR')} $`;

    const btnDeal = document.getElementById('btnDeal');
    if (btnDeal) {
      if (gameState === 'WAITING_ROOM') {
        btnDeal.disabled = false;
        btnDeal.classList.remove('opacity-50', 'cursor-not-allowed');
        btnDeal.innerHTML = '🚀 LANCER LA TABLE';
      } else if (gameState === 'BETTING' || gameState === 'ROUND_OVER') {
        btnDeal.innerHTML = '🃏 DISTRIBUER';
        const canDeal = currentBet > 0 && currentBet <= realBal;
        btnDeal.disabled = !canDeal;
        if (canDeal) {
          btnDeal.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
          btnDeal.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }
    }
  }

  function setStatusBanner(text, tone = 'default') {
    const statusBanner = document.getElementById('bjStatusBanner');
    if (!statusBanner) return;
    statusBanner.textContent = text;
    if (tone === 'win') {
      statusBanner.className = 'inline-block bg-[#10b981] text-[#12131a] border-2 border-[#12131a] px-4 py-1.5 rounded-2xl font-mono text-xs sm:text-sm font-black shadow-[3px_3px_0px_#12131a] transition-all scale-105';
    } else if (tone === 'push') {
      statusBanner.className = 'inline-block bg-[#fed72d] text-[#12131a] border-2 border-[#12131a] px-4 py-1.5 rounded-2xl font-mono text-xs sm:text-sm font-black shadow-[3px_3px_0px_#12131a] transition-all';
    } else if (tone === 'lose') {
      statusBanner.className = 'inline-block bg-[#ef4444] text-white border-2 border-[#12131a] px-4 py-1.5 rounded-2xl font-mono text-xs sm:text-sm font-black shadow-[3px_3px_0px_#12131a] transition-all';
    } else {
      statusBanner.className = 'inline-block bg-[#12131a] text-[#fed72d] border-2 border-[#fed72d] px-4 py-1.5 rounded-2xl font-mono text-xs font-black shadow-[3px_3px_0px_rgba(0,0,0,0.4)] transition-all';
    }
  }

  function showBettingControls(visible) {
    const chipBox = document.getElementById('chipSelectorBox');
    const betBox = document.getElementById('bettingControlsBox');
    const actBox = document.getElementById('actionControlsBox');

    if (visible) {
      chipBox.classList.remove('hidden');
      betBox.classList.remove('hidden');
      actBox.classList.add('hidden');
      actBox.classList.remove('grid');
    } else {
      chipBox.classList.add('hidden');
      betBox.classList.add('hidden');
      actBox.classList.remove('hidden');
      actBox.classList.add('grid');
    }
  }

  /* =========================================================
     2. DISTRIBUTION DES CARTES (SOLO & SALON MULTIJOUEUR)
     ========================================================= */
  async function dealCards() {
    // Si on est déjà en attente des autres joueurs en salon et qu'on clique sur "🚀 LANCER LA TABLE"
    if (currentRoomCode && gameState === 'WAITING_ROOM') {
      await triggerMultiplayerRoundStart();
      return;
    }

    prepareForNewBetIfNeeded();
    if (gameState !== 'BETTING') return;

    const realBal = getRealBalance();
    if (currentBet <= 0 || currentBet > realBal) {
      showToast('Choisis une mise valide avec les jetons !', '⚠️');
      return;
    }

    previousBet = currentBet;
    await commitBalanceDeltaToFirebase(-currentBet);

    // --- MODE SALON MULTIJOUEUR ---
    if (currentRoomCode && roomRef) {
      await handleMultiplayerDealReady();
      return;
    }

    // --- MODE SOLO ---
    gameState = 'PLAYING';
    playerCards = [];
    dealerCards = [];

    showBettingControls(false);

    playerCards.push(BlackjackEngine.drawCard(shoe));
    dealerCards.push(BlackjackEngine.drawCard(shoe));
    playerCards.push(BlackjackEngine.drawCard(shoe));
    dealerCards.push(BlackjackEngine.drawCard(shoe));

    renderTable();
    playCardSound();

    const pEval = BlackjackEngine.evaluateHand(playerCards);
    const dEval = BlackjackEngine.evaluateHand(dealerCards);

    if (pEval.isBlackjack || dEval.isBlackjack) {
      finishSoloRound();
      return;
    }

    updateActionButtonsState();
    startAfkTimer();
  }

  function updateActionButtonsState() {
    const canDbl = BlackjackEngine.canDoubleDown(playerCards, currentBet, getRealBalance());
    const btnDbl = document.getElementById('btnDoubleDown');
    const btnHit = document.getElementById('btnHit');
    const btnStand = document.getElementById('btnStand');

    const isPlaying = gameState === 'PLAYING';
    if (btnHit) btnHit.disabled = !isPlaying;
    if (btnStand) btnStand.disabled = !isPlaying;
    if (btnDbl) btnDbl.disabled = !(isPlaying && canDbl);
  }

  /* =========================================================
     3. ACTIONS DU JOUEUR (Hit, Stand, Double)
     ========================================================= */
  async function playerHit() {
    if (gameState !== 'PLAYING') return;
    resetAfkTimer();

    playerCards.push(BlackjackEngine.drawCard(shoe));
    playCardSound();
    renderTable();
    updateActionButtonsState();

    const evalP = BlackjackEngine.evaluateHand(playerCards);

    if (evalP.isBust || evalP.total === 21) {
      stopAfkTimer();
      if (evalP.isBust) triggerBustEffect();

      if (currentRoomCode && roomRef) {
        await finishMyMultiplayerTurn();
      } else {
        setTimeout(() => startSoloDealerTurn(), 550);
      }
    } else if (currentRoomCode && roomRef) {
      await syncMySeatHand('PLAYING');
    }
  }

  async function playerStand() {
    if (gameState !== 'PLAYING') return;
    stopAfkTimer();

    if (currentRoomCode && roomRef) {
      await finishMyMultiplayerTurn();
    } else {
      startSoloDealerTurn();
    }
  }

  async function playerDoubleDown() {
    if (gameState !== 'PLAYING') return;
    const realBal = getRealBalance();
    if (currentBet > realBal) {
      showToast('Solde insuffisant pour doubler.', '⚠️');
      return;
    }

    stopAfkTimer();

    await commitBalanceDeltaToFirebase(-currentBet);
    currentBet *= 2;
    renderBetsAndBalanceUI();

    playerCards.push(BlackjackEngine.drawCard(shoe));
    playCardSound();
    renderTable();

    const evalP = BlackjackEngine.evaluateHand(playerCards);
    if (evalP.isBust) triggerBustEffect();

    if (currentRoomCode && roomRef) {
      await finishMyMultiplayerTurn();
    } else {
      setTimeout(() => startSoloDealerTurn(), 650);
    }
  }

  /* =========================================================
     4. RÉSOLUTION SOLO & REMBOURSEMENT ÉGALITÉ CORRIGÉ
     ========================================================= */
  function startSoloDealerTurn() {
    gameState = 'DEALER_TURN';
    renderTable();

    const pEval = BlackjackEngine.evaluateHand(playerCards);
    if (pEval.isBust) {
      finishSoloRound();
      return;
    }

    const dealerInterval = setInterval(() => {
      if (BlackjackEngine.shouldDealerHit(dealerCards)) {
        dealerCards.push(BlackjackEngine.drawCard(shoe));
        playCardSound();
        renderTable();
      } else {
        clearInterval(dealerInterval);
        const dEval = BlackjackEngine.evaluateHand(dealerCards);
        if (dEval.isBust) triggerBustEffect();
        setTimeout(() => finishSoloRound(), 400);
      }
    }, 650);
  }

  async function finishSoloRound() {
    gameState = 'ROUND_OVER';
    renderTable();
    await settleMyHandPayout();
  }

  /**
   * Calcule et crédite les gains (y compris le remboursement de la mise en cas d'égalité !)
   */
  async function settleMyHandPayout() {
    const res = BlackjackEngine.resolveRound(playerCards, dealerCards, currentBet);

    // CORRECTION DU BUG D'ÉGALITÉ : res.payout vaut `stake` en cas de Push (égalité)
    if (res.payout > 0) {
      await commitBalanceDeltaToFirebase(res.payout);
    }

    if (res.netDelta > 0) {
      setStatusBanner(`${res.title} · +${res.payout.toLocaleString('fr-FR')} $ (Net +${res.netDelta.toLocaleString('fr-FR')} $)`, 'win');
      if (res.outcome === 'blackjack' && window.GameShell && typeof GameShell.fireConfetti === 'function') {
        GameShell.fireConfetti();
      }
    } else if (res.netDelta === 0) {
      setStatusBanner(`${res.title} · +${res.payout.toLocaleString('fr-FR')} $ rendus`, 'push');
    } else {
      setStatusBanner(`${res.title} (${res.netDelta.toLocaleString('fr-FR')} $)`, 'lose');
    }

    // Ré-afficher immédiatement les contrôles de mise pour enchaîner sans modale bloquante
    showBettingControls(true);
    freshBettingPhase = true;
    const realBal = getRealBalance();
    currentBet = Math.min(realBal, previousBet > 0 ? previousBet : 50);
    renderBetsAndBalanceUI();
  }

  /* =========================================================
     5. SALON MULTIJOUEUR TEMPS RÉEL (CROUPIER COMMUN)
     ========================================================= */
  function openRoomModal() {
    if (currentRoomCode) {
      const box = document.getElementById('multiRoomBox');
      if (box) box.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    createMultiplayerRoom();
  }

  async function createMultiplayerRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    await joinMultiplayerRoom(code, true);
  }

  async function joinMultiplayerRoomFromInput() {
    const input = document.getElementById('inputJoinRoomCode');
    const code = (input.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      showToast('Entre un code de salon à 4 caractères.', '⚠️');
      return;
    }
    await joinMultiplayerRoom(code, false);
  }

  async function joinMultiplayerRoom(code, isCreating = false) {
    const user = myUser || (window.GameShell && GameShell.currentUser) || await waitForResolvedUser();
    if (!user) return;
    if (roomRef) roomRef.off();

    code = code.trim().toUpperCase();
    currentRoomCode = code;
    if (window.GameShell) GameShell.currentRoomCode = code;
    window.location.hash = `room=${code}`;

    roomRef = db.ref(`rooms/casino-blackjack/${code}`);

    if (isCreating) {
      await roomRef.update({
        code,
        createdAt: Date.now(),
        hostTag: user.tag
      });
    }

    const mySeatRef = roomRef.child(`seats/${user.tag}`);
    await mySeatRef.set({
      tag: user.tag,
      nickname: user.nickname,
      avatarEmoji: user.avatarEmoji || '🍺',
      cards: [],
      score: 0,
      label: '0',
      status: 'BETTING',
      bet: currentBet,
      lastActive: Date.now()
    });
    mySeatRef.onDisconnect().remove();

    document.getElementById('btnModeSolo').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    const badge = document.getElementById('roomCodeDisplayBadge');
    if (badge) {
      badge.textContent = `#${code}`;
      badge.classList.remove('hidden');
    }
    const topBadge = document.getElementById('roomCodeBadge');
    if (topBadge) {
      topBadge.textContent = `#${code}`;
      topBadge.classList.remove('hidden');
    }
    document.getElementById('btnLeaveRoom').classList.remove('hidden');
    document.getElementById('multiSeatsPanel').classList.remove('hidden');

    // Écouter l'état complet du salon (sièges + manche commune)
    roomRef.on('value', (snap) => {
      const val = snap.val() || {};
      roomDataCache = val;
      onRoomSnapshotUpdate(val);
    });

    showToast(`Salon Blackjack #${code} rejoint !`, '👥');
  }

  function switchToSolo() {
    stopAfkTimer();
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (roomRef && user) {
      roomRef.child(`seats/${user.tag}`).remove();
      roomRef.off();
    }
    roomRef = null;
    roomDataCache = null;
    currentRoomCode = null;
    if (window.GameShell) GameShell.currentRoomCode = null;
    history.replaceState(null, '', window.location.pathname);

    gameState = 'BETTING';
    playerCards = [];
    dealerCards = [];
    showBettingControls(true);
    renderTable();
    renderBetsAndBalanceUI();

    document.getElementById('btnModeSolo').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('roomCodeDisplayBadge').classList.add('hidden');
    const topBadge = document.getElementById('roomCodeBadge');
    if (topBadge) topBadge.classList.add('hidden');
    document.getElementById('btnLeaveRoom').classList.add('hidden');
    document.getElementById('multiSeatsPanel').classList.add('hidden');
    showToast('Mode Solo activé.', '👤');
  }

  function syncMySeatBet() {
    if (!currentRoomCode || !roomRef || !myUser) return;
    if (gameState === 'BETTING' || gameState === 'ROUND_OVER') {
      roomRef.child(`seats/${myUser.tag}`).update({
        bet: currentBet,
        status: 'BETTING',
        lastActive: Date.now()
      });
    }
  }

  async function handleMultiplayerDealReady() {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (!roomRef || !user) return;

    // Si la manche précédente du salon était terminée ('OVER'), on réinitialise la manche commune
    const currentRound = roomDataCache && roomDataCache.round;
    if (currentRound && currentRound.phase === 'OVER') {
      await roomRef.child('round').remove();
    }

    // Tirer dès maintenant les 2 cartes initiales du joueur
    playerCards = [BlackjackEngine.drawCard(shoe), BlackjackEngine.drawCard(shoe)];
    const pEval = BlackjackEngine.evaluateHand(playerCards, false);

    gameState = 'WAITING_ROOM';
    renderBetsAndBalanceUI();
    setStatusBanner('Mise validée ! En attente des autres joueurs (ou clique sur 🚀 LANCER LA TABLE)...');

    await roomRef.child(`seats/${user.tag}`).update({
      bet: currentBet,
      cards: playerCards,
      score: pEval.total,
      label: pEval.label,
      status: 'READY',
      lastActive: Date.now()
    });

    // Vérifier si tous les joueurs présents à la table sont READY
    const seatsSnap = await roomRef.child('seats').once('value');
    const seats = Object.values(seatsSnap.val() || {});
    const allReady = seats.length > 0 && seats.every(s => s.status === 'READY' || s.status === 'PLAYING' || s.status === 'DONE');

    if (allReady) {
      await triggerMultiplayerRoundStart();
    }
  }

  async function triggerMultiplayerRoundStart() {
    if (!roomRef) return;
    const initialDealer = [BlackjackEngine.drawCard(shoe), BlackjackEngine.drawCard(shoe)];
    const newRoundId = 'R_' + Date.now();

    // Transaction pour ne créer la donne du croupier qu'une seule fois
    await roomRef.child('round').transaction((curr) => {
      if (curr && curr.phase === 'PLAYING') return; // Déjà en cours
      return {
        id: newRoundId,
        phase: 'PLAYING',
        dealerCards: initialDealer,
        startedAt: Date.now()
      };
    });
  }

  async function syncMySeatHand(newStatus) {
    if (!roomRef || !myUser) return;
    const pEval = BlackjackEngine.evaluateHand(playerCards, false);
    await roomRef.child(`seats/${myUser.tag}`).update({
      cards: playerCards,
      score: pEval.total,
      label: pEval.label,
      bet: currentBet,
      status: newStatus,
      lastActive: Date.now()
    });
  }

  async function finishMyMultiplayerTurn() {
    gameState = 'DEALER_TURN';
    updateActionButtonsState();
    setStatusBanner('Tu as terminé ton tour. En attente de la fin de table...');
    await syncMySeatHand('DONE');
    await checkAndResolveMultiplayerDealer();
  }

  async function checkAndResolveMultiplayerDealer() {
    if (!roomRef) return;
    const snap = await roomRef.once('value');
    const val = snap.val();
    if (!val || !val.round || val.round.phase !== 'PLAYING') return;

    const seats = Object.values(val.seats || {});
    const activePlayers = seats.filter(s => s.status === 'PLAYING' || s.status === 'READY' || s.status === 'DONE');
    const everyoneDone = activePlayers.length > 0 && activePlayers.every(s => s.status === 'DONE');

    if (!everyoneDone) return;

    // Le croupier tire ses cartes communes pour toute la table
    let sharedDealerCards = Array.isArray(val.round.dealerCards) ? [...val.round.dealerCards] : [BlackjackEngine.drawCard(shoe), BlackjackEngine.drawCard(shoe)];
    while (BlackjackEngine.shouldDealerHit(sharedDealerCards)) {
      sharedDealerCards.push(BlackjackEngine.drawCard(shoe));
    }

    await roomRef.child('round').update({
      dealerCards: sharedDealerCards,
      phase: 'OVER',
      endedAt: Date.now()
    });
  }

  async function onRoomSnapshotUpdate(val) {
    const seatsMap = val.seats || {};
    const round = val.round || null;
    renderMultiSeats(seatsMap, round);

    const phaseBadge = document.getElementById('multiRoomPhaseBadge');
    if (phaseBadge) {
      if (!round) phaseBadge.textContent = 'Mises ouvertes';
      else if (round.phase === 'PLAYING') phaseBadge.textContent = 'Tour des joueurs';
      else if (round.phase === 'OVER') phaseBadge.textContent = 'Résultat de la table';
    }

    if (!myUser || !seatsMap[myUser.tag]) return;
    const mySeat = seatsMap[myUser.tag];

    // 1. La manche commune vient de démarrer ('PLAYING')
    if (round && round.phase === 'PLAYING') {
      dealerCards = round.dealerCards || [];

      if (mySeat.status === 'READY') {
        gameState = 'PLAYING';
        showBettingControls(false);
        renderTable();
        playCardSound();

        const pEval = BlackjackEngine.evaluateHand(playerCards, false);
        const dEval = BlackjackEngine.evaluateHand(dealerCards, false);

        if (pEval.isBlackjack || dEval.isBlackjack) {
          await finishMyMultiplayerTurn();
        } else {
          await syncMySeatHand('PLAYING');
          updateActionButtonsState();
          startAfkTimer();
        }
      } else if (mySeat.status === 'PLAYING') {
        renderTable();
      } else if (mySeat.status === 'DONE') {
        renderTable();
        checkAndResolveMultiplayerDealer();
      }
    }

    // 2. La manche commune est terminée ('OVER') : le croupier a tiré ses cartes
    if (round && round.phase === 'OVER' && settledRoundId !== round.id) {
      if (mySeat.status === 'DONE' || mySeat.status === 'PLAYING' || mySeat.status === 'READY') {
        settledRoundId = round.id;
        stopAfkTimer();
        dealerCards = round.dealerCards || [];
        gameState = 'ROUND_OVER';
        renderTable();
        playCardSound();

        const dEval = BlackjackEngine.evaluateHand(dealerCards, false);
        if (dEval.isBust) triggerBustEffect();

        await settleMyHandPayout();

        const res = BlackjackEngine.resolveRound(playerCards, dealerCards, currentBet);
        await roomRef.child(`seats/${myUser.tag}`).update({
          status: 'BETTING',
          lastOutcome: res.netDelta > 0 ? `+${res.payout}$` : (res.netDelta === 0 ? 'Égalité' : 'Perdu')
        });
      }
    }
  }

  function renderMultiSeats(seatsMap, round) {
    const container = document.getElementById('multiSeatsContainer');
    const countBadge = document.getElementById('multiPlayersCount');
    if (!container) return;

    const user = myUser || (window.GameShell && GameShell.currentUser);
    const myTag = user ? user.tag : null;
    const allSeats = Object.values(seatsMap);

    if (countBadge) countBadge.textContent = allSeats.length;

    const statusLabelMap = {
      BETTING: '💰 Mise...',
      READY: '✅ Prêt',
      PLAYING: '🤔 Joue...',
      DONE: '✋ Reste'
    };

    container.innerHTML = allSeats.map(s => {
      const isMe = s.tag === myTag;
      const cardsArr = Array.isArray(s.cards) ? s.cards : [];
      const miniCardsHtml = cardsArr.length > 0
        ? cardsArr.map(c => `<span class="bj-seat-mini-card ${c.color === 'red' ? 'red' : 'black'}">${c.rank}${c.suit}</span>`).join(' ')
        : `<span class="text-[10px] text-emerald-200/60 italic">Aucune carte</span>`;

      const statusText = (round && round.phase === 'OVER' && s.lastOutcome)
        ? s.lastOutcome
        : (statusLabelMap[s.status] || s.status);

      return `
        <div class="bj-seat-card ${isMe ? 'me' : ''}">
          <div class="flex items-center justify-between text-xs font-black">
            <span class="truncate">${s.avatarEmoji || '🍺'} ${GameShell.escapeHtml(s.nickname)}${isMe ? ' (toi)' : ''}</span>
            <span class="font-mono text-[11px] text-emerald-300 flex-shrink-0">${(s.bet || 0).toLocaleString('fr-FR')} $</span>
          </div>
          <div class="flex items-center gap-1 flex-wrap my-0.5">
            ${miniCardsHtml}
          </div>
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="opacity-90">Total : <strong>${s.label || s.score || 0}</strong></span>
            <span class="bg-[#12131a] text-[#fed72d] px-2 py-0.5 rounded-full font-bold text-[9px]">${statusText}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* =========================================================
     6. TIMER AFK 60 SECONDES & RENDU DES CARTES
     ========================================================= */
  function startAfkTimer() {
    stopAfkTimer();
    afkSecondsLeft = AFK_TIMEOUT_SECONDS;
    const box = document.getElementById('afkTimerBox');
    const fill = document.getElementById('afkBarFill');
    const timeLabel = document.getElementById('afkTimeLeft');
    if (box) box.classList.remove('hidden');

    afkInterval = setInterval(() => {
      afkSecondsLeft--;
      if (timeLabel) timeLabel.textContent = `${afkSecondsLeft}s`;
      if (fill) {
        const pct = (afkSecondsLeft / AFK_TIMEOUT_SECONDS) * 100;
        fill.style.width = `${pct}%`;
        if (afkSecondsLeft <= 15) fill.classList.add('urgent');
        else fill.classList.remove('urgent');
      }

      if (afkSecondsLeft <= 0) {
        stopAfkTimer();
        showToast('Temps écoulé : tu restes automatiquement (Stand).', '⏱️');
        playerStand();
      }
    }, 1000);
  }

  function resetAfkTimer() {
    afkSecondsLeft = AFK_TIMEOUT_SECONDS;
    const fill = document.getElementById('afkBarFill');
    if (fill) {
      fill.style.width = '100%';
      fill.classList.remove('urgent');
    }
  }

  function stopAfkTimer() {
    clearInterval(afkInterval);
    const box = document.getElementById('afkTimerBox');
    if (box) box.classList.add('hidden');
  }

  function renderTable() {
    const dealerContainer = document.getElementById('dealerCardsContainer');
    const playerContainer = document.getElementById('playerHandCardsContainer');
    const dealerScore = document.getElementById('dealerScoreBadge');
    const playerScore = document.getElementById('playerScoreBadge');

    const hideDealerSecond = (gameState === 'PLAYING' || gameState === 'WAITING_ROOM') ||
                             (currentRoomCode && roomDataCache && roomDataCache.round && roomDataCache.round.phase === 'PLAYING');

    const dEval = BlackjackEngine.evaluateHand(dealerCards, hideDealerSecond);
    const pEval = BlackjackEngine.evaluateHand(playerCards, false);

    dealerContainer.innerHTML = dealerCards.length > 0
      ? dealerCards.map((c, idx) => {
          if (hideDealerSecond && idx === 1) {
            return `<div class="bj-card face-down"></div>`;
          }
          return renderCardHtml(c);
        }).join('')
      : `<span class="text-xs font-bold text-emerald-200/70 italic">En attente de mise...</span>`;

    dealerScore.textContent = dEval.label;
    dealerScore.className = 'bj-score-badge';
    if (dEval.isBlackjack) dealerScore.classList.add('blackjack');
    else if (dEval.isBust) dealerScore.classList.add('bust');

    playerContainer.innerHTML = playerCards.length > 0
      ? playerCards.map(c => renderCardHtml(c)).join('')
      : `<span class="text-xs font-bold text-emerald-200/70 italic">—</span>`;

    playerScore.textContent = pEval.label;
    playerScore.className = 'bj-score-badge';
    if (pEval.isBlackjack) playerScore.classList.add('blackjack');
    else if (pEval.isBust) playerScore.classList.add('bust');

    if (gameState === 'BETTING') setStatusBanner('Clique sur les jetons pour miser !');
    else if (gameState === 'PLAYING') setStatusBanner('À toi de jouer : Tire, Reste ou Double !');
    else if (gameState === 'DEALER_TURN') setStatusBanner('Tour du Croupier...');
  }

  function renderCardHtml(card) {
    if (!card) return '';
    const colorClass = card.color === 'red' ? 'red' : 'black';
    return `
      <div class="bj-card ${colorClass}">
        <div class="bj-card-corner">
          <span class="bj-card-rank">${card.rank}</span>
          <span class="bj-card-suit-sm">${card.suit}</span>
        </div>
        <div class="bj-card-center">${card.suit}</div>
        <div class="bj-card-corner bottom">
          <span class="bj-card-rank">${card.rank}</span>
          <span class="bj-card-suit-sm">${card.suit}</span>
        </div>
      </div>
    `;
  }

  function triggerBustEffect() {
    const arena = document.getElementById('bjArena');
    if (!arena) return;
    arena.classList.add('bust-shake');
    setTimeout(() => arena.classList.remove('bust-shake'), 500);
  }

  function playCardSound() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  /* =========================================================
     7. CHAT DE LA TABLE (SANS ANNONCES BIG WINS)
     ========================================================= */
  function listenCasinoChat() {
    const container = document.getElementById('casinoTableChatList');
    if (!container) return;

    db.ref('casino/chat').limitToLast(25).on('value', (snap) => {
      const data = snap.val();
      if (!data) {
        container.innerHTML = `<p class="text-[11px] font-bold text-slate-400 text-center py-4">Aucun message à la table.</p>`;
        return;
      }
      const messages = Object.values(data).reverse();
      container.innerHTML = messages.map(m => `
        <div class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
          <div class="flex items-center justify-between">
            <span class="font-black text-[#12131a]">${m.avatar || '🍺'} ${GameShell.escapeHtml(m.nickname)}</span>
            <span class="text-[9px] font-mono text-slate-400">${m.time || ''}</span>
          </div>
          <p class="font-bold text-slate-700 break-words leading-snug">${GameShell.escapeHtml(m.text)}</p>
        </div>
      `).join('');
    });
  }

  function sendCasinoChatMessage(event) {
    event.preventDefault();
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (!user) return;
    const input = document.getElementById('casinoTableChatInput');
    const text = (input.value || '').trim();
    if (!text) return;

    db.ref('casino/chat').push({
      nickname: user.nickname,
      tag: user.tag,
      avatar: user.avatarEmoji || '🍺',
      text,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });
    input.value = '';
  }

  function showToast(msg, icon = '🃏') {
    const toast = document.getElementById('rouletteToast');
    if (!toast) return;
    document.getElementById('rouletteToastIcon').textContent = icon;
    document.getElementById('rouletteToastMsg').textContent = msg;

    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3200);
  }

  async function useAtmInGame() {
    if (window.CasinoAPI && typeof CasinoAPI.useATM === 'function') {
      const res = await CasinoAPI.useATM();
      if (!res.ok) {
        showToast(res.error || 'ATM verrouillé.', '🔒');
        return;
      }
      GameShell.fireConfetti();
      showToast(`+1 000 $ reçus !`, '💵');
    }
  }

  window.BlackjackApp = {
    selectChip,
    clearBet,
    rebetLast,
    doubleBetAmount,
    dealCards,
    playerHit,
    playerStand,
    playerDoubleDown,
    openRoomModal,
    createMultiplayerRoom,
    joinMultiplayerRoomFromInput,
    switchToSolo,
    useAtmInGame,
    toggleSound: () => { soundEnabled = !soundEnabled; showToast(soundEnabled ? 'Son ON' : 'Muet', '🔊'); },
    sendCasinoChatMessage
  };
})();

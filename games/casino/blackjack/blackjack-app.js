/* =========================================================
   IMB CASINO - BLACKJACK APP (Étape 4)
   Jeu Solo & Salon Multi simultané, Timer AFK 60s, Casino API
   ========================================================= */
(function () {
  'use strict';

  const BIG_WIN_THRESHOLD = 500;
  const AFK_TIMEOUT_SECONDS = 60;

  let myUser = null;
  let myProfile = { balance: 1000, tokens: 0, debt: 0 };
  let isBootstrapped = false;

  let activeChip = 50;
  let currentBet = 50;
  let previousBet = 50;

  let shoe = [];
  let playerCards = [];
  let dealerCards = [];
  let gameState = 'BETTING'; // BETTING, PLAYING, DEALER_TURN, ROUND_OVER

  let soundEnabled = true;
  let audioCtx = null;

  // État Salon Multijoueur & Timer AFK
  let currentRoomCode = null;
  let roomRef = null;
  let afkInterval = null;
  let afkSecondsLeft = AFK_TIMEOUT_SECONDS;
  let hasActedThisTurn = false;

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
        <p>• 💰 <strong>Paiements :</strong> Victoire 1:1, Blackjack naturel (As + 10/Bûche) payé 3:2.</p>
        <p>• 🎩 <strong>Croupier :</strong> Tire jusqu'à 16 et s'arrête obligatoirement à partir de 17.</p>
        <p>• ⏱️ <strong>Multijoueur :</strong> En salon, tu as 60 secondes pour jouer ton tour. Sans action, ton jeu est automatiquement bloqué sur "Rester" puis tu es exclu.</p>
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

  /* ---------------- GESTION DES JETONS & MISES ---------------- */
  function selectChip(val) {
    if (gameState !== 'BETTING') return;
    activeChip = val;
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    const t = document.getElementById(`chip_${val}`);
    if (t) t.classList.add('active');
  }

  function clearBet() {
    if (gameState !== 'BETTING') return;
    currentBet = 0;
    renderBetsAndBalanceUI();
  }

  function rebetLast() {
    if (gameState !== 'BETTING') return;
    const realBal = getRealBalance();
    if (previousBet <= 0) return;
    if (previousBet > realBal) {
      showToast('Solde insuffisant pour rejouer cette mise.', '⚠️');
      return;
    }
    currentBet = previousBet;
    renderBetsAndBalanceUI();
  }

  function doubleBetAmount() {
    if (gameState !== 'BETTING') return;
    const realBal = getRealBalance();
    if (currentBet * 2 > realBal) {
      showToast('Solde insuffisant pour doubler la mise.', '⚠️');
      return;
    }
    currentBet *= 2;
    renderBetsAndBalanceUI();
  }

  function renderBetsAndBalanceUI() {
    const realBal = getRealBalance();
    const tok = Number(myProfile?.tokens ?? myProfile?.tokensUsed ?? 0);

    document.getElementById('hudBalanceValue').textContent = realBal.toLocaleString('fr-FR');
    document.getElementById('hudTokensValue').textContent = tok;

    const currentBetDisp = document.getElementById('currentBetDisplay');
    if (currentBetDisp) currentBetDisp.textContent = `${currentBet.toLocaleString('fr-FR')} $`;

    const btnDeal = document.getElementById('btnDeal');
    if (btnDeal && gameState === 'BETTING') {
      const canDeal = currentBet > 0 && currentBet <= realBal;
      btnDeal.disabled = !canDeal;
      if (canDeal) {
        btnDeal.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        btnDeal.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  /* ---------------- DISTRIBUTION DES CARTES (DEAL) ---------------- */
  async function dealCards() {
    if (gameState !== 'BETTING') return;
    const realBal = getRealBalance();
    if (currentBet <= 0 || currentBet > realBal) return;

    previousBet = currentBet;
    const debitRes = await commitBalanceDeltaToFirebase(-currentBet);
    if (debitRes === realBal && currentBet > 0) return; // Échec débit

    gameState = 'PLAYING';
    playerCards = [];
    dealerCards = [];
    hasActedThisTurn = false;

    // Bascule interface (cacher les jetons, afficher les actions)
    document.getElementById('chipSelectorBox').classList.add('hidden');
    document.getElementById('bettingControlsBox').classList.add('hidden');
    document.getElementById('actionControlsBox').classList.remove('hidden');
    document.getElementById('actionControlsBox').classList.add('grid');

    // Tirer 2 cartes joueur et 2 cartes croupier (dont 1 cachée)
    playerCards.push(BlackjackEngine.drawCard(shoe));
    dealerCards.push(BlackjackEngine.drawCard(shoe));
    playerCards.push(BlackjackEngine.drawCard(shoe));
    dealerCards.push(BlackjackEngine.drawCard(shoe));

    renderTable();
    playCardSound();

    // Vérifier si Blackjack naturel dès la donne
    const pEval = BlackjackEngine.evaluateHand(playerCards);
    const dEval = BlackjackEngine.evaluateHand(dealerCards);

    if (pEval.isBlackjack || dEval.isBlackjack) {
      finishRound();
      return;
    }

    // Vérifier si le joueur peut doubler
    const canDbl = BlackjackEngine.canDoubleDown(playerCards, currentBet, getRealBalance());
    const btnDbl = document.getElementById('btnDoubleDown');
    if (btnDbl) btnDbl.disabled = !canDbl;

    // Lancer le timer AFK 60s
    startAfkTimer();
    syncRoomState();
  }

  /* ---------------- ACTIONS DU JOUEUR (Hit, Stand, Double) ---------------- */
  function playerHit() {
    if (gameState !== 'PLAYING') return;
    hasActedThisTurn = true;
    resetAfkTimer();

    playerCards.push(BlackjackEngine.drawCard(shoe));
    playCardSound();
    renderTable();

    const evalP = BlackjackEngine.evaluateHand(playerCards);
    const btnDbl = document.getElementById('btnDoubleDown');
    if (btnDbl) btnDbl.disabled = true; // Impossible de doubler après un Hit

    if (evalP.isBust || evalP.total === 21) {
      stopAfkTimer();
      if (evalP.isBust) {
        triggerBustEffect();
      }
      setTimeout(() => startDealerTurn(), 600);
    } else {
      syncRoomState();
    }
  }

  async function playerStand() {
    if (gameState !== 'PLAYING') return;
    hasActedThisTurn = true;
    stopAfkTimer();
    startDealerTurn();
  }

  async function playerDoubleDown() {
    if (gameState !== 'PLAYING') return;
    const realBal = getRealBalance();
    if (currentBet > realBal) {
      showToast('Solde insuffisant pour doubler.', '⚠️');
      return;
    }

    hasActedThisTurn = true;
    stopAfkTimer();

    // Débiter la mise supplémentaire
    await commitBalanceDeltaToFirebase(-currentBet);
    currentBet *= 2;

    playerCards.push(BlackjackEngine.drawCard(shoe));
    playCardSound();
    renderTable();

    const evalP = BlackjackEngine.evaluateHand(playerCards);
    if (evalP.isBust) {
      triggerBustEffect();
    }

    setTimeout(() => startDealerTurn(), 700);
  }

  /* ---------------- TOUR DU CROUPIER & RÉSOLUTION ---------------- */
  function startDealerTurn() {
    gameState = 'DEALER_TURN';
    document.getElementById('actionControlsBox').classList.add('hidden');
    document.getElementById('actionControlsBox').classList.remove('grid');
    renderTable();

    const pEval = BlackjackEngine.evaluateHand(playerCards);
    if (pEval.isBust) {
      finishRound();
      return;
    }

    // Le croupier tire jusqu'à 16 et s'arrête à 17+
    const dealerInterval = setInterval(() => {
      if (BlackjackEngine.shouldDealerHit(dealerCards)) {
        dealerCards.push(BlackjackEngine.drawCard(shoe));
        playCardSound();
        renderTable();
      } else {
        clearInterval(dealerInterval);
        const dEval = BlackjackEngine.evaluateHand(dealerCards);
        if (dEval.isBust) {
          triggerBustEffect();
        }
        setTimeout(() => finishRound(), 500);
      }
    }, 750);
  }

  async function finishRound() {
    gameState = 'ROUND_OVER';
    renderTable();

    const res = BlackjackEngine.resolveRound(playerCards, dealerCards, currentBet);
    if (res.netDelta !== 0) {
      await commitBalanceDeltaToFirebase(res.payout);
    }

    showResultModal(res);

    if (res.netDelta >= BIG_WIN_THRESHOLD) {
      GameShell.fireConfetti();
      broadcastBigWin(res);
    }

    syncRoomState();
  }

  /* ---------------- TIMER AFK 60 SECONDES ---------------- */
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
        showToast('Inactivité détectée : action automatique (Stand).', '⏱️');
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

  /* ---------------- RENDU VISUEL DE LA TABLE (HTML CARTES) ---------------- */
  function renderTable() {
    const dealerContainer = document.getElementById('dealerCardsContainer');
    const playerContainer = document.getElementById('playerHandCardsContainer');
    const dealerScore = document.getElementById('dealerScoreBadge');
    const playerScore = document.getElementById('playerScoreBadge');
    const statusBanner = document.getElementById('bjStatusBanner');

    const hideDealerSecond = gameState === 'PLAYING';
    const dEval = BlackjackEngine.evaluateHand(dealerCards, hideDealerSecond);
    const pEval = BlackjackEngine.evaluateHand(playerCards, false);

    // Rendu des cartes du croupier
    dealerContainer.innerHTML = dealerCards.map((c, idx) => {
      if (hideDealerSecond && idx === 1) {
        return `<div class="bj-card face-down"></div>`;
      }
      return renderCardHtml(c);
    }).join('');

    dealerScore.textContent = dEval.label;
    dealerScore.className = 'bj-score-badge';
    if (dEval.isBlackjack) dealerScore.classList.add('blackjack');
    else if (dEval.isBust) dealerScore.classList.add('bust');

    // Rendu des cartes du joueur
    playerContainer.innerHTML = playerCards.length > 0
      ? playerCards.map(c => renderCardHtml(c)).join('')
      : `<span class="text-xs font-bold text-emerald-200/70 italic">—</span>`;

    playerScore.textContent = pEval.label;
    playerScore.className = 'bj-score-badge';
    if (pEval.isBlackjack) playerScore.classList.add('blackjack');
    else if (pEval.isBust) playerScore.classList.add('bust');

    // Messages de statut
    if (gameState === 'BETTING') statusBanner.textContent = 'Place tes jetons pour commencer !';
    else if (gameState === 'PLAYING') statusBanner.textContent = 'À toi de jouer : Tire ou Reste.';
    else if (gameState === 'DEALER_TURN') statusBanner.textContent = 'Tour du Croupier...';
    else if (gameState === 'ROUND_OVER') statusBanner.textContent = 'Manche terminée !';
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

  /* ---------------- MODE SALON MULTIJOUEUR (FIREBASE) ---------------- */
  function openRoomModal() {
    // Enregistrement direct ou création si modal simple
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
      await roomRef.set({ code, createdAt: Date.now(), hostTag: user.tag });
    }

    const mySeatRef = roomRef.child(`seats/${user.tag}`);
    await mySeatRef.set({
      tag: user.tag,
      nickname: user.nickname,
      avatarEmoji: user.avatarEmoji || '🍺',
      cards: playerCards.map(c => c.id),
      score: BlackjackEngine.evaluateHand(playerCards).total,
      status: gameState,
      bet: currentBet,
      lastActive: Date.now()
    });
    mySeatRef.onDisconnect().remove();

    document.getElementById('btnModeSolo').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    const badge = document.getElementById('roomCodeDisplayBadge');
    badge.textContent = `#${code}`;
    badge.classList.remove('hidden');
    document.getElementById('btnLeaveRoom').classList.remove('hidden');
    document.getElementById('multiSeatsPanel').classList.remove('hidden');

    roomRef.child('seats').on('value', (snap) => {
      const seatsMap = snap.val() || {};
      renderMultiSeats(seatsMap);
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
    currentRoomCode = null;
    if (window.GameShell) GameShell.currentRoomCode = null;
    history.replaceState(null, '', window.location.pathname);

    document.getElementById('btnModeSolo').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('roomCodeDisplayBadge').classList.add('hidden');
    document.getElementById('btnLeaveRoom').classList.add('hidden');
    document.getElementById('multiSeatsPanel').classList.add('hidden');
    showToast('Mode Solo activé.', '👤');
  }

  function syncRoomState() {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (roomRef && user) {
      roomRef.child(`seats/${user.tag}`).update({
        score: BlackjackEngine.evaluateHand(playerCards).total,
        status: gameState,
        bet: currentBet,
        lastActive: Date.now()
      });
    }
  }

  function renderMultiSeats(seatsMap) {
    const container = document.getElementById('multiSeatsContainer');
    const countBadge = document.getElementById('multiPlayersCount');
    const user = myUser || (window.GameShell && GameShell.currentUser);
    const myTag = user ? user.tag : null;

    const otherSeats = Object.values(seatsMap).filter(s => s.tag !== myTag);
    if (countBadge) countBadge.textContent = Object.keys(seatsMap).length;

    if (otherSeats.length === 0) {
      container.innerHTML = `<span class="text-xs font-bold text-emerald-200/70 italic">Aucun autre joueur à la table pour l'instant.</span>`;
      return;
    }

    container.innerHTML = otherSeats.map(s => `
      <div class="bj-seat-card">
        <div class="flex items-center justify-between text-xs font-black">
          <span>${s.avatarEmoji || '🍺'} ${GameShell.escapeHtml(s.nickname)}</span>
          <span class="font-mono text-[11px] text-emerald-300">Mise: ${(s.bet || 0).toLocaleString('fr-FR')}$</span>
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono">
          <span class="opacity-80">Score : <strong>${s.score || 0}</strong></span>
          <span class="bg-[#12131a] text-yellow-300 px-2 py-0.5 rounded-full font-bold uppercase text-[9px]">${s.status}</span>
        </div>
      </div>
    `).join('');
  }

  /* ---------------- CHAT DU CASINO & BIG WINS ---------------- */
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

  function broadcastBigWin(res) {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (!user) return;
    const msgText = `🔥 ${user.nickname} (@${user.tag}) a décroché un gain de ${res.payout.toLocaleString('fr-FR')} $ au Blackjack 21 !`;

    db.ref('casino/chat').push({
      nickname: user.nickname,
      tag: user.tag,
      avatar: user.avatarEmoji || '🍺',
      text: msgText,
      timestamp: Date.now()
    });

    db.ref('chat').push({
      authorNick: user.nickname,
      authorTag: user.tag,
      authorAvatar: user.avatarEmoji || '🍺',
      authorFlag: user.flagEmoji || '🇫🇷',
      isInvite: true,
      gameTitle: '🃏 Blackjack - MEGA WIN !',
      internalGame: 'casino/blackjack',
      internalRoom: currentRoomCode || 'CASINO',
      text: `@promo ${msgText}`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });
  }

  /* ---------------- MODALE RÉSULTAT ---------------- */
  function showResultModal(res) {
    const modal = document.getElementById('bjResultModal');
    const icon = document.getElementById('resultModalIcon');
    const title = document.getElementById('resultModalTitle');
    const desc = document.getElementById('resultModalDesc');
    const payoutEl = document.getElementById('resultModalPayout');

    title.textContent = res.title;
    desc.textContent = `Score joueur : ${res.playerEval.total} · Score croupier : ${res.dealerEval.total}`;

    if (res.netDelta > 0) {
      icon.textContent = '🎉';
      payoutEl.textContent = `+ ${res.payout.toLocaleString('fr-FR')} $ (Net : +${res.netDelta.toLocaleString('fr-FR')} $)`;
      payoutEl.className = 'text-base font-mono font-black text-emerald-800 bg-emerald-100 border-2 border-[#12131a] py-2.5 px-3 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    } else if (res.netDelta === 0) {
      icon.textContent = '🤝';
      payoutEl.textContent = `Mise remboursée (0 $)`;
      payoutEl.className = 'text-base font-mono font-black text-slate-800 bg-slate-100 border-2 border-[#12131a] py-2.5 px-3 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    } else {
      icon.textContent = '💀';
      payoutEl.textContent = `${res.netDelta.toLocaleString('fr-FR')} $`;
      payoutEl.className = 'text-base font-mono font-black text-rose-700 bg-rose-100 border-2 border-[#12131a] py-2.5 px-3 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    }

    modal.classList.remove('hidden');
  }

  function closeResultModal(shouldRebet = false) {
    document.getElementById('bjResultModal').classList.add('hidden');
    gameState = 'BETTING';
    playerCards = [];
    dealerCards = [];
    renderTable();

    document.getElementById('actionControlsBox').classList.add('hidden');
    document.getElementById('actionControlsBox').classList.remove('grid');
    document.getElementById('chipSelectorBox').classList.remove('hidden');
    document.getElementById('bettingControlsBox').classList.remove('hidden');

    if (shouldRebet) {
      rebetLast();
    }
  }

  function showToast(msg, icon = '🃏') {
    const toast = document.getElementById('rouletteToast');
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
    sendCasinoChatMessage,
    closeResultModal
  };
})();

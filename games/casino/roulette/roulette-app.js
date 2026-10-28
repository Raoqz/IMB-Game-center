/* =========================================================
   IMB CASINO - ROULETTE APP (Sauvegarde Firebase Directe)
   Cycle : Mise -> Rotation -> Résultat -> Écriture immédiate DB (+X / -X)
   ========================================================= */
(function () {
  'use strict';

  // Ordre officiel des 37 numéros sur un cylindre de Roulette Européenne
  const WHEEL_SEQUENCE = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const BIG_WIN_THRESHOLD = 500;

  let myUser = null;
  let myProfile = { balance: 1000, tokens: 0, tokensUsed: 0 };
  let isSessionBootstrapped = false;

  let activeChip = 50; // 10, 50, 100, 500 ou 'MAX'
  let currentBets = {};
  let previousBets = {};
  let isSpinning = false;
  let currentWheelAngle = 0;
  let spinHistory = [];
  let soundEnabled = true;
  let audioCtx = null;

  // État Salon Multijoueur & Auto-Timer
  let currentRoomCode = null;
  let roomRef = null;
  let lastProcessedSpinId = null;
  let autoTimerEnabled = false;
  let autoTimerInterval = null;
  let autoTimerSeconds = 20;

  /* ---------------- 1. INITIALISATION DU JEU ET DU PROFIL CASINO ---------------- */
  window.addEventListener('DOMContentLoaded', () => {
    buildWheelSvg();
    buildInsideBetGrid();
    renderBetsAndBalanceUI();
    listenCasinoChat();

    GameShell.init({
      gameId: 'casino/roulette',
      gameTitle: '🎡 IMB Roulette',
      theme: 'casino',
      rulesHtml: `
        <p>• 🎡 <strong>Roulette Européenne :</strong> 37 cases numérotées de <strong>0</strong> (vert) à <strong>36</strong> (18 rouges, 18 noires).</p>
        <p>• 💰 <strong>Barème des gains :</strong></p>
        <p class="pl-3">– <strong>Numéro plein (0 à 36) :</strong> ×36 ta mise</p>
        <p class="pl-3">– <strong>Douzaines (1-12, 13-24, 25-36) & Colonnes (2:1) :</strong> ×3 ta mise</p>
        <p class="pl-3">– <strong>Chances simples (Rouge/Noir, Pair/Impair, 1-18/19-36) :</strong> ×2 ta mise</p>
        <p>• 💵 <strong>Mise & Solde :</strong> Ton solde est mis à jour en direct dans la base de données dès que la roue s'arrête sur le numéro gagnant.</p>
        <p>• 🏧 <strong>ATM :</strong> Si ton solde est ≤ 200 $, utilise le bouton ATM directement en haut de la table pour recevoir +1 000 $ (+1 Token, max 20).</p>
      `,
      onGameInit: (user) => {
        bootstrapPlayerSession(user);
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
          } catch (e) {
            console.error(e);
          }
        }
      }, 100);
    });
  }

  async function bootstrapPlayerSession(userParam) {
    const user = userParam || (window.GameShell && GameShell.currentUser);
    if (!user || !user.tag || isSessionBootstrapped) return;
    isSessionBootstrapped = true;
    myUser = user;

    const avatarEl = document.getElementById('hudAvatar');
    const nickEl = document.getElementById('hudNickname');
    if (avatarEl) avatarEl.textContent = user.avatarEmoji || '🍺';
    if (nickEl) nickEl.textContent = user.nickname || user.tag;

    try {
      const userCasinoRef = db.ref(`casino/users/${user.tag}`);
      const snap = await userCasinoRef.once('value');

      if (!snap.exists()) {
        const initialData = {
          tag: user.tag,
          nickname: user.nickname || user.tag,
          avatarEmoji: user.avatarEmoji || '🍺',
          flagEmoji: user.flagEmoji || '🇫🇷',
          balance: 1000,
          tokens: 0,
          tokensUsed: 0,
          timestamp: Date.now(),
          createdAt: Date.now()
        };
        await userCasinoRef.set(initialData);
        myProfile = initialData;
      } else {
        const existing = snap.val();
        const validBalance = (typeof existing.balance === 'number' && !isNaN(existing.balance))
          ? Math.max(0, existing.balance)
          : 1000;
        const validTokens = Number(existing.tokens ?? existing.tokensUsed ?? 0);

        myProfile = {
          ...existing,
          tag: user.tag,
          nickname: user.nickname || existing.nickname || user.tag,
          avatarEmoji: user.avatarEmoji || existing.avatarEmoji || '🍺',
          flagEmoji: user.flagEmoji || existing.flagEmoji || '🇫🇷',
          balance: validBalance,
          tokens: validTokens,
          tokensUsed: validTokens
        };

        await userCasinoRef.update({
          tag: myProfile.tag,
          nickname: myProfile.nickname,
          avatarEmoji: myProfile.avatarEmoji,
          flagEmoji: myProfile.flagEmoji,
          balance: validBalance,
          tokens: validTokens,
          tokensUsed: validTokens
        });
      }

      // Écoute en temps réel sans couper les autres écouteurs (pas de .off() global)
      userCasinoRef.on('value', (s) => {
        const val = s.val();
        if (!val) return;
        myProfile = val;
        renderBetsAndBalanceUI();
      });
    } catch (err) {
      console.error('Erreur accès Firebase casino/users (vérifie les règles Firebase) :', err);
      showToast('Erreur permissions Firebase : ajoute "casino" dans tes règles Firebase !', '⚠️');
    }

    renderBetsAndBalanceUI();

    const match = window.location.hash.match(/room=([A-Z0-9]{4})/i);
    if (match) {
      joinMultiplayerRoom(match[1].toUpperCase());
    }
  }

  /* ---------------- 2. SAUVEGARDE IMMÉDIATE DU SOLDE SUR FIREBASE (+50 / -50) ---------------- */
  async function commitBalanceDeltaToFirebase(deltaAmount) {
    const delta = Math.round(Number(deltaAmount));
    if (isNaN(delta) || delta === 0) {
      renderBetsAndBalanceUI();
      return getRealBalance();
    }

    // S'assurer d'avoir l'utilisateur avant d'écrire
    if (!myUser) {
      myUser = (window.GameShell && GameShell.currentUser) || await waitForResolvedUser();
    }

    const currentBal = getRealBalance();
    const nextBal = Math.max(0, currentBal + delta);

    // 1. Mise à jour locale instantanée
    myProfile.balance = nextBal;
    renderBetsAndBalanceUI();

    if (!myUser || !myUser.tag) return nextBal;

    // 2. Écriture directe et immédiate dans Firebase Realtime Database
    try {
      const userCasinoRef = db.ref(`casino/users/${myUser.tag}`);
      const snap = await userCasinoRef.once('value');
      const serverData = snap.val();

      const baseBal = (serverData && typeof serverData.balance === 'number' && !isNaN(serverData.balance))
        ? Math.max(0, serverData.balance)
        : currentBal;
      const finalBalance = Math.max(0, baseBal + delta);
      const tokensCount = Number(serverData?.tokens ?? serverData?.tokensUsed ?? myProfile.tokens ?? 0);

      await userCasinoRef.update({
        tag: myUser.tag,
        nickname: myUser.nickname || myUser.tag,
        avatarEmoji: myUser.avatarEmoji || '🍺',
        flagEmoji: myUser.flagEmoji || '🇫🇷',
        balance: finalBalance,
        tokens: tokensCount,
        tokensUsed: tokensCount,
        timestamp: Date.now()
      });

      myProfile.balance = finalBalance;
      renderBetsAndBalanceUI();
      return finalBalance;
    } catch (err) {
      console.error('Échec écriture Firebase :', err);
      showToast('Sauvegarde refusée par Firebase (vérifie tes règles "casino") !', '⚠️');
      return nextBal;
    }
  }

  /* ---------------- 3. CONSTRUCTION DE LA ROUE SVG ROTATIVE ---------------- */
  function buildWheelSvg() {
    const svg = document.getElementById('rouletteWheelSvg');
    if (!svg) return;

    const total = WHEEL_SEQUENCE.length; // 37 cases
    const sliceDeg = 360 / total;
    const outerRadius = 154;
    const textRadius = 123;
    const innerRadius = 56;

    let pathsHtml = '';

    WHEEL_SEQUENCE.forEach((num, idx) => {
      const startDeg = idx * sliceDeg - 90 - sliceDeg / 2;
      const endDeg = startDeg + sliceDeg;
      const midDeg = startDeg + sliceDeg / 2;

      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;

      const x1 = outerRadius * Math.cos(startRad);
      const y1 = outerRadius * Math.sin(startRad);
      const x2 = outerRadius * Math.cos(endRad);
      const y2 = outerRadius * Math.sin(endRad);

      const x3 = innerRadius * Math.cos(endRad);
      const y3 = innerRadius * Math.sin(endRad);
      const x4 = innerRadius * Math.cos(startRad);
      const y4 = innerRadius * Math.sin(startRad);

      const colorName = RouletteEngine.getNumberColor(num);
      const fillHex = colorName === 'green'
        ? '#10b981'
        : (colorName === 'red' ? '#ef4444' : '#1e293b');

      const d = [
        `M ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        'Z'
      ].join(' ');

      const midRad = (midDeg * Math.PI) / 180;
      const tx = textRadius * Math.cos(midRad);
      const ty = textRadius * Math.sin(midRad);
      const textRot = midDeg + 90;

      pathsHtml += `
        <g>
          <path d="${d}" fill="${fillHex}" stroke="#12131a" stroke-width="2" />
          <text
            x="${tx.toFixed(2)}"
            y="${ty.toFixed(2)}"
            fill="#ffffff"
            font-family="JetBrains Mono, monospace"
            font-weight="900"
            font-size="11.5"
            text-anchor="middle"
            dominant-baseline="central"
            transform="rotate(${textRot.toFixed(2)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})"
          >${num}</text>
        </g>
      `;
    });

    pathsHtml += `<circle cx="0" cy="0" r="96" fill="none" stroke="#fed72d" stroke-width="2" stroke-dasharray="4 3" opacity="0.85" />`;
    svg.innerHTML = pathsHtml;
  }

  /* ---------------- 4. CONSTRUCTION DU TAPIS DE MISE ---------------- */
  function buildInsideBetGrid() {
    const grid = document.getElementById('insideBetGrid');
    if (!grid) return;

    let html = `
      <div
        onclick="RouletteApp.placeBet('straight_0')"
        oncontextmenu="RouletteApp.removeBet(event, 'straight_0')"
        id="spot_straight_0"
        class="bet-spot green-spot"
        style="grid-column: 1; grid-row: 1 / span 3;"
        title="Plein 0 (×36)"
      >
        <span>0</span>
        <span id="badge_straight_0"></span>
      </div>
    `;

    const rows = [
      { nums: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], colKey: 'col_3', label: '2:1' },
      { nums: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], colKey: 'col_2', label: '2:1' },
      { nums: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], colKey: 'col_1', label: '2:1' }
    ];

    rows.forEach((rowObj, rowIdx) => {
      const gridRow = rowIdx + 1;
      rowObj.nums.forEach((num, colIdx) => {
        const gridCol = colIdx + 2;
        const color = RouletteEngine.getNumberColor(num);
        const spotClass = color === 'red' ? 'red-spot' : 'black-spot';
        html += `
          <div
            onclick="RouletteApp.placeBet('straight_${num}')"
            oncontextmenu="RouletteApp.removeBet(event, 'straight_${num}')"
            id="spot_straight_${num}"
            class="bet-spot ${spotClass}"
            style="grid-column: ${gridCol}; grid-row: ${gridRow};"
            title="Numéro plein ${num} (×36)"
          >
            <span>${num}</span>
            <span id="badge_straight_${num}"></span>
          </div>
        `;
      });

      html += `
        <div
          onclick="RouletteApp.placeBet('${rowObj.colKey}')"
          oncontextmenu="RouletteApp.removeBet(event, '${rowObj.colKey}')"
          id="spot_${rowObj.colKey}"
          class="bet-spot outside-spot"
          style="grid-column: 14; grid-row: ${gridRow};"
          title="Colonne (×3)"
        >
          <span>${rowObj.label}</span>
          <span id="badge_${rowObj.colKey}"></span>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  /* ---------------- 5. DÉDUCTION DU SOLDE EN DIRECT & MISES ---------------- */
  function getRealBalance() {
    if (myProfile && typeof myProfile.balance === 'number' && !isNaN(myProfile.balance)) {
      return Math.max(0, myProfile.balance);
    }
    return 1000;
  }

  function getTotalBet() {
    return Object.values(currentBets).reduce((sum, val) => sum + Number(val || 0), 0);
  }

  function getAvailableBalance() {
    return Math.max(0, getRealBalance() - getTotalBet());
  }

  function selectChip(value) {
    activeChip = value;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(`chip_${value}`);
    if (target) target.classList.add('active');
  }

  function placeBet(betKey) {
    if (isSpinning) return;

    const realBalance = getRealBalance();
    const available = getAvailableBalance();

    if (realBalance <= 0) {
      showToast('Ton solde est à 0 $ ! Clique sur le bouton ATM (+1 000 $) en haut de la table.', '🏧');
      return;
    }

    if (available <= 0) {
      showToast(`Tout ton solde disponible (${realBalance.toLocaleString('fr-FR')} $) est déjà posé sur le tapis !`, '⚠️');
      return;
    }

    const amountToAdd = activeChip === 'MAX' ? available : Number(activeChip);
    if (amountToAdd > available) {
      showToast(`Il te reste ${available.toLocaleString('fr-FR')} $ disponibles (sélectionne un plus petit jeton ou MAX).`, '⚠️');
      return;
    }

    clearWinnerHighlight();
    currentBets[betKey] = (currentBets[betKey] || 0) + amountToAdd;
    playTickSound(540, 0.025);
    flashHudBox();
    renderBetsAndBalanceUI();
    syncRoomBets();
  }

  function removeBet(event, betKey) {
    if (event) event.preventDefault();
    if (isSpinning || !currentBets[betKey]) return;

    const step = activeChip === 'MAX' ? currentBets[betKey] : Number(activeChip);
    currentBets[betKey] -= step;
    if (currentBets[betKey] <= 0) {
      delete currentBets[betKey];
    }
    playTickSound(420, 0.02);
    flashHudBox();
    renderBetsAndBalanceUI();
    syncRoomBets();
  }

  function clearBets() {
    if (isSpinning) return;
    currentBets = {};
    clearWinnerHighlight();
    flashHudBox();
    renderBetsAndBalanceUI();
    syncRoomBets();
  }

  function rebetLast() {
    if (isSpinning) return;
    const prevTotal = Object.values(previousBets).reduce((s, v) => s + Number(v || 0), 0);
    if (prevTotal <= 0) {
      showToast('Aucune mise précédente à rejouer.', 'ℹ️');
      return;
    }
    const realBalance = getRealBalance();
    if (prevTotal > realBalance) {
      showToast(`Solde insuffisant (${realBalance.toLocaleString('fr-FR')} $) pour rejouer ${prevTotal.toLocaleString('fr-FR')} $ !`, '⚠️');
      return;
    }
    currentBets = { ...previousBets };
    flashHudBox();
    renderBetsAndBalanceUI();
    syncRoomBets();
  }

  function doubleBets() {
    if (isSpinning) return;
    const totalBet = getTotalBet();
    if (totalBet <= 0) return;

    const realBalance = getRealBalance();
    if (totalBet * 2 > realBalance) {
      showToast('Solde insuffisant pour doubler tes mises !', '⚠️');
      return;
    }

    Object.keys(currentBets).forEach(k => {
      currentBets[k] *= 2;
    });
    flashHudBox();
    renderBetsAndBalanceUI();
    syncRoomBets();
  }

  function flashHudBox() {
    const hud = document.getElementById('casinoHud');
    if (!hud) return;
    hud.classList.add('hud-flash');
    clearTimeout(flashHudBox._t);
    flashHudBox._t = setTimeout(() => hud.classList.remove('hud-flash'), 160);
  }

  function renderBetsAndBalanceUI() {
    document.querySelectorAll('[id^="badge_"]').forEach(el => {
      el.innerHTML = '';
    });

    for (const [betKey, amount] of Object.entries(currentBets)) {
      const badgeContainer = document.getElementById(`badge_${betKey}`);
      if (badgeContainer && amount > 0) {
        badgeContainer.innerHTML = `<span class="chip-badge">${amount.toLocaleString('fr-FR')}$</span>`;
      }
    }

    const realBalance = getRealBalance();
    const totalBet = getTotalBet();
    const availableBalance = Math.max(0, realBalance - totalBet);
    const tok = Number(myProfile?.tokens ?? myProfile?.tokensUsed ?? 0);

    const hudBalEl = document.getElementById('hudBalanceValue');
    const hudSubEl = document.getElementById('hudBettingSub');
    const hudTokEl = document.getElementById('hudTokensValue');
    const balPill = document.getElementById('hudBalancePill');

    if (hudBalEl) hudBalEl.textContent = availableBalance.toLocaleString('fr-FR');
    if (hudTokEl) hudTokEl.textContent = tok;

    if (hudSubEl) {
      if (totalBet > 0) {
        hudSubEl.textContent = `(-${totalBet.toLocaleString('fr-FR')}$)`;
        hudSubEl.classList.remove('hidden');
      } else {
        hudSubEl.classList.add('hidden');
      }
    }

    const totalBetEl = document.getElementById('totalBetDisplay');
    const remBalEl = document.getElementById('remainingBalanceDisplay');
    if (totalBetEl) totalBetEl.textContent = `${totalBet.toLocaleString('fr-FR')} $`;
    if (remBalEl) remBalEl.textContent = `${availableBalance.toLocaleString('fr-FR')} $`;

    const atmBtn = document.getElementById('btnInGameAtm');
    const atmText = document.getElementById('btnInGameAtmText');
    if (balPill && atmBtn && atmText) {
      balPill.classList.remove('low', 'betting');
      if (realBalance <= 200 && tok < 20) {
        balPill.classList.add('low');
        atmBtn.className = 'neo-btn bg-[#ef4444] hover:bg-[#dc2626] text-white px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-[2px_2px_0px_#12131a] animate-pulse';
        atmText.textContent = 'ATM Dispo (+1 000 $)';
      } else {
        if (totalBet > 0) balPill.classList.add('betting');
        atmBtn.className = 'neo-btn bg-white hover:bg-slate-100 text-[#12131a] px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-[2px_2px_0px_#12131a]';
        atmText.textContent = tok >= 20 ? 'ATM (20/20 max)' : 'ATM (si ≤ 200 $)';
      }
    }

    const btnSpin = document.getElementById('btnSpin');
    if (btnSpin) {
      const canSpin = !isSpinning && totalBet > 0 && totalBet <= realBalance;
      btnSpin.disabled = !canSpin;
      if (canSpin) {
        btnSpin.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        btnSpin.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  async function useAtmInGame() {
    if (isSpinning) return;
    const realBalance = getRealBalance();
    const tok = Number(myProfile?.tokens ?? myProfile?.tokensUsed ?? 0);

    if (realBalance > 200) {
      showToast(`ATM verrouillé : ton solde réel (${realBalance.toLocaleString('fr-FR')} $) doit être ≤ 200 $.`, '🔒');
      return;
    }
    if (tok >= 20) {
      showToast('Limite de 20/20 Tokens atteinte !', '🚫');
      return;
    }

    if (!myUser) {
      myUser = (window.GameShell && GameShell.currentUser) || await waitForResolvedUser();
    }
    if (!myUser || !myUser.tag) return;

    try {
      const ref = db.ref(`casino/users/${myUser.tag}`);
      const snap = await ref.once('value');
      const cur = snap.val() || myProfile;
      const newBal = Math.max(0, Number(cur.balance ?? realBalance)) + 1000;
      const newTok = Number(cur.tokens ?? cur.tokensUsed ?? tok) + 1;

      await ref.update({
        tag: myUser.tag,
        nickname: myUser.nickname || myUser.tag,
        avatarEmoji: myUser.avatarEmoji || '🍺',
        flagEmoji: myUser.flagEmoji || '🇫🇷',
        balance: newBal,
        tokens: newTok,
        tokensUsed: newTok,
        timestamp: Date.now(),
        lastAtmAt: Date.now()
      });

      myProfile.balance = newBal;
      myProfile.tokens = newTok;
      myProfile.tokensUsed = newTok;
      renderBetsAndBalanceUI();
      GameShell.fireConfetti();
      showToast(`+1 000 $ crédités ! (Token ${newTok}/20)`, '💵');
    } catch (e) {
      console.error('Erreur ATM :', e);
      showToast('Erreur permissions Firebase lors du retrait ATM.', '⚠️');
    }
  }

  /* ---------------- 6. LANCEMENT DE LA ROUE, ROTATION & RÉSULTAT ---------------- */
  function playTickSound(freq = 680, duration = 0.025) {
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
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btnToggleSound');
    if (btn) btn.textContent = soundEnabled ? '🔊 Son ON' : '🔇 Muet';
  }

  function spinWheel() {
    const totalBet = getTotalBet();
    if (isSpinning) return;

    if (totalBet <= 0) {
      showToast('Pose au moins un jeton sur le tapis avant de tourner la roue !', '⚠️');
      return;
    }

    const winningNumber = Math.floor(Math.random() * 37);

    if (currentRoomCode && roomRef) {
      const spinId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      lastProcessedSpinId = spinId;
      roomRef.child('currentSpin').set({
        spinId,
        winningNumber,
        launchedBy: (myUser && myUser.nickname) || 'Joueur',
        timestamp: Date.now()
      });
      executeSpinSequence(winningNumber);
      return;
    }

    executeSpinSequence(winningNumber);
  }

  function executeSpinSequence(winningNumber) {
    if (isSpinning) return;

    const totalBet = getTotalBet();
    const myBetsSnapshot = { ...currentBets };
    const participated = totalBet > 0;

    if (participated) {
      previousBets = { ...myBetsSnapshot };
    }

    isSpinning = true;
    clearWinnerHighlight();
    renderBetsAndBalanceUI();

    const banner = document.getElementById('wheelStatusBanner');
    const liveBanner = document.getElementById('liveResultBanner');
    if (banner) banner.textContent = '2. Rien ne va plus ! 🎡';
    if (liveBanner) {
      liveBanner.className = 'w-full bg-[#12131a] text-[#fed72d] border-2 border-[#fed72d] rounded-xl px-3 py-2 text-center font-mono text-xs font-black animate-pulse';
      liveBanner.textContent = participated
        ? `Mise engagée : ${totalBet.toLocaleString('fr-FR')} $ · La roue tourne...`
        : 'La roue tourne...';
    }

    animateWheelRotationToNumber(winningNumber, async () => {
      const winColor = RouletteEngine.getNumberColor(winningNumber);
      const colorLabel = winColor === 'red' ? 'ROUGE 🔴' : (winColor === 'black' ? 'NOIR ⚫' : 'ZÉRO VERT 🟢');

      updateCenterHub(winningNumber, winColor);
      highlightWinningSpot(winningNumber);
      pushToHistory(winningNumber);

      if (participated) {
        const payout = RouletteEngine.calculateWinnings(winningNumber, myBetsSnapshot);
        const netDelta = payout - totalBet; // +X si gagné, -totalBet si perdu

        // Vider le tapis et enregistrer immédiatement le nouveau solde sur Firebase
        currentBets = {};
        await commitBalanceDeltaToFirebase(netDelta);
        syncRoomBets();

        if (payout > 0) {
          if (liveBanner) {
            liveBanner.className = 'w-full bg-emerald-500 text-[#12131a] border-2 border-[#12131a] rounded-xl px-3 py-2 text-center font-mono text-xs font-black';
            liveBanner.textContent = `🎉 NUMÉRO ${winningNumber} (${colorLabel}) · GAGNÉ : +${payout.toLocaleString('fr-FR')} $ (Solde : ${netDelta >= 0 ? '+' : ''}${netDelta.toLocaleString('fr-FR')} $)`;
          }
          showResultModal(true, winningNumber, winColor, payout, netDelta);

          if (payout >= BIG_WIN_THRESHOLD) {
            GameShell.fireConfetti();
            broadcastBigWin(winningNumber, payout);
          }
        } else {
          if (liveBanner) {
            liveBanner.className = 'w-full bg-rose-600 text-white border-2 border-[#12131a] rounded-xl px-3 py-2 text-center font-mono text-xs font-black';
            liveBanner.textContent = `💀 NUMÉRO ${winningNumber} (${colorLabel}) · PERDU (${netDelta.toLocaleString('fr-FR')} $)`;
          }
          showResultModal(false, winningNumber, winColor, 0, netDelta);
        }
      } else {
        if (liveBanner) {
          liveBanner.className = 'w-full bg-[#12131a] text-white border-2 border-[#fed72d] rounded-xl px-3 py-2 text-center font-mono text-xs font-black';
          liveBanner.textContent = `Numéro sorti : ${winningNumber} (${colorLabel})`;
        }
      }

      if (banner) banner.textContent = '1. Faites vos jeux !';
      isSpinning = false;
      renderBetsAndBalanceUI();
    });
  }

  function animateWheelRotationToNumber(winningNumber, onComplete) {
    const rotor = document.getElementById('wheelRotorWrapper');
    if (!rotor) {
      if (onComplete) onComplete();
      return;
    }

    const sliceDeg = 360 / 37;
    const targetIdx = WHEEL_SEQUENCE.indexOf(winningNumber);

    const desiredMod = (360 - (targetIdx * sliceDeg)) % 360;
    const currentMod = ((currentWheelAngle % 360) + 360) % 360;
    let deltaDeg = desiredMod - currentMod;
    if (deltaDeg < 0) deltaDeg += 360;

    const extraSpins = (6 + Math.floor(Math.random() * 2)) * 360;
    const startAngle = currentWheelAngle;
    const finalAngle = startAngle + extraSpins + deltaDeg;
    currentWheelAngle = finalAngle;

    const duration = 3800;
    const startTime = performance.now();
    let lastTickStep = Math.floor(startAngle / sliceDeg);

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3.3);
      const angle = startAngle + (finalAngle - startAngle) * eased;

      rotor.style.transform = `rotate(${angle.toFixed(2)}deg)`;

      const currentTickStep = Math.floor(angle / sliceDeg);
      if (currentTickStep > lastTickStep) {
        lastTickStep = currentTickStep;
        playTickSound(540 + (1 - t) * 300, 0.02);
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        playTickSound(880, 0.09);
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function updateCenterHub(num, color) {
    const hub = document.getElementById('wheelCenterHub');
    const numEl = document.getElementById('wheelCenterNumber');
    const colEl = document.getElementById('wheelCenterColor');

    hub.className = `wheel-center-hub ${color} pop`;
    numEl.textContent = num;
    colEl.textContent = color === 'red' ? 'Rouge' : (color === 'black' ? 'Noir' : 'Zéro');
  }

  function highlightWinningSpot(num) {
    clearWinnerHighlight();
    const spot = document.getElementById(`spot_straight_${num}`);
    if (spot) spot.classList.add('winner-glow');
  }

  function clearWinnerHighlight() {
    document.querySelectorAll('.winner-glow').forEach(el => el.classList.remove('winner-glow'));
  }

  function pushToHistory(num) {
    spinHistory.unshift(num);
    spinHistory = spinHistory.slice(0, 12);

    const bar = document.getElementById('rouletteHistoryBar');
    const countLabel = document.getElementById('spinCountLabel');
    countLabel.textContent = `${spinHistory.length} tirage${spinHistory.length > 1 ? 's' : ''}`;

    bar.innerHTML = spinHistory.map(n => {
      const c = RouletteEngine.getNumberColor(n);
      return `<span class="history-pill ${c}">${n}</span>`;
    }).join('');
  }

  /* ---------------- 7. MODE SALON MULTIJOUEUR & AUTO-CROUPIER 20S ---------------- */
  function openRoomModal() {
    document.getElementById('rouletteRoomModal').classList.remove('hidden');
  }

  function closeRoomModal() {
    document.getElementById('rouletteRoomModal').classList.add('hidden');
  }

  async function createMultiplayerRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    closeRoomModal();
    await joinMultiplayerRoom(code, true);
  }

  async function joinMultiplayerRoomFromInput() {
    const input = document.getElementById('inputJoinRoomCode');
    const code = (input.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      showToast('Entre un code de salon à 4 caractères.', '⚠️');
      return;
    }
    closeRoomModal();
    await joinMultiplayerRoom(code, false);
  }

  async function joinMultiplayerRoom(code, isCreating = false) {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (!user) return;
    if (roomRef) roomRef.off();

    currentRoomCode = code;
    if (window.GameShell) GameShell.currentRoomCode = code;
    window.location.hash = `room=${code}`;

    roomRef = db.ref(`rooms/casino-roulette/${code}`);

    if (isCreating) {
      await roomRef.set({
        code,
        createdAt: Date.now(),
        hostTag: user.tag
      });
    }

    const myPlayerRef = roomRef.child(`players/${user.tag}`);
    await myPlayerRef.set({
      tag: user.tag,
      nickname: user.nickname,
      avatarEmoji: user.avatarEmoji || '🍺',
      totalBet: getTotalBet(),
      joinedAt: Date.now()
    });
    myPlayerRef.onDisconnect().remove();

    document.getElementById('btnModeSolo').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    const badge = document.getElementById('roomCodeBadge');
    badge.textContent = code;
    badge.classList.remove('hidden');
    document.getElementById('roomPanelCode').textContent = `#${code}`;
    document.getElementById('roomPlayersPanel').classList.remove('hidden');

    roomRef.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;

      renderRoomPlayers(data.players || {});

      if (data.currentSpin && data.currentSpin.spinId !== lastProcessedSpinId) {
        lastProcessedSpinId = data.currentSpin.spinId;
        if (!isSpinning) {
          executeSpinSequence(Number(data.currentSpin.winningNumber));
        }
      }
    });

    showToast(`Connecté au salon Roulette #${code} !`, '👥');
  }

  function switchToSolo() {
    stopAutoTimer();
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (roomRef && user) {
      roomRef.child(`players/${user.tag}`).remove();
      roomRef.off();
    }
    roomRef = null;
    currentRoomCode = null;
    if (window.GameShell) GameShell.currentRoomCode = null;
    history.replaceState(null, '', window.location.pathname);

    document.getElementById('btnModeSolo').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-lg text-[11px] font-black';
    document.getElementById('roomCodeBadge').classList.add('hidden');
    document.getElementById('roomPlayersPanel').classList.add('hidden');
    showToast('Mode Solo activé.', '👤');
  }

  function toggleAutoTimer() {
    if (autoTimerEnabled) {
      stopAutoTimer();
    } else {
      autoTimerEnabled = true;
      autoTimerSeconds = 20;
      const btn = document.getElementById('btnAutoTimer');
      if (btn) {
        btn.className = 'neo-btn bg-emerald-400 text-[#12131a] px-2 py-0.5 rounded-lg text-[10px] font-black';
        btn.textContent = `⏱️ Auto: ${autoTimerSeconds}s`;
      }
      autoTimerInterval = setInterval(() => {
        if (isSpinning) return;
        autoTimerSeconds--;
        if (btn) btn.textContent = `⏱️ Auto: ${autoTimerSeconds}s`;
        if (autoTimerSeconds <= 0) {
          autoTimerSeconds = 20;
          if (getTotalBet() > 0) {
            spinWheel();
          }
        }
      }, 1000);
    }
  }

  function stopAutoTimer() {
    autoTimerEnabled = false;
    clearInterval(autoTimerInterval);
    const btn = document.getElementById('btnAutoTimer');
    if (btn) {
      btn.className = 'neo-btn bg-slate-100 text-[#12131a] px-2 py-0.5 rounded-lg text-[10px] font-black';
      btn.textContent = '⏱️ Auto 20s: OFF';
    }
  }

  function syncRoomBets() {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (roomRef && user) {
      roomRef.child(`players/${user.tag}/totalBet`).set(getTotalBet());
    }
  }

  function renderRoomPlayers(playersMap) {
    const container = document.getElementById('roomPlayersList');
    if (!container) return;
    const list = Object.values(playersMap);
    container.innerHTML = list.map(p => `
      <div class="flex items-center justify-between bg-slate-50 border border-[#12131a] rounded-lg px-2 py-1">
        <span class="font-black truncate text-[11px]">${p.avatarEmoji || '🍺'} ${GameShell.escapeHtml(p.nickname)}</span>
        <span class="font-mono text-[10px] font-bold text-[#065f46]">Mise : ${(p.totalBet || 0).toLocaleString('fr-FR')} $</span>
      </div>
    `).join('');
  }

  /* ---------------- 8. CHAT DU CASINO & ALERTES BIG WIN ---------------- */
  function listenCasinoChat() {
    const container = document.getElementById('casinoTableChatList');
    if (!container) return;

    db.ref('casino/chat').limitToLast(30).on('value', (snap) => {
      const data = snap.val();
      if (!data) {
        container.innerHTML = `<p class="text-[11px] font-bold text-slate-400 text-center py-4">Aucun message à la table.</p>`;
        return;
      }

      const messages = Object.values(data).reverse();
      container.innerHTML = messages.map(m => {
        if (m.isBigWin) {
          return `
            <div class="bg-[#fef08a] border-2 border-[#12131a] rounded-lg p-2 shadow-[1.5px_2px_0px_#12131a]">
              <div class="flex items-center justify-between text-[9px] font-mono font-black text-rose-700">
                <span>🚨 MEGA WIN</span>
                <span>${m.time || ''}</span>
              </div>
              <p class="text-[11px] font-black text-[#12131a] mt-0.5 leading-snug">${GameShell.escapeHtml(m.text)}</p>
            </div>
          `;
        }

        return `
          <div class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
            <div class="flex items-center justify-between">
              <span class="font-black text-[#12131a]">${m.avatar || '🍺'} ${GameShell.escapeHtml(m.nickname)}</span>
              <span class="text-[9px] font-mono text-slate-400">${m.time || ''}</span>
            </div>
            <p class="font-bold text-slate-700 break-words leading-snug">${GameShell.escapeHtml(m.text)}</p>
          </div>
        `;
      }).join('');
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
      isBigWin: false,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    input.value = '';
  }

  function broadcastBigWin(winningNumber, payout) {
    const user = myUser || (window.GameShell && GameShell.currentUser);
    if (!user) return;
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const msgText = `🔥 ${user.nickname} (@${user.tag}) vient de rafler ${payout.toLocaleString('fr-FR')} $ à la Roulette grâce au numéro ${winningNumber} !`;

    db.ref('casino/chat').push({
      nickname: user.nickname,
      tag: user.tag,
      avatar: user.avatarEmoji || '🍺',
      text: msgText,
      isBigWin: true,
      time: timeStr,
      timestamp: Date.now()
    });

    db.ref('chat').push({
      authorNick: user.nickname,
      authorTag: user.tag,
      authorAvatar: user.avatarEmoji || '🍺',
      authorFlag: user.flagEmoji || '🇫🇷',
      isInvite: true,
      gameTitle: '🎡 IMB Roulette - MEGA WIN !',
      internalGame: 'casino/roulette',
      internalRoom: currentRoomCode || 'CASINO',
      text: `@promo ${msgText}`,
      time: timeStr,
      timestamp: Date.now()
    });
  }

  /* ---------------- 9. MODALE DE RÉSULTAT & TOAST ---------------- */
  function showResultModal(won, num, color, payout, netDelta) {
    const modal = document.getElementById('rouletteResultModal');
    const icon = document.getElementById('resultModalIcon');
    const title = document.getElementById('resultModalTitle');
    const desc = document.getElementById('resultModalDesc');
    const payoutEl = document.getElementById('resultModalPayout');

    const colorLabel = color === 'red' ? 'Rouge 🔴' : (color === 'black' ? 'Noir ⚫' : 'Zéro Vert 🟢');

    if (won) {
      icon.textContent = payout >= BIG_WIN_THRESHOLD ? '🤑' : '🎉';
      title.textContent = payout >= BIG_WIN_THRESHOLD ? 'MEGA WIN !' : 'Gagné !';
      desc.textContent = `La roue s'est arrêtée sur le ${num} (${colorLabel}).`;
      payoutEl.textContent = `+ ${payout.toLocaleString('fr-FR')} $ (Solde : ${netDelta >= 0 ? '+' : ''}${netDelta.toLocaleString('fr-FR')} $)`;
      payoutEl.className = 'text-base sm:text-lg font-mono font-black text-emerald-800 bg-emerald-100 border-2 border-[#12131a] py-2.5 px-3 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    } else {
      icon.textContent = '💀';
      title.textContent = 'Perdu...';
      desc.textContent = `La roue s'est arrêtée sur le ${num} (${colorLabel}).`;
      payoutEl.textContent = `${netDelta.toLocaleString('fr-FR')} $`;
      payoutEl.className = 'text-lg font-mono font-black text-rose-700 bg-rose-100 border-2 border-[#12131a] py-2.5 px-3 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    }

    modal.classList.remove('hidden');
  }

  function closeResultModal(shouldRebet = false) {
    document.getElementById('rouletteResultModal').classList.add('hidden');
    if (shouldRebet) {
      rebetLast();
    }
  }

  function showToast(msg, icon = '🎡') {
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

  window.RouletteApp = {
    selectChip,
    placeBet,
    removeBet,
    clearBets,
    rebetLast,
    doubleBets,
    spinWheel,
    useAtmInGame,
    toggleSound,
    openRoomModal,
    closeRoomModal,
    createMultiplayerRoom,
    joinMultiplayerRoomFromInput,
    switchToSolo,
    toggleAutoTimer,
    sendCasinoChatMessage,
    closeResultModal
  };
})();

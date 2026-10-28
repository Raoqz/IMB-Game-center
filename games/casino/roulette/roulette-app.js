/* =========================================================
   IMB CASINO - ROULETTE APP (Étapes 3 & 4)
   Roue SVG rotative avec numéros inscrits, Tapis interactif,
   ATM intégré, Mode Solo / Salon Multi & Chat Big Wins
   ========================================================= */
(function () {
  'use strict';

  // Ordre officiel des 37 numéros sur un cylindre de Roulette Européenne (sens horaire)
  const WHEEL_SEQUENCE = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const BIG_WIN_THRESHOLD = 500; // Déclenche confettis + alerte Chat général dès 500 $ gagnés

  let myProfile = null;
  let activeChip = 50; // 10, 50, 100, 500 ou 'MAX'
  let currentBets = {};
  let previousBets = {};
  let isSpinning = false;
  let currentWheelAngle = 0;
  let spinHistory = [];
  let soundEnabled = true;
  let audioCtx = null;

  // État Salon Multijoueur
  let currentRoomCode = null;
  let roomRef = null;
  let lastProcessedSpinId = null;

  /* ---------------- 1. INITIALISATION DU JEU ET DU SHELL ---------------- */
  window.addEventListener('DOMContentLoaded', () => {
    buildWheelSvg();
    buildInsideBetGrid();

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
        <p>• 🖱️ <strong>Astuce :</strong> Clic gauche pour poser un jeton, clic droit sur une case pour retirer un jeton.</p>
        <p>• 🏧 <strong>ATM :</strong> Si ton solde est ≤ 200 $, utilise le bouton ATM directement en haut de la table pour recevoir +1 000 $ (+1 Token, max 20).</p>
      `,
      onGameInit: async (user) => {
        document.getElementById('hudAvatar').textContent = user.avatarEmoji || '🍺';
        document.getElementById('hudNickname').textContent = user.nickname;

        await CasinoAPI.initPlayerProfile(user);

        CasinoAPI.subscribeProfile((profile) => {
          myProfile = profile;
          updateHudAndAtmUI(profile);
        });

        listenCasinoChat();

        // Vérifier si un code de salon est présent dans l'URL (#room=XXXX)
        const match = window.location.hash.match(/room=([A-Z0-9]{4})/i);
        if (match) {
          joinMultiplayerRoom(match[1].toUpperCase());
        }
      }
    });
  });

  /* ---------------- 2. CONSTRUCTION DE LA ROUE SVG ROTATIVE ---------------- */
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
      // On centre la case idx=0 (le 0 vert) exactement à -90° (12h, sous le pointeur)
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

      // Coordonnées et rotation du numéro inscrit dans la case
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

    // Anneau doré intermédiaire
    pathsHtml += `<circle cx="0" cy="0" r="96" fill="none" stroke="#fed72d" stroke-width="2" stroke-dasharray="4 3" opacity="0.85" />`;
    svg.innerHTML = pathsHtml;
  }

  /* ---------------- 3. CONSTRUCTION DU TAPIS DE MISE (AVEC TEXTE SUR CHAQUE CASE) ---------------- */
  function buildInsideBetGrid() {
    const grid = document.getElementById('insideBetGrid');
    if (!grid) return;

    let html = '';

    // Case 0 (occupe les 3 lignes de la colonne 1)
    html += `
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

    // Les 3 rangées de 12 numéros + le bouton Colonne (2:1) à droite de chaque rangée
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

      // Case Colonne (2:1) au bout de la ligne
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

  /* ---------------- 4. GESTION DU HUD & ATM EN JEU ---------------- */
  function updateHudAndAtmUI(profile) {
    if (!profile) return;
    const bal = Number(profile.balance ?? 0);
    const tok = Number(profile.tokens ?? profile.tokensUsed ?? 0);

    document.getElementById('hudBalanceValue').textContent = bal.toLocaleString('fr-FR');
    document.getElementById('hudTokensValue').textContent = tok;

    const balPill = document.getElementById('hudBalancePill');
    const atmBtn = document.getElementById('btnInGameAtm');
    const atmText = document.getElementById('btnInGameAtmText');

    if (bal <= CasinoAPI.ATM_THRESHOLD && tok < CasinoAPI.MAX_TOKENS) {
      balPill.classList.add('low');
      atmBtn.className = 'neo-btn bg-[#ef4444] hover:bg-[#dc2626] text-white px-3.5 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-[3px_4px_0px_#12131a] animate-pulse';
      atmText.textContent = `ATM Dispo (+1 000 $)`;
    } else if (tok >= CasinoAPI.MAX_TOKENS) {
      balPill.classList.remove('low');
      atmBtn.className = 'neo-btn bg-slate-200 text-slate-500 px-3.5 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5';
      atmText.textContent = 'ATM (20/20 épuisés)';
    } else {
      balPill.classList.remove('low');
      atmBtn.className = 'neo-btn bg-white hover:bg-slate-100 text-[#12131a] px-3.5 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-[3px_4px_0px_#12131a]';
      atmText.textContent = 'ATM (si ≤ 200 $)';
    }

    updateBetControlsState();
  }

  async function useAtmInGame() {
    const res = await CasinoAPI.useATM();
    if (!res.ok) {
      showToast(res.error || 'ATM verrouillé.', '⚠️');
      return;
    }
    GameShell.fireConfetti();
    showToast(`+1 000 $ crédités ! (Token ${res.tokens}/${CasinoAPI.MAX_TOKENS})`, '💵');
  }

  /* ---------------- 5. GESTION DES JETONS ET DES MISES ---------------- */
  function getTotalBet() {
    return Object.values(currentBets).reduce((sum, val) => sum + Number(val || 0), 0);
  }

  function selectChip(value) {
    activeChip = value;
    document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(`chip_${value}`);
    if (target) target.classList.add('active');
  }

  function placeBet(betKey) {
    if (isSpinning) return;
    const balance = Number(myProfile?.balance ?? 0);
    const totalBet = getTotalBet();
    const remaining = balance - totalBet;

    if (remaining <= 0) {
      showToast('Tu as déjà engagé tout ton solde sur le tapis !', '⚠️');
      return;
    }

    const amountToAdd = activeChip === 'MAX' ? remaining : Number(activeChip);
    if (amountToAdd > remaining) {
      showToast(`Solde insuffisant : il te reste ${remaining.toLocaleString('fr-FR')} $ disponibles.`, '⚠️');
      return;
    }

    clearWinnerHighlight();
    currentBets[betKey] = (currentBets[betKey] || 0) + amountToAdd;
    playTickSound(520, 0.03);
    renderBetsOnTable();
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
    renderBetsOnTable();
    syncRoomBets();
  }

  function clearBets() {
    if (isSpinning) return;
    currentBets = {};
    clearWinnerHighlight();
    renderBetsOnTable();
    syncRoomBets();
  }

  function rebetLast() {
    if (isSpinning) return;
    const prevTotal = Object.values(previousBets).reduce((s, v) => s + Number(v || 0), 0);
    if (prevTotal <= 0) {
      showToast('Aucune mise précédente à rejouer.', 'ℹ️');
      return;
    }
    const balance = Number(myProfile?.balance ?? 0);
    if (prevTotal > balance) {
      showToast('Solde insuffisant pour rejouer la mise précédente !', '⚠️');
      return;
    }
    currentBets = { ...previousBets };
    renderBetsOnTable();
    syncRoomBets();
  }

  function doubleBets() {
    if (isSpinning) return;
    const totalBet = getTotalBet();
    if (totalBet <= 0) return;

    const balance = Number(myProfile?.balance ?? 0);
    if (totalBet * 2 > balance) {
      showToast('Solde insuffisant pour doubler tes mises !', '⚠️');
      return;
    }

    Object.keys(currentBets).forEach(k => {
      currentBets[k] *= 2;
    });
    renderBetsOnTable();
    syncRoomBets();
  }

  function renderBetsOnTable() {
    document.querySelectorAll('[id^="badge_"]').forEach(el => {
      el.innerHTML = '';
    });

    for (const [betKey, amount] of Object.entries(currentBets)) {
      const badgeContainer = document.getElementById(`badge_${betKey}`);
      if (badgeContainer && amount > 0) {
        badgeContainer.innerHTML = `<span class="chip-badge">${amount.toLocaleString('fr-FR')}$</span>`;
      }
    }

    const total = getTotalBet();
    document.getElementById('totalBetDisplay').textContent = `${total.toLocaleString('fr-FR')} $`;
    updateBetControlsState();
  }

  function updateBetControlsState() {
    const total = getTotalBet();
    const balance = Number(myProfile?.balance ?? 0);
    const btnSpin = document.getElementById('btnSpin');

    const canSpin = !isSpinning && total > 0 && total <= balance;
    btnSpin.disabled = !canSpin;
    if (canSpin) {
      btnSpin.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      btnSpin.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  /* ---------------- 6. ROTATION DE LA ROUE & SON TIC-TIC ---------------- */
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
    } catch (e) {
      // Ignorer si l'autoplay audio est bloqué
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btnToggleSound');
    if (btn) btn.textContent = soundEnabled ? '🔊 Son ON' : '🔇 Muet';
  }

  async function spinWheel() {
    const totalBet = getTotalBet();
    if (isSpinning || totalBet <= 0) return;

    const winningNumber = Math.floor(Math.random() * 37);

    // Si on est dans un salon multijoueur, publier le tirage pour toute la table
    if (currentRoomCode && roomRef) {
      const spinId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await roomRef.child('currentSpin').set({
        spinId,
        winningNumber,
        launchedBy: GameShell.currentUser?.nickname || 'Joueur',
        timestamp: Date.now()
      });
      return;
    }

    executeSpinSequence(winningNumber);
  }

  async function executeSpinSequence(winningNumber) {
    const totalBet = getTotalBet();
    const myBetsSnapshot = { ...currentBets };

    isSpinning = true;
    clearWinnerHighlight();
    updateBetControlsState();

    // Si le joueur a misé sur ce tour, débiter sa mise immédiatement
    let participated = totalBet > 0;
    if (participated) {
      const debit = await CasinoAPI.updateCasinoBalance(-totalBet);
      if (!debit.ok) {
        showToast(debit.error || 'Mise refusée.', '⚠️');
        isSpinning = false;
        updateBetControlsState();
        return;
      }
      previousBets = { ...myBetsSnapshot };
    }

    const banner = document.getElementById('wheelStatusBanner');
    if (banner) banner.textContent = 'Rien ne va plus ! 🎡';

    animateWheelRotationToNumber(winningNumber, async () => {
      const winColor = RouletteEngine.getNumberColor(winningNumber);
      updateCenterHub(winningNumber, winColor);
      highlightWinningSpot(winningNumber);
      pushToHistory(winningNumber);

      if (participated) {
        const payout = RouletteEngine.calculateWinnings(winningNumber, myBetsSnapshot);
        const netProfit = payout - totalBet;

        if (payout > 0) {
          await CasinoAPI.updateCasinoBalance(payout);
          showResultModal(true, winningNumber, winColor, payout, netProfit);

          if (payout >= BIG_WIN_THRESHOLD) {
            GameShell.fireConfetti();
            broadcastBigWin(winningNumber, payout);
          }
        } else {
          showResultModal(false, winningNumber, winColor, 0, -totalBet);
        }

        currentBets = {};
        renderBetsOnTable();
        syncRoomBets();
      } else {
        showToast(`Numéro sorti : ${winningNumber}`, '🎡');
      }

      if (banner) banner.textContent = 'Faites vos jeux !';
      isSpinning = false;
      updateBetControlsState();
    });
  }

  function animateWheelRotationToNumber(winningNumber, onComplete) {
    const svg = document.getElementById('rouletteWheelSvg');
    const sliceDeg = 360 / 37;
    const targetIdx = WHEEL_SEQUENCE.indexOf(winningNumber);

    // Pour amener targetIdx exactement sous la flèche du haut (12h) :
    const desiredMod = (360 - (targetIdx * sliceDeg)) % 360;
    const currentMod = ((currentWheelAngle % 360) + 360) % 360;
    let deltaDeg = desiredMod - currentMod;
    if (deltaDeg < 0) deltaDeg += 360;

    const extraSpins = (6 + Math.floor(Math.random() * 2)) * 360;
    const startAngle = currentWheelAngle;
    const finalAngle = startAngle + extraSpins + deltaDeg;
    currentWheelAngle = finalAngle;

    const duration = 4200;
    const startTime = performance.now();
    let lastTickStep = Math.floor(startAngle / sliceDeg);

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Courbe de décélération réaliste (cubic-out)
      const eased = 1 - Math.pow(1 - t, 3.4);
      const angle = startAngle + (finalAngle - startAngle) * eased;

      svg.style.transform = `rotate(${angle.toFixed(2)}deg)`;

      const currentTickStep = Math.floor(angle / sliceDeg);
      if (currentTickStep > lastTickStep) {
        lastTickStep = currentTickStep;
        playTickSound(560 + (1 - t) * 280, 0.02);
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        playTickSound(880, 0.08);
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function updateCenterHub(num, color) {
    const hub = document.getElementById('wheelCenterHub');
    const numEl = document.getElementById('wheelCenterNumber');
    const colEl = document.getElementById('wheelCenterColor');

    hub.className = `wheel-center-hub ${color}`;
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
    spinHistory = spinHistory.slice(0, 14);

    const bar = document.getElementById('rouletteHistoryBar');
    const countLabel = document.getElementById('spinCountLabel');
    countLabel.textContent = `${spinHistory.length} tirage${spinHistory.length > 1 ? 's' : ''}`;

    bar.innerHTML = spinHistory.map(n => {
      const c = RouletteEngine.getNumberColor(n);
      return `<span class="history-pill ${c}">${n}</span>`;
    }).join('');
  }

  /* ---------------- 7. MODE SALON MULTIJOUEUR (FIREBASE) ---------------- */
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
    if (!GameShell.currentUser) return;
    if (roomRef) roomRef.off();

    currentRoomCode = code;
    GameShell.currentRoomCode = code;
    window.location.hash = `room=${code}`;

    roomRef = db.ref(`rooms/casino-roulette/${code}`);
    const user = GameShell.currentUser;

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

    // Mise à jour UI mode Salon
    document.getElementById('btnModeSolo').className = 'neo-btn bg-white text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black';
    const badge = document.getElementById('roomCodeBadge');
    badge.textContent = code;
    badge.classList.remove('hidden');
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
    if (roomRef && GameShell.currentUser) {
      roomRef.child(`players/${GameShell.currentUser.tag}`).remove();
      roomRef.off();
    }
    roomRef = null;
    currentRoomCode = null;
    GameShell.currentRoomCode = null;
    history.replaceState(null, '', window.location.pathname);

    document.getElementById('btnModeSolo').className = 'neo-btn bg-[#fed72d] text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black';
    document.getElementById('btnModeRoom').className = 'neo-btn bg-white text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black';
    document.getElementById('roomCodeBadge').classList.add('hidden');
    document.getElementById('roomPlayersPanel').classList.add('hidden');
    showToast('Mode Solo activé.', '👤');
  }

  function syncRoomBets() {
    if (roomRef && GameShell.currentUser) {
      roomRef.child(`players/${GameShell.currentUser.tag}/totalBet`).set(getTotalBet());
    }
  }

  function renderRoomPlayers(playersMap) {
    const container = document.getElementById('roomPlayersList');
    if (!container) return;
    const list = Object.values(playersMap);
    container.innerHTML = list.map(p => `
      <div class="flex items-center justify-between bg-slate-50 border border-[#12131a] rounded-xl px-2.5 py-1.5">
        <span class="font-black truncate">${p.avatarEmoji || '🍺'} ${GameShell.escapeHtml(p.nickname)}</span>
        <span class="font-mono text-[11px] font-bold text-[#065f46]">Mise : ${(p.totalBet || 0).toLocaleString('fr-FR')} $</span>
      </div>
    `).join('');
  }

  /* ---------------- 8. CHAT DU CASINO & ALERTES BIG WIN (ÉTAPE 4) ---------------- */
  function listenCasinoChat() {
    const container = document.getElementById('casinoTableChatList');
    if (!container) return;

    db.ref('casino/chat').limitToLast(35).on('value', (snap) => {
      const data = snap.val();
      if (!data) {
        container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-6">Aucun message à la table. Lance les hostilités !</p>`;
        return;
      }

      const messages = Object.values(data).reverse();
      container.innerHTML = messages.map(m => {
        if (m.isBigWin) {
          return `
            <div class="bg-[#fef08a] border-2 border-[#12131a] rounded-xl p-2.5 shadow-[2px_3px_0px_#12131a]">
              <div class="flex items-center justify-between text-[10px] font-mono font-black text-rose-700">
                <span>🚨 MEGA WIN ROULETTE</span>
                <span>${m.time || ''}</span>
              </div>
              <p class="text-xs font-black text-[#12131a] mt-0.5">${GameShell.escapeHtml(m.text)}</p>
            </div>
          `;
        }

        return `
          <div class="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-black text-[#12131a]">${m.avatar || '🍺'} ${GameShell.escapeHtml(m.nickname)}</span>
              <span class="text-[9px] font-mono text-slate-400">${m.time || ''}</span>
            </div>
            <p class="font-bold text-slate-700 mt-0.5 break-words">${GameShell.escapeHtml(m.text)}</p>
          </div>
        `;
      }).join('');
    });
  }

  function sendCasinoChatMessage(event) {
    event.preventDefault();
    if (!GameShell.currentUser) return;
    const input = document.getElementById('casinoTableChatInput');
    const text = (input.value || '').trim();
    if (!text) return;

    db.ref('casino/chat').push({
      nickname: GameShell.currentUser.nickname,
      tag: GameShell.currentUser.tag,
      avatar: GameShell.currentUser.avatarEmoji || '🍺',
      text,
      isBigWin: false,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    input.value = '';
  }

  function broadcastBigWin(winningNumber, payout) {
    if (!GameShell.currentUser) return;
    const user = GameShell.currentUser;
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const msgText = `🔥 ${user.nickname} (@${user.tag}) vient de rafler ${payout.toLocaleString('fr-FR')} $ à la Roulette grâce au numéro ${winningNumber} !`;

    // 1. Publier dans le chat de la table Casino
    db.ref('casino/chat').push({
      nickname: user.nickname,
      tag: user.tag,
      avatar: user.avatarEmoji || '🍺',
      text: msgText,
      isBigWin: true,
      time: timeStr,
      timestamp: Date.now()
    });

    // 2. Publier une alerte dans le chat général de l'IMB Game Center
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
  function showResultModal(won, num, color, payout, netProfit) {
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
      payoutEl.textContent = `+ ${payout.toLocaleString('fr-FR')} $ (Net : +${netProfit.toLocaleString('fr-FR')} $)`;
      payoutEl.className = 'text-lg font-mono font-black text-emerald-800 bg-emerald-100 border-2 border-[#12131a] py-2.5 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    } else {
      icon.textContent = '💀';
      title.textContent = 'Perdu...';
      desc.textContent = `La roue s'est arrêtée sur le ${num} (${colorLabel}).`;
      payoutEl.textContent = `${netProfit.toLocaleString('fr-FR')} $`;
      payoutEl.className = 'text-lg font-mono font-black text-rose-700 bg-rose-100 border-2 border-[#12131a] py-2.5 rounded-2xl my-4 shadow-[2px_3px_0px_#12131a]';
    }

    modal.classList.remove('hidden');
  }

  function closeResultModal() {
    document.getElementById('rouletteResultModal').classList.add('hidden');
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

  // Exposition globale pour les boutons HTML
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
    sendCasinoChatMessage,
    closeResultModal
  };
})();

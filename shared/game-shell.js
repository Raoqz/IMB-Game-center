/* =========================================================
   IMB GAME CENTER - SHARED GAME SHELL (v5 - Casino Ready)
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyALmOSvJ1YsP_-0b1EKU5zcEhqpyUVg5go",
  authDomain: "imb-game-center.firebaseapp.com",
  databaseURL: "https://imb-game-center-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "imb-game-center",
  storageBucket: "imb-game-center.firebasestorage.app",
  messagingSenderId: "571101212396",
  appId: "1:571101212396:web:3c66a1de5dbf8032007fc9"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

window.GameShell = {
  gameId: '',
  gameTitle: '',
  rulesHtml: '',
  theme: 'default',
  currentUser: null,
  currentRoomCode: null,
  roomRef: null,
  isHost: false,
  myRole: null,

  allUsersMap: {},
  onlinePresenceMap: {},
  fullLeaderboardData: [],
  isLeaderboardExpanded: false,

  onGameInit: null,
  onStateUpdate: null,
  onPlayerJoined: null,
  onRoomConnected: null,

  init(config) {
    this.gameId = config.gameId;
    this.gameTitle = config.gameTitle;
    this.rulesHtml = config.rulesHtml || '<p>Aucune règle renseignée.</p>';
    this.theme = config.theme || 'default';
    this.onGameInit = config.onGameInit;
    this.onStateUpdate = config.onStateUpdate;
    this.onPlayerJoined = config.onPlayerJoined;
    this.onRoomConnected = config.onRoomConnected;

    this.buildShellDom();
    this.listenAuth();
  },

  listenAuth() {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/';
        return;
      }
      const snap = await db.ref(`users/${user.uid}`).once('value');
      const data = snap.val();
      if (!data || data.status !== 'approved') {
        window.location.href = '/';
        return;
      }
      this.currentUser = data;

      const userNickEl = document.getElementById('shellUserNick');
      if (userNickEl) userNickEl.textContent = this.currentUser.nickname;

      this.setupPresence();
      this.listenUsersAndPresence();
      this.listenStackedInvitations();
      this.listenLiveChat();

      const hash = window.location.hash;
      const match = hash.match(/room=([A-Z0-9]{4})/i);
      if (match) {
        const code = match[1].toUpperCase();
        const inputCode = document.getElementById('shellInputRoomCode');
        if (inputCode) inputCode.value = code;
        this.joinRoom(code);
      }

      if (this.onGameInit) {
        this.onGameInit(this.currentUser);
      }
    });
  },

  setupPresence() {
    if (!this.currentUser) return;
    const pRef = db.ref(`presence/${this.currentUser.tag}`);
    db.ref('.info/connected').on('value', snap => {
      if (snap.val() === true) {
        pRef.onDisconnect().remove();
        pRef.set({
          tag: this.currentUser.tag,
          nickname: this.currentUser.nickname,
          avatarEmoji: this.currentUser.avatarEmoji || '🍺',
          currentGame: this.gameTitle,
          connectedAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    });
  },

  buildShellDom() {
    const isCasino = this.theme === 'casino';
    const topBarBg = isCasino ? 'bg-[#065f46]' : 'bg-[#121526]';
    const topBarIcon = isCasino ? '🎰' : '🏆';
    const accentBtn = isCasino
      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
      : 'bg-[#fed72d] hover:bg-[#eec418] text-[#12131a]';
    const chatHeaderBg = isCasino ? 'bg-[#059669] text-white' : 'bg-[#fed72d] text-[#12131a]';

    const shellHtml = `
      <!-- TOPBAR RÉTRACTABLE -->
      <header id="shellTopBar" class="fixed top-0 left-0 right-0 z-40 ${topBarBg} border-b-[3px] border-[#12131a] text-white transition-transform duration-300">
        <div class="max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
          
          <div class="flex items-center gap-2.5">
            <a href="/" class="neo-btn bg-white text-[#12131a] px-3 py-1 rounded-xl text-xs flex items-center gap-1 font-black shadow-[2px_2px_0px_#12131a]">
              <span>←</span>
              <span class="hidden sm:inline">Retour</span>
            </a>
            <h1 class="font-black italic tracking-wider text-sm sm:text-base text-white uppercase">${this.gameTitle}</h1>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2">
            <button onclick="GameShell.announceGameInChat()" title="Partager dans le chat général" class="neo-btn ${accentBtn} px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-[2px_2px_0px_#12131a]">
              <span>📢</span>
              <span class="hidden md:inline">${isCasino ? 'Appeler au Casino' : 'Annoncer ma partie'}</span>
            </button>

            <button onclick="GameShell.openLeaderboard()" title="Classement général" class="neo-btn bg-white text-[#12131a] w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow-[2px_2px_0px_#12131a]">
              ${topBarIcon}
            </button>

            <!-- BOUTON + DROPDOWN DES CONNECTÉS -->
            <div class="relative">
              <button onclick="GameShell.toggleUsersDropdown(event)" id="shellOnlineBadgeBtn" class="neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#12131a]">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-[#12131a]"></span>
                <span id="shellOnlineCountText">1 en ligne</span>
              </button>

              <div id="shellUsersDropdown" class="hidden absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border-[3px] border-[#12131a] rounded-2xl shadow-[4px_5px_0px_#12131a] p-3 text-[#12131a] max-h-96 overflow-y-auto custom-scrollbar z-[160]">
                <div class="flex items-center justify-between pb-2 mb-2 border-b-2 border-slate-200">
                  <span class="text-xs font-black uppercase text-[#12131a]"><span id="shellDropdownOnline">0</span> en ligne</span>
                  <span class="text-[11px] font-mono font-bold text-slate-500"><span id="shellDropdownTotal">0</span> membres</span>
                </div>
                <div id="shellOnlineUsersList" class="space-y-1.5"></div>
              </div>
            </div>

            <button onclick="GameShell.toggleFullScreen()" title="Plein écran" class="hidden sm:flex neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black shadow-[2px_2px_0px_#12131a]">
              ⛶ Plein écran
            </button>

            <button onclick="GameShell.openInNewTab()" title="Ouvrir dans un nouvel onglet" class="hidden sm:flex neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black shadow-[2px_2px_0px_#12131a]">
              ↗ Nouvel onglet
            </button>

            <button onclick="GameShell.toggleBarVisibility()" id="shellBtnToggleBar" title="Masquer la barre" class="neo-btn ${accentBtn} w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_#12131a]">
              ▲
            </button>
          </div>
        </div>
      </header>

      <!-- BOUTON POUR REVOIR LA BARRE -->
      <button id="shellBtnRestoreBar" onclick="GameShell.toggleBarVisibility()" class="hidden fixed top-2 right-4 z-[130] neo-btn ${accentBtn} px-3 py-1 rounded-xl text-xs font-black shadow-[3px_4px_0px_#12131a]">
        ▼ Menu
      </button>

      <!-- PILE D'INVITATIONS EN BAS À DROITE (MAX 3) -->
      <div id="shellInviteStack" class="fixed bottom-20 right-4 z-[140] flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none"></div>

      <!-- CHAT DU SHELL -->
      <div class="fixed bottom-4 right-4 z-[140] flex flex-col items-end">
        <div id="shellChatBox" class="hidden mb-3 w-80 sm:w-96 h-[460px] bg-white border-[3px] border-[#12131a] rounded-2xl shadow-[5px_6px_0px_#12131a] flex flex-col overflow-hidden relative pointer-events-auto">
          
          <div class="${chatHeaderBg} p-3 border-b-[3px] border-[#12131a] flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#12131a]"></span>
              <span class="font-black text-xs uppercase tracking-wide">QG de la Promo</span>
            </div>
            <button onclick="GameShell.toggleChatBox()" class="font-black text-sm hover:opacity-75">✕</button>
          </div>

          <div id="shellChatMessages" class="flex-1 p-3 overflow-y-auto space-y-reverse space-y-2.5 bg-[#f8fafc] flex flex-col-reverse custom-scrollbar">
            <p class="text-xs font-bold text-slate-400 text-center py-8">Chargement du chat...</p>
          </div>

          <div id="shellMentionBox" class="hidden absolute bottom-[58px] left-2 right-2 bg-white border-[2.5px] border-[#12131a] rounded-xl shadow-[3px_4px_0px_#12131a] max-h-40 overflow-y-auto custom-scrollbar z-30 divide-y divide-slate-100"></div>

          <form onsubmit="GameShell.sendChatMessage(event)" class="p-2.5 bg-white border-t-[3px] border-[#12131a] flex gap-2 relative">
            <input type="text" id="shellChatInput" oninput="GameShell.handleChatInput(event)" autocomplete="off" placeholder="Écris ou @tag un camarade..." class="flex-1 bg-[#f1f3f9] border-2 border-[#12131a] rounded-xl px-3 py-1.5 text-xs font-bold text-[#12131a] focus:outline-none focus:bg-white">
            <button type="submit" class="neo-btn ${accentBtn} px-3.5 py-1.5 rounded-xl text-xs font-black shadow-[2px_2px_0px_#12131a]">
              Envoyer
            </button>
          </form>
        </div>

        <button onclick="GameShell.toggleChatBox()" class="w-12 h-12 rounded-2xl ${accentBtn} border-[3px] border-[#12131a] flex items-center justify-center text-xl shadow-[3px_4px_0px_#12131a] active:translate-x-0.5 active:translate-y-0.5 transition-all pointer-events-auto">
          💬
        </button>
      </div>

      <!-- MODALE RÈGLES -->
      <div id="shellModalRules" class="hidden fixed inset-0 z-[150] bg-[#121422]/80 backdrop-blur-sm flex items-center justify-center p-4 text-[#12131a]">
        <div class="neo-box bg-white max-w-md w-full p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar shadow-[6px_7px_0px_#12131a]">
          <div class="flex items-center justify-between pb-3 border-b-2 border-[#12131a] mb-4">
            <h3 class="text-base font-black text-[#12131a] uppercase">📖 Règles du jeu</h3>
            <button onclick="GameShell.closeRules()" class="w-8 h-8 rounded-lg border-2 border-[#12131a] bg-slate-100 hover:bg-rose-100 text-[#12131a] flex items-center justify-center text-sm font-black shadow-[1px_2px_0px_#12131a]">✕</button>
          </div>
          <div class="text-xs font-bold text-slate-700 leading-relaxed space-y-2">
            ${this.rulesHtml}
          </div>
        </div>
      </div>

      <!-- MODALE CLASSEMENT -->
      <div id="shellModalLeaderboard" class="hidden fixed inset-0 z-[150] bg-[#121422]/80 backdrop-blur-sm flex items-center justify-center p-4 text-[#12131a]">
        <div class="neo-box bg-white max-w-md w-full p-6 relative max-h-[88vh] overflow-y-auto custom-scrollbar shadow-[6px_7px_0px_#12131a]">
          <div class="flex items-center justify-between pb-3 border-b-2 border-[#12131a] mb-4">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${topBarIcon}</span>
              <div>
                <h3 class="text-base font-black text-[#12131a] uppercase leading-none">${this.gameTitle} : Classement</h3>
                <span class="text-[10px] font-mono text-slate-500">${isCasino ? 'Richesse ($) & Tokens utilisés' : 'Palmarès enregistré'}</span>
              </div>
            </div>
            <button onclick="GameShell.closeLeaderboard()" class="w-8 h-8 rounded-lg border-2 border-[#12131a] bg-slate-100 hover:bg-rose-100 text-[#12131a] flex items-center justify-center text-sm font-black shadow-[1px_2px_0px_#12131a]">✕</button>
          </div>

          <div id="shellLeaderboardList" class="space-y-2">
            <p class="text-xs font-bold text-slate-400 text-center py-4">Chargement du palmarès...</p>
          </div>

          <div id="shellLeaderboardExpandWrapper" class="mt-3 hidden">
            <button onclick="GameShell.toggleFullLeaderboard()" id="shellBtnExpandLeaderboard" class="w-full neo-btn bg-white hover:bg-slate-50 border-2 border-[#12131a] text-[#12131a] py-2 rounded-xl text-xs font-black shadow-[2px_3px_0px_#12131a]">
              Voir le classement complet ▼
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', shellHtml);

    const mRules = document.getElementById('shellModalRules');
    const mLead = document.getElementById('shellModalLeaderboard');
    if (mRules) mRules.addEventListener('click', e => { if (e.target === mRules) this.closeRules(); });
    if (mLead) mLead.addEventListener('click', e => { if (e.target === mLead) this.closeLeaderboard(); });

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('shellUsersDropdown');
      const btn = document.getElementById('shellOnlineBadgeBtn');
      if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  },

  /* ---------------- GESTION DES SALLES ---------------- */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  async createRoom() {
    const code = this.generateRoomCode();
    this.currentRoomCode = code;
    this.isHost = true;
    this.myRole = 'X';

    localStorage.setItem(`imb_active_room_${this.gameId}`, code);

    this.roomRef = db.ref(`rooms/${this.gameId}/${code}`);
    const initialData = {
      code: code,
      createdAt: Date.now(),
      status: 'waiting',
      playerX: {
        tag: this.currentUser.tag,
        nickname: this.currentUser.nickname,
        avatarEmoji: this.currentUser.avatarEmoji || '🍺'
      },
      playerO: null,
      state: {
        board: Array(9).fill(''),
        turn: 'X',
        winner: null
      }
    };

    await this.roomRef.set(initialData);
    this.roomRef.onDisconnect().remove();
    this.attachRoomListener();
    window.location.hash = `room=${code}`;

    if (this.onRoomConnected) {
      this.onRoomConnected(code, initialData);
    }
    return code;
  },

  async joinRoom(code) {
    code = code.trim().toUpperCase();
    this.currentRoomCode = code;
    this.roomRef = db.ref(`rooms/${this.gameId}/${code}`);

    const snap = await this.roomRef.once('value');
    if (!snap.exists()) {
      localStorage.removeItem(`imb_active_room_${this.gameId}`);
      alert("Salle introuvable ou fermée !");
      return false;
    }

    const data = snap.val();
    localStorage.setItem(`imb_active_room_${this.gameId}`, code);

    if (data.playerX && data.playerX.tag === this.currentUser.tag) {
      this.isHost = true;
      this.myRole = 'X';
    } else {
      this.isHost = false;
      this.myRole = 'O';
      await this.roomRef.update({
        playerO: {
          tag: this.currentUser.tag,
          nickname: this.currentUser.nickname,
          avatarEmoji: this.currentUser.avatarEmoji || '🍺'
        },
        status: 'playing'
      });
    }

    this.attachRoomListener();
    window.location.hash = `room=${code}`;

    if (this.onRoomConnected) {
      this.onRoomConnected(code, data);
    }
    return true;
  },

  attachRoomListener() {
    this.roomRef.on('value', snap => {
      const data = snap.val();
      if (!data) return;

      if (this.onPlayerJoined) this.onPlayerJoined(data);
      if (this.onStateUpdate && data.state) this.onStateUpdate(data.state, data);
    });
  },

  updateGameState(newState) {
    if (this.roomRef) {
      this.roomRef.child('state').update(newState);
    }
  },

  /* ---------------- SCORES ---------------- */
  async recordResult(winnerRole) {
    const snap = await this.roomRef.once('value');
    const room = snap.val();
    if (!room || !room.playerX || !room.playerO) return;

    if (winnerRole === 'draw') {
      this.incrementScore(room.playerX, 'draws');
      this.incrementScore(room.playerO, 'draws');
    } else if (winnerRole === 'X') {
      this.incrementScore(room.playerX, 'wins');
      this.incrementScore(room.playerO, 'losses');
    } else if (winnerRole === 'O') {
      this.incrementScore(room.playerO, 'wins');
      this.incrementScore(room.playerX, 'losses');
    }
  },

  async incrementScore(player, type) {
    const ref = db.ref(`scores/${this.gameId}/${player.tag}`);
    await ref.transaction(current => {
      if (!current) {
        return {
          tag: player.tag,
          nickname: player.nickname,
          avatarEmoji: player.avatarEmoji || '🍺',
          wins: type === 'wins' ? 1 : 0,
          losses: type === 'losses' ? 1 : 0,
          draws: type === 'draws' ? 1 : 0,
          updatedAt: Date.now()
        };
      }
      current[type] = (current[type] || 0) + 1;
      current.updatedAt = Date.now();
      return current;
    });
  },

  fireConfetti() {
    if (typeof confetti === 'function') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0 } });
        confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1 } });
      }, 250);
    }
  },

  /* ---------------- INVITATIONS ---------------- */
  async sendDirectInvite(targetTag) {
    const isCasino = this.theme === 'casino';
    if (!this.currentRoomCode && !isCasino) {
      alert("Crée d'abord une salle avant d'inviter un camarade !");
      return;
    }

    const roomCodeParam = this.currentRoomCode || 'CASINO';
    const newInviteRef = db.ref(`invitations/${targetTag}`).push();
    await newInviteRef.set({
      id: newInviteRef.key,
      fromTag: this.currentUser.tag,
      fromNick: this.currentUser.nickname,
      gameId: this.gameId,
      gameTitle: this.gameTitle,
      roomCode: roomCodeParam,
      timestamp: Date.now()
    });

    const dropdown = document.getElementById('shellUsersDropdown');
    if (dropdown) dropdown.classList.add('hidden');
  },

  listenStackedInvitations() {
    if (!this.currentUser) return;
    const stackContainer = document.getElementById('shellInviteStack');

    db.ref(`invitations/${this.currentUser.tag}`).on('value', snap => {
      const data = snap.val();
      if (!data) {
        stackContainer.innerHTML = '';
        return;
      }

      const allInvites = Object.entries(data).map(([key, val]) => ({ ...val, key }));
      const recentInvites = allInvites.slice(-3);

      stackContainer.innerHTML = recentInvites.map(inv => {
        const isCasinoInvite = inv.gameId === 'casino' || inv.roomCode === 'CASINO';
        const roomLabel = isCasinoInvite ? '' : `(Salle <strong>${inv.roomCode}</strong>)`;

        return `
          <div id="inviteCard_${inv.key}" class="pointer-events-auto bg-[#fed72d] border-[3px] border-[#12131a] rounded-2xl p-3 shadow-[4px_5px_0px_#12131a] flex items-center justify-between gap-2.5 animate-bounce">
            <div class="min-w-0">
              <span class="text-xs font-black text-[#12131a] block truncate">
                ${this.escapeHtml(inv.fromNick)} t'invite !
              </span>
              <span class="text-[10px] font-bold text-slate-700 block truncate">
                ${this.escapeHtml(inv.gameTitle)} ${roomLabel}
              </span>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="GameShell.acceptInvite('${inv.gameId}', '${inv.roomCode}', '${inv.key}')" class="neo-btn bg-[#00e599] hover:bg-[#00c985] text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black">
                Rejoindre
              </button>
              <button onclick="GameShell.dismissInvite('${inv.key}')" class="neo-btn bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-xl text-xs font-bold">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('');
    });
  },

  acceptInvite(gameId, roomCode, inviteKey) {
    if (inviteKey) this.dismissInvite(inviteKey);
    if (gameId === 'casino' || roomCode === 'CASINO') {
      window.location.href = `/games/casino/index.html`;
      return;
    }
    if (gameId === this.gameId) {
      window.location.hash = `room=${roomCode}`;
      this.joinRoom(roomCode);
    } else {
      window.location.href = `/games/${gameId}/index.html#room=${roomCode}`;
    }
  },

  dismissInvite(inviteKey) {
    if (this.currentUser && inviteKey) {
      db.ref(`invitations/${this.currentUser.tag}/${inviteKey}`).remove();
    }
  },

  /* ---------------- CLASSEMENT TOP 3 / FULL (AVEC MODE CASINO) ---------------- */
  openLeaderboard() {
    const modal = document.getElementById('shellModalLeaderboard');
    modal.classList.remove('hidden');
    this.isLeaderboardExpanded = false;

    if (this.theme === 'casino') {
      if (window.CasinoAPI && typeof window.CasinoAPI.getLeaderboard === 'function') {
        window.CasinoAPI.getLeaderboard().then(sorted => {
          this.fullLeaderboardData = sorted;
          this.renderLeaderboardRows();
        });
      } else {
        db.ref('casino/users').once('value', snap => {
          const data = snap.val() || {};
          this.fullLeaderboardData = Object.values(data).sort((a, b) => {
            if ((b.balance ?? 0) !== (a.balance ?? 0)) return (b.balance ?? 0) - (a.balance ?? 0);
            if ((a.tokens ?? 0) !== (b.tokens ?? 0)) return (a.tokens ?? 0) - (b.tokens ?? 0);
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
          });
          this.renderLeaderboardRows();
        });
      }
      return;
    }

    db.ref(`scores/${this.gameId}`).once('value', snap => {
      const data = snap.val() || {};
      this.fullLeaderboardData = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0));
      this.renderLeaderboardRows();
    });
  },

  renderLeaderboardRows() {
    const container = document.getElementById('shellLeaderboardList');
    const expandWrapper = document.getElementById('shellLeaderboardExpandWrapper');
    const btnExpand = document.getElementById('shellBtnExpandLeaderboard');
    const isCasino = this.theme === 'casino';
    const totalPlayers = this.fullLeaderboardData.length;

    if (totalPlayers === 0) {
      container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-4">Aucune donnée enregistrée.</p>`;
      expandWrapper.classList.add('hidden');
      return;
    }

    const listToDisplay = this.isLeaderboardExpanded 
      ? this.fullLeaderboardData 
      : this.fullLeaderboardData.slice(0, 5);

    container.innerHTML = listToDisplay.map((p, idx) => {
      const isFirst = idx === 0;
      const isLast = totalPlayers > 1 && idx === totalPlayers - 1;

      let cardStyle = "bg-slate-50 border-2 border-slate-200";
      let rankBadge = `<span class="font-black text-xs w-5 text-center text-slate-400">${idx + 1}.</span>`;

      if (isCasino) {
        if (isFirst) {
          cardStyle = "bg-[#fef08a] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base" title="Le plus riche">👑</span>`;
        } else if (isLast) {
          cardStyle = "bg-rose-50 border-[2.5px] border-rose-500 shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base" title="Bonnet d'âne">🫏</span>`;
        } else if (idx === 1) {
          cardStyle = "bg-[#e2e8f0] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base">🥈</span>`;
        } else if (idx === 2) {
          cardStyle = "bg-[#fed7aa] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base">🥉</span>`;
        }
      } else {
        if (idx === 0) {
          cardStyle = "bg-[#fef08a] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base">🥇</span>`;
        } else if (idx === 1) {
          cardStyle = "bg-[#e2e8f0] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base">🥈</span>`;
        } else if (idx === 2) {
          cardStyle = "bg-[#fed7aa] border-[2.5px] border-[#12131a] shadow-[2px_3px_0px_#12131a]";
          rankBadge = `<span class="text-base">🥉</span>`;
        }
      }

      const tokensCount = p.tokens ?? p.tokensUsed ?? 0;
      const rightColumnHtml = isCasino
        ? `
          <div class="text-right flex-shrink-0">
            <div class="text-xs font-black text-[#065f46] font-mono">${(p.balance ?? 0).toLocaleString('fr-FR')} $</div>
            <div class="text-[10px] font-mono font-bold ${tokensCount > 0 ? 'text-rose-600' : 'text-emerald-700'}">
              🪙 ${tokensCount}/20 token${tokensCount > 1 ? 's' : ''}
            </div>
          </div>
        `
        : `
          <div class="text-right flex-shrink-0">
            <span class="text-xs font-black text-[#12131a]">${p.wins || 0} ${this.gameId === 'flappy-giroud' ? 'pts' : 'victoire' + ((p.wins || 0) > 1 ? 's' : '')}</span>
          </div>
        `;

      return `
        <div class="rounded-2xl p-2.5 flex items-center justify-between gap-2.5 ${cardStyle}">
          <div class="flex items-center gap-2 min-w-0">
            ${rankBadge}
            <span class="w-8 h-8 rounded-xl bg-white border border-[#12131a] flex items-center justify-center text-sm shadow-[1px_1px_0px_#12131a] flex-shrink-0">
              ${p.avatarEmoji || '🍺'}
            </span>
            <div class="min-w-0">
              <div class="text-xs font-black text-[#12131a] truncate flex items-center gap-1">
                <span>${this.escapeHtml(p.nickname)}</span>
                ${isCasino && isFirst ? '<span class="text-[9px] bg-[#12131a] text-[#fed72d] px-1.5 py-0.2 rounded font-mono">BOSS</span>' : ''}
                ${isCasino && isLast ? '<span class="text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-mono">RUINÉ</span>' : ''}
              </div>
              <div class="text-[9px] font-mono text-slate-500 truncate">@${this.escapeHtml(p.tag)}</div>
            </div>
          </div>
          ${rightColumnHtml}
        </div>
      `;
    }).join('');

    if (totalPlayers > 5) {
      expandWrapper.classList.remove('hidden');
      btnExpand.textContent = this.isLeaderboardExpanded 
        ? "Réduire au Top 5 ▲" 
        : `Voir le classement complet (${totalPlayers} joueurs) ▼`;
    } else {
      expandWrapper.classList.add('hidden');
    }
  },

  toggleFullLeaderboard() {
    this.isLeaderboardExpanded = !this.isLeaderboardExpanded;
    this.renderLeaderboardRows();
  },

  closeLeaderboard() {
    document.getElementById('shellModalLeaderboard').classList.add('hidden');
  },

  /* ---------------- CONNECTÉS DANS LE SHELL ---------------- */
  listenUsersAndPresence() {
    db.ref('users').on('value', snap => {
      this.allUsersMap = snap.val() || {};
      this.renderShellUsersDropdown();
    });

    db.ref('presence').on('value', snap => {
      this.onlinePresenceMap = snap.val() || {};
      this.renderShellUsersDropdown();
    });
  },

  renderShellUsersDropdown() {
    const container = document.getElementById('shellOnlineUsersList');
    if (!container) return;

    const approvedUsers = Object.values(this.allUsersMap).filter(u => u && u.status === 'approved');
    const onlineCount = Object.keys(this.onlinePresenceMap).length || 1;

    document.getElementById('shellOnlineCountText').textContent = `${onlineCount} en ligne`;
    document.getElementById('shellDropdownOnline').textContent = onlineCount;
    document.getElementById('shellDropdownTotal').textContent = approvedUsers.length;

    const sortedUsers = approvedUsers.sort((a, b) => {
      const aOnline = Boolean(this.onlinePresenceMap[a.tag]);
      const bOnline = Boolean(this.onlinePresenceMap[b.tag]);
      if (aOnline === bOnline) return a.nickname.localeCompare(b.nickname);
      return aOnline ? -1 : 1;
    });

    container.innerHTML = sortedUsers.map(u => {
      const isOnline = Boolean(this.onlinePresenceMap[u.tag]);
      const presenceInfo = this.onlinePresenceMap[u.tag];
      const isMe = this.currentUser && this.currentUser.tag === u.tag;
      const isAdmin = u.role === 'admin';

      let statusText = 'hors ligne';
      if (isOnline) {
        statusText = presenceInfo && presenceInfo.currentGame 
          ? `dans ${presenceInfo.currentGame}` 
          : 'En ligne';
      }

      return `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 border border-slate-100 ${isOnline ? '' : 'opacity-70'}">
          <div class="flex items-center gap-2 min-w-0">
            <div class="relative flex-shrink-0">
              <span class="w-8 h-8 rounded-xl bg-slate-100 border border-[#12131a] flex items-center justify-center text-sm shadow-[1px_1px_0px_#12131a]">
                ${u.avatarEmoji || '🍺'}
              </span>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#12131a] ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-black text-[#12131a] truncate flex items-center gap-1">
                <span>${this.escapeHtml(u.nickname)}</span>
                ${isMe ? '<span class="text-[10px] font-mono text-emerald-700 font-bold">(toi)</span>' : ''}
                ${isAdmin ? '<span class="bg-[#12131a] text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">admin</span>' : ''}
              </div>
              <div class="text-[10px] text-slate-500 truncate font-bold">
                ${statusText}
              </div>
            </div>
          </div>

          ${!isMe ? `
            <button onclick="GameShell.sendDirectInvite('${u.tag}')" class="neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] px-2.5 py-1 rounded-xl text-[10px] font-black flex-shrink-0">
              Inviter
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  toggleUsersDropdown(e) {
    e.stopPropagation();
    document.getElementById('shellUsersDropdown').classList.toggle('hidden');
  },

  /* ---------------- CHAT DU SHELL ---------------- */
  listenLiveChat() {
    const container = document.getElementById('shellChatMessages');
    db.ref('chat').limitToLast(40).on('value', snap => {
      const data = snap.val();
      if (!data) {
        container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-8">Aucun message pour le moment.</p>`;
        return;
      }

      const messages = Object.values(data).reverse();
      container.innerHTML = messages.map(m => {
        if (m.isSystem) {
          return `
            <div class="text-center py-1">
              <span class="text-[9px] font-mono font-bold bg-slate-100 border border-[#12131a] px-2 py-0.5 rounded-full">${this.escapeHtml(m.text)}</span>
            </div>
          `;
        }

        const mentionedMe = this.isUserMentionedInText(m.text);

        if (m.isInvite) {
          const isCasino = m.internalGame === 'casino' || m.internalRoom === 'CASINO';
          return `
            <div class="neo-box bg-[#fed72d] p-2.5 text-[#12131a] space-y-1.5 ${mentionedMe ? 'ring-2 ring-rose-500' : ''}">
              <div class="flex items-center justify-between text-[11px] font-black">
                <span>${m.authorAvatar || '🍺'} ${this.escapeHtml(m.authorNick)}</span>
                <span class="text-[9px] font-mono text-slate-700">${m.time}</span>
              </div>
              <div class="bg-white border-2 border-[#12131a] p-2 rounded-xl text-xs shadow-[2px_2px_0px_#12131a]">
                <div class="font-black text-[11px] mb-1">🎮 ${this.escapeHtml(m.gameTitle)}</div>
                <p class="text-[10px] font-bold text-slate-700 italic mb-2">« ${this.formatChatMessageWithMentions(m.text)} »</p>
                ${m.internalGame ? `
                  <button onclick="GameShell.acceptInvite('${m.internalGame}', '${m.internalRoom}')" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-1.5 rounded-lg text-xs font-black">
                    ${isCasino ? 'Rejoindre le Casino 🎰' : `Rejoindre la salle ${m.internalRoom} ➔`}
                  </button>
                ` : `
                  <a href="${m.roomUrl}" target="_blank" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-1.5 rounded-lg text-xs font-black block text-center">
                    Rejoindre la partie ↗
                  </a>
                `}
              </div>
            </div>
          `;
        }

        return `
          <div class="neo-box-sm bg-white p-2.5 ${mentionedMe ? 'ping-message-card' : ''}">
            <div class="flex items-center justify-between mb-1">
              <span onclick="GameShell.mentionUserInInput('${this.escapeHtml(m.authorTag)}')" class="cursor-pointer text-xs font-black text-[#12131a] flex items-center gap-1.5 hover:underline">
                <span>${m.authorAvatar || '🍺'}</span>
                <span>${this.escapeHtml(m.authorNick)}</span>
                <span class="text-[9px] font-mono text-slate-400">@${this.escapeHtml(m.authorTag)}</span>
              </span>
              <span class="text-[9px] font-mono font-bold text-slate-400">${m.time}</span>
            </div>
            <p class="text-xs font-bold text-slate-800 break-words leading-relaxed">${this.formatChatMessageWithMentions(m.text)}</p>
          </div>
        `;
      }).join('');
    });
  },

  sendChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('shellChatInput');
    const text = input.value.trim();
    if (!text || !this.currentUser) return;

    db.ref('chat').push({
      authorNick: this.currentUser.nickname,
      authorTag: this.currentUser.tag,
      authorAvatar: this.currentUser.avatarEmoji || '🍺',
      authorFlag: this.currentUser.flagEmoji || '🇫🇷',
      isInvite: false,
      text: text,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    input.value = '';
    this.hideMentionAutocomplete();
  },

  announceGameInChat() {
    const isCasino = this.theme === 'casino';
    if (!this.currentRoomCode && !isCasino) {
      alert("Crée d'abord une salle !");
      return;
    }
    if (!this.currentUser) return;

    db.ref('chat').push({
      authorNick: this.currentUser.nickname,
      authorTag: this.currentUser.tag,
      authorAvatar: this.currentUser.avatarEmoji || '🍺',
      authorFlag: this.currentUser.flagEmoji || '🇫🇷',
      isInvite: true,
      gameTitle: this.gameTitle,
      internalGame: this.gameId,
      internalRoom: this.currentRoomCode || 'CASINO',
      text: isCasino
        ? `@promo Je suis au Casino IMB ! Venez faire sauter la banque 🎰💸`
        : `@promo Je lance une partie de ${this.gameTitle} ! Rejoins avec le code : ${this.currentRoomCode}`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });
  },

  handleChatInput(e) {
    const input = e.target;
    const val = input.value;
    const cursor = input.selectionStart || val.length;
    const textBefore = val.slice(0, cursor);

    const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) {
      this.hideMentionAutocomplete();
      return;
    }

    const query = match[1].toLowerCase();
    const candidates = [
      { tag: 'promo', nickname: 'Toute la promo', avatarEmoji: '📢' }
    ];

    Object.values(this.allUsersMap).filter(u => u && u.status === 'approved').forEach(u => {
      candidates.push({
        tag: u.tag,
        nickname: u.nickname || u.tag,
        avatarEmoji: u.avatarEmoji || '🍺'
      });
    });

    const filtered = candidates.filter(c =>
      c.tag.toLowerCase().includes(query) || c.nickname.toLowerCase().includes(query)
    ).slice(0, 5);

    if (filtered.length === 0) {
      this.hideMentionAutocomplete();
      return;
    }

    const box = document.getElementById('shellMentionBox');
    box.innerHTML = filtered.map(c => `
      <button type="button" onclick="GameShell.selectMention('${this.escapeHtml(c.tag)}')" class="w-full px-2.5 py-1.5 text-left hover:bg-[#fffdf0] flex items-center justify-between text-xs">
        <span class="font-black text-[#12131a] flex items-center gap-1.5">
          <span>${c.avatarEmoji}</span>
          <span>${this.escapeHtml(c.nickname)}</span>
          <span class="font-mono text-[9px] text-slate-500">@${this.escapeHtml(c.tag)}</span>
        </span>
      </button>
    `).join('');
    box.classList.remove('hidden');
  },

  selectMention(tag) {
    const input = document.getElementById('shellChatInput');
    const val = input.value;
    const cursor = input.selectionStart || val.length;
    const before = val.slice(0, cursor).replace(/@([a-zA-Z0-9_-]*)$/, `@${tag} `);
    const after = val.slice(cursor);
    input.value = before + after;
    input.focus();
    this.hideMentionAutocomplete();
  },

  mentionUserInInput(tag) {
    this.openChatBox();
    const input = document.getElementById('shellChatInput');
    input.value = `${input.value ? input.value + ' ' : ''}@${tag} `;
    input.focus();
  },

  hideMentionAutocomplete() {
    const box = document.getElementById('shellMentionBox');
    if (box) box.classList.add('hidden');
  },

  isUserMentionedInText(text) {
    if (!text || !this.currentUser || !this.currentUser.tag) return false;
    const regex = new RegExp(`(^|\\s)@(${this.currentUser.tag}|promo|all)\\b`, 'i');
    return regex.test(text);
  },

  formatChatMessageWithMentions(rawText) {
    const safe = this.escapeHtml(rawText || '');
    return safe.replace(/(^|\s)@([a-zA-Z0-9_-]+)/g, (full, space, tag) => {
      const lower = tag.toLowerCase();
      const isMe = this.currentUser && this.currentUser.tag.toLowerCase() === lower;
      const isPromo = lower === 'promo' || lower === 'all';

      if (isMe || isPromo) {
        return `${space}<span onclick="GameShell.mentionUserInInput('${tag}')" class="cursor-pointer inline-block bg-[#ff2a5f] text-white border border-[#12131a] px-1.5 py-0.2 rounded font-mono text-[10px] font-black shadow-[1px_1px_0px_#12131a]">@${tag}</span>`;
      }
      return `${space}<span onclick="GameShell.mentionUserInInput('${tag}')" class="cursor-pointer inline-block bg-[#fed72d] text-[#12131a] border border-[#12131a] px-1.5 py-0.2 rounded font-mono text-[10px] font-black">@${tag}</span>`;
    });
  },

  toggleChatBox() {
    document.getElementById('shellChatBox').classList.toggle('hidden');
  },

  openChatBox() {
    document.getElementById('shellChatBox').classList.remove('hidden');
  },

  /* ---------------- OUTILS ---------------- */
  toggleBarVisibility() {
    const bar = document.getElementById('shellTopBar');
    const restoreBtn = document.getElementById('shellBtnRestoreBar');
    if (bar.style.transform === 'translateY(-100%)') {
      bar.style.transform = 'translateY(0)';
      restoreBtn.classList.add('hidden');
    } else {
      bar.style.transform = 'translateY(-100%)';
      restoreBtn.classList.remove('hidden');
      document.getElementById('shellUsersDropdown').classList.add('hidden');
    }
  },

  toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  },

  openInNewTab() {
    window.open(window.location.href, '_blank');
  },

  openRules() {
    document.getElementById('shellModalRules').classList.remove('hidden');
  },

  closeRules() {
    document.getElementById('shellModalRules').classList.add('hidden');
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

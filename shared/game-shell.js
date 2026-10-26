/* =========================================================
   IMB GAME CENTER - SHARED GAME SHELL
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
  currentUser: null,
  currentRoomCode: null,
  roomRef: null,
  isHost: false,
  myRole: null, // 'X' ou 'O', etc.

  // Callbacks fournis par le jeu
  onGameInit: null,
  onStateUpdate: null,
  onPlayerJoined: null,

  init(config) {
    this.gameId = config.gameId;
    this.gameTitle = config.gameTitle;
    this.rulesHtml = config.rulesHtml || '<p>Aucune règle renseignée.</p>';
    this.onGameInit = config.onGameInit;
    this.onStateUpdate = config.onStateUpdate;
    this.onPlayerJoined = config.onPlayerJoined;

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

      document.getElementById('shellUserNick').textContent = this.currentUser.nickname;
      this.setupPresence();
      this.listenOnlineUsers();
      this.listenInvitations();
      this.listenChat();

      // Vérifier si un code de salle est présent dans l'URL (#room=CODE)
      const hash = window.location.hash;
      const match = hash.match(/room=([A-Z0-9]{4})/i);
      if (match) {
        document.getElementById('shellInputRoomCode').value = match[1].toUpperCase();
        this.joinRoom(match[1].toUpperCase());
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

  /* ---------------- BARRE SUPÉRIEURE & INTERFACE ---------------- */
  buildShellDom() {
    const shellHtml = `
      <!-- TOPBAR RETRACTABLE -->
      <header id="shellTopBar" class="fixed top-0 left-0 right-0 z-40 bg-[#121526] border-b-[3px] border-[#12131a] text-white transition-transform duration-300">
        <div class="max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
          
          <div class="flex items-center gap-3">
            <a href="/" class="neo-btn bg-white text-[#12131a] px-3 py-1 rounded-xl text-xs flex items-center gap-1 font-black">
              <span>←</span>
              <span class="hidden sm:inline">Retour</span>
            </a>
            <h1 class="font-black italic tracking-wider text-base text-white uppercase">${this.gameTitle}</h1>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2">
            <button onclick="GameShell.announceGameInChat()" title="Partager dans le chat général" class="neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1">
              <span>📢</span>
              <span class="hidden md:inline">Annoncer ma partie</span>
            </button>

            <button onclick="GameShell.openLeaderboard()" title="Classement général" class="neo-btn bg-white text-[#12131a] w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black">
              🏆
            </button>

            <button onclick="GameShell.toggleUsersDropdown()" id="shellOnlineBadgeBtn" class="neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-[#12131a]"></span>
              <span id="shellOnlineCountText">0 en ligne</span>
            </button>

            <button onclick="GameShell.toggleFullScreen()" title="Plein écran" class="hidden sm:flex neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black">
              ⛶ Plein écran
            </button>

            <button onclick="GameShell.openInNewTab()" title="Ouvrir dans un nouvel onglet" class="hidden sm:flex neo-btn bg-white text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black">
              ↗ Nouvel onglet
            </button>

            <!-- Bouton Masquer la barre -->
            <button onclick="GameShell.toggleBarVisibility()" id="shellBtnToggleBar" title="Masquer la barre" class="neo-btn bg-[#fed72d] text-[#12131a] w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs">
              ▲
            </button>
          </div>
        </div>

        <!-- DROPDOWN UTILISATEURS CONNECTÉS & INVITATION -->
        <div id="shellUsersDropdown" class="hidden absolute right-4 top-16 w-72 bg-white border-[3px] border-[#12131a] rounded-2xl shadow-[4px_5px_0px_#12131a] p-3 text-[#12131a] max-h-80 overflow-y-auto custom-scrollbar z-50">
          <div class="flex items-center justify-between pb-2 mb-2 border-b-2 border-slate-200">
            <span class="text-xs font-black uppercase text-slate-500">Membres connectés</span>
            <span id="shellDropdownTotal" class="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full">0</span>
          </div>
          <div id="shellOnlineUsersList" class="space-y-1.5"></div>
        </div>
      </header>

      <!-- BOUTON REVOIR LA BARRE (quand elle est masquée) -->
      <button id="shellBtnRestoreBar" onclick="GameShell.toggleBarVisibility()" class="hidden fixed top-2 right-4 z-40 neo-btn bg-[#fed72d] text-[#12131a] px-3 py-1 rounded-xl text-xs font-black shadow-lg">
        ▼ Menu
      </button>

      <!-- BULLE CHAT FLOTTANTE (BAS DROITE) -->
      <div class="fixed bottom-4 right-4 z-40 flex flex-col items-end">
        <div id="shellChatBox" class="hidden mb-2 w-80 sm:w-96 h-96 bg-white border-[3px] border-[#12131a] rounded-2xl shadow-[4px_5px_0px_#12131a] flex flex-col overflow-hidden">
          <div class="bg-[#fed72d] p-3 border-b-2 border-[#12131a] flex items-center justify-between">
            <span class="font-black text-xs text-[#12131a] uppercase">💬 QG de la promo</span>
            <button onclick="GameShell.toggleChatBox()" class="font-black text-sm">✕</button>
          </div>
          <div id="shellChatMessages" class="flex-1 p-3 overflow-y-auto space-y-reverse space-y-2 bg-[#f8fafc] flex flex-col-reverse text-xs custom-scrollbar"></div>
          <form onsubmit="GameShell.sendChatMessage(event)" class="p-2 bg-white border-t-2 border-[#12131a] flex gap-1.5">
            <input type="text" id="shellChatInput" placeholder="Écris un mot..." class="flex-1 bg-slate-100 border border-[#12131a] rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none">
            <button type="submit" class="neo-btn bg-[#fed72d] text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black">Envoyer</button>
          </form>
        </div>

        <button onclick="GameShell.toggleChatBox()" class="w-12 h-12 rounded-2xl bg-[#fed72d] border-[3px] border-[#12131a] flex items-center justify-center text-xl shadow-[3px_4px_0px_#12131a] active:translate-x-0.5 active:translate-y-0.5 transition-all">
          💬
        </button>
      </div>

      <!-- POPUP INVITATION PERSISTANTE (EN DIRECT) -->
      <div id="shellInviteToast" class="hidden fixed bottom-4 left-4 z-50 bg-[#fed72d] border-[3px] border-[#12131a] rounded-2xl p-4 shadow-[4px_5px_0px_#12131a] max-w-sm flex items-center justify-between gap-3 animate-bounce">
        <div class="min-w-0">
          <span class="text-xs font-black text-[#12131a] block truncate" id="shellInviteMsg">Invitation</span>
          <span class="text-[10px] font-bold text-slate-700 block">Clique pour rejoindre la salle !</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button id="shellBtnAcceptInvite" class="neo-btn bg-emerald-400 hover:bg-emerald-500 text-[#12131a] px-2.5 py-1.5 rounded-xl text-xs font-black">
            Rejoindre
          </button>
          <button onclick="GameShell.dismissInvite()" class="neo-btn bg-white text-slate-700 px-2 py-1.5 rounded-xl text-xs font-bold">
            ✕
          </button>
        </div>
      </div>

      <!-- MODALE RÈGLES -->
      <div id="shellModalRules" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="neo-box bg-white max-w-md w-full p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b-2 border-[#12131a] mb-4">
            <h3 class="text-lg font-black text-[#12131a] uppercase">📖 Règles du jeu</h3>
            <button onclick="GameShell.closeRules()" class="text-xl font-bold">✕</button>
          </div>
          <div class="text-xs font-bold text-slate-700 leading-relaxed space-y-2">
            ${this.rulesHtml}
          </div>
        </div>
      </div>

      <!-- MODALE CLASSEMENT GÉNÉRAL -->
      <div id="shellModalLeaderboard" class="hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="neo-box bg-white max-w-md w-full p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b-2 border-[#12131a] mb-4">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🏆</span>
              <h3 class="text-lg font-black text-[#12131a] uppercase">${this.gameTitle} : Classement</h3>
            </div>
            <button onclick="GameShell.closeLeaderboard()" class="text-xl font-bold">✕</button>
          </div>
          <div id="shellLeaderboardList" class="space-y-2">
            <p class="text-xs font-bold text-slate-400 text-center py-4">Chargement du palmarès...</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', shellHtml);
  },

  /* ---------------- GESTION DES SALLES (4 LETTRES) ---------------- */
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

    this.roomRef = db.ref(`rooms/${this.gameId}/${code}`);
    await this.roomRef.set({
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
    });

    this.roomRef.onDisconnect().remove();
    this.attachRoomListener();
    window.location.hash = `room=${code}`;
    return code;
  },

  async joinRoom(code) {
    code = code.trim().toUpperCase();
    this.currentRoomCode = code;
    this.roomRef = db.ref(`rooms/${this.gameId}/${code}`);

    const snap = await this.roomRef.once('value');
    if (!snap.exists()) {
      alert("Salle introuvable ! Vérifie le code.");
      return false;
    }

    const data = snap.val();

    // Si on est déjà le joueur X
    if (data.playerX && data.playerX.tag === this.currentUser.tag) {
      this.isHost = true;
      this.myRole = 'X';
    } else {
      // On prend la place du joueur O
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
    return true;
  },

  attachRoomListener() {
    this.roomRef.on('value', snap => {
      const data = snap.val();
      if (!data) return;

      if (this.onPlayerJoined) {
        this.onPlayerJoined(data);
      }
      if (this.onStateUpdate && data.state) {
        this.onStateUpdate(data.state, data);
      }
    });
  },

  updateGameState(newState) {
    if (this.roomRef) {
      this.roomRef.child('state').update(newState);
    }
  },

  /* ---------------- GESTION DES SCORES (/scores/<jeu>/<tag>) ---------------- */
  async recordResult(winnerRole) {
    // winnerRole = 'X', 'O' ou 'draw'
    const snap = await this.roomRef.once('value');
    const room = snap.val();
    if (!room || !room.playerX || !room.playerO) return;

    const playerX = room.playerX;
    const playerO = room.playerO;

    if (winnerRole === 'draw') {
      this.incrementScore(playerX, 'draws');
      this.incrementScore(playerO, 'draws');
    } else if (winnerRole === 'X') {
      this.incrementScore(playerX, 'wins');
      this.incrementScore(playerO, 'losses');
    } else if (winnerRole === 'O') {
      this.incrementScore(playerO, 'wins');
      this.incrementScore(playerX, 'losses');
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

  /* ---------------- INVITATIONS EN DIRECT ---------------- */
  async sendDirectInvite(targetTag) {
    if (!this.currentRoomCode) {
      alert("Crée d'abord ta salle avant d'inviter un pote !");
      return;
    }

    await db.ref(`invitations/${targetTag}`).set({
      fromTag: this.currentUser.tag,
      fromNick: this.currentUser.nickname,
      gameId: this.gameId,
      gameTitle: this.gameTitle,
      roomCode: this.currentRoomCode,
      timestamp: Date.now()
    });

    alert(`Invitation envoyée à @${targetTag} !`);
  },

  listenInvitations() {
    if (!this.currentUser) return;
    db.ref(`invitations/${this.currentUser.tag}`).on('value', snap => {
      const inv = snap.val();
      const toast = document.getElementById('shellInviteToast');
      if (!inv) {
        toast.classList.add('hidden');
        return;
      }

      document.getElementById('shellInviteMsg').textContent = `${inv.fromNick} t'invite à jouer à ${inv.gameTitle} !`;
      document.getElementById('shellBtnAcceptInvite').onclick = () => {
        window.location.hash = `room=${inv.roomCode}`;
        this.joinRoom(inv.roomCode);
        this.dismissInvite();
      };
      toast.classList.remove('hidden');
    });
  },

  dismissInvite() {
    if (this.currentUser) {
      db.ref(`invitations/${this.currentUser.tag}`).remove();
    }
  },

  /* ---------------- PALMARÈS & MODALE ---------------- */
  openLeaderboard() {
    const modal = document.getElementById('shellModalLeaderboard');
    const container = document.getElementById('shellLeaderboardList');
    modal.classList.remove('hidden');

    db.ref(`scores/${this.gameId}`).once('value', snap => {
      const data = snap.val() || {};
      const list = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0));

      if (list.length === 0) {
        container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-4">Aucune partie enregistrée.</p>`;
        return;
      }

      container.innerHTML = list.map((p, idx) => `
        <div class="neo-box-sm bg-slate-50 p-2.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="font-black text-xs w-4 text-center">${idx + 1}.</span>
            <span class="w-8 h-8 rounded-lg bg-white border border-[#12131a] flex items-center justify-center text-sm shadow-[1px_1px_0px_#12131a]">
              ${p.avatarEmoji || '🍺'}
            </span>
            <div>
              <div class="text-xs font-black text-[#12131a]">${p.nickname}</div>
              <div class="text-[9px] font-mono text-slate-400">@${p.tag}</div>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-black text-[#12131a]">${p.wins || 0} victoire${(p.wins || 0) > 1 ? 's' : ''}</span>
          </div>
        </div>
      `).join('');
    });
  },

  closeLeaderboard() {
    document.getElementById('shellModalLeaderboard').classList.add('hidden');
  },

  /* ---------------- CONNECTÉS & CHAT GÉNÉRAL ---------------- */
  listenOnlineUsers() {
    db.ref('presence').on('value', snap => {
      const online = snap.val() || {};
      const list = Object.values(online);
      document.getElementById('shellOnlineCountText').textContent = `${list.length} en ligne`;
      document.getElementById('shellDropdownTotal').textContent = list.length;

      const container = document.getElementById('shellOnlineUsersList');
      container.innerHTML = list.map(u => {
        const isMe = this.currentUser && this.currentUser.tag === u.tag;
        return `
          <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 border border-slate-100">
            <div class="min-w-0 flex items-center gap-1.5">
              <span>${u.avatarEmoji || '🍺'}</span>
              <div class="truncate">
                <span class="text-xs font-black truncate block">${u.nickname}</span>
                <span class="text-[9px] text-slate-400 truncate block">${u.currentGame ? 'Sur ' + u.currentGame : 'En ligne'}</span>
              </div>
            </div>
            ${!isMe ? `
              <button onclick="GameShell.sendDirectInvite('${u.tag}')" class="neo-btn bg-[#fed72d] text-[#12131a] px-2 py-0.5 rounded-lg text-[10px] font-black">
                Inviter
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
    });
  },

  toggleUsersDropdown() {
    document.getElementById('shellUsersDropdown').classList.toggle('hidden');
  },

  listenChat() {
    db.ref('chat').limitToLast(30).on('value', snap => {
      const data = snap.val() || {};
      const msgs = Object.values(data).reverse();
      const container = document.getElementById('shellChatMessages');
      container.innerHTML = msgs.map(m => `
        <div class="bg-white p-2 rounded-xl border border-[#12131a]">
          <div class="flex justify-between items-center mb-0.5">
            <span class="font-black text-[10px]">${m.authorNick}</span>
            <span class="font-mono text-[9px] text-slate-400">${m.time}</span>
          </div>
          <p class="font-bold text-slate-800 break-words leading-tight">${m.text}</p>
        </div>
      `).join('');
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
      isInvite: false,
      text: text,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });
    input.value = '';
  },

  announceGameInChat() {
    if (!this.currentRoomCode || !this.currentUser) {
      alert("Crée d'abord une salle !");
      return;
    }
    db.ref('chat').push({
      authorNick: this.currentUser.nickname,
      authorTag: this.currentUser.tag,
      authorAvatar: this.currentUser.avatarEmoji || '🍺',
      isInvite: true,
      gameTitle: this.gameTitle,
      internalGame: this.gameId,
      internalRoom: this.currentRoomCode,
      text: `@promo Je lance une partie de ${this.gameTitle} ! Rejoins avec le code : ${this.currentRoomCode}`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });
    alert("Partie annoncée dans le chat général !");
  },

  toggleChatBox() {
    document.getElementById('shellChatBox').classList.toggle('hidden');
  },

  /* ---------------- OUTILS NAVIGATEUR ---------------- */
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
  }
};

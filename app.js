/* =========================================================
   FIREBASE CONFIGURATION
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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const ADMIN_EMAILS = ['sayaralex@gmail.com'];
const STORAGE_FAVS = 'imb_favs_v4';
const STORAGE_RECENTS = 'imb_recent_internal_games';

const AVATAR_EMOJIS = ['🍺', '🍷', '👑', '🗿', '🎆', '💩', '🎲', '⚡'];
const FLAG_EMOJIS = [
  '🇫🇷', '🇮🇹', '🇵🇱', '🇫🇮', '🇸🇮', '🇷🇸',
  '🇺🇸', '🇨🇦',
  '🇯🇵', '🇹🇭', '🇮🇳'
];

/* Répertoire des Jeux IMB (Internes) */
const INTERNAL_GAMES = {
  casino: {
    id: 'casino',
    title: 'IMB Casino',
    icon: '🎰',
    bg: '#059669',
    path: '/games/casino/index.html'
  },
  'pile-poil': {
    id: 'pile-poil',
    title: 'Pile Poil',
    icon: '🥞',
    bg: '#ff4f6d',
    path: '/games/pile-poil/index.html'
  },
  morpion: {
    id: 'morpion',
    title: 'Morpion',
    icon: '⭕',
    bg: '#ffd166',
    path: '/games/morpion/index.html'
  },
  skyjo: {
    id: 'skyjo',
    title: 'Skyjo',
    icon: '🃏',
    bg: '#3fd0ff',
    path: '/games/skyjo/index.html'
  },
  'flappy-giroud': {
    id: 'flappy-giroud',
    title: 'Flappy Giroud',
    icon: '⚽',
    bg: '#fed72d',
    path: '/games/flappy-giroud/index.html'
  },
  undercover: {
    id: 'undercover',
    title: "L'Imposteur",
    icon: '🕵️‍♂️',
    bg: '#00e599',
    path: '/games/undercover/'
  }
};

const GAMES_CATALOG = [
  {
    id: 'codenames',
    title: 'Codenames',
    domain: 'codenames.game',
    desc: 'Deux équipes, des mots, des indices. Trouve les espions sans toucher l’assassin !',
    bgTop: '#c4b5fd',
    icon: '🕵️‍♂️',
    officialUrl: 'https://codenames.game/'
  },
  {
    id: 'gartic',
    title: 'Gartic Phone',
    domain: 'garticphone.com',
    desc: 'Le téléphone arabe en dessins. Fous rires garantis à chaque révélation !',
    bgTop: '#fde047',
    icon: '📞',
    officialUrl: 'https://garticphone.com/fr'
  },
  {
    id: 'meme',
    title: 'Make It Meme',
    domain: 'makeitmeme.com',
    desc: 'Crée le meme le plus drôle avec l’image donnée et fais voter tes camarades.',
    bgTop: '#6ee7b7',
    icon: '😂',
    officialUrl: 'https://makeitmeme.com/'
  },
  {
    id: 'skribbl',
    title: 'Skribbl.io',
    domain: 'skribbl.io',
    desc: 'Devine ce que dessinent tes potes en direct et sois le plus rapide à taper la réponse !',
    bgTop: '#93c5fd',
    icon: '✏️',
    officialUrl: 'https://skribbl.io'
  },
  {
    id: 'popsauce',
    title: 'Pop Sauce',
    domain: 'jklm.fun',
    desc: 'Le grand quiz pop-culture : films, musiques, jeux vidéo, logos. Sois le plus rapide !',
    bgTop: '#fca5a5',
    icon: '🍿',
    officialUrl: 'https://jklm.fun'
  },
  {
    id: 'bombparty',
    title: 'Bomb Party',
    domain: 'jklm.fun',
    desc: 'Trouve un mot contenant la syllabe avant que la bombe n’explose dans tes mains !',
    bgTop: '#fdba74',
    icon: '💣',
    officialUrl: 'https://jklm.fun'
  },
  {
    id: 'wolfy',
    title: 'Loup-Garou (Wolfy)',
    domain: 'wolfy.net',
    desc: 'Incarne un villageois ou un loup-garou. Débats, manipule et élimine tes suspects.',
    bgTop: '#cbd5e1',
    icon: '🐺',
    officialUrl: 'https://wolfy.net/fr'
  },
  {
    id: 'petitbac',
    title: 'Petit Bac',
    domain: 'petitbac.net',
    desc: 'Une lettre, plusieurs catégories (Pays, Métier, Plat...). Remplis ta grille en premier !',
    bgTop: '#86efac',
    icon: '📝',
    officialUrl: 'https://petitbac.net/new-game.xhtml'
  },
  {
    id: 'geoguessr',
    title: 'GeoGuessr',
    domain: 'geoguessr.com',
    desc: 'Largué n’importe où dans le monde sur Google Street View : devine où tu te trouves !',
    bgTop: '#a5f3fc',
    icon: '🌍',
    officialUrl: 'https://www.geoguessr.com/'
  }
];

let currentUser = null;
let userListenerRef = null;
let isRegisteringProcess = false;

let selectedAvatarReg = '🍺';
let selectedFlagReg = '🇫🇷';
let selectedAvatarEdit = '🍺';
let selectedFlagEdit = '🇫🇷';
let currentFilter = 'all';
let activeExternalGame = null;

let allUsersMap = {};
let onlinePresenceMap = {};
let initialChatTimestamp = Date.now();
let lastNotifiedMsgKey = null;

/* Données du classement modale */
let lobbyLeaderboardData = [];
let isLobbyLeaderboardExpanded = false;
let currentLeaderboardGameId = null;

/* ---------------- DÉMARRAGE ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  renderPickers();
  renderGamesCatalog();
  renderRecentGames();

  // Fermer le menu déroulant des connectés en cliquant ailleurs
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('lobbyUsersDropdown');
    const btn = document.getElementById('navOnlineBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  auth.onAuthStateChanged(async (firebaseUser) => {
    if (isRegisteringProcess) return;
    await loadAuthenticatedUser(firebaseUser);
  });
});

/* ---------------- GESTION DE LA SESSION UTILISATEUR ---------------- */
async function loadAuthenticatedUser(firebaseUser) {
  const authOverlay = document.getElementById('authOverlay');
  const verifyEmailOverlay = document.getElementById('verifyEmailOverlay');
  const pendingOverlay = document.getElementById('pendingOverlay');
  const rejectedOverlay = document.getElementById('rejectedOverlay');

  if (!firebaseUser) {
    if (userListenerRef) {
      userListenerRef.off();
      userListenerRef = null;
    }
    currentUser = null;
    authOverlay.classList.remove('hidden');
    verifyEmailOverlay.classList.add('hidden');
    pendingOverlay.classList.add('hidden');
    rejectedOverlay.classList.add('hidden');
    document.getElementById('navAdminBtn').classList.add('hidden');
    return;
  }

  const snap = await db.ref(`users/${firebaseUser.uid}`).once('value');
  if (!snap.exists()) {
    const isGoogle = firebaseUser.providerData.some(p => p.providerId === 'google.com');
    if (isGoogle) {
      switchAuthTab('register');
      const regNick = document.getElementById('regNickname');
      if (regNick && !regNick.value && firebaseUser.displayName) {
        regNick.value = firebaseUser.displayName;
      }
      showAuthError("Choisis ton pseudo et ton @tag puis clique sur « Créer mon compte avec Google ».");
      return;
    }
    await auth.signOut();
    showAuthError("Aucun compte trouvé. Veuillez d'abord vous inscrire.");
    return;
  }

  if (userListenerRef) userListenerRef.off();
  userListenerRef = db.ref(`users/${firebaseUser.uid}`);
  
  userListenerRef.on('value', async (userSnap) => {
    const userData = userSnap.val();
    if (!userData) {
      await auth.signOut();
      return;
    }

    currentUser = userData;

    const isGoogle = firebaseUser.providerData.some(p => p.providerId === 'google.com');
    if (!isGoogle && !firebaseUser.emailVerified) {
      authOverlay.classList.add('hidden');
      pendingOverlay.classList.add('hidden');
      rejectedOverlay.classList.add('hidden');
      document.getElementById('verifyUserEmail').textContent = firebaseUser.email;
      verifyEmailOverlay.classList.remove('hidden');
      return;
    }

    verifyEmailOverlay.classList.add('hidden');

    if (currentUser.status === 'rejected') {
      authOverlay.classList.add('hidden');
      pendingOverlay.classList.add('hidden');
      document.getElementById('rejectedUserNick').textContent = currentUser.nickname;
      rejectedOverlay.classList.remove('hidden');
      return;
    }

    if (currentUser.status === 'pending') {
      authOverlay.classList.add('hidden');
      rejectedOverlay.classList.add('hidden');
      document.getElementById('pendingUserNick').textContent = currentUser.nickname;
      document.getElementById('pendingUserTag').textContent = `@${currentUser.tag}`;
      pendingOverlay.classList.remove('hidden');
      return;
    }

    authOverlay.classList.add('hidden');
    pendingOverlay.classList.add('hidden');
    rejectedOverlay.classList.add('hidden');

    updateUserUI();
    setupMyRealtimePresence();
    listenToUsersAndPresence();
    listenToLiveChat();
    listenToUndercoverLiveActivity();
    renderRecentGames();
    
    // Top 3 Cartes & Salles Actives
    loadCasinoTop3Card();
    loadPilePoilTop3Card();
    loadMorpionTop3Card();
    checkLobbyMorpionActiveRoom();
    loadSkyjoTop3Card();
    checkLobbySkyjoActiveRoom();
    loadFlappyGiroudTop3Card();
    checkLobbyFlappyGiroudActiveRoom();
    
    listenLobbyInvitations();

    if (currentUser.role === 'admin') {
      setupAdminWatcher();
    }
  });
}

function updateUserUI() {
  if (!currentUser) return;
  document.getElementById('navUserPseudo').textContent = currentUser.nickname;
  document.getElementById('navUserTag').textContent = `@${currentUser.tag}`;
  document.getElementById('navUserEmojis').textContent = `${currentUser.avatarEmoji || '🍺'} ${currentUser.flagEmoji || '🇫🇷'}`;
  document.getElementById('heroGreeting').textContent = `SALUT ${currentUser.nickname} !`;
}

/* =========================================================
   GESTION DU MENU REPRENDRE
   ========================================================= */
function trackGameLaunch(gameId) {
  if (!INTERNAL_GAMES[gameId]) return;

  let recents = JSON.parse(localStorage.getItem(STORAGE_RECENTS) || '[]');
  recents = recents.filter(item => item.id !== gameId);
  recents.unshift({
    id: gameId,
    timestamp: Date.now()
  });

  localStorage.setItem(STORAGE_RECENTS, JSON.stringify(recents.slice(0, 6)));
}

function formatRelativeTime(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Joué à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Joué il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Joué il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  const diffDays = Math.floor(diffHours / 24);
  return `Joué il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
}

function renderRecentGames() {
  const container = document.getElementById('recentGamesContainer');
  const section = document.getElementById('sectionReprendre');
  if (!container || !section) return;

  const recents = JSON.parse(localStorage.getItem(STORAGE_RECENTS) || '[]');
  const validRecents = recents.filter(r => INTERNAL_GAMES[r.id]);

  if (validRecents.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = validRecents.map(item => {
    const game = INTERNAL_GAMES[item.id];
    const timeLabel = formatRelativeTime(item.timestamp);
    
    const activeRoom = localStorage.getItem(`imb_active_room_${game.id}`);
    const hasValidRoom = activeRoom && activeRoom.length >= 4 && game.id !== 'casino' && game.id !== 'pile-poil';
    const targetUrl = hasValidRoom 
      ? `${game.path}#room=${activeRoom}` 
      : game.path;

    const labelAction = hasValidRoom
      ? `Reprendre (${activeRoom})`
      : 'Reprendre';

    return `
      <a href="${targetUrl}" onclick="trackGameLaunch('${game.id}')" class="flex-shrink-0 bg-white border-[3px] border-[#12131a] rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 shadow-[3px_4px_0px_#12131a] hover:-translate-y-1 hover:shadow-[4px_6px_0px_#12131a] transition-all min-w-[210px] sm:min-w-[240px]">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 border-[#12131a] flex-shrink-0 shadow-[1px_2px_0px_#12131a]" style="background-color: ${game.bg};">
          ${game.icon}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="font-black text-sm text-[#12131a] truncate leading-tight">${game.title}</h4>
          <span class="text-[11px] font-bold text-slate-500 block mt-0.5 truncate">${labelAction} · ${timeLabel}</span>
        </div>
      </a>
    `;
  }).join('');
}

/* ---------------- GESTION DES SALLES ACTIVES SUR LES CARTES ---------------- */
function checkLobbyMorpionActiveRoom() {
  const activeRoom = localStorage.getItem('imb_active_room_morpion');
  const badge = document.getElementById('morpionActiveRoomBadge');
  if (badge) {
    if (activeRoom && activeRoom.length >= 4) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
}

function checkLobbySkyjoActiveRoom() {
  const activeRoom = localStorage.getItem('imb_active_room_skyjo');
  const badge = document.getElementById('skyjoActiveRoomBadge');
  if (badge) {
    if (activeRoom && activeRoom.length >= 4) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
}

function checkLobbyFlappyGiroudActiveRoom() {
  const activeRoom = localStorage.getItem('imb_active_room_flappy-giroud');
  const badge = document.getElementById('flappyActiveRoomBadge');
  if (badge) {
    if (activeRoom) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
}

/* ---------------- TRI OFFICIEL DU CASINO ---------------- */
function sortCasinoPlayersLobby(a, b) {
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

/* ---------------- TOP 3 DES CARTES ---------------- */
function loadCasinoTop3Card() {
  const container = document.getElementById('casinoTop3Box');
  if (!container) return;
  db.ref('casino/users').on('value', snap => {
    const data = snap.val() || {};
    const allSorted = Object.values(data).sort(sortCasinoPlayersLobby);
    const top3 = allSorted.slice(0, 3);

    if (top3.length === 0) {
      container.innerHTML = `<div class="text-[10px] font-bold text-slate-400 italic text-center py-1">Aucune fortune enregistrée. Prends tes 1 000 $ !</div>`;
      return;
    }

    const medals = ['👑', '🥈', '🥉'];
    container.innerHTML = top3.map((p, idx) => {
      const tok = Number(p.tokens ?? p.tokensUsed ?? 0);
      return `
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm">${medals[idx]}</span>
            <span class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="bg-[#065f46] text-white px-2 py-0.5 rounded-full font-mono text-[9px] font-black">
              ${Number(p.balance ?? 0).toLocaleString('fr-FR')} $
            </span>
            <span class="text-[9px] font-mono font-bold text-slate-500" title="Tokens utilisés">
              (${tok}🪙)
            </span>
          </div>
        </div>
      `;
    }).join('') + `
      <div class="text-right pt-1 border-t border-emerald-200/80">
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); openLobbyLeaderboard('casino', 'IMB Casino');" class="text-[10px] font-black text-emerald-900 hover:underline">Classement des fortunes ></button>
      </div>
    `;
  });
}

function loadPilePoilTop3Card() {
  const container = document.getElementById('pilePoilTop3Box');
  if (!container) return;
  db.ref('scores/pile-poil').on('value', snap => {
    const data = snap.val() || {};
    const sorted = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 3);
    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-[10px] font-bold text-slate-400 italic text-center py-1">Aucun record. Sois le premier !</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((p, idx) => `
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm">${medals[idx]}</span>
          <span class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</span>
        </div>
        <span class="bg-[#121526] text-[#fed72d] px-2 py-0.5 rounded-full font-mono text-[9px] font-black flex-shrink-0 border border-[#fed72d]">
          ${p.wins || 0} étage${(p.wins || 0) > 1 ? 's' : ''}
        </span>
      </div>
    `).join('') + `
      <div class="text-right pt-1 border-t border-amber-200/60">
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); openLobbyLeaderboard('pile-poil', 'Pile Poil');" class="text-[10px] font-black text-amber-900 hover:underline">Classement ></button>
      </div>
    `;
  });
}

function loadMorpionTop3Card() {
  const container = document.getElementById('morpionTop3Box');
  if (!container) return;
  db.ref('scores/morpion').on('value', snap => {
    const data = snap.val() || {};
    const sorted = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 3);
    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-[10px] font-bold text-slate-400 italic text-center py-1">Aucune victoire enregistrée. Sois le premier !</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((p, idx) => `
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm">${medals[idx]}</span>
          <span class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</span>
        </div>
        <span class="bg-[#121526] text-white px-2 py-0.5 rounded-full font-mono text-[9px] font-black flex-shrink-0">
          ${p.wins || 0} victoire${(p.wins || 0) > 1 ? 's' : ''}
        </span>
      </div>
    `).join('') + `
      <div class="text-right pt-1 border-t border-amber-200/60">
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); openLobbyLeaderboard('morpion', 'Morpion');" class="text-[10px] font-black text-amber-900 hover:underline">Classement ></button>
      </div>
    `;
  });
}

function loadSkyjoTop3Card() {
  const container = document.getElementById('skyjoTop3Box');
  if (!container) return;
  db.ref('scores/skyjo').on('value', snap => {
    const data = snap.val() || {};
    const sorted = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 3);
    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-[10px] font-bold text-slate-400 italic text-center py-1">Aucune victoire enregistrée. Sois le premier !</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((p, idx) => `
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm">${medals[idx]}</span>
          <span class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</span>
        </div>
        <span class="bg-[#121526] text-white px-2 py-0.5 rounded-full font-mono text-[9px] font-black flex-shrink-0">
          ${p.wins || 0} victoire${(p.wins || 0) > 1 ? 's' : ''}
        </span>
      </div>
    `).join('') + `
      <div class="text-right pt-1 border-t border-amber-200/60">
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); openLobbyLeaderboard('skyjo', 'Skyjo');" class="text-[10px] font-black text-amber-900 hover:underline">Classement ></button>
      </div>
    `;
  });
}

function loadFlappyGiroudTop3Card() {
  const container = document.getElementById('flappyTop3Box');
  if (!container) return;
  db.ref('scores/flappy-giroud').on('value', snap => {
    const data = snap.val() || {};
    const sorted = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 3);
    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-[10px] font-bold text-slate-400 italic text-center py-1">Aucun record. Sois le premier !</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((p, idx) => `
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm">${medals[idx]}</span>
          <span class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</span>
        </div>
        <span class="bg-[#121526] text-[#fed72d] px-2 py-0.5 rounded-full font-mono text-[9px] font-black flex-shrink-0 border border-[#fed72d]">
          ${p.wins || 0} pts
        </span>
      </div>
    `).join('') + `
      <div class="text-right pt-1 border-t border-amber-200/60">
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); openLobbyLeaderboard('flappy-giroud', 'Flappy Giroud');" class="text-[10px] font-black text-amber-900 hover:underline">Classement ></button>
      </div>
    `;
  });
}

/* =========================================================
   MODALE DU CLASSEMENT COMPLET SUR LE LOBBY
   ========================================================= */
function openLobbyLeaderboard(gameId, gameTitle) {
  currentLeaderboardGameId = gameId;
  const modal = document.getElementById('modalLobbyLeaderboard');
  const titleEl = document.getElementById('modalLeaderboardGameTitle');
  const subEl = document.getElementById('modalLeaderboardSubtitle');
  if (titleEl) titleEl.textContent = `${gameTitle} : Classement`;
  if (subEl) {
    subEl.textContent = gameId === 'casino'
      ? 'Trié par Solde ($) › Moins de Dette › Moins de Tokens'
      : 'Palmarès global';
  }
  modal.classList.remove('hidden');
  isLobbyLeaderboardExpanded = false;

  if (gameId === 'casino') {
    db.ref('casino/users').once('value', snap => {
      const data = snap.val() || {};
      lobbyLeaderboardData = Object.values(data).sort(sortCasinoPlayersLobby);
      renderLobbyLeaderboardRows();
    });
    return;
  }

  db.ref(`scores/${gameId}`).once('value', snap => {
    const data = snap.val() || {};
    lobbyLeaderboardData = Object.values(data).sort((a, b) => (b.wins || 0) - (a.wins || 0));
    renderLobbyLeaderboardRows();
  });
}

function renderLobbyLeaderboardRows() {
  const container = document.getElementById('modalLeaderboardList');
  const expandWrapper = document.getElementById('modalLeaderboardExpandWrapper');
  const btnExpand = document.getElementById('modalBtnExpandLeaderboard');
  const isCasino = currentLeaderboardGameId === 'casino';
  const totalPlayers = lobbyLeaderboardData.length;

  if (totalPlayers === 0) {
    container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-4">Aucune donnée enregistrée.</p>`;
    expandWrapper.classList.add('hidden');
    return;
  }

  const listToDisplay = isLobbyLeaderboardExpanded 
    ? lobbyLeaderboardData 
    : lobbyLeaderboardData.slice(0, 5);

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

    const tok = Number(p.tokens ?? p.tokensUsed ?? 0);
    const debt = Number(p.debt ?? 0);
    const unitLabel = currentLeaderboardGameId === 'flappy-giroud'
      ? 'pts'
      : (currentLeaderboardGameId === 'pile-poil'
          ? 'étage' + ((p.wins || 0) > 1 ? 's' : '')
          : 'victoire' + ((p.wins || 0) > 1 ? 's' : ''));

    const scoreColumnHtml = isCasino
      ? `
        <div class="text-right flex-shrink-0">
          <div class="text-xs font-black text-[#065f46] font-mono">${Number(p.balance ?? 0).toLocaleString('fr-FR')} $</div>
          <div class="text-[10px] font-mono font-bold ${debt > 0 ? 'text-rose-600' : 'text-slate-500'}">Dette : ${debt.toLocaleString('fr-FR')} $ · 🪙 ${tok}</div>
        </div>
      `
      : `
        <div class="text-right flex-shrink-0">
          <span class="text-xs font-black text-[#12131a]">${p.wins || 0} ${unitLabel}</span>
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
            <div class="text-xs font-black text-[#12131a] truncate">${escapeHtml(p.nickname)}</div>
            <div class="text-[9px] font-mono text-slate-500 truncate">@${escapeHtml(p.tag)}</div>
          </div>
        </div>
        ${scoreColumnHtml}
      </div>
    `;
  }).join('');

  if (totalPlayers > 5) {
    expandWrapper.classList.remove('hidden');
    btnExpand.textContent = isLobbyLeaderboardExpanded 
      ? "Réduire au Top 5 ▲" 
      : `Voir le classement complet (${totalPlayers} joueurs) ▼`;
  } else {
    expandWrapper.classList.add('hidden');
  }
}

function toggleLobbyLeaderboardExpand() {
  isLobbyLeaderboardExpanded = !isLobbyLeaderboardExpanded;
  renderLobbyLeaderboardRows();
}

function closeLobbyLeaderboard() {
  document.getElementById('modalLobbyLeaderboard').classList.add('hidden');
}

/* =========================================================
   CHAT FLOTTANT DU LOBBY (IDENTIQUE AU SHELL)
   ========================================================= */
function toggleLobbyChatBox() {
  document.getElementById('lobbyChatBox').classList.toggle('hidden');
}

function openLobbyChatBox() {
  document.getElementById('lobbyChatBox').classList.remove('hidden');
}

function listenToLiveChat() {
  const container = document.getElementById('chatMessagesContainer');
  db.ref('chat').limitToLast(40).on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-8">Aucun message pour le moment.</p>`;
      return;
    }

    const messages = Object.values(data).reverse();
    container.innerHTML = messages.map(m => {
      if (m.isSystem) {
        return `
          <div class="text-center py-1">
            <span class="text-[9px] font-mono font-bold bg-[#edf0f8] border border-[#12131a] px-2 py-0.5 rounded-full">${escapeHtml(m.text)}</span>
          </div>
        `;
      }

      const mentionedMe = isUserMentionedInText(m.text);

      if (m.isInvite) {
        const hasSpecificRoom = m.internalRoom && m.internalRoom !== 'CASINO';
        const btnLabel = hasSpecificRoom
          ? `Rejoindre la salle ${escapeHtml(safeRoomCode(m.internalRoom))} ➔`
          : `Rejoindre ${escapeHtml(m.gameTitle)} 🎰`;

        return `
          <div class="neo-box bg-[#fed72d] p-2.5 text-[#12131a] space-y-1.5 ${mentionedMe ? 'ring-2 ring-rose-500' : ''}">
            <div class="flex items-center justify-between text-[11px] font-black">
              <span>${m.authorAvatar || '🍺'} ${escapeHtml(m.authorNick)}</span>
              <span class="text-[9px] font-mono text-slate-700">${m.time}</span>
            </div>

            <div class="bg-white border-2 border-[#12131a] p-2 rounded-xl text-xs shadow-[2px_2px_0px_#12131a]">
              <div class="font-black text-[11px] mb-1">🎮 ${escapeHtml(m.gameTitle)}</div>
              <p class="text-[10px] font-bold text-slate-700 italic mb-2">« ${formatChatMessageWithMentions(m.text)} »</p>
              ${m.internalGame ? `
              <button type="button" onclick="openInternalInvite('${safeRoomCode(m.internalGame)}', '${safeRoomCode(m.internalRoom || 'CASINO')}')" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-1.5 rounded-lg text-xs font-black">
                ${btnLabel}
              </button>` : `
              <a href="${m.roomUrl}" target="_blank" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-1.5 rounded-lg text-xs font-black block text-center">
                Rejoindre la partie ↗
              </a>`}
            </div>
          </div>
        `;
      }

      return `
        <div class="neo-box-sm bg-white p-2.5 ${mentionedMe ? 'ping-message-card' : ''}">
          <div class="flex items-center justify-between mb-1">
            <span onclick="mentionUserInChat('${escapeHtml(m.authorTag)}')" class="cursor-pointer text-xs font-black text-[#12131a] flex items-center gap-1.5 hover:underline">
              <span>${m.authorAvatar || '🍺'}</span>
              <span>${escapeHtml(m.authorNick)}</span>
              <span class="text-[9px] font-mono text-slate-400">@${escapeHtml(m.authorTag)}</span>
            </span>
            <span class="text-[9px] font-mono font-bold text-slate-400">${m.time}</span>
          </div>
          <p class="text-xs font-bold text-slate-800 break-words leading-relaxed">${formatChatMessageWithMentions(m.text)}</p>
        </div>
      `;
    }).join('');
  });
}

function handleSendChatMessage(e) {
  e.preventDefault();
  if (!currentUser) return;
  const input = document.getElementById('chatInputMessage');
  const text = input.value.trim();
  if (!text) return;

  db.ref('chat').push({
    authorNick: currentUser.nickname,
    authorTag: currentUser.tag,
    authorAvatar: currentUser.avatarEmoji || '🍺',
    authorFlag: currentUser.flagEmoji || '🇫🇷',
    isInvite: false,
    text: text,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now()
  });

  input.value = '';
  hideMentionAutocomplete();
}

function mentionUserInChat(tag) {
  openLobbyChatBox();
  const input = document.getElementById('chatInputMessage');
  const currentVal = input.value;
  const prefix = currentVal && !currentVal.endsWith(' ') ? currentVal + ' ' : currentVal;
  input.value = `${prefix}@${tag} `;
  input.focus();
  hideMentionAutocomplete();
}

function handleChatInputKey(e) {
  const input = e.target;
  const val = input.value;
  const cursor = input.selectionStart || val.length;
  const textBeforeCursor = val.slice(0, cursor);

  const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) {
    hideMentionAutocomplete();
    return;
  }

  const query = match[1].toLowerCase();
  const candidates = [
    { tag: 'promo', nickname: 'Toute la promo', avatarEmoji: '📢' }
  ];

  Object.values(allUsersMap).filter(u => u && u.status === 'approved').forEach(u => {
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
    hideMentionAutocomplete();
    return;
  }

  const box = document.getElementById('mentionAutocompleteBox');
  box.innerHTML = filtered.map(c => `
    <button type="button" onclick="selectMentionAutocomplete('${escapeHtml(c.tag)}')" class="w-full px-2.5 py-1.5 text-left hover:bg-[#fffdf0] flex items-center justify-between text-xs">
      <span class="font-black text-[#12131a] flex items-center gap-1.5">
        <span>${c.avatarEmoji}</span>
        <span>${escapeHtml(c.nickname)}</span>
        <span class="font-mono text-[9px] text-slate-500">@${escapeHtml(c.tag)}</span>
      </span>
    </button>
  `).join('');
  box.classList.remove('hidden');
}

function selectMentionAutocomplete(tag) {
  const input = document.getElementById('chatInputMessage');
  const val = input.value;
  const cursor = input.selectionStart || val.length;
  const before = val.slice(0, cursor).replace(/@([a-zA-Z0-9_-]*)$/, `@${tag} `);
  const after = val.slice(cursor);
  input.value = before + after;
  input.focus();
  hideMentionAutocomplete();
}

function hideMentionAutocomplete() {
  const box = document.getElementById('mentionAutocompleteBox');
  if (box) box.classList.add('hidden');
}

function isUserMentionedInText(text) {
  if (!text || !currentUser || !currentUser.tag) return false;
  const regex = new RegExp(`(^|\\s)@(${currentUser.tag}|promo|all)\\b`, 'i');
  return regex.test(text);
}

function formatChatMessageWithMentions(rawText) {
  const safe = escapeHtml(rawText || '');
  return safe.replace(/(^|\s)@([a-zA-Z0-9_-]+)/g, (full, space, tag) => {
    const lower = tag.toLowerCase();
    const isMe = currentUser && currentUser.tag.toLowerCase() === lower;
    const isPromo = lower === 'promo' || lower === 'all';

    if (isMe || isPromo) {
      return `${space}<span onclick="mentionUserInChat('${tag}')" class="cursor-pointer inline-block bg-[#ff2a5f] text-white border border-[#12131a] px-1.5 py-0.2 rounded font-mono text-[10px] font-black shadow-[1px_1px_0px_#12131a]">@${tag}</span>`;
    }
    return `${space}<span onclick="mentionUserInChat('${tag}')" class="cursor-pointer inline-block bg-[#fed72d] text-[#12131a] border border-[#12131a] px-1.5 py-0.2 rounded font-mono text-[10px] font-black">@${tag}</span>`;
  });
}

/* =========================================================
   LISTE DES CONNECTÉS (DROPDOWN SOUS LA NAVBAR)
   ========================================================= */
function toggleLobbyUsersDropdown(e) {
  e.stopPropagation();
  document.getElementById('lobbyUsersDropdown').classList.toggle('hidden');
}

function listenToUsersAndPresence() {
  db.ref('users').on('value', snapshot => {
    allUsersMap = snapshot.val() || {};
    updatePresenceAndDropdown();
  });

  db.ref('presence').on('value', snapshot => {
    onlinePresenceMap = snapshot.val() || {};
    updatePresenceAndDropdown();
  });
}

function updatePresenceAndDropdown() {
  const onlineCount = Object.keys(onlinePresenceMap).length || 1;
  const approvedUsers = Object.values(allUsersMap).filter(u => u && u.status === 'approved');

  document.getElementById('navOnlineCount').textContent = onlineCount;
  document.getElementById('navRegisteredCount').textContent = approvedUsers.length;
  document.getElementById('dropdownOnlineCount').textContent = onlineCount;
  document.getElementById('dropdownTotalCount').textContent = approvedUsers.length;

  const container = document.getElementById('lobbyOnlineUsersList');
  if (!container) return;

  const sortedUsers = approvedUsers.sort((a, b) => {
    const aOnline = Boolean(onlinePresenceMap[a.tag]);
    const bOnline = Boolean(onlinePresenceMap[b.tag]);
    if (aOnline === bOnline) return a.nickname.localeCompare(b.nickname);
    return aOnline ? -1 : 1;
  });

  container.innerHTML = sortedUsers.map(u => {
    const isOnline = Boolean(onlinePresenceMap[u.tag]);
    const presenceInfo = onlinePresenceMap[u.tag];
    const isMe = currentUser && currentUser.tag === u.tag;
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
              <span>${escapeHtml(u.nickname)}</span>
              ${isMe ? '<span class="text-[10px] font-mono text-emerald-700 font-bold">(toi)</span>' : ''}
              ${isAdmin ? '<span class="bg-[#12131a] text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">admin</span>' : ''}
            </div>
            <div class="text-[10px] text-slate-500 truncate font-bold">
              ${statusText}
            </div>
          </div>
        </div>

        ${!isMe ? `
          <button onclick="mentionUserInChat('${u.tag}')" class="neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] px-2.5 py-1 rounded-xl text-[10px] font-black flex-shrink-0">
            @ Ping
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

/* =========================================================
   INVITATIONS EN DIRECT (MAX 3 EN BAS À DROITE)
   ========================================================= */
function listenLobbyInvitations() {
  if (!currentUser) return;
  const stack = document.getElementById('lobbyInviteStack');
  if (!stack) return;

  db.ref(`invitations/${currentUser.tag}`).on('value', snap => {
    const data = snap.val();
    if (!data) {
      stack.innerHTML = '';
      return;
    }

    const allInvites = Object.entries(data).map(([key, val]) => ({ ...val, key }));
    const recentInvites = allInvites.slice(-3);

    stack.innerHTML = recentInvites.map(inv => {
      const hasRoom = inv.roomCode && inv.roomCode !== 'CASINO';
      return `
        <div class="pointer-events-auto bg-[#fed72d] border-[3px] border-[#12131a] rounded-2xl p-3 shadow-[4px_5px_0px_#12131a] flex items-center justify-between gap-2.5 animate-bounce">
          <div class="min-w-0">
            <span class="text-xs font-black text-[#12131a] block truncate">
              ${escapeHtml(inv.fromNick)} t'invite !
            </span>
            <span class="text-[10px] font-bold text-slate-700 block truncate">
              ${escapeHtml(inv.gameTitle)} ${hasRoom ? `(Salon <strong>${inv.roomCode}</strong>)` : ''}
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button onclick="acceptLobbyInvite('${inv.gameId}', '${inv.roomCode}', '${inv.key}')" class="neo-btn bg-[#00e599] hover:bg-[#00c985] text-[#12131a] px-2.5 py-1 rounded-xl text-xs font-black">
              Rejoindre
            </button>
            <button onclick="dismissLobbyInvite('${inv.key}')" class="neo-btn bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-xl text-xs font-bold">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');
  });
}

function acceptLobbyInvite(gameId, roomCode, key) {
  dismissLobbyInvite(key);
  const g = String(gameId || '').toLowerCase();

  if (g === 'casino/roulette' || g === 'casino-roulette' || g === 'roulette') {
    trackGameLaunch('casino');
    const hash = (roomCode && roomCode !== 'CASINO') ? `#room=${roomCode}` : '';
    window.location.href = `/games/casino/roulette/index.html${hash}`;
    return;
  }
  if (g === 'casino/blackjack' || g === 'casino-blackjack' || g === 'blackjack') {
    trackGameLaunch('casino');
    const hash = (roomCode && roomCode !== 'CASINO') ? `#room=${roomCode}` : '';
    window.location.href = `/games/casino/blackjack/index.html${hash}`;
    return;
  }
  if (g === 'casino' || roomCode === 'CASINO') {
    trackGameLaunch('casino');
    window.location.href = `/games/casino/index.html`;
    return;
  }

  trackGameLaunch(gameId);
  window.location.href = `/games/${gameId}/index.html#room=${roomCode}`;
}

function dismissLobbyInvite(key) {
  if (currentUser && key) {
    db.ref(`invitations/${currentUser.tag}/${key}`).remove();
  }
}

function safeRoomCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9/-]/g, '');
}

function openInternalInvite(game, code) {
  if (!currentUser || !code) return;
  const g = String(game || '').toLowerCase();

  if (g === 'casino/roulette' || g === 'casino-roulette' || g === 'roulette' || g === 'casinoroulette') {
    trackGameLaunch('casino');
    const hash = (code && code !== 'CASINO') ? `#room=${code}` : '';
    window.location.href = `/games/casino/roulette/index.html${hash}`;
  } else if (g === 'casino/blackjack' || g === 'casino-blackjack' || g === 'blackjack' || g === 'casinoblackjack') {
    trackGameLaunch('casino');
    const hash = (code && code !== 'CASINO') ? `#room=${code}` : '';
    window.location.href = `/games/casino/blackjack/index.html${hash}`;
  } else if (g === 'casino') {
    trackGameLaunch('casino');
    window.location.href = `/games/casino/index.html`;
  } else if (g === 'morpion') {
    trackGameLaunch('morpion');
    window.location.href = `/games/morpion/index.html#room=${code}`;
  } else if (g === 'skyjo') {
    trackGameLaunch('skyjo');
    window.location.href = `/games/skyjo/index.html#room=${code}`;
  } else if (g === 'imposteur' || g === 'undercover') {
    trackGameLaunch('undercover');
    window.location.href = `/games/undercover/#imposteur=${code}`;
  } else if (INTERNAL_GAMES[g]) {
    trackGameLaunch(g);
    window.location.href = `${INTERNAL_GAMES[g].path}#room=${code}`;
  }
}

/* ---------------- PRÉSENCE ---------------- */
function setupMyRealtimePresence() {
  if (!currentUser || !currentUser.tag) return;
  const myPresenceRef = db.ref(`presence/${currentUser.tag}`);

  db.ref('.info/connected').on('value', snap => {
    if (snap.val() === true && currentUser) {
      myPresenceRef.onDisconnect().remove();
      myPresenceRef.set({
        tag: currentUser.tag,
        nickname: currentUser.nickname,
        avatarEmoji: currentUser.avatarEmoji || '🍺',
        flagEmoji: currentUser.flagEmoji || '🇫🇷',
        currentGame: 'Lobby',
        connectedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  });
}

function listenToUndercoverLiveActivity() {
  const badge = document.getElementById('undercoverLiveBadge');
  db.ref('rooms_imposteur').on('value', snap => {
    const rooms = snap.val() || {};
    let activePlayers = 0;
    Object.values(rooms).forEach(r => {
      if (r && r.players) {
        activePlayers += Object.keys(r.players).length;
      }
    });
    if (activePlayers > 0) {
      badge.textContent = `🟢 ${activePlayers} en mission`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}

/* ---------------- JEU ALÉATOIRE ---------------- */
function pickRandomGame() {
  const externalGames = GAMES_CATALOG.map(g => ({ type: 'external', id: g.id, title: g.title }));
  const internalList = Object.values(INTERNAL_GAMES).map(g => ({ type: 'internal', path: g.path, id: g.id, title: g.title }));
  const allGames = internalList.concat(externalGames);

  const chosen = allGames[Math.floor(Math.random() * allGames.length)];
  showToast(`La roulette a choisi : ${chosen.title} ! 🎲`, '🎰');

  setTimeout(() => {
    if (chosen.type === 'internal') {
      trackGameLaunch(chosen.id);
      window.location.href = chosen.path;
    } else {
      openExternalGameModal(chosen.id);
    }
  }, 650);
}

/* ---------------- CATALOGUE DE JEUX EXTERNES ---------------- */
function renderGamesCatalog() {
  const container = document.getElementById('gamesCatalogGrid');
  const search = document.getElementById('gameSearchInput').value.toLowerCase();
  const favs = JSON.parse(localStorage.getItem(STORAGE_FAVS) || '[]');

  const filtered = GAMES_CATALOG.filter(game => {
    const matchesTag = (currentFilter === 'all') ||
                       (currentFilter === 'externe') ||
                       (currentFilter === 'favoris' && favs.includes(game.id));
    const matchesSearch = game.title.toLowerCase().includes(search) || game.desc.toLowerCase().includes(search);
    return matchesTag && matchesSearch;
  });

  const sectionInternes = document.getElementById('sectionInternes');

  if (currentFilter === 'externe' || currentFilter === 'favoris') {
    sectionInternes.classList.add('hidden');
    container.parentElement.classList.remove('hidden');
  } else if (currentFilter === 'interne') {
    sectionInternes.classList.remove('hidden');
    container.parentElement.classList.add('hidden');
    return;
  } else {
    sectionInternes.classList.remove('hidden');
    container.parentElement.classList.remove('hidden');
  }

  container.innerHTML = filtered.map(game => {
    const isFav = favs.includes(game.id);
    return `
      <div onclick="openExternalGameModal('${game.id}')" class="game-card">
        <div class="w-full h-28 flex items-center justify-center relative border-b-[3px] border-[#12131a]" style="background-color: ${game.bgTop}">
          <span class="text-5xl drop-shadow-[2px_2px_0px_rgba(0,0,0,0.15)]">${game.icon}</span>
          <button onclick="event.stopPropagation(); toggleFavorite('${game.id}')" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white border-2 border-[#12131a] flex items-center justify-center text-xs shadow-[1.5px_2px_0px_#12131a]">
            ${isFav ? '⭐' : '☆'}
          </button>
        </div>
        
        <div class="p-3.5 flex flex-col justify-between flex-1">
          <div>
            <h4 class="text-base font-black text-[#12131a] leading-tight">${game.title}</h4>
            <p class="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2">${game.desc}</p>
          </div>

          <div class="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
            <span class="text-[9px] font-black bg-[#12131a] text-white px-2 py-0.5 rounded-full">Site externe</span>
            <span class="text-[10px] font-mono font-bold text-slate-400 truncate">${game.domain}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setFilter(tag) {
  currentFilter = tag;
  document.querySelectorAll('#filterPillsContainer button').forEach(btn => {
    if (btn.getAttribute('data-tag') === tag) {
      btn.className = 'neo-tag-cartoon bg-[#fed72d] text-[#12131a] px-4 py-2 rounded-full text-xs';
    } else {
      btn.className = 'neo-tag-cartoon bg-white text-[#12131a] px-4 py-2 rounded-full text-xs';
    }
  });
  renderGamesCatalog();
}

function toggleFavorite(gameId) {
  let favs = JSON.parse(localStorage.getItem(STORAGE_FAVS) || '[]');
  if (favs.includes(gameId)) {
    favs = favs.filter(id => id !== gameId);
  } else {
    favs.push(gameId);
  }
  localStorage.setItem(STORAGE_FAVS, JSON.stringify(favs));
  renderGamesCatalog();
  showToast(favs.includes(gameId) ? 'Ajouté aux favoris !' : 'Retiré des favoris', '⭐');
}

function openExternalGameModal(gameId) {
  const game = GAMES_CATALOG.find(g => g.id === gameId);
  if (!game) return;
  activeExternalGame = game;

  document.getElementById('modalGameIcon').textContent = game.icon;
  document.getElementById('modalGameTitle').textContent = game.title;
  document.getElementById('modalGameStep1Desc').textContent = `${game.title} s'ouvre dans un nouvel onglet. Crée la partie, puis colle le lien d'invitation ci-dessous pour que tes camarades te rejoignent.`;
  document.getElementById('modalGameOfficialBtn').href = game.officialUrl;
  document.getElementById('modalGameOfficialText').textContent = `Ouvrir ${game.title}`;
  
  document.getElementById('modalInputRoomLink').placeholder = `Colle ici le lien d'invitation ${game.domain}...`;
  document.getElementById('modalInputRoomLink').value = '';
  document.getElementById('modalInputRoomMsg').value = '';

  document.getElementById('modalExternalGame').classList.remove('hidden');
}

function closeExternalModal() {
  document.getElementById('modalExternalGame').classList.add('hidden');
  activeExternalGame = null;
}

function dispatchGameToChat() {
  if (!currentUser || !activeExternalGame) return;
  const roomUrl = document.getElementById('modalInputRoomLink').value.trim();
  const customMsg = document.getElementById('modalInputRoomMsg').value.trim();

  if (!roomUrl) {
    showToast('Colle le lien de la partie !', '⚠️');
    return;
  }

  db.ref('chat').push({
    authorNick: currentUser.nickname,
    authorTag: currentUser.tag,
    authorAvatar: currentUser.avatarEmoji || '🍺',
    authorFlag: currentUser.flagEmoji || '🇫🇷',
    isInvite: true,
    gameTitle: activeExternalGame.title,
    roomUrl: roomUrl,
    text: customMsg || '@promo On lance la partie, rejoignez vite !',
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now()
  });

  closeExternalModal();
  showToast('Partie annoncée dans le général !', '📣');
}

/* ---------------- CONNEXIONS ---------------- */
async function handleGoogleLogin() {
  hideAuthError();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const res = await auth.signInWithPopup(provider);
    await loadAuthenticatedUser(res.user);
  } catch (err) {
    showAuthError("Erreur Google : " + err.message);
  }
}

async function handleEmailLogin(e) {
  e.preventDefault();
  hideAuthError();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const btn = document.getElementById('btnSubmitLogin');
  btn.disabled = true;
  btn.textContent = "Connexion...";

  try {
    const res = await auth.signInWithEmailAndPassword(email, password);
    await loadAuthenticatedUser(res.user);
  } catch (err) {
    showAuthError("Adresse e-mail ou mot de passe incorrect.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Se connecter</span><span class="text-base">🔑</span>`;
  }
}

/* ---------------- INSCRIPTIONS ---------------- */
async function handleGoogleRegister() {
  hideAuthError();
  const nickname = document.getElementById('regNickname').value.trim();
  const tag = document.getElementById('regTag').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (!nickname || !tag) {
    showAuthError("Renseigne ton prénom et ton @tag avant de continuer avec Google.");
    return;
  }

  isRegisteringProcess = true;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const res = await auth.signInWithPopup(provider);
    
    const userSnap = await db.ref(`users/${res.user.uid}`).once('value');
    if (userSnap.exists()) {
      isRegisteringProcess = false;
      showToast("Compte existant trouvé ! Connexion...", "👋");
      await loadAuthenticatedUser(res.user);
      return;
    }

    const allUsersSnap = await db.ref('users').once('value');
    const allUsers = Object.values(allUsersSnap.val() || {});
    const tagTaken = allUsers.some(u => u && u.tag && u.tag.toLowerCase() === tag);

    if (tagTaken) {
      showAuthError(`Le tag @${tag} est déjà utilisé par un camarade.`);
      isRegisteringProcess = false;
      return;
    }

    const email = (res.user.email || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(email);

    const newUser = {
      uid: res.user.uid,
      email: email,
      nickname: nickname,
      tag: tag,
      role: isAdmin ? 'admin' : 'member',
      status: isAdmin ? 'approved' : 'pending',
      avatarEmoji: selectedAvatarReg,
      flagEmoji: selectedFlagReg,
      createdAt: Date.now()
    };

    await db.ref(`users/${res.user.uid}`).set(newUser);
    isRegisteringProcess = false;
    await loadAuthenticatedUser(res.user);
  } catch (err) {
    isRegisteringProcess = false;
    showAuthError("Erreur inscription Google : " + err.message);
  }
}

async function handleEmailRegister(e) {
  e.preventDefault();
  hideAuthError();

  const nickname = document.getElementById('regNickname').value.trim();
  const tag = document.getElementById('regTag').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;

  if (!nickname || !tag || !email || !password) {
    showAuthError("Tous les champs sont requis.");
    return;
  }

  const btn = document.getElementById('btnSubmitReg');
  btn.disabled = true;
  btn.textContent = "Création du compte...";
  isRegisteringProcess = true;

  try {
    const res = await auth.createUserWithEmailAndPassword(email, password);

    const allUsersSnap = await db.ref('users').once('value');
    const allUsers = Object.values(allUsersSnap.val() || {});
    const tagTaken = allUsers.some(u => u && u.tag && u.tag.toLowerCase() === tag);

    if (tagTaken) {
      await res.user.delete();
      showAuthError(`Le tag @${tag} est déjà utilisé.`);
      isRegisteringProcess = false;
      return;
    }

    try {
      await res.user.sendEmailVerification();
      showToast("E-mail de confirmation envoyé ! Regarde tes spams.", "📬");
    } catch (mailErr) {
      console.error("Erreur e-mail :", mailErr);
    }

    const isAdmin = ADMIN_EMAILS.includes(email);
    const newUser = {
      uid: res.user.uid,
      email: email,
      nickname: nickname,
      tag: tag,
      role: isAdmin ? 'admin' : 'member',
      status: isAdmin ? 'approved' : 'pending',
      avatarEmoji: selectedAvatarReg,
      flagEmoji: selectedFlagReg,
      createdAt: Date.now()
    };

    await db.ref(`users/${res.user.uid}`).set(newUser);
    isRegisteringProcess = false;
    await loadAuthenticatedUser(res.user);
  } catch (err) {
    isRegisteringProcess = false;
    showAuthError("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Créer mon compte par e-mail</span><span class="text-base">🚀</span>`;
  }
}

/* ---------------- VÉRIFICATION D'E-MAIL ---------------- */
async function checkEmailVerified() {
  if (!auth.currentUser) return;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    showToast("E-mail validé avec succès !", "✅");
    location.reload();
  } else {
    showToast("Ton adresse n'a pas encore été validée. Regarde tes spams !", "⚠️");
  }
}

async function resendVerificationEmail() {
  if (!auth.currentUser) return;
  try {
    await auth.currentUser.sendEmailVerification();
    showToast("Nouveau lien envoyé !", "📬");
  } catch (err) {
    showToast("Patiente quelques instants avant de renvoyer un e-mail.", "⏳");
  }
}

/* ---------------- GESTION DÉCONNEXION & INTERFACE ---------------- */
function logout() {
  if (currentUser && currentUser.tag) {
    db.ref(`presence/${currentUser.tag}`).remove();
  }
  auth.signOut().then(() => {
    location.reload();
  });
}

function switchAuthTab(tab) {
  hideAuthError();
  const containerLog = document.getElementById('authLoginContainer');
  const containerReg = document.getElementById('authRegisterContainer');
  const btnReg = document.getElementById('tabBtnRegister');
  const btnLog = document.getElementById('tabBtnLogin');

  if (tab === 'register') {
    containerReg.classList.remove('hidden');
    containerLog.classList.add('hidden');
    btnReg.className = 'neo-btn bg-[#fed72d] text-[#12131a] text-xs py-2 rounded-xl';
    btnLog.className = 'bg-transparent text-slate-600 hover:text-black font-extrabold text-xs py-2 rounded-xl transition-all';
  } else {
    containerLog.classList.remove('hidden');
    containerReg.classList.add('hidden');
    btnLog.className = 'neo-btn bg-[#fed72d] text-[#12131a] text-xs py-2 rounded-xl';
    btnReg.className = 'bg-transparent text-slate-600 hover:text-black font-extrabold text-xs py-2 rounded-xl transition-all';
  }
}

function showAuthError(msg) {
  const banner = document.getElementById('authErrorBanner');
  banner.textContent = msg;
  banner.classList.remove('hidden');
}

function hideAuthError() {
  const banner = document.getElementById('authErrorBanner');
  banner.textContent = '';
  banner.classList.add('hidden');
}

/* =========================================================
   PANNEAU DE MODÉRATION ADMIN
   ========================================================= */
let pendingUsersList = [];

function setupAdminWatcher() {
  const navAdminBtn = document.getElementById('navAdminBtn');
  navAdminBtn.classList.remove('hidden');
  navAdminBtn.classList.add('flex');

  db.ref('users').on('value', snap => {
    const users = snap.val() || {};
    pendingUsersList = Object.values(users).filter(u => u && u.status === 'pending');

    const badge = document.getElementById('navAdminBadge');
    const modalCount = document.getElementById('adminPendingCount');

    if (pendingUsersList.length > 0) {
      badge.textContent = pendingUsersList.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (modalCount) modalCount.textContent = pendingUsersList.length;
    renderAdminPendingList();
  });
}

function renderAdminPendingList() {
  const container = document.getElementById('adminPendingList');
  if (!container) return;

  if (pendingUsersList.length === 0) {
    container.innerHTML = `<p class="text-xs font-bold text-slate-400 italic py-4 text-center">Aucune demande en attente actuellement.</p>`;
    return;
  }

  container.innerHTML = pendingUsersList.map(u => `
    <div class="neo-box-sm bg-slate-50 p-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-10 h-10 rounded-xl bg-white border-2 border-[#12131a] flex items-center justify-center text-lg shadow-[1px_2px_0px_#12131a]">
          ${u.avatarEmoji || '🍺'}
        </span>
        <div class="min-w-0">
          <div class="text-xs font-black text-[#12131a] truncate">${escapeHtml(u.nickname)} ${u.flagEmoji || ''}</div>
          <div class="text-[10px] font-mono text-indigo-600 font-bold truncate">@${escapeHtml(u.tag)}</div>
          <div class="text-[10px] font-mono text-slate-400 truncate">${escapeHtml(u.email || 'Compte Google')}</div>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="approveUser('${u.uid}', '${escapeHtml(u.nickname)}')" class="neo-btn bg-emerald-400 hover:bg-emerald-500 text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black">
          ✓ Accepter
        </button>
        <button onclick="rejectUser('${u.uid}', '${escapeHtml(u.nickname)}')" class="neo-btn bg-rose-200 hover:bg-rose-300 text-rose-900 px-2.5 py-1.5 rounded-xl text-xs font-black">
          ✕ Refuser
        </button>
      </div>
    </div>
  `).join('');
}

function approveUser(uid, nickname) {
  db.ref(`users/${uid}`).update({
    status: 'approved'
  }).then(() => {
    showToast(`${nickname} a été accepté dans la promo !`, '✅');
  });
}

function rejectUser(uid, nickname) {
  if (confirm(`Refuser définitivement l'accès à ${nickname} ?`)) {
    db.ref(`users/${uid}`).update({
      status: 'rejected'
    }).then(() => {
      showToast(`Accès refusé pour ${nickname}.`, '🚫');
    });
  }
}

function openAdminModal() {
  document.getElementById('modalAdmin').classList.remove('hidden');
}

function closeAdminModal() {
  document.getElementById('modalAdmin').classList.add('hidden');
}

/* ---------------- PROFIL UTILISATEUR ---------------- */
function openProfileModal() {
  if (!currentUser) return;
  document.getElementById('editNickname').value = currentUser.nickname;
  document.getElementById('editTag').value = currentUser.tag;
  selectedAvatarEdit = currentUser.avatarEmoji || '🍺';
  selectedFlagEdit = currentUser.flagEmoji || '🇫🇷';
  renderPickers();
  document.getElementById('modalEditProfile').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('modalEditProfile').classList.add('hidden');
}

async function handleSaveProfile(e) {
  e.preventDefault();
  const nick = document.getElementById('editNickname').value.trim();
  if (!nick) return;

  currentUser.nickname = nick;
  currentUser.avatarEmoji = selectedAvatarEdit;
  currentUser.flagEmoji = selectedFlagEdit;

  await db.ref(`users/${currentUser.uid}`).update({
    nickname: nick,
    avatarEmoji: selectedAvatarEdit,
    flagEmoji: selectedFlagEdit
  });

  updateUserUI();
  setupMyRealtimePresence();
  closeProfileModal();
  showToast('Profil mis à jour !', '✅');
}

function renderPickers() {
  document.getElementById('emojiPickerReg').innerHTML = AVATAR_EMOJIS.map(em => `
    <button type="button" onclick="setRegAvatar('${em}')" class="w-9 h-9 rounded-xl border-2 ${em === selectedAvatarReg ? 'border-[#12131a] bg-[#fed72d] scale-110 shadow-[1px_2px_0px_#12131a]' : 'border-slate-200 bg-white'} text-base transition-all flex items-center justify-center">${em}</button>
  `).join('');

  document.getElementById('flagPickerReg').innerHTML = FLAG_EMOJIS.map(fl => `
    <button type="button" onclick="setRegFlag('${fl}')" class="w-9 h-9 rounded-xl border-2 ${fl === selectedFlagReg ? 'border-[#12131a] bg-[#fed72d] scale-110 shadow-[1px_2px_0px_#12131a]' : 'border-slate-200 bg-white'} text-base transition-all flex items-center justify-center">${fl}</button>
  `).join('');

  document.getElementById('emojiPickerEdit').innerHTML = AVATAR_EMOJIS.map(em => `
    <button type="button" onclick="setEditAvatar('${em}')" class="w-9 h-9 rounded-xl border-2 ${em === selectedAvatarEdit ? 'border-[#12131a] bg-[#fed72d] scale-110 shadow-[1px_2px_0px_#12131a]' : 'border-slate-200 bg-white'} text-base transition-all flex items-center justify-center">${em}</button>
  `).join('');

  document.getElementById('flagPickerEdit').innerHTML = FLAG_EMOJIS.map(fl => `
    <button type="button" onclick="setEditFlag('${fl}')" class="w-9 h-9 rounded-xl border-2 ${fl === selectedFlagEdit ? 'border-[#12131a] bg-[#fed72d] scale-110 shadow-[1px_2px_0px_#12131a]' : 'border-slate-200 bg-white'} text-base transition-all flex items-center justify-center">${fl}</button>
  `).join('');
}

function setRegAvatar(em) { selectedAvatarReg = em; renderPickers(); }
function setRegFlag(fl) { selectedFlagReg = fl; renderPickers(); }
function setEditAvatar(em) { selectedAvatarEdit = em; renderPickers(); }
function setEditFlag(fl) { selectedFlagEdit = fl; renderPickers(); }

function showToast(msg, icon = '💬') {
  const toast = document.getElementById('toastNotification');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').textContent = icon;

  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

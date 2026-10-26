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
const db = firebase.database();

const STORAGE_AUTH_SESSION = 'imb_session_v4';
const STORAGE_FAVS = 'imb_favs_v4';

const AVATAR_EMOJIS = ['🍺', '🍷', '👑', '🗿', '🎆', '💩', '🎲', '⚡'];
const FLAG_EMOJIS = [
  '🇫🇷', '🇮🇹', '🇵🇱', '🇫🇮', '🇸🇮', '🇷🇸',
  '🇺🇸', '🇨🇦',
  '🇯🇵', '🇹🇭', '🇮🇳'
];

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
let selectedAvatarReg = '🍺';
let selectedFlagReg = '🇫🇷';
let selectedAvatarEdit = '🍺';
let selectedFlagEdit = '🇫🇷';
let currentFilter = 'all';
let activeExternalGame = null;

let allUsersMap = {};
let onlinePresenceMap = {};
let soundMuted = false;
let initialChatTimestamp = Date.now();
let lastNotifiedMsgKey = null;

/* ---------------- DÉMARRAGE ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  renderPickers();
  checkAuthSession();
  renderGamesCatalog();
  listenToUsersAndPresence();
  listenToLiveChat();
  listenToUndercoverLiveActivity();
});

function checkAuthSession() {
  const stored = localStorage.getItem(STORAGE_AUTH_SESSION);
  const overlay = document.getElementById('authOverlay');

  if (stored) {
    currentUser = JSON.parse(stored);
    overlay.classList.add('hidden');
    updateUserUI();
    setupMyRealtimePresence();
    if (location.hash.startsWith('#imposteur=')) {
      window.location.href = 'undercover.html' + location.hash;
    }
  } else {
    overlay.classList.remove('hidden');
  }
}

function updateUserUI() {
  if (!currentUser) return;
  document.getElementById('navUserPseudo').textContent = currentUser.nickname;
  document.getElementById('navUserTag').textContent = `@${currentUser.tag}`;
  document.getElementById('navUserEmojis').textContent = `${currentUser.avatarEmoji || '🍺'} ${currentUser.flagEmoji || '🇫🇷'}`;
  document.getElementById('heroGreeting').textContent = `SALUT ${currentUser.nickname} !`;
}

/* ---------------- PRÉSENCE EN LIGNE ---------------- */
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
        connectedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  });
}

function listenToUsersAndPresence() {
  db.ref('users').on('value', snapshot => {
    allUsersMap = snapshot.val() || {};
    updatePresenceCountersAndDirectory();
  });

  db.ref('presence').on('value', snapshot => {
    onlinePresenceMap = snapshot.val() || {};
    updatePresenceCountersAndDirectory();
  });
}

function updatePresenceCountersAndDirectory() {
  const onlineCount = Object.keys(onlinePresenceMap).length || (currentUser ? 1 : 0);
  const registeredCount = Object.keys(allUsersMap).length || onlineCount;

  document.getElementById('navOnlineCount').textContent = onlineCount;
  document.getElementById('navRegisteredCount').textContent = registeredCount;
  document.getElementById('tabUsersOnlineBadge').textContent = onlineCount;
  document.getElementById('tabUsersTotalBadge').textContent = registeredCount;

  renderUsersDirectory();
}

function switchSidebarTab(tab) {
  const btnChat = document.getElementById('sidebarTabChat');
  const btnUsers = document.getElementById('sidebarTabUsers');
  const panelChat = document.getElementById('sidebarPanelChat');
  const panelUsers = document.getElementById('sidebarPanelUsers');

  if (tab === 'users') {
    btnUsers.className = 'neo-btn bg-[#12131a] text-white py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5';
    btnChat.className = 'bg-transparent text-[#12131a] hover:bg-white font-black py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5';
    panelChat.classList.add('hidden');
    panelUsers.classList.remove('hidden');
    panelUsers.classList.add('flex');
    renderUsersDirectory();
  } else {
    btnChat.className = 'neo-btn bg-[#12131a] text-white py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5';
    btnUsers.className = 'bg-transparent text-[#12131a] hover:bg-white font-black py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5';
    panelUsers.classList.add('hidden');
    panelUsers.classList.remove('flex');
    panelChat.classList.remove('hidden');
  }
}

function openDirectoryFromNavbar() {
  switchSidebarTab('users');
  document.getElementById('communitySidebar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderUsersDirectory() {
  const searchInput = document.getElementById('userDirectorySearch');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const combinedTags = new Set([
    ...Object.keys(allUsersMap),
    ...Object.keys(onlinePresenceMap)
  ]);

  const onlineUsers = [];
  const offlineUsers = [];

  combinedTags.forEach(tag => {
    const reg = allUsersMap[tag] || {};
    const pres = onlinePresenceMap[tag] || null;
    const userObj = {
      tag: tag,
      nickname: (pres && pres.nickname) || reg.nickname || tag,
      avatarEmoji: (pres && pres.avatarEmoji) || reg.avatarEmoji || '🍺',
      flagEmoji: (pres && pres.flagEmoji) || reg.flagEmoji || '🇫🇷',
      isOnline: Boolean(pres)
    };

    if (query && !userObj.nickname.toLowerCase().includes(query) && !userObj.tag.toLowerCase().includes(query)) {
      return;
    }

    if (userObj.isOnline) {
      onlineUsers.push(userObj);
    } else {
      offlineUsers.push(userObj);
    }
  });

  onlineUsers.sort((a, b) => a.nickname.localeCompare(b.nickname));
  offlineUsers.sort((a, b) => a.nickname.localeCompare(b.nickname));

  document.getElementById('dirOnlineCountLabel').textContent = onlineUsers.length;
  document.getElementById('dirOfflineCountLabel').textContent = offlineUsers.length;

  const onlineContainer = document.getElementById('dirOnlineList');
  const offlineContainer = document.getElementById('dirOfflineList');

  onlineContainer.innerHTML = onlineUsers.length
    ? onlineUsers.map(u => renderDirectoryUserCard(u, true)).join('')
    : `<p class="text-xs font-bold text-slate-400 italic py-2">Aucun joueur en ligne.</p>`;

  offlineContainer.innerHTML = offlineUsers.length
    ? offlineUsers.map(u => renderDirectoryUserCard(u, false)).join('')
    : `<p class="text-xs font-bold text-slate-400 italic py-2">Aucun inscrit hors-ligne.</p>`;
}

function renderDirectoryUserCard(u, isOnline) {
  const isMe = currentUser && currentUser.tag === u.tag;
  return `
    <div class="neo-box-sm bg-white p-2.5 flex items-center justify-between gap-2 ${isOnline ? '' : 'opacity-75'}">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="relative flex-shrink-0">
          <span class="w-9 h-9 rounded-xl bg-[#f1f3f9] border-2 border-[#12131a] flex items-center justify-center text-base">
            ${u.avatarEmoji}
          </span>
          <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12131a] ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-black text-[#12131a] truncate">
            ${escapeHtml(u.nickname)} ${u.flagEmoji} ${isMe ? '<span class="text-[10px] font-mono text-emerald-700">(Toi)</span>' : ''}
          </div>
          <div class="text-[10px] font-mono font-bold text-slate-400 truncate">@${escapeHtml(u.tag)}</div>
        </div>
      </div>
      ${!isMe ? `
        <button type="button" onclick="mentionUserInChat('${escapeHtml(u.tag)}')" class="neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] px-2.5 py-1 rounded-lg text-[10px] font-mono font-black flex-shrink-0">
          @ Ping
        </button>
      ` : ''}
    </div>
  `;
}

/* ---------------- @MENTIONS & PINGS ---------------- */
function mentionUserInChat(tag) {
  switchSidebarTab('chat');
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
    { tag: 'promo', nickname: 'Toute la promo', avatarEmoji: '📢', isOnline: true }
  ];

  Object.keys(allUsersMap).forEach(tag => {
    const u = allUsersMap[tag];
    candidates.push({
      tag: tag,
      nickname: u.nickname || tag,
      avatarEmoji: u.avatarEmoji || '🍺',
      isOnline: Boolean(onlinePresenceMap[tag])
    });
  });

  const filtered = candidates.filter(c =>
    c.tag.toLowerCase().includes(query) || c.nickname.toLowerCase().includes(query)
  ).slice(0, 6);

  if (filtered.length === 0) {
    hideMentionAutocomplete();
    return;
  }

  const box = document.getElementById('mentionAutocompleteBox');
  box.innerHTML = filtered.map(c => `
    <button type="button" onclick="selectMentionAutocomplete('${escapeHtml(c.tag)}')" class="w-full px-3 py-2 text-left hover:bg-[#fffdf0] flex items-center justify-between text-xs">
      <span class="font-black text-[#12131a] flex items-center gap-2">
        <span>${c.avatarEmoji}</span>
        <span>${escapeHtml(c.nickname)}</span>
        <span class="font-mono text-[10px] text-slate-500">@${escapeHtml(c.tag)}</span>
      </span>
      ${c.isOnline ? '<span class="w-2 h-2 rounded-full bg-emerald-500 border border-[#12131a]"></span>' : ''}
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
  document.getElementById('mentionAutocompleteBox').classList.add('hidden');
}

function toggleSoundMute() {
  soundMuted = !soundMuted;
  document.getElementById('btnSoundToggle').textContent = soundMuted ? '🔕' : '🔔';
  showToast(soundMuted ? 'Son des pings désactivé' : 'Son des pings activé', soundMuted ? '🔕' : '🔔');
}

function playPingSound() {
  if (soundMuted) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.09);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
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
      return `${space}<span onclick="mentionUserInChat('${tag}')" class="cursor-pointer inline-block bg-[#ff2a5f] text-white border border-[#12131a] px-1.5 py-0.2 rounded-md font-mono text-[11px] font-black shadow-[1px_1px_0px_#12131a]">@${tag}</span>`;
    }
    return `${space}<span onclick="mentionUserInChat('${tag}')" class="cursor-pointer inline-block bg-[#fed72d] text-[#12131a] border border-[#12131a] px-1.5 py-0.2 rounded-md font-mono text-[11px] font-black">@${tag}</span>`;
  });
}

/* ---------------- ACTIVITÉ SOUS-MARIN ---------------- */
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
  const allGames = [
    { type: 'morpion', title: 'Morpion' },
    { type: 'undercover', title: "L'Imposteur (Undercover)" },
    ...GAMES_CATALOG.map(g => ({ type: 'external', id: g.id, title: g.title }))
  ];
  const chosen = allGames[Math.floor(Math.random() * allGames.length)];
  showToast(`La roulette a choisi : ${chosen.title} ! 🎲`, '🎰');

  setTimeout(() => {
    if (chosen.type === 'morpion') openMorpionModal();
    else if (chosen.type === 'undercover') window.location.href = 'undercover.html';
    else openExternalGameModal(chosen.id);
  }, 650);
}

/* ---------------- AUTHENTIFICATION ---------------- */
function switchAuthTab(tab) {
  hideAuthError();
  const formReg = document.getElementById('formRegister');
  const formLog = document.getElementById('formLogin');
  const btnReg = document.getElementById('tabBtnRegister');
  const btnLog = document.getElementById('tabBtnLogin');

  if (tab === 'register') {
    formReg.classList.remove('hidden');
    formLog.classList.add('hidden');
    btnReg.className = 'neo-btn bg-[#fed72d] text-[#12131a] text-xs py-2 rounded-xl';
    btnLog.className = 'bg-transparent text-slate-600 hover:text-black font-extrabold text-xs py-2 rounded-xl transition-all';
  } else {
    formLog.classList.remove('hidden');
    formReg.classList.add('hidden');
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

async function handleRegister(e) {
  e.preventDefault();
  hideAuthError();

  const nickname = document.getElementById('regNickname').value.trim();
  let tag = document.getElementById('regTag').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const password = document.getElementById('regPassword').value;

  if (!nickname || !tag || !password) {
    showAuthError('Tous les champs sont requis.');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitReg');
  submitBtn.disabled = true;
  submitBtn.innerText = "Création du compte...";

  try {
    const tagSnapshot = await db.ref(`users/${tag}`).get();
    if (tagSnapshot.exists()) {
      showAuthError(`Le tag @${tag} est déjà pris par un autre camarade.`);
      submitBtn.disabled = false;
      submitBtn.innerText = "Créer mon compte & Entrer";
      return;
    }

    const newUser = {
      nickname,
      tag,
      password,
      avatarEmoji: selectedAvatarReg,
      flagEmoji: selectedFlagReg,
      createdAt: Date.now()
    };

    await db.ref(`users/${tag}`).set(newUser);

    localStorage.setItem(STORAGE_AUTH_SESSION, JSON.stringify(newUser));
    currentUser = newUser;

    checkAuthSession();
    showToast(`Bienvenue dans la promo, ${nickname} !`, '🚀');
    sendSystemChat(`${newUser.nickname} (@${newUser.tag}) a rejoint le Game Center !`);
  } catch (err) {
    showAuthError("Erreur : " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Créer mon compte & Entrer";
  }
}

async function handleLogin(e) {
  e.preventDefault();
  hideAuthError();

  const tag = document.getElementById('loginTag').value.trim().toLowerCase().replace(/^@/, '');
  const password = document.getElementById('loginPassword').value;

  const submitBtn = document.getElementById('btnSubmitLogin');
  submitBtn.disabled = true;
  submitBtn.innerText = "Connexion...";

  try {
    const userSnap = await db.ref(`users/${tag}`).get();
    const userData = userSnap.val();

    if (!userData) {
      showAuthError(`Aucun compte trouvé avec le tag @${tag}. Crée ton compte d'abord !`);
      submitBtn.disabled = false;
      submitBtn.innerText = "Se connecter";
      return;
    }

    if (userData.password !== password) {
      showAuthError("Mot de passe incorrect pour ce tag.");
      submitBtn.disabled = false;
      submitBtn.innerText = "Se connecter";
      return;
    }

    localStorage.setItem(STORAGE_AUTH_SESSION, JSON.stringify(userData));
    currentUser = userData;
    checkAuthSession();
    showToast(`Ravi de te revoir, ${userData.nickname} !`, '👋');
  } catch (err) {
    showAuthError("Erreur : " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Se connecter";
  }
}

function logout() {
  if (confirm('Te déconnecter du Game Center ?')) {
    if (currentUser && currentUser.tag) {
      db.ref(`presence/${currentUser.tag}`).remove();
    }
    localStorage.removeItem(STORAGE_AUTH_SESSION);
    location.reload();
  }
}

/* ---------------- CHAT TEMPS RÉEL ---------------- */
function listenToLiveChat() {
  const container = document.getElementById('chatMessagesContainer');
  db.ref('chat').limitToLast(50).on('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<p class="text-xs font-bold text-slate-400 text-center py-8">Aucun message pour le moment.</p>`;
      return;
    }

    const entries = Object.entries(data);
    const [lastKey, lastMsg] = entries[entries.length - 1];

    if (
      lastMsg &&
      !lastMsg.isSystem &&
      lastMsg.timestamp &&
      lastMsg.timestamp > initialChatTimestamp &&
      lastKey !== lastNotifiedMsgKey &&
      currentUser &&
      lastMsg.authorTag !== currentUser.tag &&
      isUserMentionedInText(lastMsg.text)
    ) {
      lastNotifiedMsgKey = lastKey;
      playPingSound();
      showToast(`🔔 ${lastMsg.authorNick} t'a tagué dans le chat !`, '📣');
    }

    const messages = entries.map(([, val]) => val).reverse();
    container.innerHTML = messages.map(m => {
      if (m.isSystem) {
        return `
          <div class="text-center py-1">
            <span class="text-[10px] font-mono font-bold bg-[#edf0f8] border border-[#12131a] px-2.5 py-0.5 rounded-full">${escapeHtml(m.text)}</span>
          </div>
        `;
      }

      const mentionedMe = isUserMentionedInText(m.text);

      if (m.isInvite) {
        return `
          <div class="neo-box bg-[#fed72d] p-3 text-[#12131a] space-y-2 ${mentionedMe ? 'ring-4 ring-rose-500' : ''}">
            <div class="flex items-center justify-between">
              <span onclick="mentionUserInChat('${escapeHtml(m.authorTag)}')" class="cursor-pointer text-xs font-black flex items-center gap-1.5 hover:underline">
                <span>${m.authorAvatar || '🍺'} ${m.authorFlag || ''}</span>
                <span>${escapeHtml(m.authorNick)}</span>
                <span class="text-[10px] font-mono text-slate-700">(@${escapeHtml(m.authorTag)})</span>
              </span>
              <span class="text-[10px] font-mono font-bold">${m.time}</span>
            </div>

            <div class="bg-white border-2 border-[#12131a] p-2.5 rounded-xl shadow-[2px_2px_0px_#12131a]">
              <div class="flex items-center gap-1 font-black text-xs text-[#12131a] mb-1">
                <span>🎮</span>
                <span>Partie de ${escapeHtml(m.gameTitle)}</span>
              </div>
              <p class="text-[11px] font-bold text-slate-700 italic mb-2">« ${formatChatMessageWithMentions(m.text)} »</p>
              ${m.internalGame ? `
              <button type="button" onclick="openInternalInvite('${safeRoomCode(m.internalGame)}', '${safeRoomCode(m.internalRoom)}')" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                <span>Rejoindre la salle ${escapeHtml(safeRoomCode(m.internalRoom))}</span>
                <span>➔</span>
              </button>` : `
              <a href="${m.roomUrl}" target="_blank" class="w-full neo-btn bg-[#fed72d] hover:bg-[#eec418] text-[#12131a] py-2 rounded-xl text-xs flex items-center justify-center gap-1">
                <span>Rejoindre la partie</span>
                <span>↗</span>
              </a>`}
            </div>
          </div>
        `;
      }

      return `
        <div class="neo-box-sm bg-white p-2.5 ${mentionedMe ? 'ping-message-card' : ''}">
          <div class="flex items-center justify-between mb-1">
            <span onclick="mentionUserInChat('${escapeHtml(m.authorTag)}')" title="Cliquer pour répondre à @${escapeHtml(m.authorTag)}" class="cursor-pointer text-xs font-black text-[#12131a] flex items-center gap-1.5 hover:underline">
              <span>${m.authorAvatar || '🍺'} ${m.authorFlag || ''}</span>
              <span>${escapeHtml(m.authorNick)}</span>
              <span class="text-[10px] font-mono text-slate-400">(@${escapeHtml(m.authorTag)})</span>
            </span>
            <span class="text-[10px] font-mono font-bold text-slate-400">${m.time}</span>
          </div>
          <p class="text-xs font-bold text-slate-800 break-words leading-relaxed">${formatChatMessageWithMentions(m.text)}</p>
        </div>
      `;
    }).join('');
  });
}

function safeRoomCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function openInternalInvite(game, code) {
  if (!currentUser || !code) return;
  if (game === 'MORPION') {
    openMorpionModal();
    setMorpionMode('online');
    document.getElementById('morpionInputRoom').value = code;
    joinMorpionOnlineRoom();
  } else if (game === 'IMPOSTEUR' || game === 'UNDERCOVER') {
    window.location.href = 'undercover.html#imposteur=' + code;
  }
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

function sendSystemChat(text) {
  db.ref('chat').push({
    isSystem: true,
    text: text,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now()
  });
}

/* ---------------- CATALOGUE DE JEUX ---------------- */
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

/* ---------------- JEU INTERNE : MORPION ---------------- */
let morpionMode = 'local';
let morpionBoard = Array(9).fill('');
let morpionTurn = 'X';
let morpionScoreX = 0;
let morpionScoreO = 0;
let morpionRoomCode = null;
let morpionMySymbol = 'X';

function normalizeMorpionBoard(raw) {
  const board = Array(9).fill('');
  if (raw) {
    Object.keys(raw).forEach(k => {
      const i = Number(k);
      if (i >= 0 && i < 9 && (raw[k] === 'X' || raw[k] === 'O')) board[i] = raw[k];
    });
  }
  return board;
}

function leaveMorpionRoom() {
  if (morpionRoomCode) {
    db.ref(`rooms_morpion/${morpionRoomCode}`).off();
  }
  morpionRoomCode = null;
  morpionMySymbol = 'X';
  document.getElementById('morpionRoomStatus').textContent = "Crée une salle ou rejoins celle d'un pote !";
  setMorpionPlayerNames(null, null);
}

function setMorpionPlayerNames(nameX, nameO) {
  document.getElementById('morpionNameX').textContent = nameX ? `❌ ${nameX}` : 'Joueur X';
  document.getElementById('morpionNameO').textContent = nameO ? `⭕ ${nameO}` : 'Joueur O';
}

function openMorpionModal() {
  document.getElementById('modalMorpion').classList.remove('hidden');
  setMorpionMode('local');
}

function closeMorpionModal() {
  document.getElementById('modalMorpion').classList.add('hidden');
  leaveMorpionRoom();
}

function setMorpionMode(mode) {
  morpionMode = mode;
  const btnLoc = document.getElementById('morpionBtnLocal');
  const btnOnl = document.getElementById('morpionBtnOnline');
  const controls = document.getElementById('morpionOnlineControls');
  const btnShare = document.getElementById('btnAnnounceMorpion');

  if (mode === 'local') {
    btnLoc.className = 'neo-btn bg-[#fed72d] text-[#12131a] text-xs py-2 rounded-xl';
    btnOnl.className = 'bg-transparent text-slate-600 font-extrabold text-xs py-2 rounded-xl';
    controls.classList.add('hidden');
    btnShare.classList.add('hidden');
    leaveMorpionRoom();
    resetMorpionBoard(true);
  } else {
    btnOnl.className = 'neo-btn bg-[#fed72d] text-[#12131a] text-xs py-2 rounded-xl';
    btnLoc.className = 'bg-transparent text-slate-600 font-extrabold text-xs py-2 rounded-xl';
    controls.classList.remove('hidden');
    btnShare.classList.remove('hidden');
    if (!morpionRoomCode) resetMorpionBoard(true);
  }
}

function renderMorpionBoard() {
  const container = document.getElementById('morpionGrid');
  container.innerHTML = morpionBoard.map((val, idx) => `
    <button onclick="handleMorpionCellClick(${idx})" class="w-20 h-20 sm:w-24 sm:h-24 bg-white border-[3px] border-[#12131a] rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black shadow-[2px_3px_0px_#12131a] active:translate-x-0.5 active:translate-y-0.5 transition-transform ${val === 'X' ? 'text-blue-600' : 'text-rose-600'}">
      ${val ? val : ''}
    </button>
  `).join('');

  document.getElementById('morpionTurnIndicator').textContent = `Tour de ${morpionTurn}`;
  document.getElementById('morpionScoreX').textContent = morpionScoreX;
  document.getElementById('morpionScoreO').textContent = morpionScoreO;
}

function handleMorpionCellClick(idx) {
  if (morpionBoard[idx] || checkMorpionWinner(morpionBoard)) return;

  if (morpionMode === 'local') {
    morpionBoard[idx] = morpionTurn;
    const winner = checkMorpionWinner(morpionBoard);
    if (winner) {
      if (winner === 'X') morpionScoreX++;
      if (winner === 'O') morpionScoreO++;
      showToast(`Joueur ${winner} a gagné ! 🎉`, '🏆');
    } else if (morpionBoard.every(c => c)) {
      showToast("Match nul !", '🤝');
    } else {
      morpionTurn = morpionTurn === 'X' ? 'O' : 'X';
    }
    renderMorpionBoard();
  } else {
    if (!morpionRoomCode) {
      showToast("Crée ou rejoins une salle d'abord !", '⚠️');
      return;
    }

    if (morpionTurn !== morpionMySymbol) {
      showToast(`Ce n'est pas ton tour ! (Tu es ${morpionMySymbol})`, '⏳');
      return;
    }

    morpionBoard = [...morpionBoard];
    morpionBoard[idx] = morpionMySymbol;
    const winner = checkMorpionWinner(morpionBoard);
    let newTurn = morpionTurn === 'X' ? 'O' : 'X';

    let updates = {
      board: morpionBoard,
      turn: newTurn
    };

    if (winner) {
      if (winner === 'X') updates.scoreX = morpionScoreX + 1;
      if (winner === 'O') updates.scoreO = morpionScoreO + 1;
    }

    db.ref(`rooms_morpion/${morpionRoomCode}`).update(updates);
  }
}

function checkMorpionWinner(b) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (let [x, y, z] of lines) {
    if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
  }
  return null;
}

function resetMorpionBoard(fullReset = false) {
  morpionBoard = Array(9).fill('');
  morpionTurn = 'X';
  if (fullReset) {
    morpionScoreX = 0;
    morpionScoreO = 0;
  }

  if (morpionMode === 'online' && morpionRoomCode) {
    db.ref(`rooms_morpion/${morpionRoomCode}`).update({
      board: morpionBoard,
      turn: 'X'
    });
  }
  renderMorpionBoard();
}

function createMorpionOnlineRoom() {
  leaveMorpionRoom();
  const code = 'MORPION-' + Math.floor(100 + Math.random() * 900);
  morpionRoomCode = code;
  morpionMySymbol = 'X';

  document.getElementById('morpionInputRoom').value = code;
  document.getElementById('morpionRoomStatus').textContent = `Salle ${code} créée ! Tu as les ❌ (en attente d'un adversaire...)`;

  morpionBoard = Array(9).fill('');
  morpionTurn = 'X';
  morpionScoreX = 0;
  morpionScoreO = 0;
  renderMorpionBoard();

  db.ref(`rooms_morpion/${code}`).set({
    board: Array(9).fill(''),
    turn: 'X',
    playerX: currentUser ? currentUser.nickname : 'Hôte',
    playerO: null,
    scoreX: 0,
    scoreO: 0
  });

  listenToMorpionRoom(code);
  showToast(`Salle ${code} créée !`, '🎲');
}

function joinMorpionOnlineRoom() {
  const code = document.getElementById('morpionInputRoom').value.trim().toUpperCase();
  if (!code) {
    showToast('Entre un code de salle !', '⚠️');
    return;
  }

  db.ref(`rooms_morpion/${code}`).get().then(snap => {
    if (!snap.exists()) {
      showToast('Salle introuvable !', '❌');
      return;
    }

    leaveMorpionRoom();
    morpionRoomCode = code;
    morpionMySymbol = 'O';

    db.ref(`rooms_morpion/${code}`).update({
      playerO: currentUser ? currentUser.nickname : 'Invité'
    });

    document.getElementById('morpionRoomStatus').textContent = `Connecté au salon ${code} ! Tu as les ⭕.`;
    listenToMorpionRoom(code);
    showToast(`Salle ${code} rejointe !`, '🚀');
  }).catch(() => showToast('Connexion à la salle impossible, réessaie !', '❌'));
}

function listenToMorpionRoom(code) {
  db.ref(`rooms_morpion/${code}`).on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const previousBoard = morpionBoard.join(',');
    morpionBoard = normalizeMorpionBoard(data.board);
    morpionTurn = data.turn || 'X';
    morpionScoreX = data.scoreX || 0;
    morpionScoreO = data.scoreO || 0;

    setMorpionPlayerNames(data.playerX, data.playerO);
    const opponent = morpionMySymbol === 'X' ? data.playerO : data.playerX;
    const mySign = morpionMySymbol === 'X' ? '❌' : '⭕';
    document.getElementById('morpionRoomStatus').textContent = opponent
      ? `Salle ${code} : tu affrontes ${opponent} ! Tu as les ${mySign}.`
      : `Salle ${code} : en attente d'un adversaire... Tu as les ${mySign}.`;

    renderMorpionBoard();

    if (previousBoard === morpionBoard.join(',')) return;
    const winner = checkMorpionWinner(morpionBoard);
    if (winner) {
      showToast(`Joueur ${winner} a gagné la manche ! 🎉`, '🏆');
    } else if (morpionBoard.every(c => c)) {
      showToast("Match nul !", '🤝');
    }
  });
}

function announceMorpionInChat() {
  if (!morpionRoomCode) {
    showToast("Crée une salle d'abord !", '⚠️');
    return;
  }
  db.ref('chat').push({
    authorNick: currentUser.nickname,
    authorTag: currentUser.tag,
    authorAvatar: currentUser.avatarEmoji || '⭕',
    authorFlag: currentUser.flagEmoji || '🇫🇷',
    isInvite: true,
    gameTitle: 'Morpion en direct',
    roomUrl: '#',
    internalGame: 'morpion',
    internalRoom: morpionRoomCode,
    text: `@promo Qui veut me défier au Morpion ? Code de la salle : ${morpionRoomCode}`,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now()
  });
  showToast('Défi Morpion envoyé dans le chat !', '📣');
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

  await db.ref(`users/${currentUser.tag}`).update({
    nickname: nick,
    avatarEmoji: selectedAvatarEdit,
    flagEmoji: selectedFlagEdit
  });

  localStorage.setItem(STORAGE_AUTH_SESSION, JSON.stringify(currentUser));
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

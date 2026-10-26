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

/* ---------------- DÉMARRAGE & SURVEILLANCE AUTHENTIFICATION ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  renderPickers();
  renderGamesCatalog();

  // Écouteur global de session Firebase Auth
  auth.onAuthStateChanged(async (firebaseUser) => {
    const authOverlay = document.getElementById('authOverlay');
    const pendingOverlay = document.getElementById('pendingOverlay');

    if (!firebaseUser) {
      // Déconnecté
      currentUser = null;
      authOverlay.classList.remove('hidden');
      pendingOverlay.classList.add('hidden');
      document.getElementById('navAdminBtn').classList.add('hidden');
      return;
    }

    // Connecté : écouter son profil en temps réel dans Realtime Database
    db.ref(`users/${firebaseUser.uid}`).on('value', async (snap) => {
      let userData = snap.val();

      // Si c'est sa toute première connexion
      if (!userData) {
        const userEmail = (firebaseUser.email || '').toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(userEmail);

        // Profil par défaut pour Alex ou pour un nouvel arrivant
        userData = {
          uid: firebaseUser.uid,
          email: userEmail,
          nickname: isAdmin ? 'Alex' : (firebaseUser.displayName || 'Joueur'),
          tag: isAdmin ? 'alexs' : ('joueur_' + Math.floor(1000 + Math.random() * 9000)),
          role: isAdmin ? 'admin' : 'member',
          status: isAdmin ? 'approved' : 'pending',
          avatarEmoji: '🍺',
          flagEmoji: '🇫🇷',
          createdAt: Date.now()
        };

        await db.ref(`users/${firebaseUser.uid}`).set(userData);
      }

      currentUser = userData;

      // 1. Vérification du statut d'approbation
      if (currentUser.status === 'pending') {
        authOverlay.classList.add('hidden');
        pendingOverlay.classList.remove('hidden');
        document.getElementById('pendingUserNick').textContent = currentUser.nickname;
        document.getElementById('pendingUserTag').textContent = `@${currentUser.tag}`;
        return;
      }

      // 2. Compte approuvé : déblocage du lobby
      authOverlay.classList.add('hidden');
      pendingOverlay.classList.add('hidden');
      updateUserUI();
      setupMyRealtimePresence();
      listenToUsersAndPresence();
      listenToLiveChat();
      listenToUndercoverLiveActivity();

      // 3. Si c'est un admin, activer le panneau modérateur
      if (currentUser.role === 'admin') {
        setupAdminWatcher();
      }
    });
  });
});

function updateUserUI() {
  if (!currentUser) return;
  document.getElementById('navUserPseudo').textContent = currentUser.nickname;
  document.getElementById('navUserTag').textContent = `@${currentUser.tag}`;
  document.getElementById('navUserEmojis').textContent = `${currentUser.avatarEmoji || '🍺'} ${currentUser.flagEmoji || '🇫🇷'}`;
  document.getElementById('heroGreeting').textContent = `SALUT ${currentUser.nickname} !`;
}

/* ---------------- CONNEXION GOOGLE & EMAIL ---------------- */
async function handleGoogleSignIn() {
  hideAuthError();
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
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
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showAuthError("Identifiants incorrects ou compte inexistant.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Se connecter</span><span class="text-base">🔑</span>`;
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

  try {
    // Vérifier si le tag est déjà pris
    const tagSnap = await db.ref('users').orderByChild('tag').equalTo(tag).once('value');
    if (tagSnap.exists()) {
      showAuthError(`Le tag @${tag} est déjà utilisé.`);
      btn.disabled = false;
      btn.innerHTML = `<span>Créer mon compte</span><span class="text-base">🚀</span>`;
      return;
    }

    const res = await auth.createUserWithEmailAndPassword(email, password);
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
  } catch (err) {
    showAuthError("Erreur : " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Créer mon compte</span><span class="text-base">🚀</span>`;
  }
}

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
          <div class="text-[10px] font-mono text-slate-400 truncate">${escapeHtml(u.email || 'Google Auth')}</div>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="approveUser('${u.uid}', '${escapeHtml(u.nickname)}')" class="neo-btn bg-emerald-400 hover:bg-emerald-500 text-[#12131a] px-3 py-1.5 rounded-xl text-xs font-black">
          ✓ Accepter
        </button>
        <button onclick="rejectUser('${u.uid}')" class="neo-btn bg-rose-200 hover:bg-rose-300 text-rose-900 px-2.5 py-1.5 rounded-xl text-xs font-black">
          ✕
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
    sendSystemChat(`🎉 ${nickname} a rejoint la promo après validation !`);
  });
}

function rejectUser(uid) {
  if (confirm("Refuser cette inscription ?")) {
    db.ref(`users/${uid}`).remove().then(() => {
      showToast('Inscription refusée et supprimée.', '🗑️');
    });
  }
}

function openAdminModal() {
  document.getElementById('modalAdmin').classList.remove('hidden');
}

function closeAdminModal() {
  document.getElementById('modalAdmin').classList.add('hidden');
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
  // Ne compter que les membres approuvés
  const approvedUsers = Object.values(allUsersMap).filter(u => u && u.status === 'approved');
  const registeredCount = approvedUsers.length || onlineCount;

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

  const approvedUsers = Object.values(allUsersMap).filter(u => u && u.status === 'approved');
  const onlineUsers = [];
  const offlineUsers = [];

  approvedUsers.forEach(u => {
    const isOnline = Boolean(onlinePresenceMap[u.tag]);
    const userObj = {
      tag: u.tag,
      nickname: u.nickname || u.tag,
      avatarEmoji: u.avatarEmoji || '🍺',
      flagEmoji: u.flagEmoji || '🇫🇷',
      isOnline: isOnline
    };

    if (query && !userObj.nickname.toLowerCase().includes(query) && !userObj.tag.toLowerCase().includes(query)) {
      return;
    }

    if (isOnline) {
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

  Object.values(allUsersMap).filter(u => u && u.status === 'approved').forEach(u => {
    candidates.push({
      tag: u.tag,
      nickname: u.nickname || u.tag,
      avatarEmoji: u.avatarEmoji || '🍺',
      isOnline: Boolean(onlinePresenceMap[u.tag])
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
  const externalGames = GAMES_CATALOG.map(g => ({ type: 'external', id: g.id, title: g.title }));
  const allGames = [
    { type: 'internal', path: 'games/morpion/', title: 'Morpion' },
    { type: 'internal', path: 'games/undercover/', title: "L'Imposteur (Undercover)" }
  ].concat(externalGames);

  const chosen = allGames[Math.floor(Math.random() * allGames.length)];
  showToast(`La roulette a choisi : ${chosen.title} ! 🎲`, '🎰');

  setTimeout(() => {
    if (chosen.type === 'internal') {
      window.location.href = chosen.path;
    } else {
      openExternalGameModal(chosen.id);
    }
  }, 650);
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
    window.location.href = `games/morpion/#room=${code}`;
  } else if (game === 'IMPOSTEUR' || game === 'UNDERCOVER') {
    window.location.href = `games/undercover/#imposteur=${code}`;
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

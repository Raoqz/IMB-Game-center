/* =========================================================
   IMB GAME CENTER - CATAN (Étape 1 : Pont Firebase SDK)
   Remplace _sdk.js et _prefill.js pour relier Catan à Firebase
   Stockage salon : rooms/catan/<CODE>
   Stockage scores : scores/catan/<tag>
   ========================================================= */
(function () {
  'use strict';

  /**
   * Attend que l'utilisateur soit authentifié et chargé dans GameShell
   */
  function waitForShellUser() {
    return new Promise((resolve) => {
      if (window.GameShell && window.GameShell.currentUser) {
        return resolve(window.GameShell.currentUser);
      }
      const iv = setInterval(() => {
        if (window.GameShell && window.GameShell.currentUser) {
          clearInterval(iv);
          resolve(window.GameShell.currentUser);
        }
      }, 60);
    });
  }

  /**
   * Convertit l'emoji du joueur (ex: 🍺) en Data-URI SVG pour que
   * les balises <img src="..."> de Catan l'affichent proprement.
   */
  function emojiToDataUri(emoji) {
    const safeEmoji = emoji || '🍺';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" font-size="40">${safeEmoji}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /**
   * Extrait le code de salon depuis ?room=XXXX ou #room=XXXX
   */
  function getRoomFromUrl() {
    const q = new URLSearchParams(window.location.search).get('room');
    if (q) return q.trim().toUpperCase();
    const match = window.location.hash.match(/room=([A-Z0-9]{4,12})/i);
    return match ? match[1].toUpperCase() : null;
  }

  window.ChadGang = {
    hubUrl: window.location.origin,

    /**
     * Identité du joueur connecté -> { id, name, avatar, isAdmin }
     */
    me: async function () {
      const user = await waitForShellUser();
      return {
        id: user.tag,
        name: user.nickname || user.tag,
        avatar: emojiToDataUri(user.avatarEmoji || '🍺'),
        isAdmin: user.role === 'admin',
        roles: user.role === 'admin' ? ['admin'] : [],
        isModo: user.role === 'admin'
      };
    },

    isAdmin: async function () {
      const user = await waitForShellUser();
      return user.role === 'admin';
    },

    room: function () {
      return getRoomFromUrl();
    },

    /**
     * Connexion temps réel à une salle Catan sur Firebase : rooms/catan/<CODE>
     */
    join: function (code, opts) {
      const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const L = { ready: [], players: [], message: [], error: [] };
      let closed = false;
      let playersRef = null;
      let messagesRef = null;
      let onPlayersValue = null;
      let onMessageAdded = null;

      function emit(evt, a, b) {
        (L[evt] || []).forEach(function (fn) {
          try { fn(a, b); } catch (e) { console.error(e); }
        });
      }

      const roomRef = db.ref('rooms/catan/' + c);

      const channel = {
        code: c,
        me: null,
        on: function (evt, fn) {
          (L[evt] = L[evt] || []).push(fn);
          return channel;
        },
        send: async function (data, o) {
          if (closed) return;
          const user = await waitForShellUser();
          const now = Date.now();

          // Si keep: true, on sauvegarde le dernier état de la partie pour les reconnexions
          if (o && o.keep) {
            await roomRef.child('lastState').set({
              data: data,
              from: { id: user.tag, name: user.nickname || user.tag },
              timestamp: now
            });
          }

          // Diffuser l'événement à tous les joueurs de la salle
          const msgRef = roomRef.child('messages').push();
          await msgRef.set({
            data: data,
            from: { id: user.tag, name: user.nickname || user.tag },
            timestamp: now
          });
        },
        leave: function () {
          if (closed) return;
          closed = true;

          if (playersRef && onPlayersValue) playersRef.off('value', onPlayersValue);
          if (messagesRef && onMessageAdded) messagesRef.off('child_added', onMessageAdded);

          if (window.GameShell && window.GameShell.currentUser) {
            const tag = window.GameShell.currentUser.tag;
            roomRef.child('players/' + tag).remove().catch(() => {});
          }
          if (window.GameShell) {
            window.GameShell.currentRoomCode = null;
          }
          try {
            localStorage.removeItem('imb_active_room_catan');
            history.replaceState(null, '', window.location.pathname);
          } catch (e) {}
        }
      };

      // Initialisation asynchrone de la salle
      (async function initRoomConnection() {
        try {
          const user = await waitForShellUser();
          if (closed) return;

          const snap = await roomRef.once('value');
          if (closed) return;

          const roomData = snap.val();
          const hasPlayers = roomData && roomData.players && Object.keys(roomData.players).length > 0;
          const hasState = roomData && roomData.lastState;

          // Si le joueur tente de rejoindre une salle qui n'existe pas (create: false)
          if (!hasPlayers && !hasState && opts && opts.create === false) {
            emit('error', 'Salle introuvable : vérifie le code');
            return;
          }

          channel.me = user.tag;

          // Synchroniser le code de salle avec GameShell et le stockage local ("Reprendre")
          if (window.GameShell) {
            window.GameShell.currentRoomCode = c;
          }
          try {
            localStorage.setItem('imb_active_room_catan', c);
            window.location.hash = 'room=' + c;
          } catch (e) {}

          // Conserver l'ordre d'arrivée (joinedAt) si le joueur était déjà présent
          const myPlayerRef = roomRef.child('players/' + user.tag);
          const existingPlayerSnap = await myPlayerRef.once('value');
          const existingPlayer = existingPlayerSnap.val();
          const joinedAt = (existingPlayer && existingPlayer.joinedAt) ? existingPlayer.joinedAt : Date.now();

          await myPlayerRef.set({
            id: user.tag,
            name: user.nickname || user.tag,
            avatar: emojiToDataUri(user.avatarEmoji || '🍺'),
            joinedAt: joinedAt
          });
          myPlayerRef.onDisconnect().remove();

          // Nettoyer les anciens messages éphémères s'il y en a trop
          const allPlayersSnap = await roomRef.child('players').once('value');
          const sortPlayers = (map) => {
            return Object.values(map || {})
              .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
              .map(p => ({ id: p.id, name: p.name, avatar: p.avatar || null }));
          };

          const initialPlayers = sortPlayers(allPlayersSnap.val());
          const lastStateSnap = await roomRef.child('lastState').once('value');
          const lastStateVal = lastStateSnap.val();
          const joinTimestamp = Date.now();

          // 1. Émettre l'événement 'ready' (info.me DOIT être le tag string pour Catan)
          emit('ready', {
            me: user.tag,
            players: initialPlayers,
            last: lastStateVal ? lastStateVal.data : null
          });

          // 2. Écouter les changements de liste des joueurs en direct
          playersRef = roomRef.child('players');
          onPlayersValue = function (pSnap) {
            if (closed) return;
            emit('players', sortPlayers(pSnap.val()));
          };
          playersRef.on('value', onPlayersValue);

          // 3. Écouter tous les nouveaux messages envoyés à partir de maintenant
          messagesRef = roomRef.child('messages').orderByChild('timestamp').startAt(joinTimestamp - 200);
          onMessageAdded = function (mSnap) {
            if (closed) return;
            const msg = mSnap.val();
            if (!msg || !msg.data) return;
            emit('message', msg.data, msg.from || {});
          };
          messagesRef.on('child_added', onMessageAdded);

        } catch (err) {
          console.error('Erreur connexion salon Catan :', err);
          if (!closed) emit('error', 'Impossible de joindre la salle Catan');
        }
      })();

      return channel;
    },

    /**
     * Publie une invitation dans le chat général de l'IMB Game Center
     */
    createInvite: async function (opts) {
      opts = opts || {};
      const user = await waitForShellUser();
      const roomCode = (opts.room || (window.GameShell && window.GameShell.currentRoomCode) || '').toUpperCase();
      if (!roomCode) throw new Error('Code de salle manquant');

      const extraInfo = opts.version ? ` (${opts.version})` : '';
      const text = opts.message
        ? `@promo ${opts.message}${extraInfo} — Code : ${roomCode}`
        : `@promo Venez coloniser Catan ! 🏝️${extraInfo} — Code : ${roomCode}`;

      await db.ref('chat').push({
        authorNick: user.nickname,
        authorTag: user.tag,
        authorAvatar: user.avatarEmoji || '🍺',
        authorFlag: user.flagEmoji || '🇫🇷',
        isInvite: true,
        gameTitle: '🏝️ Catan',
        internalGame: 'catan',
        internalRoom: roomCode,
        text: text,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      return {
        code: roomCode,
        link: `${window.location.origin}/games/catan/index.html#room=${roomCode}`
      };
    },

    debutPartie: function () {
      return Promise.resolve({
        run: 'catan-' + Date.now(),
        seed: 1 + Math.floor(Math.random() * 2147483646)
      });
    },

    /**
     * Enregistre le résultat de fin de partie dans scores/catan/<tag>
     */
    finPartie: async function (o) {
      o = o || {};
      const user = await waitForShellUser();
      if (!user || !user.tag) return { counted: false, record: false };

      const won = Boolean(o.gagne !== undefined ? o.gagne : o.won);
      const vpScore = typeof o.score === 'number' ? o.score : 0;
      const matchId = String(o.partie || o.match || ('catan-' + Date.now()));

      const ref = db.ref('scores/catan/' + user.tag);
      let isNewRecord = false;

      await ref.transaction(function (current) {
        if (!current) {
          isNewRecord = won;
          return {
            tag: user.tag,
            nickname: user.nickname || user.tag,
            avatarEmoji: user.avatarEmoji || '🍺',
            wins: won ? 1 : 0,
            losses: won ? 0 : 1,
            plays: 1,
            best: vpScore,
            lastMatchId: matchId,
            updatedAt: Date.now()
          };
        }
        // Éviter de compter deux fois la même partie
        if (current.lastMatchId === matchId) {
          return current;
        }
        current.nickname = user.nickname || current.nickname;
        current.avatarEmoji = user.avatarEmoji || current.avatarEmoji || '🍺';
        current.wins = (current.wins || 0) + (won ? 1 : 0);
        current.losses = (current.losses || 0) + (won ? 0 : 1);
        current.plays = (current.plays || 0) + 1;
        if (vpScore > (current.best || 0)) {
          current.best = vpScore;
          isNewRecord = true;
        }
        current.lastMatchId = matchId;
        current.updatedAt = Date.now();
        return current;
      });

      if (won && window.GameShell && typeof window.GameShell.fireConfetti === 'function') {
        window.GameShell.fireConfetti();
      }

      return { counted: true, record: isNewRecord };
    },

    /**
     * Récupère le classement général de Catan (trié par victoires)
     */
    classement: async function () {
      const user = await waitForShellUser();
      const snap = await db.ref('scores/catan').once('value');
      const data = snap.val() || {};

      const sorted = Object.values(data).sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return (b.best || 0) - (a.best || 0);
      });

      const rows = sorted.map((p, idx) => ({
        id: p.tag,
        name: `${p.avatarEmoji || '🍺'} ${p.nickname}`,
        wins: p.wins || 0,
        plays: p.plays || 0,
        best: p.best || 0,
        rank: idx + 1,
        you: Boolean(user && p.tag === user.tag)
      }));

      return {
        mode: 'victoires',
        unit: 'victoires',
        rows: rows,
        me: rows.find(r => r.you) || null
      };
    }
  };

  window.ChadGang.reportResult = window.ChadGang.finPartie;
})();

/* =========================================================
   IMB CASINO - BLACKJACK 21 ENGINE (Étape 1)
   Sabot 6 jeux, Calcul intelligent des As, Règles Croupier & Gains
   ========================================================= */
(function () {
  'use strict';

  const SUITS = [
    { symbol: '♠', name: 'spades', color: 'black' },
    { symbol: '♥', name: 'hearts', color: 'red' },
    { symbol: '♦', name: 'diamonds', color: 'red' },
    { symbol: '♣', name: 'clubs', color: 'black' }
  ];

  const RANKS = [
    { rank: 'A', baseValue: 11 },
    { rank: '2', baseValue: 2 },
    { rank: '3', baseValue: 3 },
    { rank: '4', baseValue: 4 },
    { rank: '5', baseValue: 5 },
    { rank: '6', baseValue: 6 },
    { rank: '7', baseValue: 7 },
    { rank: '8', baseValue: 8 },
    { rank: '9', baseValue: 9 },
    { rank: '10', baseValue: 10 },
    { rank: 'J', baseValue: 10 },
    { rank: 'Q', baseValue: 10 },
    { rank: 'K', baseValue: 10 }
  ];

  /**
   * Génère et mélange un sabot de N paquets de 52 cartes (par défaut 6 jeux = 312 cartes)
   * Utilise l'algorithme de mélange non biaisé de Fisher-Yates.
   */
  function createShoe(deckCount = 6) {
    const shoe = [];
    for (let d = 0; d < deckCount; d++) {
      for (const s of SUITS) {
        for (const r of RANKS) {
          shoe.push({
            id: `${r.rank}${s.symbol}_${d}_${Math.random().toString(36).slice(2, 6)}`,
            rank: r.rank,
            suit: s.symbol,
            suitName: s.name,
            color: s.color,
            value: r.baseValue
          });
        }
      }
    }

    // Mélange Fisher-Yates
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shoe[i];
      shoe[i] = shoe[j];
      shoe[j] = tmp;
    }

    return shoe;
  }

  /**
   * Tire une carte du sabot (recrée un sabot neuf s'il reste moins de 25 cartes)
   */
  function drawCard(shoe) {
    if (!Array.isArray(shoe) || shoe.length < 25) {
      const fresh = createShoe(6);
      if (Array.isArray(shoe)) {
        shoe.length = 0;
        shoe.push(...fresh);
      } else {
        return fresh.pop();
      }
    }
    return shoe.pop();
  }

  /**
   * Évalue une main de Blackjack :
   * - Gère dynamiquement chaque As (11 ou 1) pour éviter de dépasser 21
   * - Détecte le Blackjack naturel (2 cartes = 21)
   * - Détecte le Bust (> 21)
   * - Fournit un label lisible (ex: "17", "8 / 18" pour une main souple, "BJ 21", "BUST 24")
   */
  function evaluateHand(cards, hideSecondCard = false) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return {
        total: 0,
        isSoft: false,
        isBlackjack: false,
        isBust: false,
        label: '0'
      };
    }

    const visibleCards = hideSecondCard ? [cards[0]] : cards;

    let total = 0;
    let acesCount = 0;

    for (const card of visibleCards) {
      if (!card) continue;
      if (card.rank === 'A') {
        acesCount += 1;
        total += 11;
      } else {
        total += Number(card.value) || 0;
      }
    }

    // Réduire les As de 11 à 1 tant que le total dépasse 21
    while (total > 21 && acesCount > 0) {
      total -= 10;
      acesCount -= 1;
    }

    const isSoft = acesCount > 0 && total <= 21;
    const isBlackjack = !hideSecondCard && visibleCards.length === 2 && total === 21;
    const isBust = total > 21;

    let label = String(total);
    if (isBlackjack) {
      label = 'BLACKJACK 21';
    } else if (isBust) {
      label = `BUST (${total})`;
    } else if (isSoft && total < 21) {
      label = `${total - 10} / ${total}`;
    }

    return {
      total,
      isSoft,
      isBlackjack,
      isBust,
      label
    };
  }

  /**
   * Indique si le croupier doit tirer une carte supplémentaire.
   * Règle officielle : Le croupier tire jusqu'à 16 et reste sur tout 17 (même souple).
   */
  function shouldDealerHit(dealerCards) {
    const evalDealer = evaluateHand(dealerCards, false);
    return evalDealer.total < 17;
  }

  /**
   * Vérifie si le joueur peut "Doubler" (Double Down) :
   * Autorisé uniquement avec exactement 2 cartes en main et si le solde disponible >= mise initiale.
   */
  function canDoubleDown(playerCards, currentBet, availableBalance) {
    if (!Array.isArray(playerCards) || playerCards.length !== 2) return false;
    const hand = evaluateHand(playerCards, false);
    if (hand.isBlackjack || hand.isBust) return false;
    return Number(availableBalance) >= Number(currentBet) && Number(currentBet) > 0;
  }

  /**
   * Calcule le résultat final et le paiement entre la main d'un joueur et celle du croupier.
   * @param {Array} playerCards - Cartes du joueur
   * @param {Array} dealerCards - Cartes du croupier
   * @param {number} betAmount - Mise totale engagée par le joueur sur cette main
   * @returns {Object} { outcome, title, payout, netDelta, multiplier }
   *   - payout : somme totale qui revient au joueur (mise incluse si gagné ou égalité)
   *   - netDelta : variation nette sur le solde réel Firebase (+gain ou -perte ou 0 si Push)
   */
  function resolveRound(playerCards, dealerCards, betAmount) {
    const stake = Math.max(0, Math.round(Number(betAmount) || 0));
    const pEval = evaluateHand(playerCards, false);
    const dEval = evaluateHand(dealerCards, false);

    // 1. Le joueur a dépassé 21 (Bust) -> Perdu immédiatement, même si le croupier saute après
    if (pEval.isBust) {
      return {
        outcome: 'bust',
        title: 'BUST ! Tu dépasses 21 💀',
        payout: 0,
        netDelta: -stake,
        multiplier: 0,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 2. Blackjack Naturel des deux côtés -> Égalité (Push)
    if (pEval.isBlackjack && dEval.isBlackjack) {
      return {
        outcome: 'push',
        title: 'Double Blackjack ! Égalité (Push) 🤝',
        payout: stake,
        netDelta: 0,
        multiplier: 1,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 3. Blackjack Naturel du joueur seul -> Paiement 3:2 (Mise x 2.5, soit profit net +1.5x)
    if (pEval.isBlackjack) {
      const profit = Math.floor(stake * 1.5);
      const totalPayout = stake + profit;
      return {
        outcome: 'blackjack',
        title: 'BLACKJACK NATUREL ! (×2.5) 👑',
        payout: totalPayout,
        netDelta: profit,
        multiplier: 2.5,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 4. Blackjack Naturel du croupier seul -> Le croupier bat même un 21 en 3+ cartes
    if (dEval.isBlackjack) {
      return {
        outcome: 'dealer_blackjack',
        title: 'Blackjack du Croupier... 💀',
        payout: 0,
        netDelta: -stake,
        multiplier: 0,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 5. Le croupier dépasse 21 (Dealer Bust) -> Victoire 1:1
    if (dEval.isBust) {
      return {
        outcome: 'dealer_bust',
        title: 'Le Croupier saute ! Gagnant (×2) 🎉',
        payout: stake * 2,
        netDelta: stake,
        multiplier: 2,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 6. Comparaison des totaux <= 21
    if (pEval.total > dEval.total) {
      return {
        outcome: 'win',
        title: `Victoire ! (${pEval.total} contre ${dEval.total}) 🎉`,
        payout: stake * 2,
        netDelta: stake,
        multiplier: 2,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    if (pEval.total < dEval.total) {
      return {
        outcome: 'lose',
        title: `La banque gagne (${dEval.total} contre ${pEval.total}) 💀`,
        payout: 0,
        netDelta: -stake,
        multiplier: 0,
        playerEval: pEval,
        dealerEval: dEval
      };
    }

    // 7. Même score -> Égalité (Push)
    return {
      outcome: 'push',
      title: `Égalité à ${pEval.total} (Push - Mise remboursée) 🤝`,
      payout: stake,
      netDelta: 0,
      multiplier: 1,
      playerEval: pEval,
      dealerEval: dEval
    };
  }

  window.BlackjackEngine = {
    SUITS,
    RANKS,
    createShoe,
    drawCard,
    evaluateHand,
    shouldDealerHit,
    canDoubleDown,
    resolveRound
  };
})();

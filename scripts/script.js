// --- Configuración ---
const API       = 'https://deckofcardsapi.com/api/deck';
const SUITS     = { SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' };
const RED_SUITS = new Set(['HEARTS', 'DIAMONDS']);

// --- Estado del juego ---
let deckId      = null;
let playerCards = [];
let dealerCards = [];
let gameActive  = false;

// --- Elementos del HTML ---
const elDealerHand  = document.getElementById('dealer-hand');
const elPlayerHand  = document.getElementById('player-hand');
const elDealerScore = document.getElementById('dealer-score');
const elPlayerScore = document.getElementById('player-score');
const elStatus      = document.getElementById('status');
const elResult      = document.getElementById('result');
const btnNew        = document.getElementById('btn-new');
const btnHit        = document.getElementById('btn-hit');
const btnStand      = document.getElementById('btn-stand');

// --- Eventos ---
btnNew.addEventListener('click', newGame);
btnHit.addEventListener('click', hit);
btnStand.addEventListener('click', stand);

// --- Calcula el valor de una carta ---
function cardValue(card) {
  if (['JACK', 'QUEEN', 'KING'].includes(card.value)) return 10;
  if (card.value === 'ACE') return 11;
  return parseInt(card.value);
}

// --- Suma los puntos de una mano (ajusta ases si hace falta) ---
function handScore(cards) {
  let score = 0, aces = 0;
  for (const card of cards) {
    score += cardValue(card);
    if (card.value === 'ACE') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

// --- Crea el elemento HTML de una carta (hidden = boca abajo) ---
function makeCardEl(card, hidden) {
  const div = document.createElement('div');
  if (hidden) { div.className = 'card back'; return div; }
  const label = card.value.length > 2 ? card.value[0] : card.value;
  div.className = `card ${RED_SUITS.has(card.suit) ? 'red' : 'black'}`;
  div.innerHTML = `
    <div class="corner top">${label}<br>${SUITS[card.suit]}</div>
    <div class="center-suit">${SUITS[card.suit]}</div>
    <div class="corner bot">${label}<br>${SUITS[card.suit]}</div>`;
  return div;
}

// --- Dibuja todas las cartas de una mano ---
function renderHand(cards, container, hideFirst) {
  container.innerHTML = '';
  cards.forEach((card, i) => container.appendChild(makeCardEl(card, hideFirst && i === 0)));
}

// --- Helpers de UI ---
function setStatus(msg)            { elStatus.textContent = msg; }
function setScore(el, score, hide) { el.textContent = hide ? '?' : 'Puntos: ' + score; }
function setButtons(playing)       { btnHit.disabled = btnStand.disabled = !playing; btnNew.disabled = playing; }
function showResult(type, msg)     { elResult.className = 'show ' + type; elResult.textContent = msg; elStatus.textContent = ''; }
function delay(ms)                 { return new Promise(r => setTimeout(r, ms)); }
async function apiFetch(url)       { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }

// --- Nueva partida ---
async function newGame() {
  elResult.className = elResult.textContent = '';
  elDealerHand.innerHTML = '<div class="loading">Barajando...</div>';
  elPlayerHand.innerHTML = elDealerScore.textContent = elPlayerScore.textContent = '';
  setStatus('Repartiendo...'); setButtons(false);

  try {
    if (!deckId) { const d = await apiFetch(API + '/new/shuffle/?deck_count=6'); deckId = d.deck_id; }
    else await apiFetch(API + '/' + deckId + '/shuffle/');

    const draw = await apiFetch(API + '/' + deckId + '/draw/?count=4');
    playerCards = [draw.cards[0], draw.cards[2]];
    dealerCards = [draw.cards[1], draw.cards[3]];
    gameActive  = true;

    renderHand(playerCards, elPlayerHand, false);
    renderHand(dealerCards, elDealerHand, true);
    setScore(elPlayerScore, handScore(playerCards));
    setScore(elDealerScore, 0, true);

    if (handScore(playerCards) === 21) await dealerTurn();
    else { setStatus('Pide carta o plantate'); setButtons(true); }

  } catch (err) {
    deckId = null;
    elDealerHand.innerHTML = '';
    setStatus('Error de conexion. Intenta de nuevo.');
  }
}

// --- El jugador pide una carta ---
async function hit() {
  if (!gameActive) return;
  setButtons(false); setStatus('Pidiendo carta...');

  const draw = await apiFetch(API + '/' + deckId + '/draw/?count=1');
  playerCards.push(draw.cards[0]);
  renderHand(playerCards, elPlayerHand, false);
  const score = handScore(playerCards);
  setScore(elPlayerScore, score);

  if      (score > 21) { gameActive = false; renderHand(dealerCards, elDealerHand, false); setScore(elDealerScore, handScore(dealerCards)); showResult('lose', 'Te pasaste'); }
  else if (score === 21) await dealerTurn();
  else { setStatus('Pide otra carta o plantate'); setButtons(true); }
}

// --- El jugador se planta ---
async function stand() {
  if (!gameActive) return;
  gameActive = false; setButtons(false); setStatus('Turno del crupier...');
  await dealerTurn();
}

// --- El crupier roba hasta tener 17 o mas ---
async function dealerTurn() {
  gameActive = false; setButtons(false);
  renderHand(dealerCards, elDealerHand, false);
  setScore(elDealerScore, handScore(dealerCards));

  while (handScore(dealerCards) < 17) {
    await delay(750);
    const draw = await apiFetch(API + '/' + deckId + '/draw/?count=1');
    dealerCards.push(draw.cards[0]);
    renderHand(dealerCards, elDealerHand, false);
    setScore(elDealerScore, handScore(dealerCards));
  }

  await delay(400);
  evaluate();
}

// --- Compara puntuaciones y muestra el resultado ---
function evaluate() {
  const p  = handScore(playerCards);
  const d  = handScore(dealerCards);
  const bj = p === 21 && playerCards.length === 2;

  if      (bj && d !== 21) showResult('win',  'Blackjack, ganaste');
  else if (p > 21)         showResult('lose', 'Te pasaste');
  else if (d > 21)         showResult('win',  'El crupier se paso, ganaste');
  else if (p > d)          showResult('win',  'Ganaste');
  else if (d > p)          showResult('lose', 'Perdiste');
  else                     showResult('tie',  'Empate');
}
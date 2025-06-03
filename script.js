const board = document.getElementById("board");
const turnIndicator = document.getElementById("turn-indicator");
const BOARD_SIZE = 8;

let currentPlayer = "red";
let selectedPiece = null;
let piecesCounter = {"red": 0, "yellow": 0};

// boardState[r][c] = null or { player: 'red'|'yellow', king: boolean }
const boardState = [];

function initBoard() {
    board.innerHTML = "";
    boardState.length = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        boardState[r] = new Array(BOARD_SIZE).fill(null);

        for (let c = 0; c < BOARD_SIZE; c++) {
            const square = document.createElement("div");
            square.classList.add("square");
            square.dataset.row = r;
            square.dataset.col = c;

            if ((r + c) % 2 === 1) {
            square.classList.add("dark");

            if (r < 3) {
                placePiece(square, "yellow");
                boardState[r][c] = { player: "yellow", king: false };
            } else if (r > 4) {
                placePiece(square, "red");
                boardState[r][c] = { player: "red", king: false };
            }
            } else {
                square.classList.add("light");
            }

            square.addEventListener("click", handleClick);
            board.appendChild(square);
        }
    }

    currentPlayer = "red";
    selectedPiece = null;
    piecesCounter = {"red": 0, "yellow": 0};
    clearHighlights();
    updateTurnIndicator();  
}

// Create piece element and add to square
function placePiece(square, player, king = false) {
    const piece = document.createElement("div");
    piece.classList.add("piece", player);
    if (king) piece.classList.add("king");
    square.appendChild(piece);
}

function clearHighlights() {
    document.querySelectorAll(".highlight").forEach(el => el.classList.remove("highlight"));
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    // Clear any custom dataset flags like capture
    document.querySelectorAll(".square").forEach(sq => delete sq.dataset.capture);
}

function isOnBoard(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

// Return array of valid moves: { row, col, capture: bool, capturedPos? }
function getValidMoves(row, col, mustCaptureOnly = false) {
    const moves = [];
    const piece = boardState[row][col];
    if (!piece) return moves;

    const directions = [];

    if (piece.king) {
        directions.push([-1, -1], [-1, +1], [+1, -1], [+1, +1]);
    } else if (piece.player === "red") {
        directions.push([-1, -1], [-1, +1]);
    } else {
        directions.push([+1, -1], [+1, +1]);
    }

    for (const [dr, dc] of directions) {
        const r1 = row + dr;
        const c1 = col + dc;

        // Basic move (non-capture)
        if (isOnBoard(r1, c1) && !boardState[r1][c1] && !mustCaptureOnly) {
            moves.push({ row: r1, col: c1, capture: false });
        }

        // Capture move
        const r2 = row + 2 * dr;
        const c2 = col + 2 * dc;

        if (
            isOnBoard(r2, c2) &&
            !boardState[r2][c2] &&
            boardState[r1][c1] &&
            boardState[r1][c1].player !== piece.player
        ) {
            moves.push({ row: r2, col: c2, capture: true, capturedPos: [r1, c1] });
        }
    }

    if (mustCaptureOnly) {
        return moves.filter(m => m.capture);
    }
    return moves;
}

// Check if a player has any captures anywhere on the board
function playerHasCapture(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = boardState[r][c];
            if (p && p.player === player) {
                if (getValidMoves(r, c, true).length > 0) return true;
            }
        }
    }
    return false;
}

function movePiece(piece, targetSquare) {
    const fromSquare = piece.parentElement;
    const fromRow = +fromSquare.dataset.row;
    const fromCol = +fromSquare.dataset.col;
    const toRow = +targetSquare.dataset.row;
    const toCol = +targetSquare.dataset.col;

    // Get valid moves with forced capture if any available
    const moves = getValidMoves(fromRow, fromCol, playerHasCapture(currentPlayer));
    const move = moves.find(m => m.row === toRow && m.col === toCol);
    if (!move) return false;

    // Update board state
    boardState[toRow][toCol] = boardState[fromRow][fromCol];
    boardState[fromRow][fromCol] = null;

    // Move DOM piece
    targetSquare.appendChild(piece);

    // Handle capture removal
    if (move.capture) {
        const [capR, capC] = move.capturedPos;
        boardState[capR][capC] = null;
        const capSquare = document.querySelector(`.square[data-row="${capR}"][data-col="${capC}"]`);
        if (capSquare && capSquare.firstChild) {
            capSquare.removeChild(capSquare.firstChild);
            piecesCounter[currentPlayer] = piecesCounter[currentPlayer] + 1;
        }
    }

  // Promote to king if reaches opponent baseline
    if (!boardState[toRow][toCol].king) {
        if (
            (boardState[toRow][toCol].player === "red" && toRow === 0) ||
            (boardState[toRow][toCol].player === "yellow" && toRow === BOARD_SIZE - 1)
        ) {
            boardState[toRow][toCol].king = true;
            piece.classList.add("king");
        }
    }
    return move.capture;
}

function updateTurnIndicator() {
    turnIndicator.textContent = `${capitalize(currentPlayer)}'s Turn`;
    turnIndicator.style.color = currentPlayer === "red" ? "#ff4d4d" : "#ffe066";
}
  
function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}
  

function switchPlayer() {
    currentPlayer = currentPlayer === "red" ? "yellow" : "red";
    selectedPiece = null;
    clearHighlights();
    updateTurnIndicator();
}



function handleClick(e) {
    const square = e.currentTarget;
    const piece = square.querySelector(".piece");

    // If clicking own piece, select and highlight moves
    if (piece && piece.classList.contains(currentPlayer)) {
        // If there are forced captures anywhere on board, only allow selecting pieces with captures
        if (playerHasCapture(currentPlayer) && getValidMoves(+square.dataset.row, +square.dataset.col, true).length === 0) {
            // Trying to select piece that cannot capture when captures are mandatory
            return; // do nothing
        }

        selectedPiece = piece;
        highlightValidMoves(square);
        return;
    }

  // Clicking a highlighted square to move
    if (square.classList.contains("highlight") && selectedPiece) {
        const didCapture = movePiece(selectedPiece, square);
        clearHighlights();
        const toRow = +square.dataset.row;
        const toCol = +square.dataset.col;

        if (didCapture) {
            // Check for possible multi-jump from new position
            if (getValidMoves(toRow, toCol, true).length > 0) {
            // Must continue jump with same piece
            selectedPiece = square.querySelector(".piece");
            highlightValidMoves(square);
            return; // Don't switch player yet
            }
        }

        if (piecesCounter["red"] == 12 || piecesCounter["yellow"] == 12){
            endGame();
            return;
        }
        // No more captures or normal move, switch turn
        switchPlayer();
        return;
    }

  // Clicked empty or invalid square, clear selection
  clearHighlights();
  selectedPiece = null;
}

function endGame() {
    alert(capitalize(currentPlayer) + " Wins");
    initBoard();
}

function highlightValidMoves(square) {
    clearHighlights();

    const row = +square.dataset.row;
    const col = +square.dataset.col;

    const mustCapture = playerHasCapture(currentPlayer);
    const moves = getValidMoves(row, col, mustCapture);

    // Only highlight if there are valid moves
    if (moves.length === 0) return;

    moves.forEach(m => {
        const sel = `.square[data-row="${m.row}"][data-col="${m.col}"]`;
        const targetSquare = document.querySelector(sel);
        if (targetSquare) {
            targetSquare.classList.add("highlight");
            if (m.capture) targetSquare.dataset.capture = "true";
        }
    });

    square.classList.add("selected");
}

// Initialize the board on page load
initBoard();

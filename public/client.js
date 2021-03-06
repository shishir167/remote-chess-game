(function() {
    var socket, serverGame;
    var username, playerColor, otherUser, penalty;
    var game, board;
    var usersOnline = [];
    var myGames = [];
    socket = io('http://localhost');
    var clock;

    socket.on('login', function(msg) {
        usersOnline = msg.users;
        updateUserList();

        myGames = msg.games;

    });

    socket.on('resign', function(userInfo) {
        if(serverGame && userInfo.gameId === serverGame.id && username === userInfo.userId) {
            socket.emit('login', username);
            $('#page-game').hide();
            $('#page-lobby').show();
            var resignPopup = $('#popup-element-resign-received').bPopup({modalClose: false, escClose: false});
            resignPopup.reposition(100);
            $('#game-resign-message').text(userInfo.opponentId + ' has resigned the game, you won!');
            $('#game-resign-received-ok').on('click', function() {
                resignPopup.close();
            });
        }
    });

    socket.on('invite-receive', function(info) {
        if(info.userId === username) {
            var bpopup = $('#popup-element-request').bPopup({modalClose: false, escClose: false});
            bpopup.reposition(100);
            $('#sender').text(info.sender);
            $('#request-accept').unbind().on('click', function() {
                socket.emit('invite-accept', info);
            });
            $('#request-decline').unbind().on('click', function() {
                socket.emit('invite-decline', info);
                bpopup.close();
                socket.emit('login', info.userId);
            });
        }
    });

    socket.on('receive-invite-decline', function(opponentId) {
        $('#popup-element-request').bPopup().close();
        $('#popup-element-request-sent').bPopup().close();
        socket.emit('login', username);
        $('#page-game').hide();
        $('#page-lobby').show();
        var declinePopup = $('#popup-element-request-decline').bPopup({modalClose: false, escClose: false});
        declinePopup.reposition(100);
        $('#game-request-decline').text(opponentId + ' declined your request to play!');
        $('#game-request-decline-ok').on('click', function() {
            declinePopup.close();
        });
    });

    socket.on('joinlobby', function(msg) {
        addUser(msg);
    });

    socket.on('leavelobby', function(msg) {
        removeUser(msg);
    });


    socket.on('joingame', function(msg) {
        $('#popup-element-request').bPopup().close();
        $('#popup-element-request-sent').bPopup().close();
        playerColor = msg.color;
        otherUser = msg.otherUser;
        penalty = 3;
        initGame(msg.game);
        $('#page-lobby').hide();
        $('#page-game').show();
        $('#opponent').text(otherUser);
        $('#penalty').text(penalty);
        $('#current-turn').text(getInTurnPlayer());
    });

    socket.on('start-time', function(gameInfo) {
        if (serverGame && gameInfo.gameId === serverGame.id) {
            clock = $('.clock').FlipClock(gameInfo.time, {
                clockFace: 'Counter',
                autoStart: true,
                countdown: true,
                callbacks: {
                    stop: function() {
                        updatePenalty();
                    }
                }
            });
        }
    });

    socket.on('request-cancel', function(users) {
        if(username === users.sender) {
            socket.emit('login', username);
            $('#page-login').hide();
            $('#page-lobby').show();
        } else if(username === users.userId) {
            $('#popup-element-request').bPopup().close();
            $('#popup-element-request-sent').bPopup().close();
            socket.emit('login', username);
            $('#page-game').hide();
            $('#page-lobby').show();
            var declinePopup = $('#popup-element-request-decline').bPopup({modalClose: false, escClose: false});
            declinePopup.reposition(100);
            $('#game-request-decline').text(users.sender + ' cancelled the request!');
            $('#game-request-decline-ok').on('click', function() {
                declinePopup.close();
            });
        }
    });

    socket.on('move', function(msg) {
        if (serverGame && msg.gameId === serverGame.id) {
            game.move(msg.move);
            board.position(game.fen());
            $('#current-turn').text(getInTurnPlayer());
        }
    });

    socket.on('game-end', function(msg) {
        if (serverGame && msg.gameId === serverGame.id) {
            showEndGamePopup();
        }
    });

    socket.on('logout', function(msg) {
        removeUser(msg.userId);
    });

    socket.on('valid-username', function(isValid) {
      if(isValid) {
        $('#userLabel').text('You are checked in as: ' + username);
        socket.emit('login', username);
        $('#page-login').hide();
        $('#page-lobby').show();
      } else {
        var bpopup = $('#popup-element-duplicate-username').bPopup({modalClose: false, escClose: false});
        bpopup.reposition(100);
        $('#popup-dup-ok').unbind().on('click', function() {
          bpopup.close();
          $('#username').val('');
        });
      }
    });
    socket.on('reset-time', function(gameInfo) {
        if(serverGame && serverGame.id === gameInfo.gameId && clock) {
            clock.setTime(gameInfo.time);
            clock.start();
        }
    });

    $('#login').on('click', function() {
        username = $('#username').val();
        if (username.length > 0) {
          socket.emit('validate-username', username);
        }
    });

    $('#game-resign').click(function() {
        var bpopup = $('#popup-element-forfeit').bPopup({modalClose: false, escClose: false});
        bpopup.reposition(100);
        $('#resign-accept').unbind().on('click', function() {
            bpopup.close();
            socket.emit('resign', {
                userId: username,
                gameId: serverGame.id,
                otherUser: otherUser
            });
            socket.emit('login', username);
            $('#page-game').hide();
            $('#page-lobby').show();
        });
        $('#resign-decline').unbind().on('click', function() {
            bpopup.close();
        });
    });

    var addUser = function(userId) {
        usersOnline.push(userId);
        updateUserList();
    };

    var removeUser = function(userId) {
        for (var i = 0; i < usersOnline.length; i++) {
            if (usersOnline[i] === userId) {
                usersOnline.splice(i, 1);
            }
        }
        updateUserList();
    };

    var updateUserList = function() {
        document.getElementById('userList').innerHTML = 'No users online';
        if (usersOnline.length > 0) {
            usersOnline.forEach(function(user) {
                $('#userList').append($('<a href="#" class="row list-group-item">')
                    .text(user)
                    .on('click', function() {
                        var bpopup = $('#popup-element-request-sent').bPopup({modalClose: false, escClose: false});
                        bpopup.reposition(100);
                        $('#game-request-sent-message').text('Waiting for ' + user + ' to accept or decline your request...');
                        socket.emit('invite', user);
                        $('#request-sent-cancel').unbind().on('click', function() {
                            bpopup.close();
                            socket.emit('invite-cancel', {
                                sender: username,
                                userId: user
                            });
                        });
                    }));
            });
        }
    };

    var getInTurnPlayer = function() {
        var currentPlayer = '';
        if(game.turn() === 'w') {
            if(playerColor === 'black') {
                currentPlayer = otherUser;
            } else {
                currentPlayer = username;
            }
        } else if(game.turn() === 'b') {
            if(playerColor === 'white') {
                currentPlayer = otherUser;
            } else {
                currentPlayer = username;
            }
        }
        return currentPlayer;
    };

    var initGame = function(serverGameState) {
        serverGame = serverGameState;

        var cfg = {
            draggable: true,
            showNotation: false,
            orientation: playerColor,
            position: serverGame.board ? serverGame.board : 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onMouseoutSquare: onMouseoutSquare,
            onMouseoverSquare: onMouseoverSquare,
            onSnapEnd: onSnapEnd
        };

        game = serverGame.board ? new Chess(serverGame.board) : new Chess();
        board = new ChessBoard('game-board', cfg);
    };

    var onMouseoverSquare = function(square) {
        // get list of possible moves for this square
        var moves = game.moves({
            square: square,
            verbose: true
        });

        // exit if there are no moves available for this square
        if (moves.length === 0) return;

        // highlight the square they moused over
        greySquare(square);

        // highlight the possible squares for this piece
        for (var i = 0; i < moves.length; i++) {
            greySquare(moves[i].to);
        }
    };

    var greySquare = function(square) {
        var squareEl = $('#game-board .square-' + square);

        var background = '#a9a9a9';
        if (squareEl.hasClass('black-3c85d') === true) {
            background = '#696969';
        }

        squareEl.css('background', background);
    };

    var onMouseoutSquare = function() {
        removeGreySquares();
    };

    var removeGreySquares = function() {
        $('#game-board .square-55d63').css('background', '');
    };

    var onDragStart = function(source, piece) {
        if (game.game_over() === true ||
            (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
            (game.turn() !== playerColor[0])) {
            return false;
        }
    };

    var onDrop = function(source, target) {
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        if (move === null) {
            return 'snapback';
        } else {
            socket.emit('move', {
                move: move,
                gameId: serverGame.id,
                board: game.fen()
            });
            socket.emit('reset-time', serverGame.id);
            $('#current-turn').text(getInTurnPlayer());
            checkGameEnd();
        }
    };

    var checkGameEnd = function(){
        if (game.game_over()){
            socket.emit('game-end', {
                gameId: serverGame.id
            });
            showEndGamePopup();
        }
    };

    var showEndGamePopup = function(){
        clock = null;
        var bpopup = $('#popup-element-game-over').bPopup({modalClose: false, escClose: false});
        bpopup.reposition(100);
            if(game.in_draw()){
                $('#match-winner').text("Game draw!");;
            }
            else{
                if(game.turn() === 'b'){
                    $('#match-winner').text("White won!");;
                }
                if(game.turn() === 'w'){
                    $('#match-winner').text("Black won!");;
                }
            }
            $('#match-winner-ok').unbind().on('click', function() {
                bpopup.close();
                $('#page-game').hide();
                $('#page-lobby').show();
                socket.emit('login', username);
        });
    };

    var onSnapEnd = function() {
        board.position(game.fen());
    };
    var updatePenalty = function() {
        if(getInTurnPlayer() === username) {
            penalty -= 1;
            $('#penalty').text(penalty);
            socket.emit('reset-time', serverGame.id);
        }
        if(penalty === 0) {
            socket.emit('game-end', {
                gameId: serverGame.id
            });
            showEndGamePopup();
        }
    };
})();

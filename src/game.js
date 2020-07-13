'use strict';

/*
Объявление переменных привяка к DOM

* */

// game.html State
const $mapCanvas = document.getElementById('gameCanvas');

// game.html UI
(function (app, $) {
    (function (game) {
        game.GameView = (function () {
            function getGame() {
                return {
                    $gameCaption: document.getElementById('gameCaption'),
                    $switchTimer: document.getElementById('switchTimer'),
                    team1: {
                        $container: document.getElementById('team1'),
                        $caption: document.getElementById('team1Caption'),
                        $players: document.getElementById('team1users'),
                        $lives: document.getElementById('team1Lives'),
                        $coins: document.getElementById('team1Coins')
                    },
                    team2: {
                        $container: document.getElementById('team2'),
                        $caption: document.getElementById('team2Caption'),
                        $players: document.getElementById('team2users'),
                        $lives: document.getElementById('team2Lives'),
                        $coins: document.getElementById('team2Coins')
                    },
                    mapBuffer: null,
                    $mapCanvas,
                    mapCellSize: 25
                };
            }

            function getButtons() {
                return {
                    $btnGameList: document.getElementById("btnGameList"),
                    $btnStart: document.getElementById("btnStart"),
                    $btnConnect: document.getElementById("btnConnect"),
                    $btnConnectPolice: document.getElementById("btnConnectPolice"),
                    $btnConnectThief: document.getElementById("btnConnectThief"),
                    $btnLeave: document.getElementById("btnLeave"),
                    $btnPause: document.getElementById("btnPause"),
                    $btnCancel: document.getElementById("btnCancel")
                };
            }

            function getImages() {
                return {
                    imgHeart: document.getElementById('img_heart'),
                    imgCoin: document.getElementById('img_coin'),
                    imgPolice: document.getElementById('img_police'),
                    imgPoliceSelf: document.getElementById('img_police_self'),
                    imgThief: document.getElementById('img_thief'),
                    imgThiefSelf: document.getElementById('img_thief_self'),
                    imgSwitch: document.getElementById('img_switch')
                };
            }

            function setMapCanvasSizing($canvas, width, height) {
                $canvas.style.width = `${width}px`;
                $canvas.style.height = `${height}px`;
                $canvas.width = `${width}`;
                $canvas.height = `${height}`;
                return $canvas;
            }

            function drawMapField(canvas, map, width, height, cellSize) {
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = "#C0C0C0";
                ctx.strokeWidth = "1px";
                for (var i = 0; i < map.cells.length; i++) {
                    var cell = map.cells[i];
                    var x = i % map.width;
                    var y = Math.floor(i / map.width);
                    if (cell === GameApi.MapCellType.wall) {
                        ctx.fillStyle = "#C0C0C0";
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    } else {
                        ctx.fillStyle = "#FFFFFF";
                        ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                        ctx.stroke();
                    }
                }
            }

            function getCanvasBuffer(width, height, map, cellSize) {
                var canvas = setMapCanvasSizing($mapCanvas, width, height);
                drawMapField(canvas, map, width, height, cellSize);
                return canvas;
            }

            function getMapCellSize(map) {
                return map.width <= 20 ? 25 : 15;
            }

            function GameView($container, $loading, $error, gameState) {
                this.imgRotationAngle = 0;
                this.imgRotationPeriod = 10;
                this.imgRotationTimer = null;
                this.$container = $container;
                this.$loading = $loading;
                this.$error = $error;
                this.state = gameState;
                this.btns = getButtons();
                this.imgs = getImages();
                this.game = getGame();
                this.bindEvents();
                this.bindButtons();

            }

            GameView.prototype.bindEvents = function () {
                var c = this.state.callbacks;
                c.captionChanged.add(function (name, status) {
                    this.setGameCaption(name, status);
                }.bind(this));
                c.invalidGame.add(function () {
                    this.showError();
                }.bind(this));
                c.mapChanged.add(function (map) {
                    this.updateMap(map);
                }.bind(this));
                c.playerChanged.add(function (player) {
                    this.updatePlayer(player);
                }.bind(this));
                c.statusChanged.add(function (status) {
                    this.setButtons(status);
                    this.toggleRotation(status);
                }.bind(this));
                c.synced.add(function () {
                    this.show();
                }.bind(this));
                c.syncing.add(function () {
                    this.showLoading();
                }.bind(this));
                c.teamCaptionChanged.add(function (team) {
                    this.updateTeamCaption(team);
                }.bind(this));
                c.teamCoinsChanged.add(function (team) {
                    this.updateTeamCoins(team);
                }.bind(this));
                c.teamLivesChanged.add(function (team) {
                    this.updateTeamLives(team);
                }.bind(this));
                c.teamPlayersChanged.add(function (team) {
                    this.updateTeam(team);
                }.bind(this));
                c.timerChanged.add(function (data) {
                    this.setTimer(data);
                }.bind(this));
            };
            GameView.prototype.bindButtons = function () {
                const btns = this.btns;
                let $lastKey = -1;
                btns.$btnGameList.addEventListener('click', () => window.location.replace("index.html"));
                btns.$btnStart.addEventListener('click', () => this.state.game.start());
                btns.$btnConnect.addEventListener('click', () => this.state.game.join(GameApi.GameTeamRole.random));
                btns.$btnConnectPolice.addEventListener('click', () => this.state.game.join(GameApi.GameTeamRole.police));
                btns.$btnConnectThief.addEventListener('click', () => this.state.game.join(GameApi.GameTeamRole.thief));
                btns.$btnLeave.addEventListener('click', () => this.state.game.leave());
                btns.$btnPause.addEventListener('click', () => this.state.game.pause());
                btns.$btnCancel.addEventListener('click', () => this.state.game.cancel());

                $(window).on('keydown', function (event) {
                    if ($lastKey === event.keyCode) {
                        return;
                    }
                    switch (event.keyCode) {
                        case 32:
                            event.preventDefault();
                            this.state.game.stopMoving();
                            break;
                        case 37:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.left);
                            break;
                        case 38:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.top);
                            break;
                        case 39:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.right);
                            break;
                        case 40:
                            event.preventDefault();
                            this.state.game.beginMove(GameApi.MoveDirection.bottom);
                            break;
                    }
                    //console.log(event);
                }.bind(this));
                $(window).on('keyup', function () {
                    $lastKey = -1;
                }.bind(this));
            };
            GameView.prototype.toggleRotation = function (status) {
                if (status === GameApi.GameStatus.inProcess) {
                    if (!this.imgRotationTimer) {
                        this.imgRotationTimer = setInterval(function () {
                            this.imgRotationAngle += this.imgRotationPeriod;
                            if (this.imgRotationAngle >= 360) {
                                this.imgRotationAngle = 0;
                            }
                            this.updateMap();
                        }.bind(this), 50);
                    }
                } else if (this.imgRotationTimer) {
                    clearInterval(this.imgRotationTimer);
                    this.imgRotationTimer = null;
                }
            };
            GameView.prototype.drawObject = function (ctx, objType, x, y, cellSize) {
                var img = null;
                switch (objType) {
                    case GameApi.MapCellType.coin:
                        img = this.imgs.imgCoin;
                        break;
                    case GameApi.MapCellType.life:
                        img = this.imgs.imgHeart;
                        break;
                    case GameApi.MapCellType.swtch:
                        img = this.imgs.imgSwitch;
                        break;
                }
                if (img) {
                    ctx.drawImage(img, cellSize * x + 2, cellSize * y + 2, cellSize - 4, cellSize - 4);
                }
            };
            GameView.prototype.drawPlayer = function (ctx, playerId, police, x, y, cellSize) {
                var self = this.state.gameApi.questor.user.id === playerId;
                var halfCell = cellSize / 2;
                var img = police ? (self ? this.imgs.imgPoliceSelf : this.imgs.imgPolice) :
                    self ? this.imgs.imgThiefSelf : this.imgs.imgThief;
                ctx.save();

                ctx.translate(x * cellSize + halfCell, y * cellSize + halfCell);
                ctx.rotate(this.imgRotationAngle * Math.PI / 180);
                ctx.drawImage(img, 2 - halfCell, 2 - halfCell, cellSize - 4, cellSize - 4);

                ctx.restore();
            };
            GameView.prototype.drawTeam = function (ctx, team, cellSize) {
                var police = team.role === GameApi.GameTeamRole.police;
                $.each(team.players, function (playerId) {
                    var player = team.players[playerId];
                    if (player.alive) {
                        this.drawPlayer(ctx, playerId, police, player.x, player.y, cellSize);
                    }
                }.bind(this));
            };
            GameView.prototype.updateMap = function (map) {
                map = map || this.state.map;
                if (!this.game.mapBuffer) {
                    this.game.mapCellSize = getMapCellSize(map);
                    var width = map.width * this.game.mapCellSize;
                    var height = map.height * this.game.mapCellSize;
                    setMapCanvasSizing(this.game.$mapCanvas, width, height);
                    this.game.mapBuffer = getCanvasBuffer(width, height, map, this.game.mapCellSize);
                }
                var ctx = this.game.$mapCanvas.getContext("2d");
                var cellSize = this.game.mapCellSize;
                ctx.drawImage(this.game.mapBuffer, 0, 0);
                for (var i = 0; i < map.cells.length; i++) {
                    var cell = map.cells[i];
                    var x = i % map.width;
                    var y = Math.floor(i / map.width);
                    this.drawObject(ctx, cell, x, y, cellSize);
                }
                if (this.state.status !== GameApi.GameStatus.open &&
                    this.state.status !== GameApi.GameStatus.ready) {
                    this.drawTeam(ctx, this.state.teams.team1, cellSize);
                    this.drawTeam(ctx, this.state.teams.team2, cellSize);
                }
            };
            GameView.prototype.setGameCaption = function (name, status) {
                name = name || this.state.name;
                status = status || this.state.status;
                utils.reWriteDomElement(this.game.$gameCaption, utils.templator(
                    "<div class='game-caption-name'>{name} <span class='game-caption-status game-caption-status-{status}'>{statusName}</span></div>",
                    {name: name, status: status, statusName: utils.getStatusName(status)})
                );
            };
            GameView.prototype.setTimer = function (data) {
                var seconds = data.s;
                var minutes = data.m;
                var timerState = minutes > 0 || seconds > 30 ? "game-timer-ok" :
                    seconds > 15 ? "game-timer-warn" : "game-timer-cri";
                if (seconds < 10) {
                    seconds = "0" + seconds;
                }
                if (minutes < 10) {
                    minutes = "0" + minutes;
                }
                utils.reWriteDomElement(this.game.$switchTimer, utils.templator(
                    "<span class='{state}'>{m}:{s}</span>", {state: timerState, m: minutes, s: seconds})
                );
            };
            GameView.prototype.getPlayer = function (player) {
                var status = player.alive ?
                    (player.connected ? "ac" : "ad") :
                    player.connected ? "dc" : "dd";
                return $(utils.templator(
                    "<div id='player{playerId}' class='game-player game-player-status-{status}'>" +
                    "<span class='game-player-name'>{name}</span>" +
                    " [<span class='game-player-coins'>{coins}</span>;" +
                    "<span class='game-player-lives'>{lives}</span>;" +
                    "<span class='game-player-deaths'>{deaths}</span>]" +
                    "</div>", {
                        playerId: player.id,
                        status: status,
                        name: player.name,
                        coins: player.coins,
                        lives: player.lives,
                        deaths: player.deaths
                    }));
            };
            GameView.prototype.updatePlayer = function (player) {
                var $p = $("#player" + player.id);
                $p.replaceWith(this.getPlayer(player));
            };
            GameView.prototype.getTeam = function (team) {
                if (team == this.state.teams.team1) {
                    return this.game.team1;
                }
                return this.game.team2;
            };
            GameView.prototype.setTeamCaption = function (team, $team) {
                if (team.winner) {
                    utils.addClasses($team.$container, 'game-team-winner')
                }
                var role = team.role === GameApi.GameTeamRole.police ? "police" : "thief";
                utils.removeClasses($team.$container, ['police', 'thief'])
                utils.addClasses($team.$container, role)
                utils.reWriteDomElement($team.$caption, `<div class='game-team-${role}-caption'>
                    <span class='game-team-name'>${team.name}</span>
                    <span class='game-team-role game-team-role-${role}'>${ROLE_TITLES[team.role] || ROLE_TITLES[team.role]}</span>
                    </div>`
                );
            };
            GameView.prototype.setTeam = function (team, $team) {
                this.setTeamCaption(team, $team);
                utils.reWriteDomElement($team.$lives, team.lives);
                utils.reWriteDomElement($team.$coins, team.coins);
                utils.reWriteDomElement($team.$players, '');
                for (const player in team.players) {
                    utils.writeDomElement($team.$players, this.getPlayer(player));
                }
            };
            GameView.prototype.updateTeam = function (team) {
                var $team = this.getTeam(team);
                this.setTeam(team, $team);
            };
            GameView.prototype.updateTeamCaption = function (team) {
                var $team = this.getTeam(team);
                this.setTeamCaption(team, $team);
            };
            GameView.prototype.updateTeamLives = function (team) {
                var $team = this.getTeam(team);
                utils.reWriteDomElement($team.$lives, team.lives);
            };
            GameView.prototype.updateTeamCoins = function (team) {
                var $team = this.getTeam(team);
                utils.reWriteDomElement($team.$coins, team.coins);
            };
            GameView.prototype.setButtons = function (status) {
                status = status || this.state.status;
                const btns = this.btns;
                if (status === GameApi.GameStatus.canceled || status === GameApi.GameStatus.finished) {
                    utils.addClasses(btns.$btnStart, 'hidden');
                    utils.addClasses(btns.$btnLeave, 'hidden');
                    utils.addClasses(btns.$btnPause, 'hidden');
                    utils.addClasses(btns.$btnCancel, 'hidden');
                    utils.addClasses(btns.$btnConnect, 'hidden');
                    utils.addClasses(btns.$btnConnectThief, 'hidden');
                    utils.addClasses(btns.$btnConnectPolice, 'hidden');
                    return;
                }
                const currentUser = this.state.gameApi.questor.user.id;
                const isOwner = currentUser === this.state.owner.id;
                const isAdmin = this.state.gameApi.questor.user.isAdmin;
                const connected = this.state.getPlayer(currentUser) ? true : false;

                const initBtnsStartCancel = ()=>{
                    if (isOwner) {
                        utils.removeClasses(btns.$btnStart, "hidden");
                        utils.removeClasses(btns.$btnCancel, "hidden");
                    } else {
                        utils.addClasses(btns.$btnStart, "hidden");
                        if (isAdmin) {
                            utils.removeClasses(btns.$btnCancel, "hidden");
                        } else {
                            utils.addClasses(btns.$btnCancel, "hidden");
                        }
                    }
                }

                if (this.state.status === GameApi.GameStatus.open ||
                    this.state.status === GameApi.GameStatus.ready) {
                    utils.addClasses(btns.$btnPause, "hidden");
                    initBtnsStartCancel();

                    if (connected) {
                        utils.removeClasses(btns.$btnLeave, "hidden");
                        utils.addClasses(btns.$btnConnect, "hidden");
                        utils.addClasses(btns.$btnConnectThief, "hidden");
                        utils.addClasses(btns.$btnConnectPolice, "hidden");
                    } else {
                        utils.addClasses(btns.$btnLeave, "hidden");
                        utils.removeClasses(btns.$btnConnect, "hidden");
                        utils.removeClasses(btns.$btnConnectThief, "hidden");
                        utils.removeClasses(btns.$btnConnectPolice, "hidden");
                    }
                    return;
                }

                initBtnsStartCancel();
                if (this.state.status === GameApi.GameStatus.starting ||
                    this.state.status === GameApi.GameStatus.inProcess) {
                    utils.addClasses(btns.$btnStart, "hidden");
                    utils.addClasses(btns.$btnLeave, "hidden");
                    utils.addClasses(btns.$btnConnect, "hidden");
                    utils.addClasses(btns.$btnConnectThief, "hidden");
                    utils.addClasses(btns.$btnConnectPolice, "hidden");
                } else {
                    utils.addClasses(btns.$btnPause, "hidden");
                    utils.addClasses(btns.$btnLeave, "hidden");
                    utils.addClasses(btns.$btnConnect, "hidden");
                    utils.addClasses(btns.$btnConnectThief, "hidden");
                    utils.addClasses(btns.$btnConnectPolice, "hidden");
                }
            };
            GameView.prototype.showLoading = function () {
                utils.addClasses(this.$container, 'hidden')
                utils.addClasses(this.$error, 'hidden')
                utils.removeClasses(this.$loading, 'hidden')
            };
            GameView.prototype.showError = function () {
                utils.addClasses(this.$container, 'hidden')
                utils.addClasses(this.$loading, 'hidden')
                utils.removeClasses(this.$error, 'hidden')
            };
            GameView.prototype.show = function () {
                utils.addClasses(this.$loading, 'hidden')
                utils.addClasses(this.$error, 'hidden')
                utils.removeClasses(this.$container, 'hidden')
            };

            return GameView;
        })();
    })(app.game = app.game || {});
})(window.app = window.app || {}, $);


(() => {
    const gameApi = new GameApi();
    gameApi.questor.on("unauthorized", function () {
        window.location.replace("../login");
    });
    gameApi.questor.login();
    const gameState = new app.game.GameState(gameApi);
    const $container = document.getElementById('game');
    const $loading = document.getElementById('loading');
    const $error = document.getElementById('loadError');
    new app.game.GameView($container, $loading, $error, gameState);
    gameState.request();
})();
'use strict';

/*
Объявление переменных привяка к DOM

* */

// game.html State

// game.html UI
(function (app, $) {
    (function (game) {
        game.GameView = (function() {
            function getGame() {
                return {
                    $gameCaption: $("#gameCaption"),
                    $switchTimer: $("#switchTimer"),
                    team1: {
                        $container: $("#team1"),
                        $caption: $("#team1Caption"),
                        $players: $("#team1users"),
                        $lives: $("#team1Lives"),
                        $coins: $("#team1Coins")
                    },
                    team2: {
                        $container: $("#team2"),
                        $caption: $("#team2Caption"),
                        $players: $("#team2users"),
                        $lives: $("#team2Lives"),
                        $coins: $("#team2Coins")
                    },
                    mapBuffer: null,
                    $mapCanvas: $("#gameCanvas"),
                    mapCellSize: 25
                };
            }
            function getButtons() {
                return {
                    $btnGameList: $("#btnGameList"),
                    $btnStart: $("#btnStart"),
                    $btnConnect: $("#btnConnect"),
                    $btnConnectPolice: $("#btnConnectPolice"),
                    $btnConnectThief: $("#btnConnectThief"),
                    $btnLeave: $("#btnLeave"),
                    $btnPause: $("#btnPause"),
                    $btnCancel: $("#btnCancel")
                };
            }
            function getImages() {
                return {
                    imgHeart: $('#img_heart').get(0),
                    imgCoin: $('#img_coin').get(0),
                    imgPolice: $('#img_police').get(0),
                    imgPoliceSelf: $('#img_police_self').get(0),
                    imgThief: $('#img_thief').get(0),
                    imgThiefSelf: $('#img_thief_self').get(0),
                    imgSwitch: $('#img_switch').get(0)
                };
            }
            function setMapCanvasSizing($canvas, width, height) {
                return $canvas
                    .css("width", width + "px")
                    .css("height", height + "px")
                    .attr("width", width + "px")
                    .attr("height", height + "px");
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
                    }
                    else {
                        ctx.fillStyle = "#FFFFFF";
                        ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                        ctx.stroke();
                    }
                }
            }
            function getCanvasBuffer(width, height, map, cellSize) {
                var canvas = setMapCanvasSizing($("<canvas/>"), width, height).get(0);
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
                c.captionChanged.add(function (name, status){
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
                var btns = this.btns;
                var $lastKey = -1;
                btns.$btnGameList.click(function () {
                    window.location.replace("index.html");
                });
                btns.$btnStart.click(function () {
                    this.state.game.start();
                }.bind(this));
                btns.$btnConnect.click(function () {
                    this.state.game.join(GameApi.GameTeamRole.random);
                }.bind(this));
                btns.$btnConnectPolice.click(function () {
                    this.state.game.join(GameApi.GameTeamRole.police);
                }.bind(this));
                btns.$btnConnectThief.click(function () {
                    this.state.game.join(GameApi.GameTeamRole.thief);
                }.bind(this));
                btns.$btnLeave.click(function () {
                    this.state.game.leave();
                }.bind(this));
                btns.$btnPause.click(function () {
                    this.state.game.pause();
                }.bind(this));
                btns.$btnCancel.click(function () {
                    this.state.game.cancel();
                }.bind(this));
                $(window).on('keydown', function(event) {
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
                $(window).on('keyup', function() {
                    $lastKey = -1;
                }.bind(this));
            };
            GameView.prototype.toggleRotation = function (status) {
                if (status === GameApi.GameStatus.inProcess) {
                    if (!this.imgRotationTimer) {
                        this.imgRotationTimer = setInterval(function (){
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
                ctx.rotate(this.imgRotationAngle * Math.PI/180);
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
                var ctx = this.game.$mapCanvas.get(0).getContext("2d");
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
                this.game.$gameCaption
                    .empty()
                    .append($(utils.t(
                        "<div class='game-caption-name'>{name} <span class='game-caption-status game-caption-status-{status}'>{statusName}</span></div>",
                        {name: name, status: status, statusName: utils.getStatusName(status)})));
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
                this.game.$switchTimer
                    .empty()
                    .append(utils.t("<span class='{state}'>{m}:{s}</span>",
                        {state: timerState, m: minutes, s: seconds}));
            };
            GameView.prototype.getPlayer = function (player) {
                var status = player.alive ?
                    (player.connected ? "ac" : "ad") :
                    player.connected ? "dc" : "dd";
                return $(utils.t(
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
                    $team.$container.addClass("game-team-winner");
                }
                var role = team.role === GameApi.GameTeamRole.police ? "police" : "thief";
                $team.$container.removeClass("police");
                $team.$container.removeClass("thief");
                $team.$container.addClass(role);
                $team.$caption
                    .empty()
                    .append(utils.t(
                        "<div class='game-team-{role}-caption'>" +
                        "<span class='game-team-name'>{name}</span> " +
                        "<span class='game-team-role game-team-role-{role}'>{roleName}</span>" +
                        "</div>", {
                            role: role,
                            roleName: ROLE_TITLES[team.role] || ROLE_TITLES[team.role],
                            name: team.name
                        }
                    ));
            };
            GameView.prototype.setTeam = function (team, $team) {
                this.setTeamCaption(team, $team);
                $team.$lives.text(team.lives);
                $team.$coins.text(team.coins);
                $team.$players.empty();
                $.each(team.players, function (player) {
                    $team.$players.append(this.getPlayer(team.players[player]));
                }.bind(this));
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
                $team.$lives.text(team.lives);
            };
            GameView.prototype.updateTeamCoins = function (team) {
                var $team = this.getTeam(team);
                $team.$coins.text(team.coins);
            };
            GameView.prototype.setButtons = function (status) {
                status = status || this.state.status;
                var btns = this.btns;
                if (status === GameApi.GameStatus.canceled || status === GameApi.GameStatus.finished) {
                    btns.$btnStart.addClass("hidden");
                    btns.$btnLeave.addClass("hidden");
                    btns.$btnPause.addClass("hidden");
                    btns.$btnCancel.addClass("hidden");
                    btns.$btnConnect.addClass("hidden");
                    btns.$btnConnectThief.addClass("hidden");
                    btns.$btnConnectPolice.addClass("hidden");
                    return;
                }
                var currentUser = this.state.gameApi.questor.user.id;
                var isOwner = currentUser === this.state.owner.id;
                var isAdmin = this.state.gameApi.questor.user.isAdmin;
                var connected = this.state.getPlayer(currentUser) ? true : false;

                if (this.state.status === GameApi.GameStatus.open ||
                    this.state.status === GameApi.GameStatus.ready) {
                    btns.$btnPause.addClass("hidden");
                    if (isOwner) {
                        btns.$btnStart.removeClass("hidden");
                        btns.$btnCancel.removeClass("hidden");
                    }
                    else {
                        btns.$btnStart.addClass("hidden");
                        if (isAdmin) {
                            btns.$btnCancel.removeClass("hidden");
                        } else {
                            btns.$btnCancel.addClass("hidden");
                        }
                    }
                    if (connected) {
                        btns.$btnLeave.removeClass("hidden");
                        btns.$btnConnect.addClass("hidden");
                        btns.$btnConnectThief.addClass("hidden");
                        btns.$btnConnectPolice.addClass("hidden");
                    }
                    else {
                        btns.$btnLeave.addClass("hidden");
                        btns.$btnConnect.removeClass("hidden");
                        btns.$btnConnectThief.removeClass("hidden");
                        btns.$btnConnectPolice.removeClass("hidden");
                    }
                    return;
                }
                if (this.state.status === GameApi.GameStatus.starting ||
                    this.state.status === GameApi.GameStatus.inProcess) {
                    btns.$btnStart.addClass("hidden");
                    btns.$btnLeave.addClass("hidden");
                    btns.$btnConnect.addClass("hidden");
                    btns.$btnConnectThief.addClass("hidden");
                    btns.$btnConnectPolice.addClass("hidden");
                    if (isOwner) {
                        btns.$btnPause.removeClass("hidden");
                        btns.$btnCancel.removeClass("hidden");
                    }
                    else {
                        btns.$btnPause.addClass("hidden");
                        if (isAdmin) {
                            btns.$btnCancel.removeClass("hidden");
                        } else {
                            btns.$btnCancel.addClass("hidden");
                        }
                    }
                }
                else {
                    if (isOwner) {
                        btns.$btnStart.removeClass("hidden");
                        btns.$btnCancel.removeClass("hidden");
                    }
                    else {
                        btns.$btnStart.addClass("hidden");
                        if (isAdmin) {
                            btns.$btnCancel.removeClass("hidden");
                        } else {
                            btns.$btnCancel.addClass("hidden");
                        }
                    }
                    btns.$btnPause.addClass("hidden");
                    btns.$btnLeave.addClass("hidden");
                    btns.$btnConnect.addClass("hidden");
                    btns.$btnConnectThief.addClass("hidden");
                    btns.$btnConnectPolice.addClass("hidden");
                }
            };
            GameView.prototype.showLoading = function () {
                this.$container.addClass("hidden");
                this.$error.addClass("hidden");
                this.$loading.removeClass("hidden");
            };
            GameView.prototype.showError = function () {
                this.$container.addClass("hidden");
                this.$loading.addClass("hidden");
                this.$error.removeClass("hidden");
            };
            GameView.prototype.show = function () {
                this.$loading.addClass("hidden");
                this.$error.addClass("hidden");
                this.$container.removeClass("hidden");
            };

            return GameView;
        })();
    })(app.game = app.game || {});
})(window.app = window.app || {}, $);


(function() {
    var gameApi = new GameApi();
    gameApi.questor.on("unauthorized", function () {
        window.location.replace("../login");
    });
    gameApi.questor.login();
    var gameState = new app.game.GameState(gameApi);
    new app.game.GameView($("#game"), $("#loading"), $("#loadError"), gameState);
    gameState.request();
})();
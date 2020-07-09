'use strict';

// game.html State
(function (app, $) {
    (function (game) {
        game.GameState = (function() {
            function createCallbacks() {
                return {
                    syncing: $.Callbacks(),
                    synced: $.Callbacks(),
                    captionChanged: $.Callbacks(),
                    timerChanged: $.Callbacks(),
                    mapChanged: $.Callbacks(),
                    teamCaptionChanged: $.Callbacks(),
                    teamLivesChanged: $.Callbacks(),
                    teamCoinsChanged: $.Callbacks(),
                    teamPlayersChanged: $.Callbacks(),
                    playerChanged: $.Callbacks(),
                    statusChanged: $.Callbacks(),
                    invalidGame: $.Callbacks()
                };
            }

            function createPlayerFromStats(stats, existingPlayer) {
                var player = existingPlayer || {};
                player.id = stats.userId;
                player.name = stats.login;
                player.coins = stats.coinsCollected;
                player.lives = stats.livesCollected;
                player.deaths = stats.deaths;
                player.alive = stats.alive;
                player.connected = stats.connected;
                player.x = stats.location.x;
                player.y = stats.location.y;
                return player;
            }

            function createTeamFromStats(stats) {
                var team = {};
                team.id = stats.teamId;
                team.name = stats.name;
                team.role = stats.role;
                team.lives = stats.currentLives;
                team.coins = stats.coinsCollected;
                team.winner = stats.winner;
                team.players = {};
                for(var i = 0; i < stats.playerStats.length; i++) {
                    var player = createPlayerFromStats(stats.playerStats[i]);
                    team.players[player.id] = player;
                }

                return team;
            }

            function GameState(gameApi) {
                this.gameApi = gameApi;
                this.callbacks = createCallbacks();
                this.game = null;
                this.name = "";
                this.owner = {};
                this.status = GameApi.GameStatus.open;
                this.millisecondsToSwitch = 0;
                this.millisecondsToSwitchDate = Date.now();
                this.switchTimeout = 0;
                this.switchTimer = null;
                this.teams = {
                    team1: {players: null},
                    ream2: {players: null}
                };
                this.map = {};
            }
            GameState.prototype.request = function () {
                if (!this.game) {
                    this.callbacks.syncing.fire();
                    this.game = this.gameApi.subscribe();
                    this.game.onError(function (error) {
                        console.log(error);
                        if (error) {
                            if (error.error === 'invalidGame') {
                                this.callbacks.synced.fire(false, error);
                            }
                        }
                    }.bind(this));
                    this.listen();
                }
            };
            GameState.prototype.listen = function () {
                this.game.onSync(function (data) {
                    this.sync(data);
                }.bind(this));

                this.game.onStarting(function (data) {
                    this.setStatus(GameApi.GameStatus.starting);
                }.bind(this));

                this.game.onStarted(function (data) {
                    this.setStatus(GameApi.GameStatus.inProcess);
                    this.setMillisecondsToSwitch(data.millisecodsToSwitch);
                }.bind(this));

                this.game.onPaused(function () {
                    this.setStatus(GameApi.GameStatus.paused);
                }.bind(this));

                this.game.onCanceled(function () {
                    this.setStatus(GameApi.GameStatus.canceled);
                }.bind(this));

                this.game.onFinished(function (data) {
                    this.setWinners(data.teamId);
                }.bind(this));

                this.game.onCoinsChanged(function(data) {
                    this.setTeamCoins(data.teamId, data.coins);
                }.bind(this));

                this.game.onLivesChanged(function (data) {
                    this.setTeamLives(data.teamId, data.lives);
                }.bind(this));

                this.game.onCellChanged(function (data) {
                    this.setMapCell(data.x, data.y, data.type);
                }.bind(this));

                this.game.onRolesSwitched(function (data) {
                    var t = data[0];
                    this.setTeamRole(t.teamId, t.role);
                    t = data[1];
                    this.setTeamRole(t.teamId, t.role);
                    this.setMillisecondsToSwitch();
                }.bind(this));

                this.game.onPlayerJoined(function (data) {
                    this.addPlayerFromStats(data.teamId, data.stats);
                }.bind(this));

                this.game.onPlayerLeft(function (data) {
                    this.removePlayer(data.user.id);
                }.bind(this));

                this.game.onPlayerMoved(function (data) {
                    this.movePlayer(data.userId, data.location.x, data.location.y);
                }.bind(this));

                this.game.onPlayerDied(function (data) {
                    this.kill(data.userId);
                }.bind(this));

                this.game.onPlayerRespawned(function (data) {
                    this.respawn(data.userId, data.location.x, data.location.y);
                }.bind(this));

                this.game.onLifeCollected(function (data) {
                    this.addLifeCollected(data.userId);
                }.bind(this));

                this.game.onCoinCollected(function (data) {
                    this.addCoinCollected(data.userId);
                }.bind(this));

                this.game.onAny(function (data) {
                    if (data && data.message) {
                        //console.log('Log:', data.message, data.data);
                    }
                }.bind(this));
            };
            GameState.prototype.setStatus = function (status) {
                this.status = status;
                this.millisecondsToSwitchDate = Date.now();
                this.runTimer();
                this.callbacks.captionChanged.fire(this.name, this.status);
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.mapChanged.fire(this.map);
            };
            GameState.prototype.setTimer = function () {
                if (this.status !== GameApi.GameStatus.inProcess) {
                    return false;
                }
                var msSpend = Date.now() - this.millisecondsToSwitchDate;
                if (msSpend >= this.millisecondsToSwitch) {
                    this.callbacks.timerChanged.fire({m: 0, s: 0, total: 0}, this.switchTimeout);
                    return false;
                }
                var ms = this.millisecondsToSwitch - msSpend;
                this.millisecondsToSwitchDate += msSpend;
                this.millisecondsToSwitch -= msSpend;
                var seconds = Math.floor(ms/1000);
                var minutes = Math.floor(seconds/60);
                seconds = seconds - minutes * 60;
                this.callbacks.timerChanged.fire({m: minutes, s: seconds, total: ms}, this.switchTimeout);
                return true;
            };
            GameState.prototype.runTimer = function () {
                if (this.switchTimer) {
                    clearTimeout(this.switchTimer);
                }
                var timeout = 1000;
                var callback = function () {
                    if (this.setTimer()) {
                        this.switchTimer = setTimeout(callback, timeout);
                    }
                }.bind(this);
                this.switchTimer = setTimeout(callback, 0);
            };
            GameState.prototype.setMillisecondsToSwitch = function (milliseconds) {
                if (milliseconds < 0) {
                    milliseconds = 0;
                }
                this.millisecondsToSwitch = milliseconds || this.switchTimeout;
                this.millisecondsToSwitchDate = Date.now();
                this.runTimer();
            };
            GameState.prototype.setMapCell = function (x, y, type) {
                if (this.map.cells) {
                    var location = this.map.width * y + x;
                    if (location < this.map.cells.length) {
                        this.map.cells[location] = type;
                    }
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.getTeam = function (id) {
                return this.teams[id];
            };
            GameState.prototype.setTeamRole = function (id, role) {
                var team = this.getTeam(id);
                if (team) {
                    team.role = role;
                    this.callbacks.teamCaptionChanged.fire(team);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.setTeamLives = function (id, lives) {
                var team = this.getTeam(id);
                if (team) {
                    team.lives = lives;
                    this.callbacks.teamLivesChanged.fire(team);
                }
            };
            GameState.prototype.setTeamCoins = function (id, coins) {
                var team = this.getTeam(id);
                if (team) {
                    team.coins = coins;
                    this.callbacks.teamCoinsChanged.fire(team);
                }
            };
            GameState.prototype.setWinners = function (id) {
                this.setStatus(GameApi.GameStatus.finished);
                var team = this.getTeam(id);
                if (team) {
                    team.winner = true;
                    this.callbacks.teamCaptionChanged.fire(team);
                }
            };
            GameState.prototype.getPlayer = function (id) {
                return this.teams && this.teams.team1 && this.teams.team2 ?
                    this.teams.team1.players[id] || this.teams.team2.players[id] : null;
            };
            GameState.prototype.removePlayerFromTeam = function (player, team, disconnected) {
                if (disconnected) {
                    player.connected = false;
                    this.callbacks.playerChanged.fire(player, team);
                }
                else {
                    delete team.players[player.id];
                    this.callbacks.teamPlayersChanged.fire(team);
                }
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.mapChanged.fire(this.map);
            };
            GameState.prototype.removePlayer = function (id) {
                var disconnected = this.status !== GameApi.GameStatus.open &&
                    this.status !== GameApi.GameStatus.ready;
                var team = this.teams.team1;
                var player = team ? team.players[id] : null;
                if (player) {
                    this.removePlayerFromTeam(player, team, disconnected);
                }
                else {
                    team = this.teams.team2;
                    player = team ? team.players[id] : null;
                    if (player) {
                        this.removePlayerFromTeam(player, team, disconnected);
                    }
                }
            };
            GameState.prototype.addPlayerFromStats = function (teamId, playerStats) {
                var team = this.getTeam(teamId);
                if (team) {
                    var player = createPlayerFromStats(playerStats);
                    team.players[player.id] = player;
                    this.callbacks.statusChanged.fire(this.status);
                    this.callbacks.teamPlayersChanged.fire(team);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.updatePlayerStats = function (id, stats) {
                var player = this.getPlayer(id);
                if (player) {
                    createPlayerFromStats(stats, player);
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.movePlayer = function (id, x, y) {
                var player = this.getPlayer(id);
                if (player) {
                    player.x = x;
                    player.y = y;
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.kill = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.alive = false;
                    player.deaths += 1;
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.respawn = function (id, x, y) {
                var player = this.getPlayer(id);
                if (player) {
                    player.alive = true;
                    player.x = x;
                    player.y = y;
                    this.callbacks.playerChanged.fire(player);
                    this.callbacks.mapChanged.fire(this.map);
                }
            };
            GameState.prototype.addLifeCollected = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.lives += 1;
                    this.callbacks.playerChanged.fire(player);
                }
            };
            GameState.prototype.addCoinCollected = function (id) {
                var player = this.getPlayer(id);
                if (player) {
                    player.coins += 1;
                    this.callbacks.playerChanged.fire(player);
                }
            };
            GameState.prototype.sync = function (syncData) {
                this.name = syncData.game.name;
                this.owner = syncData.game.owner;
                this.status = syncData.game.status;
                this.millisecondsToSwitch = syncData.game.millisecodsToSwitch;
                this.millisecondsToSwitchDate = Date.now();
                this.switchTimeout = syncData.game.switchTimeout;
                this.map = utils.unpackMap(syncData.game.map);
                this.teams.team1 = createTeamFromStats(syncData.game.team1Stats);
                this.teams[this.teams.team1.id] = this.teams.team1;
                this.teams.team2 = createTeamFromStats(syncData.game.team2Stats);
                this.teams[this.teams.team2.id] = this.teams.team2;

                //Reconnect if connection was lost
                var selfJoined = this.getPlayer(this.gameApi.questor.user.id);
                if (selfJoined) {
                    this.game.join();
                }

                this.runTimer();

                this.callbacks.captionChanged.fire(this.name, this.status);
                this.callbacks.teamCaptionChanged.fire(this.teams.team1);
                this.callbacks.teamCaptionChanged.fire(this.teams.team2);
                this.callbacks.teamLivesChanged.fire(this.teams.team1);
                this.callbacks.teamLivesChanged.fire(this.teams.team2);
                this.callbacks.teamCoinsChanged.fire(this.teams.team1);
                this.callbacks.teamCoinsChanged.fire(this.teams.team2);
                this.callbacks.teamPlayersChanged.fire(this.teams.team1);
                this.callbacks.teamPlayersChanged.fire(this.teams.team2);
                this.callbacks.mapChanged.fire(this.map);
                this.callbacks.statusChanged.fire(this.status);
                this.callbacks.synced.fire(true);
            };

            return GameState;
        })();
    })(app.game = app.game || {});
})(window.app = window.app || {}, $);

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

class GameController {
    callbacks = utils.createCallbacks();
    game = null;
    name = "";
    owner = {};
    status = GameApi.GameStatus.open;
    millisecondsToSwitch = 0;
    millisecondsToSwitchDate = Date.now();
    switchTimeout = 0;
    switchTimer = null;
    teams = {
        team1: {players: null},
        ream2: {players: null}
    };
    map = {};

    constructor(gameApi) {
        this.gameApi = gameApi;
        this.checkLogin();
    }

    checkLogin() {
        this.gameApi.questor.on("unauthorized", function () {
            window.location.replace("../login");
        });
        this.gameApi.questor.login();
    }

    request = () => {
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
    }

    setStatusStarting = () => this.setStatus(GameApi.GameStatus.starting)
    setStatusInProcess = () => this.setStatus(GameApi.GameStatus.inProcess)
    setStatusPaused = () => this.setStatus(GameApi.GameStatus.paused)
    setStatusCanceled = () => this.setStatus(GameApi.GameStatus.canceled)

    listen = () => {
        this.game.onSync(this.sync);
        this.game.onStarting(this.setStatusStarting);
        this.game.onPaused(this.setStatusPaused);
        this.game.onCanceled(this.setStatusCanceled);

        this.game.onStarted((data) => {
            this.setStatusInProcess();
            this.setMillisecondsToSwitch(data.millisecodsToSwitch);
        });


        this.game.onFinished((data) => this.setWinners(data.teamId));

        this.game.onCoinsChanged(data => this.setTeamCoins(data.teamId, data.coins));

        this.game.onLivesChanged(data => this.setTeamLives(data.teamId, data.lives));

        this.game.onCellChanged(data => this.setMapCell(data.x, data.y, data.type));

        this.game.onRolesSwitched(([team1, team2]) => {
            this.setTeamRole(team1.teamId, team1.role);
            this.setTeamRole(team2.teamId, team2.role);
            this.setMillisecondsToSwitch();
        });

        this.game.onPlayerJoined(team => this.addPlayerFromStats(team.teamId, data.stats));

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

        this.game.onCoinCollected(data => this.addCoinCollected(data.userId));

        this.game.onAny((data) => {
            data && console.log('Log:data:', data);
        });
    }

    setStatus = status => {
        this.status = status;
        this.millisecondsToSwitchDate = Date.now();
        this.runTimer();
        this.callbacks.captionChanged.fire(this.name, this.status);
        this.callbacks.statusChanged.fire(this.status);
        this.callbacks.mapChanged.fire(this.map);
    };

    setTimer = () => {
        if (this.status !== GameApi.GameStatus.inProcess) {
            return false;
        }
        let msSpend = Date.now() - this.millisecondsToSwitchDate;
        if (msSpend >= this.millisecondsToSwitch) {
            this.callbacks.timerChanged.fire({m: 0, s: 0, total: 0}, this.switchTimeout);
            return false;
        }
        let ms = this.millisecondsToSwitch - msSpend;
        this.millisecondsToSwitchDate += msSpend;
        this.millisecondsToSwitch -= msSpend;
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds = seconds - minutes * 60;
        this.callbacks.timerChanged.fire({m: minutes, s: seconds, total: ms}, this.switchTimeout);
        return true;
    }

    runTimer = () => {
        if (this.switchTimer) {
            clearTimeout(this.switchTimer);
        }
        const callback = () => {
            if (this.setTimer()) {
                this.switchTimer = setTimeout(callback, 1000);
            }
        };
        this.switchTimer = setTimeout(callback, 0);
    };

    setMillisecondsToSwitch = (milliseconds = 0) => {
        this.millisecondsToSwitch = milliseconds < 0 ? 0 : milliseconds || this.switchTimeout;
        this.millisecondsToSwitchDate = Date.now();
        this.runTimer();
    };

    setMapCell = (x, y, type) => {
        if (this.map.cells) {
            const location = this.map.width * y + x;
            if (location < this.map.cells.length) {
                this.map.cells[location] = type;
            }
            this.callbacks.mapChanged.fire(this.map);
        }
    };

    getTeam = (teamId) => this.teams[teamId];

    setTeamRole = (teamId, role) => {
        const team = this.getTeam(teamId);
        if (team) {
            team.role = role;
            this.callbacks.teamCaptionChanged.fire(team);
            this.callbacks.mapChanged.fire(this.map);
        }
    };

    setTeamLives = (teamId, lives) => {
        const team = this.getTeam(teamId);
        if (team) {
            team.lives = lives;
            this.callbacks.teamLivesChanged.fire(team);
        }
    };


    setTeamCoins = (teamId, coins) => {
        const team = this.getTeam(id);
        if (team) {
            team.coins = coins;
            this.callbacks.teamCoinsChanged.fire(team);
        }
    };

    setWinners = (teamId) => {
        this.setStatus(GameApi.GameStatus.finished);
        const team = this.getTeam(teamId);
        if (team) {
            team.winner = true;
            this.callbacks.teamCaptionChanged.fire(team);
        }
    };

    getPlayer = (playerId) => {
        return this.teams && this.teams.team1 && this.teams.team2 ?
            this.teams.team1.players[playerId] || this.teams.team2.players[playerId] : null;
    };

    removePlayerFromTeam = (player, team, disconnected) => {
        if (disconnected) {
            player.connected = false;
            this.callbacks.playerChanged.fire(player, team);
        } else {
            delete team.players[player.id];
            this.callbacks.teamPlayersChanged.fire(team);
        }
        this.callbacks.statusChanged.fire(this.status);
        this.callbacks.mapChanged.fire(this.map);
    };


    removePlayer = (playerId) => {
        const disconnected = this.status !== GameApi.GameStatus.open &&
            this.status !== GameApi.GameStatus.ready;
        let team = this.teams.team1;
        let player = team ? team.players[playerId] : null;
        if (player) {
            this.removePlayerFromTeam(player, team, disconnected);
        } else {
            team = this.teams.team2;
            player = team ? team.players[playerId] : null;
            player && this.removePlayerFromTeam(player, team, disconnected);
        }
    };
    addPlayerFromStats = (teamId, playerStats) => {
        const team = this.getTeam(teamId);
        if (team) {
            const player = utils.createPlayerFromStats(playerStats);
            team.players[player.id] = player;
            this.callbacks.statusChanged.fire(this.status);
            this.callbacks.teamPlayersChanged.fire(team);
            this.callbacks.mapChanged.fire(this.map);
        }
    };
    updatePlayerStats = (playerId, stats) => {
        var player = this.getPlayer(playerId);
        if (player) {
            utils.createPlayerFromStats(stats, player);
            this.callbacks.playerChanged.fire(player);
            this.callbacks.mapChanged.fire(this.map);
        }
    };
    movePlayer = (playerId, x, y) => {
        const player = this.getPlayer(playerId);
        if (player) {
            player.x = x;
            player.y = y;
            this.callbacks.mapChanged.fire(this.map);
        }
    };
    kill = (playerId) => {
        const player = this.getPlayer(playerId);
        if (player) {
            player.alive = false;
            player.deaths += 1;
            this.callbacks.playerChanged.fire(player);
            this.callbacks.mapChanged.fire(this.map);
        }
    };
    respawn = (playerId, x, y) => {
        const player = this.getPlayer(playerId);
        if (player) {
            player.alive = true;
            player.x = x;
            player.y = y;
            this.callbacks.playerChanged.fire(player);
            this.callbacks.mapChanged.fire(this.map);
        }
    };
    addLifeCollected = (playerId) => {
        const player = this.getPlayer(playerId);
        if (player) {
            player.lives += 1;
            this.callbacks.playerChanged.fire(player);
        }
    };
    addCoinCollected = (playerId) => {
        const player = this.getPlayer(playerId);
        if (player) {
            player.coins += 1;
            this.callbacks.playerChanged.fire(player);
        }
    };

    sync = (syncData) => {
        this.name = syncData.game.name;
        this.owner = syncData.game.owner;
        this.status = syncData.game.status;
        this.millisecondsToSwitch = syncData.game.millisecodsToSwitch;
        this.millisecondsToSwitchDate = Date.now();
        this.switchTimeout = syncData.game.switchTimeout;
        this.map = utils.unpackMap(syncData.game.map);
        this.teams.team1 = utils.createTeamFromStats(syncData.game.team1Stats);
        this.teams[this.teams.team1.id] = this.teams.team1;
        this.teams.team2 = utils.createTeamFromStats(syncData.game.team2Stats);
        this.teams[this.teams.team2.id] = this.teams.team2;

        //Reconnect if connection was lost
        const selfJoined = this.getPlayer(this.gameApi.questor.user.id);
        selfJoined && this.game.join();

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
}

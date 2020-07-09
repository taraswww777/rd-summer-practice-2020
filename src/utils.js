'use strict';
// utilities
const utils = {
    getStatusName: (status) => (
        !status
            ? STATUSES_NAMES.open
            : (STATUSES_NAMES[status] || STATUSES_NAMES.error)
    ),

    canUserCancelGame: (gameApi, gameInfo) => {
        if (gameInfo.status === GameApi.GameStatus.canceled &&
            gameInfo.status === GameApi.GameStatus.finished) {
            return false;
        }
        return gameInfo && gameInfo.owner && gameInfo.owner.id &&
            gameApi && gameApi.questor && gameApi.questor.user &&
            (gameApi.questor.user.isAdmin ||
                gameInfo.owner.id.toLowerCase() === gameApi.questor.user.id.toLowerCase());
    },
    unpackMap: (map) => {
        let i, location, unpacked = [];
        let cellCount = map.width * map.height;
        //fill blanks
        for (i = 0; i < cellCount; i++) {
            unpacked.push(GameApi.MapCellType.empty);
        }
        for (i = 0; i < map.cells.length; i++) {
            var cell = map.cells[i];
            location = cell.location.y * map.width + cell.location.x;
            if (cell.type !== GameApi.MapCellType.policeRespawn &&
                cell.type !== GameApi.MapCellType.thiefRespawn) {
                unpacked[location] = cell.type;
            }
        }

        return { width: map.width, height: map.height, cells: unpacked };
    },
    t: (s, d) => {
        for (let p in d) {
            s = s.replace(new RegExp('{' + p + '}', 'g'), d[p]);
        }
        return s;
    }
}


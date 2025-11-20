const apiUrl = "https://api.steampowered.com";
const storeUrl = "https://store.steampowered.com";

///////////////////////////////////////////////////////////

function getData(url)
{
    const options = {
        "muteHttpExceptions": true,
        "followRedirects": true
    };
    const response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
}

function getUserId()
{
    const idUrl = apiUrl + "/ISteamUser/ResolveVanityURL/v0001/?key=" + config.apiKey +
        "&vanityurl=" + config.username;
    let data = getData(idUrl);
    data = JSON.parse(data);
    return data.response.steamid;
}

let appInfo = new Map();
function getAppInfo(appId)
{
    if (appInfo.has(appId))
    {
        return appInfo.get(appId);
    }

    // Retrieve basic info about this game
    const appInfoUrl = storeUrl + "/api/appdetails/?appids=";
    let gameData = getData(appInfoUrl + appId);
    gameData = JSON.parse(gameData);
    if (gameData[appId].success)
    {
        const gameInfo =
        {
            "name": gameData[appId].data.name,
            "description": gameData[appId].data.short_description,
        };
        appInfo.set(appId, gameInfo);

        return appInfo.get(appId);
    }

    // Fallback to retrieve game name only
    const gameNamesUrl = apiUrl + "/IStoreService/GetAppList/v1/?key=" + config.apiKey + 
        "&include_games=true&include_dlc=true&include_software=true&include_videos=true&include_hardware=true&" +
        "max_results=3&last_appid=";

    let data = getData(gameNamesUrl + (appId - 1));
    data = JSON.parse(data);
    data = new Map(data.response.apps.map(x =>
        [x.appid,
        {
            ...x
        }]
    ));
    appInfo.set(appId, data.get(appId));

    return appInfo.get(appId);
}

function backupProfile()
{
    // Retrieve profile from API
    const userId = getUserId();
    const profileUrl = apiUrl + "/ISteamUser/GetPlayerSummaries/v0002/?key=" +
        config.apiKey + "&steamids=" + userId;
    const playerLevelUrl = apiUrl + "/IPlayerService/GetSteamLevel/v1/?key=" +
        config.apiKey + "&steamid=" + userId;
    const commBadgeUrl = apiUrl + "/IPlayerService/GetCommunityBadgeProgress/v1/?key=" +
        config.apiKey + "&steamid=" + userId;

    let outputData = getData(profileUrl);
    outputData = JSON.parse(outputData);
    let profile = outputData.response.players[0];

    let levelData = getData(playerLevelUrl);
    levelData = JSON.parse(levelData);

    let badgeData = getData(commBadgeUrl);
    badgeData = JSON.parse(badgeData);

    profile = {
        ...profile,
        "player_level": levelData.response.player_level,
        "quests": badgeData.response.quests
    };

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateJsonFile(config.backupDir, config.username + ".json",
        profile);
}

function backupWishlist()
{
    // Retrieve wishlist data
    const userId = getUserId();
    const wishlistUrl = apiUrl + "/IWishlistService/GetWishlist/v0001/?steamid=" + userId;

    // Retrieve wishlist
    let data = getData(wishlistUrl);
    data = JSON.parse(data);

    // Retrieve and add games names to wishlist
    const outputData = data.response.items.map(item =>
    {
        const gameInfo = getAppInfo(item.appid);
        return {
            ...gameInfo,
            ...item
        }
    });

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateJsonFile(config.backupDir, "wishlist.json",
        outputData);
}

function backupGames()
{
    const userId = getUserId();
    const parameters = "key=" + config.apiKey + "&steamid=" + userId;
    const ownedGamesUrl = apiUrl + "/IPlayerService/GetOwnedGames/v0001/?" + 
        "format=json&include_appinfo=true&include_played_free_games=true&include_free_sub=true1&" +
        parameters;
    const achievementUrl = apiUrl + "/ISteamUserStats/GetPlayerAchievements/v1/?" +
        parameters + "&appid=";

    // Retrieve drive folder to save game data in.
    const folder = common.findOrCreateFolder(config.backupDir, "games");
    const backupFolder = folder.getId();

    // Retrieve a meta list of games for service purposes
    const metaListFile =
        common.findOrCreateFile(backupFolder, "meta.list.json", "{}");
    let metaList = common.getJsonFileContent(metaListFile);
    let killList = { ...metaList };

    // Retrieve list of all owned games, with playtimes
    let data = getData(ownedGamesUrl);
    data = JSON.parse(data);

    // Convert returned data to map for later use
    const appIds = data.response.games.map(x => x.appid);
    const playtimeData = new Map(data.response.games.map(x => [x.appid, x]));

    // Retrieve data for all games
    for (const appId of appIds)
    {
        // If the last played date is the same as last time,
        // then we don't need to update the game's data file
        if (metaList[appId] &&
            metaList[appId].last_played ==
            playtimeData.get(appId).rtime_last_played)
        {
            delete killList[appId];
            continue;
        }

        // Retrieve achievements for this game
        let achievementData = getData(achievementUrl + appId);
        achievementData = JSON.parse(achievementData);

        let achievementInfo = {};
        if (achievementData.playerstats.success)
        {
            achievementInfo =
            {
                "achievements": achievementData.playerstats.achievements
            };
        }

        // // Retrieve basic info about this game
        const gameInfo = getAppInfo(appId);

        // Clean up playtime data
        const thisPlaytimeData = { ...playtimeData.get(appId) };
        delete thisPlaytimeData.rtime_last_played;
        delete thisPlaytimeData.appid;
        const playtimeInfo = {
            "last_played": playtimeData.get(appId).rtime_last_played,
            "playtime": { ...thisPlaytimeData }
        };

        // Stitch together previously found data
        const outputData = {
            "appid": appId,
            ...gameInfo,
            ...playtimeInfo,
            ...achievementInfo
        }

        // Save as a json file in the indicated Google Drive folder
        common.updateOrCreateJsonFile(backupFolder, appId + ".json",
            outputData);

        // Update meta list with new info
        metaList[appId] = {
            "appId": appId,
            "last_played": playtimeData.get(appId).rtime_last_played
        };
        delete killList[appId];

        // Write the meta list, so we don't lose anything
        metaListFile.setContent(JSON.stringify(metaList));
    };

    // Delete game data that no longer exist,
    // i.e. on the meta list, but not returned by the API
    if (config.removeMissingGames && Object.keys(killList).length > 0)
    {
        for (const [appId, info] of Object.entries(killList))
        {
            common.deleteFile(backupFolder, appId + ".json");

            // Remove the now-deleted file from the meta list
            delete metaList[appId];

            // Write the meta list, so we don't lose anything
            metaListFile.setContent(JSON.stringify(metaList));
        }
    }
}

function main()
{
    backupProfile();
    backupWishlist();
    backupGames();
}
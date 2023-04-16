const apiUrl = "https://api.steampowered.com/";
const storeUrl = "https://store.steampowered.com/";

///////////////////////////////////////////////////////////

function getData(url)
{
    var options = {
        "muteHttpExceptions": true,
        "followRedirects": true
    };
    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
}

function getUserId()
{
    const idUrl = apiUrl + "ISteamUser/ResolveVanityURL/v0001/?key=" + config.apiKey +
        "&vanityurl=" + config.username;
    var data = getData(idUrl);
    data = JSON.parse(data);
    return data.response.steamid;
}

function backupProfile()
{
    // Retrieve profile from API
    var userId = getUserId();
    const profileUrl = apiUrl + "ISteamUser/GetPlayerSummaries/v0002/?key=" +
        config.apiKey + "&steamids=" + userId;

    var outputData = getData(profileUrl);
    outputData = JSON.parse(outputData);

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, config.username + ".json",
        JSON.stringify(outputData.response, null, 4));
}

function backupWishlist()
{
    // Retrieve wishlist data
    var userId = getUserId();
    const wishlistUrl = storeUrl + "/wishlist/profiles/" +
        userId + "/wishlistdata/?p=";

    // Retrieve pages until no data returned
    var outputData = {};
    var p = 0;
    do
    {
        var data = getData(wishlistUrl + p);
        data = JSON.parse(data);
        outputData = {
            ...outputData,
            ...data
        };
        p++;
    } while (data.length < 1);

    // Remove some fields we don't care about
    for (const key in outputData)
    {
        delete outputData[key].screenshots;
        delete outputData[key].subs;
        delete outputData[key].platform_icons;
    };

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, "wishlist.json",
        JSON.stringify(outputData, null, 4));
}

function backupGames()
{
    var userId = getUserId();
    const parameters = "key=" + config.apiKey + "&steamid=" + userId;
    const ownedGamesUrl = apiUrl + "IPlayerService/GetOwnedGames/v0001/?format=json&" +
        parameters;
    const appInfoUrl = storeUrl + "api/appdetails/?appids=";
    const achievementUrl = apiUrl + "ISteamUserStats/GetPlayerAchievements/v1/?" +
        parameters + "&appid=";
    const gameNamesUrl = apiUrl + "ISteamApps/GetAppList/v2/";

    // Retrieve drive folder to save game data in.
    var folder = common.findOrCreateFolder(config.backupDir, "games");
    var backupFolder = folder.getId();

    // Retrieve a meta list of games for service purposes
    var metaListFile = common.findOrCreateFile(backupFolder, "meta.list.json", "{}");
    var metaList = common.grabJson(metaListFile.getId());
    var killList = common.grabJson(metaListFile.getId());

    // Retrieve list of all owned games, with playtimes
    var data = getData(ownedGamesUrl);
    data = JSON.parse(data);

    // Convert returned data to map for later use
    var appIds = data.response.games.map(x => x.appid);
    var playtimeData = new Map(data.response.games.map(x => [x.appid, x]));

    // Retrieve names of all games
    data = getData(gameNamesUrl);
    data = JSON.parse(data);
    var gameNames = new Map(data.applist.apps.map(x => [x.appid, x]));

    // Retrieve data for all games
    for (const appId of appIds)
    {
        // If the last played date is the same as last time,
        // then we don't need to update the game's data file
        if (metaList[appId] &&
            metaList[appId].last_played == playtimeData.get(appId).rtime_last_played)
        {
            delete killList[appId];
            continue;
        }

        // Retrieve achievements for this game
        var achievementData = getData(achievementUrl + appId);
        achievementData = JSON.parse(achievementData);

        var achievementInfo = {};
        if (achievementData.playerstats.success)
        {
            achievementInfo =
            {
                "achievements": achievementData.playerstats.achievements
            };
        }

        // // Retrieve basic info about this game
        var gameInfo = {};
        if (gameNames.has(appId))
        {
            gameInfo =
            {
                "name": gameNames.get(appId).name,
            };
        }
        // Get name from store, if not in all games list
        else
        {
            // Retrieve basic info about this game
            var gameData = getData(appInfoUrl + appId);
            gameData = JSON.parse(gameData);
            if (gameData[appId].success)
            {
                gameInfo =
                {
                    "name": gameData[appId].data.name,
                    "description": gameData[appId].data.short_description,
                };
            }
        }

        // Clean up playtime data
        var thisPlaytimeData = { ...playtimeData.get(appId) };
        delete thisPlaytimeData.rtime_last_played;
        delete thisPlaytimeData.appid;
        var playtimeInfo = {
            "last_played": playtimeData.get(appId).rtime_last_played,
            "playtime": { ...thisPlaytimeData }
        };

        // Stitch together previously found data
        var outputData = {
            "appid": appId,
            ...gameInfo,
            ...playtimeInfo,
            ...achievementInfo
        }

        // Save as a json file in the indicated Google Drive folder
        common.updateOrCreateFile(backupFolder, appId + ".json",
            JSON.stringify(outputData, null, 4));

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
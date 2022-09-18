const apiUrl = "https://api.steampowered.com/";
const profileUrl = "https://steamcommunity.com/id/";
const storeUrl = "https://store.steampowered.com/api/";

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

function backupPlaytime()
{
    // Retrieve page w/ playtimes
    const playtimeUrl = profileUrl + config.username + "/games/?tab=all&sort=name";
    var playtimePage = getData(playtimeUrl);

    // Parse page for game data
    var playtimeData = playtimePage.match(/var rgGames = (.*);/);
    if (playtimeData.length < 2)
    {
        throw "Failed to fetch valid Steam play times page.";
    }

    // Remove some fields we don't care about
    var outputData = JSON.parse(playtimeData[1]);

    outputData = outputData.map(element =>
    {
        delete element.availStatLinks;
        return element
    });

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, "playtime.json",
        JSON.stringify(outputData, null, 4));
}

function backupWishlist()
{
    // Retrieve wishlist data
    var userId = getUserId();
    const wishlistUrl = "https://store.steampowered.com/wishlist/profiles/" +
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
    const appInfoUrl = storeUrl + "/appdetails/?appids=";
    const achievementUrl = apiUrl + "ISteamUserStats/GetPlayerAchievements/v1/?" +
        parameters + "&appid=";

    // Retrieve list of all owned games, with playtimes
    var data = getData(ownedGamesUrl);
    data = JSON.parse(data);

    // Convert returned data to map for later use
    var appIds = data.response.games.map(x => x.appid);
    var playtimeData = new Map(data.response.games.map(x => [x.appid, x]));

    // Retrieve drive folder to save game data in.
    var folder = common.findOrCreateFolder(config.backupDir, "games");
    var folderId = folder.getId();

    // Retrieve data for all games
    appIds.forEach(appId =>
    {
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

        // Retrieve basic info about this game
        var gameData = getData(appInfoUrl + appId);
        gameData = JSON.parse(gameData);

        var gameInfo = {};
        if (gameData[appId].success)
        {
            gameInfo =
            {
                "name": gameData[appId].data.name,
                "description": gameData[appId].data.short_description,
            };
        }
        // Get name from achievement info, if we couldn't get it from store
        else if (achievementData.playerstats.success)
        {
            gameInfo =
            {
                "name": achievementData.playerstats.gameName
            };
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
        common.updateOrCreateFile(folderId, appId + ".json",
            JSON.stringify(outputData, null, 4));
    });
}

function main()
{
    backupProfile();
    backupPlaytime();
    backupWishlist();
    backupGames();
}